import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Train, MapPin, Calendar, Clock, User, Users,
    ChevronLeft, CreditCard, Armchair, Info, QrCode, WalletCards,
    CheckCircle2, AlertCircle, AlertTriangle, ChevronRight,
    ShoppingBag, ShieldCheck, Zap, Mail, Phone, Copy, IdCard
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { keepPreviousData, useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripApi } from '../api/trip.api';
import { bookingApi } from '../api/booking.api';
import { useAuthStore } from '../store/useAuthStore';
import { useBookingSocket } from '../hooks/useBookingSocket';
import { useSeatSocket } from '../hooks/useSeatSocket';
import {
    Trip,
    BookingResponse,
    Seat,
    SeatStatus,
    PassengerRequest,
    SeatStatusEvent,
    TripItinerary,
} from '../types/api.types';

// Local extension for new backend field
interface EnhancedBookingResponse extends BookingResponse {
    seatNumbers?: string[];
    ticketIds?: number[];
}

interface BookingContact {
    name: string;
    email: string;
    phone: string;
    idCard: string;
}

const redirectUrlKeys = ['payUrl', 'paymentUrl', 'checkoutUrl', 'redirectUrl', 'deeplink', 'shortLink', 'url'];

const normalizeRedirectUrl = (value: unknown) => {
    if (typeof value !== 'string') return null;
    const url = value.trim();
    if (!url) return null;
    return /^[a-z][a-z0-9+.-]*:\/\//i.test(url) || url.startsWith('/') ? url : null;
};

const getPaymentRedirectUrl = (payload: unknown): string | null => {
    const directUrl = normalizeRedirectUrl(payload);
    if (directUrl) return directUrl;

    const seen = new Set<unknown>();
    const visit = (value: unknown): string | null => {
        if (!value || typeof value !== 'object' || seen.has(value)) return null;
        seen.add(value);

        const record = value as Record<string, unknown>;
        for (const key of redirectUrlKeys) {
            const url = normalizeRedirectUrl(record[key]);
            if (url) return url;
        }

        for (const child of Object.values(record)) {
            const url = visit(child);
            if (url) return url;
        }

        return null;
    };

    return visit(payload);
};

const normalizeSeatStatus = (status: SeatStatus | string | undefined) => String(status || '').toUpperCase();

const bookingCodeOf = (booking?: Pick<BookingResponse, 'bookingId' | 'orderNumber'> | null) => {
    return booking?.orderNumber || (booking?.bookingId ? `#${booking.bookingId}` : 'VTT882');
};

const isSeatAvailable = (status: SeatStatus | string | undefined) => normalizeSeatStatus(status) === 'AVAILABLE';

const isSeatHeld = (status: SeatStatus | string | undefined) => {
    return ['HOLD', 'HELD', 'PENDING'].includes(normalizeSeatStatus(status));
};

const parseSegmentIds = (value?: string | number[] | null): number[] => {
    if (!value) return [];
    if (Array.isArray(value)) return value.map(Number).filter(Number.isFinite);
    return String(value)
        .split(',')
        .map(item => Number(item.trim()))
        .filter(Number.isFinite);
};

const hasSegmentOverlap = (left: number[], right: number[]) => {
    if (!left.length || !right.length) return true;
    const rightSet = new Set(right);
    return left.some(segmentId => rightSet.has(segmentId));
};

const getAllSeats = (trip: Trip | undefined): Seat[] => {
    if (!trip) return [];
    const carriageSeats = trip.carriages?.flatMap(carriage => carriage.seats || []) || [];
    return carriageSeats.length > 0 ? carriageSeats : trip.seats || [];
};

const isSeatHeldByCurrentBooking = (
    seat: Pick<Seat, 'id' | 'status' | 'heldByCurrentBooking' | 'holdingBookingId'>,
    currentBookingId?: number | null,
    currentBookingTicketIds: number[] = [],
) => {
    if (currentBookingTicketIds.includes(seat.id)) return true;
    if (seat.heldByCurrentBooking) return true;
    if (currentBookingId && seat.holdingBookingId === currentBookingId) return true;
    return false;
};

const isPendingBookingStatus = (status: string | undefined) => {
    const normalized = String(status || '').toUpperCase();
    return ['PENDING', 'AWAITING_PAYMENT', 'ACTIVE'].includes(normalized);
};

const isQueuedBookingStatus = (status: string | undefined) => {
    return String(status || '').toUpperCase() === 'QUEUED';
};

const STATION_NAME_MAP: Record<string, string> = {
    'ga sai gon': 'Ga Sài Gòn',
    'sai gon': 'Sài Gòn',
    'ga ha noi': 'Ga Hà Nội',
    'ha noi': 'Hà Nội',
    'ga da nang': 'Ga Đà Nẵng',
    'da nang': 'Đà Nẵng',
    'ga hai phong': 'Ga Hải Phòng',
    'hai phong': 'Hải Phòng',
    'ga hue': 'Ga Huế',
    'hue': 'Huế',
    'ga nha trang': 'Ga Nha Trang',
    'nha trang': 'Nha Trang',
    'ga vinh': 'Ga Vinh',
    'vinh': 'Vinh',
    'ga lao cai': 'Ga Lào Cai',
    'lao cai': 'Lào Cai',
};

const formatStationName = (value?: string) => {
    const normalized = String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();
    return STATION_NAME_MAP[normalized] || value || '';
};

const normalizeForMatch = (value?: string) =>
    String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase()
        .trim();

const STOP_STATUS_LABELS: Record<string, string> = {
    SCHEDULED: 'Theo lịch',
    ACTIVE: 'Đang chạy',
    ON_TIME: 'Đúng giờ',
    ARRIVING: 'Sắp đến',
    ARRIVED: 'Đã đến',
    DEPARTED: 'Đã rời ga',
    DELAYED: 'Trễ giờ',
    SKIPPED: 'Bỏ qua',
    CANCELLED: 'Đã hủy',
};

const CARRIAGE_TYPE_NAME_MAP: Record<string, string> = {
    'ghe cung': 'Ghế cứng',
    'ghe cung dieu hoa': 'Ghế cứng điều hòa',
    'ghe mem': 'Ghế mềm',
    'ghe mem dieu hoa': 'Ghế mềm điều hòa',
    'giuong nam': 'Giường nằm',
    'giuong nam khoang 4': 'Giường nằm khoang 4',
    'giuong nam khoang 4 dieu hoa': 'Giường nằm khoang 4 điều hòa',
    'giuong nam khoang 6': 'Giường nằm khoang 6',
    'giuong nam khoang 6 dieu hoa': 'Giường nằm khoang 6 điều hòa',
};

const formatStopStatus = (status?: string | null) => {
    const normalized = String(status || 'SCHEDULED').trim().toUpperCase();
    return STOP_STATUS_LABELS[normalized] || String(status || '').replace(/_/g, ' ');
};

const formatCarriageTypeName = (value?: string) => {
    const raw = String(value || '').trim();
    if (!raw) return '';

    const normalized = normalizeForMatch(raw).replace(/\s+/g, ' ');
    return CARRIAGE_TYPE_NAME_MAP[normalized] || raw;
};

const formatTime = (value?: string | null) => {
    if (!value) return '--:--';

    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) {
        return date.toLocaleTimeString('vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        });
    }

    const match = value.match(/(\d{1,2}):(\d{2})/);
    return match ? `${match[1].padStart(2, '0')}:${match[2]}` : value;
};

const resolveCarriageTypeId = (itinerary?: TripItinerary, carriageTypeName?: string) => {
    const prices = itinerary?.segments?.flatMap(segment => segment.prices || []) || [];
    if (!prices.length) return undefined;

    const currentType = normalizeForMatch(carriageTypeName);
    if (currentType) {
        const matched = prices.find(price => normalizeForMatch(price.carriageTypeName).includes(currentType)
            || currentType.includes(normalizeForMatch(price.carriageTypeName)));
        if (matched?.carriageTypeId) return matched.carriageTypeId;
    }

    return prices[0]?.carriageTypeId;
};

const CCCD_LENGTH = 12;
const normalizeCccd = (value: string) => value.replace(/\D/g, '').slice(0, CCCD_LENGTH);
const isValidCccd = (value: string) => /^\d{12}$/.test(value);
const arePassengersValid = (passengers: PassengerRequest[]) =>
    passengers.length > 0 && passengers.every(p => p.name.trim() && isValidCccd(p.idCard));
const isPassengerValid = (passenger: PassengerRequest) => passenger.name.trim() && isValidCccd(passenger.idCard);

const TicketDetails: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isAuthenticated, fetchUser } = useAuthStore();
    const queryClient = useQueryClient();
    const routeSearchParams = new URLSearchParams(location.search);
    const promoCode = (routeSearchParams.get('promoCode') || routeSearchParams.get('promo') || '').trim();
    const routeDepartureStationId = Number(routeSearchParams.get('departureStationId')) || undefined;
    const routeArrivalStationId = Number(routeSearchParams.get('arrivalStationId')) || undefined;
    const [selectedDepartureStationId, setSelectedDepartureStationId] = useState<number | undefined>(routeDepartureStationId);
    const [selectedArrivalStationId, setSelectedArrivalStationId] = useState<number | undefined>(routeArrivalStationId);
    
    const [step, setStep] = useState(1);
    const [booking, setBooking] = useState<EnhancedBookingResponse | null>(null);
    const [selectedCarIndex, setSelectedCarIndex] = useState(0);
    const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
    const [passengers, setPassengers] = useState<PassengerRequest[]>([]);
    const [activePassengerIndex, setActivePassengerIndex] = useState(0);
    const [bookingContact, setBookingContact] = useState<BookingContact>({
        name: '',
        email: '',
        phone: '',
        idCard: '',
    });
    const [paymentMethod, setPaymentMethod] = useState('');
    const [pendingPaymentMethod, setPendingPaymentMethod] = useState<string | null>(null);
    const [loginError, setLoginError] = useState<string | null>(null);
    const [queuedBookingRequestId, setQueuedBookingRequestId] = useState<string | null>(null);
    const syncedBookingRef = useRef<number | null>(null);
    const currentBookingId = booking?.bookingId;
    const currentBookingTicketIds = booking?.ticketIds || [];

    useEffect(() => {
        if (isAuthenticated && !user?.id) {
            fetchUser();
        }
    }, [fetchUser, isAuthenticated, user?.id]);

    useEffect(() => {
        if (!user) return;
        setBookingContact(prev => ({
            name: prev.name || user.name || '',
            email: prev.email || user.email || '',
            phone: prev.phone || user.phone || '',
            idCard: prev.idCard,
        }));
    }, [user]);

    useEffect(() => {
        if (!passengers.length || (!bookingContact.name && !bookingContact.idCard)) return;
        setPassengers(prev => prev.map((passenger, index) => (
            index === 0 && !passenger.name && !passenger.idCard
                ? { ...passenger, name: bookingContact.name, idCard: bookingContact.idCard }
                : passenger
        )));
    }, [bookingContact.idCard, bookingContact.name, passengers.length]);

    const { data: itinerary, isLoading: itineraryLoading } = useQuery({
        queryKey: ['trip-itinerary', id],
        queryFn: () => tripApi.getTripItinerary(parseInt(id!)),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });

    const itineraryStops = [...(itinerary?.stops || [])].sort((a, b) => a.stopOrder - b.stopOrder);
    const firstRouteStop = itineraryStops[0];
    const lastRouteStop = itineraryStops[itineraryStops.length - 1];
    const effectiveDepartureStationId = selectedDepartureStationId || routeDepartureStationId || firstRouteStop?.stationId;
    const effectiveArrivalStationId = selectedArrivalStationId || routeArrivalStationId || lastRouteStop?.stationId;
    const selectedDepartureStop = itineraryStops.find(stop => stop.stationId === effectiveDepartureStationId);
    const selectedArrivalStop = itineraryStops.find(stop => stop.stationId === effectiveArrivalStationId);
    const selectedRouteIsValid = !!selectedDepartureStop && !!selectedArrivalStop && selectedDepartureStop.stopOrder < selectedArrivalStop.stopOrder;
    const routeScopedDepartureStationId = selectedRouteIsValid ? effectiveDepartureStationId : undefined;
    const routeScopedArrivalStationId = selectedRouteIsValid ? effectiveArrivalStationId : undefined;
    const tripQueryKey = ['trip', id, currentBookingId || 'guest', routeScopedDepartureStationId || 'from', routeScopedArrivalStationId || 'to'];

    useEffect(() => {
        if (routeDepartureStationId) {
            setSelectedDepartureStationId(routeDepartureStationId);
        }
        if (routeArrivalStationId) {
            setSelectedArrivalStationId(routeArrivalStationId);
        }
    }, [routeArrivalStationId, routeDepartureStationId]);

    // Query Trip Details
    const { data: trip, isLoading: tripLoading, isFetching: tripFetching } = useQuery({
        queryKey: tripQueryKey,
        queryFn: () => tripApi.getTripDetails(parseInt(id!), {
            bookingId: currentBookingId,
            departureStationId: routeScopedDepartureStationId,
            arrivalStationId: routeScopedArrivalStationId,
        }),
        enabled: !!id && !!itinerary && selectedRouteIsValid,
        placeholderData: keepPreviousData,
    });

    const quoteCarriageTypeId = resolveCarriageTypeId(itinerary, trip?.carriages?.[selectedCarIndex]?.carriageTypeName);

    const { data: fareQuote } = useQuery({
        queryKey: ['trip-fare', id, effectiveDepartureStationId, effectiveArrivalStationId, quoteCarriageTypeId],
        queryFn: () => tripApi.quoteFare(parseInt(id!), {
            departureStationId: effectiveDepartureStationId!,
            arrivalStationId: effectiveArrivalStationId!,
            carriageTypeId: quoteCarriageTypeId!,
            passengerType: 'ADULT',
        }),
        enabled: !!id && selectedRouteIsValid && !!quoteCarriageTypeId,
        staleTime: 60 * 1000,
    });
    const selectedRouteSegmentIds = useMemo(() => fareQuote?.segmentIds || [], [fareQuote?.segmentIds]);

    useEffect(() => {
        if (!trip || currentBookingId) return;
        const availableSeatIds = new Set(
            getAllSeats(trip)
                .filter(seat => isSeatAvailable(seat.status))
                .map(seat => seat.id),
        );
        setSelectedSeats(prev => prev.filter(seatId => availableSeatIds.has(seatId)));
    }, [currentBookingId, routeScopedArrivalStationId, routeScopedDepartureStationId, trip]);

    const { data: myBookings = [] } = useQuery({
        queryKey: ['my-bookings', 'ticket-details'],
        queryFn: bookingApi.getMyBookings,
        enabled: isAuthenticated,
        staleTime: 30_000,
    });

    const { data: bookingDetail } = useQuery({
        queryKey: ['booking-detail', currentBookingId],
        queryFn: () => bookingApi.getBookingById(currentBookingId!),
        enabled: !!currentBookingId,
        staleTime: 30_000,
    });

    useEffect(() => {
        if (!queuedBookingRequestId) return;

        const queuedBooking = myBookings.find(item => item.requestId === queuedBookingRequestId);
        if (!queuedBooking) return;

        setBooking({
            bookingId: queuedBooking.bookingId,
            requestId: queuedBooking.requestId,
            orderNumber: queuedBooking.orderNumber,
            storageMonth: queuedBooking.storageMonth,
            status: queuedBooking.status,
            originalPrice: queuedBooking.originalPrice,
            promoCode: queuedBooking.promoCode,
            discountAmount: queuedBooking.discountAmount,
            totalPrice: queuedBooking.totalPrice,
            expiredAt: queuedBooking.expiredAt || '',
            seatNumbers: queuedBooking.seatNumbers,
            ticketIds: queuedBooking.ticketIds,
        });
        setQueuedBookingRequestId(null);
        setLoginError(null);
        setPaymentMethod(prev => prev || queuedBooking.paymentMethod?.toLowerCase() || '');
        queryClient.invalidateQueries({ queryKey: ['trip', id] });
    }, [id, myBookings, queryClient, queuedBookingRequestId]);

    useBookingSocket(isAuthenticated ? user?.id : undefined, (event) => {
        if (!event?.requestId || event.requestId !== queuedBookingRequestId) {
            return;
        }

        if (String(event.status || '').toUpperCase() === 'FAILED') {
            setQueuedBookingRequestId(null);
            setPendingPaymentMethod(null);
            setLoginError('Đặt chỗ thất bại. Ghế có thể đã được người khác giữ, vui lòng chọn lại.');
            queryClient.invalidateQueries({ queryKey: ['trip', id] });
            return;
        }

        if (!event.bookingId) {
            return;
        }

        setBooking(event);
        setQueuedBookingRequestId(null);
        setLoginError(null);
        if (event.ticketIds?.length) {
            setSelectedSeats(event.ticketIds);
        }
        queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
        queryClient.invalidateQueries({ queryKey: ['trip', id] });
    });

    useEffect(() => {
        if (!trip || booking || queuedBookingRequestId) return;

        const pendingBooking = myBookings.find(item =>
            item.tripId === trip.id &&
            isPendingBookingStatus(item.status) &&
            item.ticketIds?.length
        );

        if (!pendingBooking) return;

        setBooking({
            bookingId: pendingBooking.bookingId,
            requestId: pendingBooking.requestId,
            orderNumber: pendingBooking.orderNumber,
            storageMonth: pendingBooking.storageMonth,
            status: pendingBooking.status,
            originalPrice: pendingBooking.originalPrice,
            promoCode: pendingBooking.promoCode,
            discountAmount: pendingBooking.discountAmount,
            totalPrice: pendingBooking.totalPrice,
            expiredAt: pendingBooking.expiredAt || '',
            seatNumbers: pendingBooking.seatNumbers,
            ticketIds: pendingBooking.ticketIds,
        });
        setPaymentMethod(prev => prev || pendingBooking.paymentMethod?.toLowerCase() || '');
    }, [booking, myBookings, queuedBookingRequestId, trip]);

    useEffect(() => {
        if (!booking?.bookingId || !booking.ticketIds?.length) return;
        if (syncedBookingRef.current === booking.bookingId) return;

        syncedBookingRef.current = booking.bookingId;
        setSelectedSeats(booking.ticketIds);
        setPassengers(prev => prev.length > 0 ? prev : booking.ticketIds!.map((ticketId, index) => ({
            ticketId,
            name: index === 0 ? bookingContact.name : '',
            idCard: index === 0 ? bookingContact.idCard : '',
        })));
        setActivePassengerIndex(0);
    }, [booking]);

    useEffect(() => {
        if (!bookingDetail?.details?.length) return;

        setBooking(prev => prev && prev.bookingId === bookingDetail.bookingId ? ({
            ...prev,
            requestId: bookingDetail.requestId,
            orderNumber: bookingDetail.orderNumber,
            storageMonth: bookingDetail.storageMonth,
            status: bookingDetail.status,
            originalPrice: bookingDetail.originalPrice,
            promoCode: bookingDetail.promoCode,
            discountAmount: bookingDetail.discountAmount,
            totalPrice: bookingDetail.totalPrice,
            contactName: bookingDetail.contactName,
            contactEmail: bookingDetail.contactEmail,
            contactPhone: bookingDetail.contactPhone,
            contactIdCard: bookingDetail.contactIdCard,
            expiredAt: bookingDetail.expiredAt,
            seatNumbers: bookingDetail.seatNumbers,
            ticketIds: bookingDetail.ticketIds,
        }) : prev);

        setBookingContact(prev => ({
            name: bookingDetail.contactName || prev.name,
            email: bookingDetail.contactEmail || prev.email,
            phone: bookingDetail.contactPhone || prev.phone,
            idCard: bookingDetail.contactIdCard || prev.idCard,
        }));

        setPassengers(bookingDetail.details.map(detail => ({
            ticketId: detail.ticketId,
            name: detail.passengerName || '',
            idCard: detail.passengerIdCard || '',
        })));
    }, [bookingDetail]);

    useEffect(() => {
        if (!trip?.carriages?.length || !currentBookingTicketIds.length) return;

        const carriageIndex = trip.carriages.findIndex(carriage =>
            carriage.seats.some(seat => currentBookingTicketIds.includes(seat.id))
        );

        if (carriageIndex >= 0) {
            setSelectedCarIndex(carriageIndex);
        }
    }, [trip, currentBookingTicketIds]);

    // Realtime seat updates - Update React Query Cache
    const handleSeatUpdate = useCallback((data: SeatStatusEvent) => {
        const eventSegmentIds = parseSegmentIds(data.segmentIds);
        if (eventSegmentIds.length && selectedRouteSegmentIds.length && !hasSegmentOverlap(eventSegmentIds, selectedRouteSegmentIds)) {
            return;
        }

        const eventBelongsToCurrentBooking = !!(
            isSeatHeld(data.status) &&
            ((currentBookingId && data.bookingId === currentBookingId) ||
                (!data.bookingId && currentBookingTicketIds.includes(data.ticketId)))
        );

        queryClient.setQueryData(tripQueryKey, (prevTrip: Trip | undefined) => {
            if (!prevTrip) return prevTrip;
            const newCarriages = [...prevTrip.carriages];
            const carIndex = newCarriages.findIndex(c => c.seats.some(s => s.id === data.ticketId));
            if (carIndex !== -1) {
                newCarriages[carIndex] = {
                    ...newCarriages[carIndex],
                    seats: [...newCarriages[carIndex].seats],
                };
                const seatIndex = newCarriages[carIndex].seats.findIndex(s => s.id === data.ticketId);
                if (seatIndex !== -1) {
                    newCarriages[carIndex].seats[seatIndex] = {
                        ...newCarriages[carIndex].seats[seatIndex],
                        status: data.status,
                        heldByCurrentBooking: eventBelongsToCurrentBooking,
                        holdingBookingId: data.bookingId ?? null,
                    };
                }
            }
            return { ...prevTrip, carriages: newCarriages };
        });

        if (step === 1 && !isSeatAvailable(data.status) && !eventBelongsToCurrentBooking) {
            setSelectedSeats(prev => prev.filter(seatId => seatId !== data.ticketId));
        }
    }, [currentBookingId, currentBookingTicketIds, queryClient, selectedRouteSegmentIds, step, tripQueryKey]);

    useSeatSocket(trip?.id, handleSeatUpdate);

    // Mutations
    const createBookingMutation = useMutation({
        mutationFn: bookingApi.createBooking,
        onSuccess: (res) => {
            if (!res.bookingId && res.requestId && isQueuedBookingStatus(res.status)) {
                setQueuedBookingRequestId(res.requestId);
                setBooking(null);
                if (res.ticketIds?.length) {
                    setSelectedSeats(res.ticketIds);
                }
                setStep(3);
                setLoginError(null);
                queryClient.invalidateQueries({ queryKey: ['my-bookings'] });
                queryClient.invalidateQueries({ queryKey: ['trip', id] });
                return;
            }

            setBooking(res);
            setQueuedBookingRequestId(null);
            if (res.ticketIds?.length) {
                setSelectedSeats(res.ticketIds);
            }
            setStep(3);
            setLoginError(null);
            queryClient.invalidateQueries({ queryKey: ['trip', id] });
        },
        onError: (error: any) => {
            console.error('Booking failed:', error);
            const message = error.response?.data?.message || error.message || "Đặt chỗ thất bại";
            setLoginError(message);
            setQueuedBookingRequestId(null);
            queryClient.invalidateQueries({ queryKey: ['trip', id] });
        }
    });

    const updatePassengersMutation = useMutation({
        mutationFn: ({ bookingId, data }: { bookingId: number, data: any }) => 
            bookingApi.updateBooking(bookingId, data),
        onSuccess: () => setStep(3),
        onError: () => alert("Cập nhật thông tin hành khách thất bại")
    });

    const momoPaymentMutation = useMutation({
        mutationFn: bookingApi.createMomoPayment,
        onSuccess: (res) => {
            const redirectUrl = getPaymentRedirectUrl(res);
            if (redirectUrl) {
                window.location.assign(redirectUrl);
                return;
            }

            alert("Không nhận được liên kết thanh toán MoMo");
        },
        onError: () => alert("Thanh toán MoMo thất bại")
    });

    const vnpayPaymentMutation = useMutation({
        mutationFn: bookingApi.createVnpayPayment,
        onSuccess: (res) => {
            const redirectUrl = getPaymentRedirectUrl(res);
            if (redirectUrl) {
                window.location.assign(redirectUrl);
                return;
            }

            alert("Không nhận được liên kết thanh toán VNPay");
        },
        onError: () => alert("Thanh toán VNPay thất bại")
    });

    const formatPrice = (price: number) => {
        return price.toLocaleString(i18n.language === 'en' ? 'en-US' : 'vi-VN') + 'đ';
    };

    const clearSeatSelectionForRouteChange = () => {
        if (currentBookingId) return;
        setSelectedSeats([]);
        setPassengers([]);
        setActivePassengerIndex(0);
        setLoginError(null);
    };

    const syncRouteToUrl = (departureStationId: number, arrivalStationId: number) => {
        const params = new URLSearchParams(location.search);
        const departureStop = itineraryStops.find(item => item.stationId === departureStationId);
        const arrivalStop = itineraryStops.find(item => item.stationId === arrivalStationId);

        params.set('departureStationId', String(departureStationId));
        params.set('arrivalStationId', String(arrivalStationId));
        if (departureStop?.stationName) params.set('departure', departureStop.stationName);
        if (arrivalStop?.stationName) params.set('arrival', arrivalStop.stationName);

        navigate(
            {
                pathname: location.pathname,
                search: `?${params.toString()}`,
            },
            { replace: true },
        );
    };

    const chooseDepartureStop = (stationId: number) => {
        if (currentBookingId || itineraryStops.length < 2) return;

        const stop = itineraryStops.find(item => item.stationId === stationId);
        if (!stop || stop.stopOrder >= lastRouteStop.stopOrder) return;

        const nextStop = itineraryStops.find(item => item.stopOrder > stop.stopOrder) || lastRouteStop;
        const currentArrival = itineraryStops.find(item => item.stationId === effectiveArrivalStationId);
        const nextArrivalStationId = currentArrival && currentArrival.stopOrder > stop.stopOrder
            ? currentArrival.stationId
            : nextStop.stationId;

        setSelectedDepartureStationId(stop.stationId);
        setSelectedArrivalStationId(nextArrivalStationId);
        syncRouteToUrl(stop.stationId, nextArrivalStationId);
        clearSeatSelectionForRouteChange();
    };

    const chooseArrivalStop = (stationId: number) => {
        if (currentBookingId || itineraryStops.length < 2) return;

        const stop = itineraryStops.find(item => item.stationId === stationId);
        if (!stop || stop.stopOrder <= firstRouteStop.stopOrder) return;

        const previousStop = [...itineraryStops].reverse().find(item => item.stopOrder < stop.stopOrder) || firstRouteStop;
        const currentDeparture = itineraryStops.find(item => item.stationId === effectiveDepartureStationId);
        const nextDepartureStationId = currentDeparture && currentDeparture.stopOrder < stop.stopOrder
            ? currentDeparture.stationId
            : previousStop.stationId;

        setSelectedDepartureStationId(nextDepartureStationId);
        setSelectedArrivalStationId(stop.stationId);
        syncRouteToUrl(nextDepartureStationId, stop.stationId);
        clearSeatSelectionForRouteChange();
    };

    const toggleSeat = (seatId: number) => {
        if (selectedSeats.includes(seatId)) {
            if (currentBookingTicketIds.includes(seatId)) return;
            setSelectedSeats(selectedSeats.filter(s => s !== seatId));
        } else {
            if (currentBookingTicketIds.includes(seatId)) {
                setSelectedSeats(prev => [...prev, seatId]);
                return;
            }
            if (currentBookingId) return;
            if (selectedSeats.length >= 4) return;
            setSelectedSeats([...selectedSeats, seatId]);
        }
    };

    const handleCreateBooking = async () => {
        if (!isAuthenticated) {
            navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
            return;
        }
        if (!trip || selectedSeats.length === 0) return;

        if (booking) {
            const hasPassengerInfo = arePassengersValid(passengers);
            setStep(hasPassengerInfo ? 3 : 2);
            return;
        }

        setPassengers(selectedSeats.map((ticketId, index) => ({
            ticketId,
            name: index === 0 ? bookingContact.name : '',
            idCard: index === 0 ? bookingContact.idCard : '',
        })));
        setActivePassengerIndex(0);
        setLoginError(null);
        setStep(2);
    };

    const updateBookingContact = (field: keyof BookingContact, value: string) => {
        setBookingContact(prev => ({
            ...prev,
            [field]: field === 'idCard' ? normalizeCccd(value) : value,
        }));
    };

    const updatePassenger = (index: number, field: keyof PassengerRequest, value: string) => {
        setPassengers(prev => prev.map((passenger, passengerIndex) => (
            passengerIndex === index
                ? { ...passenger, [field]: field === 'idCard' ? normalizeCccd(value) : value }
                : passenger
        )));
    };

    const applyContactToPassenger = (index: number) => {
        setPassengers(prev => prev.map((passenger, passengerIndex) => (
            passengerIndex === index
                ? {
                    ...passenger,
                    name: bookingContact.name,
                    idCard: bookingContact.idCard,
                }
                : passenger
        )));
        setActivePassengerIndex(index);
    };

    const getBookingContactPayload = () => ({
        contactName: bookingContact.name.trim() || undefined,
        contactEmail: bookingContact.email.trim() || undefined,
        contactPhone: bookingContact.phone.trim() || undefined,
        contactIdCard: isValidCccd(bookingContact.idCard) ? normalizeCccd(bookingContact.idCard) : undefined,
    });

    const handleUpdatePassengers = () => {
        if (!trip) return;
        if (!arePassengersValid(passengers)) {
            const firstInvalidIndex = passengers.findIndex(passenger => !isPassengerValid(passenger));
            if (firstInvalidIndex >= 0) setActivePassengerIndex(firstInvalidIndex);
            return;
        }
        if (!selectedRouteIsValid || !effectiveDepartureStationId || !effectiveArrivalStationId) {
            setLoginError('Vui lòng chọn chặng đi hợp lệ trước khi đặt vé.');
            return;
        }

        const normalizedPassengers = passengers.map(passenger => ({
            ...passenger,
            name: passenger.name.trim(),
            idCard: normalizeCccd(passenger.idCard),
        }));

        if (booking?.bookingId) {
            updatePassengersMutation.mutate({
                bookingId: booking.bookingId,
                data: { passengers: normalizedPassengers, ...getBookingContactPayload() },
            });
            return;
        }

        createBookingMutation.mutate({
            tripId: trip.id,
            departureStationId: effectiveDepartureStationId,
            arrivalStationId: effectiveArrivalStationId,
            ticketIds: selectedSeats,
            ...(promoCode ? { promoCode } : {}),
            ...getBookingContactPayload(),
            passengers: normalizedPassengers,
        });
    };

    const startMomoPayment = () => {
        if (!booking?.bookingId || momoPaymentMutation.isPending) return;
        sessionStorage.setItem('pendingPayment', JSON.stringify({ bookingId: booking.bookingId, orderNumber: booking.orderNumber, method: 'momo' }));
        momoPaymentMutation.mutate(booking.bookingId);
    };

    const startVnpayPayment = () => {
        if (!booking?.bookingId || vnpayPaymentMutation.isPending) return;
        sessionStorage.setItem('pendingPayment', JSON.stringify({ bookingId: booking.bookingId, orderNumber: booking.orderNumber, method: 'vnpay' }));
        vnpayPaymentMutation.mutate(booking.bookingId);
    };

    const handleSelectPaymentMethod = (methodId: string) => {
        setPaymentMethod(methodId);
        setPendingPaymentMethod(prev => prev ? methodId : prev);
    };

    const handleConfirmPayment = () => {
        if (!booking?.bookingId) {
            setPendingPaymentMethod(paymentMethod);
            setLoginError(null);
            return;
        }
        if (paymentMethod === 'momo') {
            startMomoPayment();
            return;
        }
        if (paymentMethod === 'vnpay') {
            startVnpayPayment();
            return;
        }
    };

    useEffect(() => {
        if (!booking?.bookingId || !pendingPaymentMethod) return;

        const method = pendingPaymentMethod;
        setPendingPaymentMethod(null);

        if (method === 'momo') {
            startMomoPayment();
            return;
        }
        if (method === 'vnpay') {
            startVnpayPayment();
        }
    }, [booking?.bookingId, pendingPaymentMethod]);

    const isBookingQueued = !!queuedBookingRequestId && !currentBookingId;
    const isPaymentSubmitting = momoPaymentMutation.isPending || vnpayPaymentMutation.isPending;
    const isSubmitting = createBookingMutation.isPending ||
                       updatePassengersMutation.isPending ||
                       isPaymentSubmitting;

    if (itineraryLoading || (tripLoading && !trip)) return <div className="min-h-screen flex items-center justify-center"><Train className="animate-spin text-tet-red" /></div>;
    if (!trip) return <div className="min-h-screen flex items-center justify-center">Không tìm thấy chuyến tàu</div>;

    const currentCarriage = trip.carriages?.[selectedCarIndex];
    const isSeatAreaLoading = tripFetching && !!trip;
    const departureStationLabel = fareQuote?.departureStationName || routeSearchParams.get('departure') || formatStationName(trip.departureStation);
    const arrivalStationLabel = fareQuote?.arrivalStationName || routeSearchParams.get('arrival') || formatStationName(trip.arrivalStation);
    const allSeats = getAllSeats(trip);
    const selectedSeatDetails = selectedSeats
        .map(ticketId => allSeats.find(seat => seat.id === ticketId))
        .filter(Boolean) as Seat[];
    const seatUnitPrice = fareQuote?.totalPrice;
    const totalPrice = selectedSeatDetails.reduce((total, seat) => total + (seatUnitPrice ?? seat.price ?? 0), 0);
    const payableTotal = booking?.totalPrice ?? totalPrice;
    const originalPrice = booking?.originalPrice ?? totalPrice;
    const discountAmount = booking?.discountAmount ?? 0;
    const appliedPromoCode = booking?.promoCode || promoCode;
    const hasPendingBooking = !!booking && isPendingBookingStatus(booking.status);
    const hasPassengerInfo = arePassengersValid(passengers);
    const routeLineLeft = selectedDepartureStop && itineraryStops.length > 1
        ? ((selectedDepartureStop.stopOrder - 1) / (itineraryStops.length - 1)) * 100
        : 0;
    const routeLineWidth = selectedDepartureStop && selectedArrivalStop && itineraryStops.length > 1
        ? ((selectedArrivalStop.stopOrder - selectedDepartureStop.stopOrder) / (itineraryStops.length - 1)) * 100
        : 0;

    return (
        <main className="min-h-screen bg-[#FDFDFD] flex flex-col">
            <Helmet>
                <title>{t('ticket_details.seo_title', { train: trip.trainCode, from: departureStationLabel, to: arrivalStationLabel })}</title>
            </Helmet>
            <Header />
            {/* Progress Header */}
            <div className="pt-[100px] md:pt-[130px] pb-6 bg-white/80 backdrop-blur-md border-b border-gray-100 sticky top-0 z-40 transition-all">
                <div className="max-w-7xl mx-auto px-4 md:px-12 flex flex-col md:flex-row md:items-center justify-between gap-6">
                    <div className="flex items-center gap-4">
                        <button 
                            onClick={() => step > 1 ? setStep(step - 1) : navigate(-1)} 
                            className="w-10 h-10 rounded-full border border-gray-200 flex items-center justify-center text-gray-500 hover:border-tet-red hover:text-tet-red transition-all bg-white shadow-sm"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <div>
                            <h2 className="text-xl font-black text-gray-900 tracking-tight leading-none mb-1">
                                {trip.trainCode}: {departureStationLabel} → {arrivalStationLabel}
                            </h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
                                <Calendar size={10} /> {trip.departureTime.split('T')[0]} 
                                <span className="w-1 h-1 rounded-full bg-gray-300" />
                                <Clock size={10} /> {trip.departureTime.split('T')[1].substring(0,5)}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-1 md:gap-3 bg-gray-50/50 p-1.5 rounded-2xl border border-gray-100">
                        {[1, 2, 3, 4].map((s) => (
                            <div key={s} className="flex items-center">
                                <div className={cn(
                                    "flex items-center gap-2 px-3 py-1.5 rounded-xl transition-all",
                                    step === s ? "bg-white shadow-sm border border-gray-200" : "opacity-40"
                                )}>
                                    <div className={cn(
                                        "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black",
                                        step >= s ? "bg-tet-red text-white" : "bg-gray-200 text-gray-500"
                                    )}>
                                        {step > s ? <CheckCircle2 size={12} /> : s}
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest hidden lg:block">
                                        {s === 1 ? t('ticket_details.steps.select_seat') : 
                                         s === 2 ? t('ticket_details.steps.info') : 
                                         s === 3 ? t('ticket_details.steps.payment') : t('ticket_details.steps.success')}
                                    </span>
                                </div>
                                {s < 4 && <div className="w-4 md:w-8 h-[2px] bg-gray-200 mx-1 opacity-20" />}
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            <div className="mx-auto w-full max-w-[1600px] px-4 md:px-8 xl:px-10 py-8 flex-grow">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div 
                            key="step1" 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_360px]"
                        >
                            <div className="space-y-8">
                                {itinerary?.stops?.length ? (
                                    <div className="rounded-3xl border border-gray-100 bg-white p-4 md:p-5 shadow-sm">
                                        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-tet-red">Lịch trình</p>
                                                <h3 className="mt-1 text-lg font-black text-gray-900 md:text-xl">
                                                    {departureStationLabel}{' -> '}{arrivalStationLabel}
                                                </h3>
                                            </div>
                                            {fareQuote && (
                                                <div className="rounded-2xl bg-red-50 px-4 py-2.5 text-right">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-tet-red">Giá chặng</p>
                                                    <p className="text-lg font-black text-tet-red">{formatPrice(fareQuote.totalPrice)}</p>
                                                </div>
                                            )}
                                        </div>

                                        <div className="overflow-x-auto pb-2 [scrollbar-width:thin]">
                                            <div className="relative pt-3" style={{ minWidth: Math.max(itineraryStops.length * 112, 560) }}>
                                                <div className="absolute left-12 right-12 top-8 h-1 rounded-full bg-gray-100" />
                                                <div
                                                    className="absolute top-8 h-1 rounded-full bg-tet-red transition-all"
                                                    style={{
                                                        left: `calc(${routeLineLeft}% + ${3 - (routeLineLeft / 100) * 6}rem)`,
                                                        width: `calc(${routeLineWidth}% - ${(routeLineWidth / 100) * 6}rem)`,
                                                    }}
                                                />
                                                <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${itineraryStops.length}, minmax(0, 1fr))` }}>
                                                    {itineraryStops.map((stop, index) => {
                                                        const isDeparture = stop.stationId === effectiveDepartureStationId;
                                                        const isArrival = stop.stationId === effectiveArrivalStationId;
                                                        const inSelectedRoute = selectedDepartureStop && selectedArrivalStop
                                                            && stop.stopOrder > selectedDepartureStop.stopOrder
                                                            && stop.stopOrder < selectedArrivalStop.stopOrder;
                                                        const isFirst = index === 0;
                                                        const isLast = index === itineraryStops.length - 1;
                                                        const arrivalTime = formatTime(stop.estimatedArrivalTime || stop.scheduledArrivalTime || undefined);
                                                        const departureTime = formatTime(stop.estimatedDepartureTime || stop.scheduledDepartureTime || undefined);

                                                        return (
                                                            <div key={stop.id} className="relative min-w-0">
                                                                <div className="relative z-10 mx-auto mb-3 flex h-10 w-10 items-center justify-center">
                                                                    <span
                                                                        className={cn(
                                                                            "flex h-9 w-9 items-center justify-center rounded-full border-2 bg-white text-xs font-black transition",
                                                                            isDeparture || isArrival
                                                                                ? "border-tet-red bg-tet-red text-white shadow-lg shadow-red-100"
                                                                                : inSelectedRoute
                                                                                    ? "border-red-200 bg-red-50 text-tet-red"
                                                                                    : "border-gray-200 text-gray-400"
                                                                        )}
                                                                    >
                                                                        {index + 1}
                                                                    </span>
                                                                </div>

                                                                <div
                                                                    className={cn(
                                                                        "min-w-0 rounded-2xl border bg-white p-2.5 text-center transition",
                                                                        isDeparture || isArrival
                                                                            ? "border-red-100 bg-red-50/70"
                                                                            : inSelectedRoute
                                                                                ? "border-red-100"
                                                                                : "border-gray-100"
                                                                    )}
                                                                >
                                                                    <div className="min-w-0 space-y-2.5">
                                                                        <div className="min-w-0">
                                                                            <div className="flex min-h-10 flex-col items-center justify-start gap-1">
                                                                                <p className="line-clamp-2 text-[13px] font-black leading-4 text-gray-900">{formatStationName(stop.stationName)}</p>
                                                                                {isDeparture && (
                                                                                    <span className="rounded-full bg-tet-red px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                                                                                        Ga đi
                                                                                    </span>
                                                                                )}
                                                                                {isArrival && (
                                                                                    <span className="rounded-full bg-gray-900 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-white">
                                                                                        Ga đến
                                                                                    </span>
                                                                                )}
                                                                            </div>
                                                                            <div className="mt-2 grid grid-cols-2 gap-1 text-[9px] font-black uppercase tracking-widest text-gray-400">
                                                                                <div>
                                                                                    <p>Đến</p>
                                                                                    <p className="mt-0.5 text-[11px] tracking-normal text-gray-900">{arrivalTime}</p>
                                                                                </div>
                                                                                <div>
                                                                                    <p>Rời</p>
                                                                                    <p className="mt-0.5 text-[11px] tracking-normal text-gray-900">{departureTime}</p>
                                                                                </div>
                                                                            </div>
                                                                            <p className="mt-1.5 truncate text-[9px] font-black uppercase tracking-widest text-gray-400">
                                                                                {stop.platform ? `Sân ${stop.platform} - ` : ''}{formatStopStatus(stop.status)}
                                                                            </p>
                                                                        </div>

                                                                        <div className="grid grid-cols-2 gap-1">
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => chooseDepartureStop(stop.stationId)}
                                                                                disabled={currentBookingId !== undefined || isLast}
                                                                                className={cn(
                                                                                    "h-8 rounded-lg px-1.5 text-[9px] font-black uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-35",
                                                                                    isDeparture
                                                                                        ? "bg-tet-red text-white"
                                                                                        : "border border-gray-200 bg-white text-gray-500 hover:border-tet-red hover:text-tet-red"
                                                                                )}
                                                                            >
                                                                                Đi
                                                                            </button>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => chooseArrivalStop(stop.stationId)}
                                                                                disabled={currentBookingId !== undefined || isFirst}
                                                                                className={cn(
                                                                                    "h-8 rounded-lg px-1.5 text-[9px] font-black uppercase tracking-widest transition disabled:cursor-not-allowed disabled:opacity-35",
                                                                                    isArrival
                                                                                        ? "bg-gray-900 text-white"
                                                                                        : "border border-gray-200 bg-white text-gray-500 hover:border-gray-900 hover:text-gray-900"
                                                                                )}
                                                                            >
                                                                                Đến
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : null}

                                {/* Carriage Selector Container */}
                                <div className="space-y-4">
                                    <div className="flex justify-between items-end">
                                        <h4 className="text-[11px] font-black text-gray-400 uppercase tracking-[0.2em]">{t('ticket_details.carriage.select')}</h4>
                                        <span className="text-[10px] font-bold text-tet-red bg-red-50 px-2 py-0.5 rounded-full">{trip.carriages?.length} {t('ticket_details.carriage.total')}</span>
                                    </div>
                                    {hasPendingBooking && (
                                        <div className="p-4 rounded-2xl border border-green-100 bg-green-50 text-green-700 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.25em] mb-1">Đặt chỗ đang giữ</p>
                                                <p className="text-sm font-bold">
                                                    Ghế của bạn vẫn đang được giữ. Kiểm tra lại tại đây hoặc tiếp tục thanh toán.
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => setStep(hasPassengerInfo ? 3 : 2)}
                                                className="px-5 py-3 rounded-xl bg-green-600 text-white text-xs font-black uppercase tracking-widest hover:bg-green-700 transition-all"
                                            >
                                                {hasPassengerInfo ? 'Tiếp tục thanh toán' : 'Tiếp tục nhập thông tin'}
                                            </button>
                                        </div>
                                    )}
                                    <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                                        {trip.carriages?.map((car, idx) => (
                                            <button 
                                                key={idx} 
                                                onClick={() => setSelectedCarIndex(idx)}
                                                className={cn(
                                                    "min-w-[160px] p-4 rounded-2xl border-2 transition-all flex flex-col items-center gap-3 group relative overflow-hidden",
                                                    selectedCarIndex === idx 
                                                        ? "border-tet-red bg-white shadow-xl shadow-red-50" 
                                                        : "border-gray-100 bg-white hover:border-gray-200 text-gray-400 grayscale opacity-60"
                                                )}
                                            >
                                                {selectedCarIndex === idx && (
                                                    <motion.div layoutId="car-glow" className="absolute inset-0 bg-tet-red/5" />
                                                )}
                                                <div className={cn(
                                                    "w-12 h-12 rounded-xl flex items-center justify-center transition-all",
                                                    selectedCarIndex === idx ? "bg-tet-red text-white" : "bg-gray-50 text-gray-300"
                                                )}>
                                                    <Train size={24} />
                                                </div>
                                                <div className="text-center">
                                                    <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", selectedCarIndex === idx ? "text-tet-red" : "text-gray-400")}>
                                                        Toa {car.carriageNumber}
                                                    </p>
                                                    <p className="text-xs font-black text-gray-900 line-clamp-1">{formatCarriageTypeName(car.carriageTypeName)}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Main Seat Selection Grid */}
                                <div className="bg-white p-6 md:p-10 rounded-[3rem] border border-gray-100 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] relative overflow-hidden">
                                    {/* Decoration */}
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-tet-red/[0.02] rounded-full blur-3xl -mr-32 -mt-32" />
                                    {isSeatAreaLoading && (
                                        <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/75 backdrop-blur-sm">
                                            <div className="flex items-center gap-3 rounded-2xl border border-red-100 bg-white px-5 py-4 shadow-xl shadow-red-50">
                                                <Train size={20} className="animate-spin text-tet-red" />
                                                <div>
                                                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-tet-red">Đang tải ghế</p>
                                                    <p className="text-xs font-bold text-gray-400">Cập nhật theo chặng mới</p>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                    
                                    <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                                        <div className="flex items-center gap-3 bg-gray-50 px-5 py-3 rounded-2xl">
                                            <div className="w-8 h-8 bg-white rounded-lg border border-gray-100 flex items-center justify-center text-tet-red font-black text-sm">
                                                {currentCarriage?.carriageNumber}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{t('ticket_details.carriage.active')}</p>
                                                <p className="text-sm font-black text-gray-900">{formatCarriageTypeName(currentCarriage?.carriageTypeName)}</p>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-6">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-gray-100 border border-gray-200" />
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('ticket_details.seats.available')}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-tet-red shadow-sm shadow-tet-red/20" />
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('ticket_details.seats.selected')}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-tet-yellow shadow-sm shadow-tet-yellow/20" />
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Đang giữ</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-gray-900 shadow-sm shadow-gray-900/20" />
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('ticket_details.seats.occupied')}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {hasPendingBooking && (
                                        <div className="mb-8 p-4 rounded-2xl border border-blue-100 bg-blue-50 text-blue-900">
                                            <p className="text-[10px] font-black uppercase tracking-[0.25em] mb-2">Kiểm tra ghế</p>
                                            <p className="text-sm font-bold leading-relaxed">
                                                Ghế trong đơn hiện tại chỉ hiển thị để kiểm tra. Nếu muốn đổi ghế, vui lòng chờ hết thời gian giữ chỗ hoặc hủy đơn và đặt lại.
                                            </p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
                                        {currentCarriage?.seats.map(seat => {
                                            const isSelected = selectedSeats.includes(seat.id);
                                            const isAvailable = isSeatAvailable(seat.status);
                                            const isHeld = isSeatHeld(seat.status);
                                            const isHeldByMe = isSeatHeldByCurrentBooking(seat, currentBookingId, currentBookingTicketIds);
                                            const isSold = !isAvailable && !isHeld && !isHeldByMe;
                                            const canSelectFreshSeat = isAvailable && !currentBookingId;
                                            const canInteract = canSelectFreshSeat || isHeldByMe;
                                            
                                            return (
                                                <motion.button
                                                    key={seat.id}
                                                    whileHover={canInteract && !isSeatAreaLoading ? { y: -4, scale: 1.05 } : {}}
                                                    whileTap={canInteract && !isSeatAreaLoading ? { scale: 0.95 } : {}}
                                                    disabled={isSeatAreaLoading || !canInteract}
                                                    onClick={() => toggleSeat(seat.id)}
                                                    className={cn(
                                                        "group relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-all",
                                                        isHeldByMe
                                                            ? "bg-blue-600 text-white shadow-xl shadow-blue-600/20 ring-4 ring-blue-50"
                                                            : isHeld
                                                                ? "bg-yellow-100 border-2 border-yellow-300 text-yellow-800 shadow-lg shadow-yellow-200/40 cursor-not-allowed"
                                                            : isSold
                                                                ? "bg-gray-900 border-2 border-gray-900 text-white shadow-lg shadow-gray-300/70 cursor-not-allowed opacity-100"
                                                            : !canInteract
                                                                ? "bg-gray-50 border border-transparent opacity-40 cursor-not-allowed"
                                                            : !isAvailable 
                                                                ? "bg-gray-50 border border-transparent opacity-40 cursor-not-allowed" 
                                                                : isSelected 
                                                                    ? "bg-tet-red text-white shadow-xl shadow-tet-red/30 ring-4 ring-red-50" 
                                                                    : "bg-white border-2 border-gray-100 text-gray-500 hover:border-tet-red hover:shadow-lg hover:shadow-tet-red/10"
                                                    )}
                                                >
                                                    <Armchair size={16} className={cn(
                                                        "transition-colors",
                                                        isHeldByMe || isSelected
                                                            ? "text-white"
                                                            : isHeld
                                                                ? "text-yellow-600"
                                                                : isSold
                                                                    ? "text-white"
                                                                : isAvailable
                                                                    ? "text-gray-300 group-hover:text-tet-red"
                                                                    : "text-gray-200"
                                                    )} />
                                                    <span className={cn(
                                                        "text-[10px] font-black",
                                                        isHeldByMe
                                                            ? "text-white"
                                                            : isHeld
                                                                ? "text-yellow-700"
                                                                : isSold
                                                                    ? "text-white"
                                                                : ""
                                                    )}>{seat.seatNumber}</span>
                                                </motion.button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Sidebar Summary */}
                            <div>
                                <div className="sticky top-[240px]">
                                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-[0_24px_48px_-12px_rgba(0,0,0,0.08)] relative overflow-hidden">
                                        <div className="absolute top-0 left-0 w-full h-1 bg-tet-red" />
                                        
                                        <div className="flex items-center gap-3 mb-8">
                                            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-tet-red">
                                                <ShoppingBag size={20} />
                                            </div>
                                            <h3 className="text-lg font-black text-gray-900 tracking-tight">{t('ticket_details.summary.title')}</h3>
                                        </div>

                                        {loginError && (
                                            <div className="mb-6 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-tet-red">
                                                <AlertCircle size={18} className="shrink-0" />
                                                <p className="text-xs font-bold leading-tight">{loginError}</p>
                                            </div>
                                        )}

                                        <div className="space-y-4 mb-8">
                                            <AnimatePresence>
                                                {selectedSeats.length === 0 ? (
                                                    <motion.div 
                                                        initial={{ opacity: 0 }}
                                                        animate={{ opacity: 1 }}
                                                        className="text-center py-10 px-4 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200"
                                                    >
                                                        <Armchair size={32} className="text-gray-200 mx-auto mb-3" />
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-relaxed">
                                                            {t('ticket_details.summary.please_select')}
                                                        </p>
                                                    </motion.div>
                                                ) : (
                                                    selectedSeatDetails.map(seat => (
                                                        <motion.div 
                                                            key={seat.id}
                                                            initial={{ opacity: 0, x: -20 }}
                                                            animate={{ opacity: 1, x: 0 }}
                                                            exit={{ opacity: 0, scale: 0.9 }}
                                                            className="flex items-center justify-between p-3 bg-gray-50/50 rounded-xl border border-gray-100"
                                                        >
                                                            <div className="flex items-center gap-3">
                                                                <div className="w-8 h-8 rounded-lg bg-white border border-gray-100 flex items-center justify-center text-tet-red font-black text-[10px]">
                                                                    {seat.seatNumber}
                                                                </div>
                                                                <span className="text-xs font-bold text-gray-700">Ghế {seat.seatNumber}</span>
                                                            </div>
                                                            <span className="text-xs font-black text-gray-900">{formatPrice(seatUnitPrice ?? seat.price ?? 0)}</span>
                                                        </motion.div>
                                                    ))
                                                )}
                                            </AnimatePresence>
                                        </div>

                                        <div className="pt-6 border-t border-gray-100 space-y-4 mb-8">
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Tạm tính</span>
                                                <span className="text-sm font-bold text-gray-900">{formatPrice(originalPrice)}</span>
                                            </div>
                                            {appliedPromoCode && (
                                                <div className="flex justify-between items-center rounded-xl border border-red-100 bg-red-50 px-3 py-2">
                                                    <span className="text-xs font-black text-tet-red uppercase tracking-widest">
                                                        Mã {appliedPromoCode}
                                                    </span>
                                                    <span className="text-sm font-black text-tet-red">
                                                        {discountAmount > 0 ? `-${formatPrice(discountAmount)}` : 'Áp dụng khi giữ chỗ'}
                                                    </span>
                                                </div>
                                            )}
                                            <div className="flex justify-between items-center">
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Phí dịch vụ</span>
                                                <span className="text-sm font-bold text-gray-900">0đ</span>
                                            </div>
                                            <div className="flex justify-between items-center pt-4 border-t border-gray-50">
                                                <span className="text-sm font-black text-gray-900 uppercase tracking-widest">Tổng cộng</span>
                                                <span className="text-2xl font-black text-tet-red">{formatPrice(payableTotal)}</span>
                                            </div>
                                        </div>

                                        <button 
                                            disabled={selectedSeats.length === 0 || isSubmitting}
                                            onClick={handleCreateBooking}
                                            className="w-full bg-tet-red hover:bg-red-700 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-xl shadow-tet-red/20 transition-all flex items-center justify-center gap-3 disabled:opacity-30 group"
                                        >
                                            {isSubmitting ? (
                                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                            ) : (
                                                <>
                                                    {t('ticket_details.summary.continue')}
                                                    <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                                </>
                                            )}
                                        </button>
                                        
                                        <p className="mt-6 text-center flex items-center justify-center gap-2 text-[9px] font-black text-gray-400 uppercase tracking-[0.1em]">
                                            <ShieldCheck size={12} className="text-green-500" />
                                            Đặt vé an toàn qua Vetautet
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    )}

                    {step === 2 && (
                        <motion.div 
                            key="step2" 
                            initial={{ opacity: 0, scale: 0.98 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="max-w-4xl mx-auto space-y-6"
                        >
                            <div className="text-center space-y-2">
                                <h3 className="text-3xl font-black text-gray-900 tracking-tight">{t('ticket_details.passengers.title')}</h3>
                                <p className="text-gray-500 font-medium">Nhập thông tin người đặt một lần, sau đó gán nhanh cho hành khách nếu người đặt cũng đi tàu.</p>
                            </div>

                            <div className="bg-white p-6 md:p-8 rounded-3xl border border-gray-100 shadow-sm">
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between mb-6">
                                    <div className="flex items-center gap-4">
                                        <div className="w-11 h-11 rounded-xl bg-red-50 text-tet-red flex items-center justify-center">
                                            <User size={20} />
                                        </div>
                                        <div>
                                            <h4 className="text-base font-black text-gray-900">Thông tin người đặt</h4>
                                            <p className="text-xs font-bold text-gray-400">Dùng để liên hệ và có thể sao chép cho ghế người đặt sử dụng.</p>
                                        </div>
                                    </div>
                                    <span className="rounded-full bg-gray-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        Nhập một lần
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Họ và tên người đặt</label>
                                        <div className="relative">
                                            <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                                            <input
                                                type="text"
                                                placeholder="Ví dụ: Nguyễn Văn A"
                                                className="w-full pl-11 pr-4 py-4 bg-gray-50/50 rounded-xl border border-gray-100 focus:bg-white focus:border-tet-red focus:ring-4 focus:ring-tet-red/5 outline-none transition-all font-bold text-sm"
                                                value={bookingContact.name}
                                                onChange={e => updateBookingContact('name', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Số điện thoại</label>
                                        <div className="relative">
                                            <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                                            <input
                                                type="tel"
                                                placeholder="Số điện thoại liên hệ"
                                                className="w-full pl-11 pr-4 py-4 bg-gray-50/50 rounded-xl border border-gray-100 focus:bg-white focus:border-tet-red focus:ring-4 focus:ring-tet-red/5 outline-none transition-all font-bold text-sm"
                                                value={bookingContact.phone}
                                                onChange={e => updateBookingContact('phone', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Email</label>
                                        <div className="relative">
                                            <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                                            <input
                                                type="email"
                                                placeholder="Email nhận thông báo"
                                                className="w-full pl-11 pr-4 py-4 bg-gray-50/50 rounded-xl border border-gray-100 focus:bg-white focus:border-tet-red focus:ring-4 focus:ring-tet-red/5 outline-none transition-all font-bold text-sm"
                                                value={bookingContact.email}
                                                onChange={e => updateBookingContact('email', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">CCCD người đặt</label>
                                        <div className="relative">
                                            <IdCard size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-300" />
                                            <input
                                                type="text"
                                                inputMode="numeric"
                                                pattern="\d{12}"
                                                maxLength={CCCD_LENGTH}
                                                placeholder="Nhập nếu người đặt đi tàu"
                                                className={cn(
                                                    "w-full pl-11 pr-4 py-4 bg-gray-50/50 rounded-xl border focus:bg-white focus:ring-4 focus:ring-tet-red/5 outline-none transition-all font-bold text-sm",
                                                    bookingContact.idCard && !isValidCccd(bookingContact.idCard) ? "border-tet-red" : "border-gray-100 focus:border-tet-red"
                                                )}
                                                value={bookingContact.idCard}
                                                onChange={e => updateBookingContact('idCard', e.target.value)}
                                            />
                                        </div>
                                        {bookingContact.idCard && !isValidCccd(bookingContact.idCard) && (
                                            <p className="text-[11px] font-bold text-tet-red px-1">CCCD phải gồm đúng 12 chữ số.</p>
                                        )}
                                    </div>
                                </div>
                            </div>

                            <div className="space-y-4">
                                <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                    <div>
                                        <h4 className="text-base font-black text-gray-900">Hành khách theo ghế</h4>
                                        <p className="text-xs font-bold text-gray-400">Mỗi vé cần đúng tên và CCCD của người sử dụng ghế.</p>
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">
                                        {passengers.filter(passenger => isPassengerValid(passenger)).length}/{passengers.length} đã đủ
                                    </span>
                                </div>
                                {passengers.map((p, i) => (
                                    <motion.div 
                                        key={p.ticketId} 
                                        initial={{ opacity: 0, x: -20, delay: i * 0.1 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        onFocusCapture={() => setActivePassengerIndex(i)}
                                        className={cn(
                                            "bg-white p-5 md:p-6 rounded-3xl border shadow-sm relative overflow-hidden transition-all",
                                            activePassengerIndex === i ? "border-red-100 ring-4 ring-red-50" : "border-gray-100"
                                        )}
                                    >
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-tet-red" />
                                        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
                                            <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-tet-red font-black">
                                                {isPassengerValid(p) ? <CheckCircle2 size={20} /> : i + 1}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-gray-900">Thông tin hành khách</h4>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ghế {p.ticketId}</p>
                                            </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => applyContactToPassenger(i)}
                                                disabled={!bookingContact.name && !bookingContact.idCard}
                                                className="inline-flex items-center gap-2 self-start rounded-full bg-red-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-tet-red transition-all hover:bg-red-100 disabled:opacity-40 disabled:cursor-not-allowed"
                                            >
                                                <Copy size={13} />
                                                Dùng thông tin người đặt
                                            </button>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Họ và tên</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Ví dụ: Nguyễn Văn A" 
                                                    className="w-full px-5 py-4 bg-gray-50/50 rounded-xl border border-gray-100 focus:bg-white focus:border-tet-red focus:ring-4 focus:ring-tet-red/5 outline-none transition-all font-bold text-sm"
                                                    value={p.name}
                                                    onChange={e => updatePassenger(i, 'name', e.target.value)}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Số CCCD</label>
                                                <input 
                                                    type="text" 
                                                    inputMode="numeric"
                                                    pattern="\d{12}"
                                                    maxLength={CCCD_LENGTH}
                                                    placeholder="Nhập 12 số CCCD" 
                                                    className={cn(
                                                        "w-full px-5 py-4 bg-gray-50/50 rounded-xl border focus:bg-white focus:ring-4 focus:ring-tet-red/5 outline-none transition-all font-bold text-sm",
                                                        p.idCard && !isValidCccd(p.idCard) ? "border-tet-red" : "border-gray-100 focus:border-tet-red"
                                                    )}
                                                    value={p.idCard}
                                                    onChange={e => updatePassenger(i, 'idCard', e.target.value)}
                                                />
                                                {p.idCard && !isValidCccd(p.idCard) && (
                                                    <p className="text-[11px] font-bold text-tet-red px-1">CCCD phải gồm đúng 12 chữ số.</p>
                                                )}
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            <button 
                                onClick={handleUpdatePassengers}
                                disabled={isSubmitting || !arePassengersValid(passengers)}
                                className="w-full bg-tet-red text-white py-6 rounded-2xl font-black uppercase text-sm tracking-[0.2em] shadow-2xl shadow-tet-red/30 transition-all flex items-center justify-center gap-3 disabled:opacity-30"
                            >
                                {isSubmitting ? <Train className="animate-spin" /> : 'Xác nhận thông tin hành khách'}
                            </button>
                        </motion.div>
                    )}

                    {step === 3 && (
                        <motion.div 
                            key="step3" 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="max-w-3xl mx-auto space-y-8"
                        >
                             <div className="text-center space-y-2">
                                <h3 className="text-3xl font-black text-gray-900 tracking-tight">{t('ticket_details.payment.title')}</h3>
                                <p className="text-gray-500 font-medium">Chọn cổng thanh toán an toàn để hoàn tất đặt vé.</p>
                            </div>

                            {isBookingQueued && (
                                <div className="p-5 rounded-2xl border border-blue-100 bg-blue-50 text-blue-900 flex items-start gap-4">
                                    <Info className="shrink-0 mt-0.5" size={20} />
                                    <div>
                                        <p className="text-xs font-black uppercase tracking-[0.2em] mb-1">Yêu cầu đã tiếp nhận</p>
                                        <p className="text-sm font-bold leading-relaxed">
                                            Bạn có thể chọn phương thức thanh toán. Hệ thống sẽ tự mở nút thanh toán khi đặt chỗ sẵn sàng.
                                        </p>
                                        {queuedBookingRequestId && (
                                            <p className="mt-2 text-[10px] font-black text-blue-500 uppercase tracking-widest">
                                                Request: {queuedBookingRequestId}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                                {[
                                    { id: 'momo', name: 'Ví MoMo', desc: 'Thanh toán bằng ví MoMo thử nghiệm', Icon: WalletCards, tone: 'text-[#A50064] bg-[#A50064]/10 border-[#A50064]/20' },
                                    { id: 'vnpay', name: 'VNPAY QR', desc: 'Quét QR hoặc thanh toán bằng thẻ ngân hàng', Icon: QrCode, tone: 'text-tet-red bg-red-50 border-red-100' }
                                ].map(m => (
                                    <button 
                                        key={m.id} 
                                        onClick={() => handleSelectPaymentMethod(m.id)}
                                        disabled={isSubmitting}
                                        className={cn(
                                            "p-5 rounded-2xl border transition-all flex items-center gap-4 text-left bg-white group disabled:cursor-not-allowed",
                                            paymentMethod === m.id 
                                                ? "border-tet-red shadow-lg shadow-tet-red/10 ring-4 ring-red-50" 
                                                : "border-gray-100 hover:border-red-200 hover:shadow-md"
                                        )}
                                    >
                                        <div className={cn(
                                            "w-14 h-14 rounded-xl border flex items-center justify-center transition-all shrink-0",
                                            m.tone
                                        )}>
                                            {(m.id === 'momo' && momoPaymentMutation.isPending) || (m.id === 'vnpay' && vnpayPaymentMutation.isPending) ? (
                                                <Train className="animate-spin text-tet-red" />
                                            ) : <m.Icon size={26} />}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <div className="flex items-center gap-2">
                                                <span className="text-sm font-black text-gray-900 uppercase tracking-widest">{m.name}</span>
                                                {paymentMethod === m.id && (
                                                    <CheckCircle2 size={18} className="text-tet-red shrink-0" />
                                                )}
                                            </div>
                                            <p className="text-xs font-bold text-gray-400 mt-1">{m.desc}</p>
                                        </div>
                                    </button>
                                ))}
                            </div>

                            <div className="bg-white border border-gray-100 p-6 md:p-8 rounded-2xl shadow-[0_18px_45px_-24px_rgba(0,0,0,0.22)]">
                                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Tổng thanh toán</p>
                                        <h4 className="text-4xl font-black text-gray-900">{formatPrice(payableTotal)}</h4>
                                        {discountAmount > 0 && (
                                            <p className="mt-2 text-xs font-black uppercase tracking-widest text-tet-red">
                                                Đã giảm {formatPrice(discountAmount)} với mã {appliedPromoCode}
                                            </p>
                                        )}
                                    </div>
                                    <div className="sm:text-right">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Số vé</p>
                                        <h4 className="text-xl font-black text-gray-900">
                                            {selectedSeats.length} vé
                                        </h4>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleConfirmPayment}
                                    disabled={!paymentMethod || isSubmitting}
                                    className="w-full bg-tet-red hover:bg-red-700 text-white py-5 rounded-xl font-black uppercase text-sm tracking-[0.2em] shadow-lg shadow-tet-red/20 transition-all flex items-center justify-center gap-3 disabled:bg-gray-100 disabled:text-gray-400 disabled:shadow-none disabled:cursor-not-allowed"
                                >
                                    {isPaymentSubmitting ? (
                                        <Train className="animate-spin" />
                                    ) : pendingPaymentMethod && isBookingQueued ? (
                                        `Đang chờ ${pendingPaymentMethod.toUpperCase()}`
                                    ) : isBookingQueued ? (
                                        'Thanh toán khi đặt chỗ sẵn sàng'
                                    ) : (
                                        'Xác nhận và thanh toán'
                                    )}
                                </button>
                                {!paymentMethod && (
                                    <p className="mt-3 text-center text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                        Vui lòng chọn phương thức thanh toán
                                    </p>
                                )}
                            </div>
                        </motion.div>
                    )}

                    {step === 4 && (
                        <motion.div 
                            key="step4" 
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            className="text-center py-20 max-w-lg mx-auto bg-white p-12 rounded-[3.5rem] border border-gray-100 shadow-2xl shadow-green-500/5 relative overflow-hidden"
                        >
                            <div className="absolute -top-24 -left-24 w-48 h-48 bg-green-500/5 rounded-full blur-3xl" />
                            
                            <div className="relative z-10 space-y-8">
                                <div className="w-24 h-24 bg-green-50 rounded-full flex items-center justify-center text-green-500 mx-auto shadow-inner">
                                    <CheckCircle2 size={48} />
                                </div>
                                <div className="space-y-3">
                                    <h2 className="text-4xl font-black text-gray-900 tracking-tight leading-tight">Đặt vé <br /> thành công!</h2>
                                    <p className="text-gray-500 font-bold px-4">Vé của bạn đã được phát hành và gửi tới email.</p>
                                </div>
                                <div className="p-6 bg-gray-50 rounded-3xl border border-gray-100 space-y-4">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Mã đặt chỗ</p>
                                        <p className="text-3xl font-black text-tet-red">{bookingCodeOf(booking)}</p>
                                    </div>
                                    {booking?.seatNumbers && (
                                        <div className="pt-4 border-t border-gray-200">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em] mb-2">Ghế đã cấp</p>
                                            <div className="flex flex-wrap justify-center gap-2">
                                                {booking.seatNumbers.map(sn => (
                                                    <span key={sn} className="px-3 py-1 bg-tet-red text-white rounded-lg font-black text-xs shadow-sm">
                                                        {sn}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>
                                <div className="flex flex-col gap-3">
                                    <button onClick={() => navigate('/orders')} className="w-full bg-gray-900 text-white py-5 rounded-2xl font-black uppercase text-xs tracking-widest shadow-xl shadow-gray-200">Xem vé của tôi</button>
                                    <button onClick={() => navigate('/')} className="w-full bg-white text-gray-500 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest">Về trang chủ</button>
                                </div>
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            <Footer />
        </main>
    );
};

export default TicketDetails;
