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
import { applyPassengerFareRule, buildPassengerTypeMeta } from '../lib/passengerFareRules';
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
    return ['HOLD', 'HELD', 'PENDING', 'QUEUED'].includes(normalizeSeatStatus(status));
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

type PassengerTypeCode = 'ADULT' | 'CHILD' | 'SENIOR' | 'STUDENT';

interface PassengerSlot {
    type: PassengerTypeCode;
    label: string;
    discountLabel?: string;
}

const MAX_PASSENGER_SEATS = 10;
const PASSENGER_INFO_TIMEOUT_MS = 8 * 60 * 1000;

const PASSENGER_TYPE_META: Record<PassengerTypeCode, { label: string; discountLabel?: string }> = {
    ADULT: { label: 'Người lớn' },
    CHILD: { label: 'Trẻ em', discountLabel: '-25%' },
    SENIOR: { label: 'Người cao tuổi', discountLabel: '-15%' },
    STUDENT: { label: 'Sinh viên', discountLabel: '-10%' },
};

const PASSENGER_TYPE_ORDER: PassengerTypeCode[] = ['ADULT', 'CHILD', 'SENIOR', 'STUDENT'];

const PASSENGER_TYPE_SUB_LABELS: Record<PassengerTypeCode, string> = {
    ADULT: 'Từ 10 - 59 tuổi',
    CHILD: '6 - 9 tuổi',
    SENIOR: 'Từ 60 tuổi',
    STUDENT: 'Thẻ SV',
};

const PASSENGER_TYPE_NOTES: Partial<Record<PassengerTypeCode, string>> = {
    ADULT: 'Một người lớn được kèm 1 trẻ dưới 6 tuổi miễn vé, ngồi chung chỗ.',
    SENIOR: 'Người cao tuổi áp dụng cho công dân Việt Nam từ 60 tuổi.',
    STUDENT: 'Sinh viên cần giấy tờ hợp lệ khi đi tàu.',
};

const readPassengerCount = (params: URLSearchParams, keys: string[], fallback = 0) => {
    const rawValue = keys.map((key) => params.get(key)).find((value) => value !== null);
    const parsed = Number(rawValue ?? fallback);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.floor(parsed);
};

const buildPassengerSlotsFromSearch = (params: URLSearchParams): PassengerSlot[] => {
    let adult = readPassengerCount(params, ['passenger_adult', 'adults'], 0);
    const child = readPassengerCount(params, ['passenger_child', 'childs', 'children'], 0);
    const senior = readPassengerCount(params, ['passenger_senior', 'elderlys', 'seniors'], 0);
    const student = readPassengerCount(params, ['passenger_student', 'students'], 0);
    const explicitTotal = readPassengerCount(params, ['passengers', 'totalTicket'], 0);
    const breakdownTotal = adult + child + senior + student;

    if (!breakdownTotal) {
        adult = explicitTotal || 1;
    } else if (explicitTotal > breakdownTotal) {
        adult += explicitTotal - breakdownTotal;
    }

    const slots: PassengerSlot[] = [];
    const appendSlots = (type: PassengerTypeCode, count: number) => {
        const meta = PASSENGER_TYPE_META[type];
        for (let index = 1; index <= count && slots.length < MAX_PASSENGER_SEATS; index += 1) {
            slots.push({
                type,
                label: `${meta.label} ${index}`,
                discountLabel: meta.discountLabel,
            });
        }
    };

    appendSlots('ADULT', adult);
    appendSlots('CHILD', child);
    appendSlots('SENIOR', senior);
    appendSlots('STUDENT', student);

    return slots.length ? slots : [{ type: 'ADULT', label: 'Người lớn 1' }];
};

const buildPassengerSlotsForCount = (count: number, existingSlots: PassengerSlot[]) => {
    if (count <= existingSlots.length) return existingSlots.slice(0, count);

    const slots = [...existingSlots];
    let adultIndex = slots.filter(slot => slot.type === 'ADULT').length;
    while (slots.length < count && slots.length < MAX_PASSENGER_SEATS) {
        adultIndex += 1;
        slots.push({ type: 'ADULT', label: `Người lớn ${adultIndex}` });
    }
    return slots;
};

type PassengerCounts = Record<PassengerTypeCode, number>;

const relabelPassengerSlots = (
    slots: PassengerSlot[],
    metaByType: Record<PassengerTypeCode, { label: string; discountLabel?: string }>,
) => {
    const counters = {} as PassengerCounts;
    return slots.map((slot) => {
        counters[slot.type] = (counters[slot.type] || 0) + 1;
        const meta = metaByType[slot.type] || PASSENGER_TYPE_META[slot.type];
        return {
            ...slot,
            label: `${meta.label} ${counters[slot.type]}`,
            discountLabel: meta.discountLabel,
        };
    });
};

const formatDiscountBadge = (discountLabel?: string) => {
    if (!discountLabel) return '';
    return `Giảm ${discountLabel.replace(/^-/, '')}`;
};

const countPassengerSlots = (slots: PassengerSlot[]): PassengerCounts => (
    PASSENGER_TYPE_ORDER.reduce((counts, type) => {
        counts[type] = slots.filter(slot => slot.type === type).length;
        return counts;
    }, {} as PassengerCounts)
);

const totalPassengerCount = (counts: PassengerCounts) =>
    PASSENGER_TYPE_ORDER.reduce((total, type) => total + (counts[type] || 0), 0);

const formatPassengerBreakdown = (
    counts: PassengerCounts,
    metaByType: Record<PassengerTypeCode, { label: string }> = PASSENGER_TYPE_META,
) => {
    const items = PASSENGER_TYPE_ORDER
        .filter(type => counts[type] > 0)
        .map(type => `${counts[type]} ${metaByType[type].label.toLowerCase()}`);
    return items.join(', ');
};

const formatCriteriaDate = (value?: string | null) => {
    if (!value) return 'Chưa chọn';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('vi-VN', {
        weekday: 'long',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
};

const formatCountdown = (seconds: number) => {
    const safeSeconds = Math.max(0, Math.floor(seconds));
    const minutes = Math.floor(safeSeconds / 60);
    const remainingSeconds = safeSeconds % 60;
    return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
};

const formatTravelDateShort = (value?: string | null) => {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    const weekday = date.toLocaleDateString('vi-VN', { weekday: 'long' });
    const formattedDate = date.toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' });
    return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)}, ${formattedDate}`;
};

type TripCarriage = NonNullable<Trip['carriages']>[number];

const getCarriageAvailableSeatCount = (carriage?: TripCarriage) =>
    carriage?.seats?.filter(seat => isSeatAvailable(seat.status)).length || 0;

const getCarriageMinSeatPrice = (carriage?: TripCarriage) => {
    const prices = carriage?.seats
        ?.filter(seat => isSeatAvailable(seat.status))
        .map(seat => Number(seat.price || 0))
        .filter(price => price > 0) || [];
    return prices.length ? Math.min(...prices) : 0;
};

const formatCarriageNumberLabel = (value?: string | number) => {
    const raw = String(value ?? '').trim();
    if (!raw) return 'Toa';
    return normalizeForMatch(raw).startsWith('toa') ? raw : `Toa ${raw}`;
};

const CHILD_CARRIAGE_VALIDATION_MESSAGE = 'Trẻ em phải ngồi cùng toa với ít nhất một người lớn.';

const carriageKeyOf = (value?: string | number) => String(value ?? '').trim().toUpperCase();

const findSeatCarriage = (trip?: Trip | null, seatId?: number) => {
    if (!trip || !seatId) return undefined;
    return trip.carriages?.find(carriage => carriage.seats?.some(seat => seat.id === seatId));
};

const getSeatPlaceLabel = (trip?: Trip | null, seat?: Seat) => {
    if (!seat) return '';
    const carriage = findSeatCarriage(trip, seat.id);
    const carriageLabel = carriage ? formatCarriageNumberLabel(carriage.carriageNumber) : '';
    return [carriageLabel, `Ghế ${seat.seatNumber}`].filter(Boolean).join(' - ');
};

const calculatePassengerFareFromItinerary = (
    itinerary: TripItinerary | undefined,
    segmentIds: number[],
    carriageTypeId: number | undefined,
    passengerType: PassengerTypeCode,
    passengerFareRules: Parameters<typeof applyPassengerFareRule>[1],
) => {
    if (!itinerary || !segmentIds.length || !carriageTypeId) return undefined;
    const segments = itinerary.segments?.filter(segment => segmentIds.includes(segment.id)) || [];
    if (segments.length !== segmentIds.length) return undefined;

    const adultPrices = segments
        .map(segment => (segment.prices || []).find(price => (
            price.carriageTypeId === carriageTypeId
            && String(price.passengerType || 'ADULT').toUpperCase() === 'ADULT'
            && String(price.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
        ))?.price)
        .filter((price): price is number => typeof price === 'number' && Number.isFinite(price));
    if (adultPrices.length === segments.length) {
        return adultPrices.reduce((total, price) => total + applyPassengerFareRule(price, passengerFareRules, passengerType), 0);
    }

    const directPrices = segments
        .map(segment => (segment.prices || []).find(price => (
            price.carriageTypeId === carriageTypeId
            && String(price.passengerType || 'ADULT').toUpperCase() === passengerType
            && String(price.status || 'ACTIVE').toUpperCase() === 'ACTIVE'
        ))?.price)
        .filter((price): price is number => typeof price === 'number' && Number.isFinite(price));
    return directPrices.length === segments.length
        ? directPrices.reduce((total, price) => total + price, 0)
        : undefined;
};

const validateChildSeatCarriages = (trip: Trip | null | undefined, seatIds: number[], passengerSlots: PassengerSlot[]) => {
    if (!trip || !seatIds.length || !passengerSlots.some(slot => slot.type === 'CHILD')) return null;

    const assignments = seatIds
        .map((seatId, index) => {
            const carriage = findSeatCarriage(trip, seatId);
            return {
                slot: passengerSlots[index],
                carriageKey: carriageKeyOf(carriage?.carriageNumber),
            };
        })
        .filter(assignment => assignment.slot && assignment.carriageKey);

    const adultCarriages = new Set(
        assignments
            .filter(assignment => assignment.slot.type === 'ADULT')
            .map(assignment => assignment.carriageKey),
    );
    const invalidChild = assignments.some(assignment => (
        assignment.slot.type === 'CHILD' && !adultCarriages.has(assignment.carriageKey)
    ));

    return invalidChild ? CHILD_CARRIAGE_VALIDATION_MESSAGE : null;
};

const formatCarriageShortNumber = (value?: string | number) => {
    const raw = String(value ?? '').trim();
    const match = raw.match(/\d+/);
    return match ? match[0] : raw;
};

const TicketDetails: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { user, isAuthenticated, fetchUser } = useAuthStore();
    const queryClient = useQueryClient();
    const routeSearchParams = new URLSearchParams(location.search);
    const promoCode = (routeSearchParams.get('promoCode') || routeSearchParams.get('promo') || '').trim();
    const routeBookingId = Number(routeSearchParams.get('bookingId')) || undefined;
    const shouldResumePayment = ['1', 'true', 'yes'].includes(String(routeSearchParams.get('resumePayment') || routeSearchParams.get('pay') || '').toLowerCase());
    const routeDepartureStationId = Number(routeSearchParams.get('departureStationId')) || undefined;
    const routeArrivalStationId = Number(routeSearchParams.get('arrivalStationId')) || undefined;
    const searchPassengerSlots = useMemo(
        () => buildPassengerSlotsFromSearch(new URLSearchParams(location.search)),
        [location.search],
    );
    const passengerCounts = useMemo(() => countPassengerSlots(searchPassengerSlots), [searchPassengerSlots]);
    const [isPassengerPickerOpen, setIsPassengerPickerOpen] = useState(false);
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
    const [passengerInfoDeadlineMs, setPassengerInfoDeadlineMs] = useState<number | null>(null);
    const [clockNowMs, setClockNowMs] = useState(Date.now());
    const [queuedBookingRequestId, setQueuedBookingRequestId] = useState<string | null>(null);
    const syncedBookingRef = useRef<number | null>(null);
    const currentBookingId = booking?.bookingId;
    const currentBookingTicketIds = useMemo(() => booking?.ticketIds || [], [booking?.ticketIds]);
    const { data: passengerFareRules = [] } = useQuery({
        queryKey: ['passenger-fare-rules'],
        queryFn: tripApi.getPassengerFareRules,
        staleTime: 5 * 60 * 1000,
    });
    const passengerTypeMeta = useMemo(
        () => buildPassengerTypeMeta(passengerFareRules) as Record<PassengerTypeCode, { label: string; description: string; discountLabel?: string }>,
        [passengerFareRules],
    );
    const requiredSeatCount = currentBookingTicketIds.length || searchPassengerSlots.length;
    const requiredPassengerSlots = useMemo(
        () => relabelPassengerSlots(buildPassengerSlotsForCount(requiredSeatCount, searchPassengerSlots), passengerTypeMeta),
        [passengerTypeMeta, requiredSeatCount, searchPassengerSlots],
    );
    const requiredPassengerCounts = useMemo(() => countPassengerSlots(requiredPassengerSlots), [requiredPassengerSlots]);
    const requiredPassengerBreakdown = useMemo(() => formatPassengerBreakdown(requiredPassengerCounts, passengerTypeMeta), [passengerTypeMeta, requiredPassengerCounts]);

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

    useEffect(() => {
        if (currentBookingId) return;
        setSelectedSeats(prev => prev.length > requiredSeatCount ? prev.slice(0, requiredSeatCount) : prev);
        setPassengers(prev => prev.length > requiredSeatCount ? prev.slice(0, requiredSeatCount) : prev);
        setActivePassengerIndex(prev => Math.min(prev, Math.max(0, requiredSeatCount - 1)));
    }, [currentBookingId, requiredSeatCount]);

    const { data: itinerary, isLoading: itineraryLoading } = useQuery({
        queryKey: ['trip-itinerary', id],
        queryFn: () => tripApi.getTripItinerary(parseInt(id!)),
        enabled: !!id,
        staleTime: 5 * 60 * 1000,
    });

    useEffect(() => {
        if (step !== 2) return;
        const now = Date.now();
        setClockNowMs(now);
        setPassengerInfoDeadlineMs(now + PASSENGER_INFO_TIMEOUT_MS);
    }, [step]);

    useEffect(() => {
        if (step !== 2) return undefined;
        const intervalId = window.setInterval(() => setClockNowMs(Date.now()), 1000);
        return () => window.clearInterval(intervalId);
    }, [step]);

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
    const quotePassengerType = requiredPassengerSlots[0]?.type || 'ADULT';

    const { data: fareQuote } = useQuery({
        queryKey: ['trip-fare', id, effectiveDepartureStationId, effectiveArrivalStationId, quoteCarriageTypeId, quotePassengerType],
        queryFn: () => tripApi.quoteFare(parseInt(id!), {
            departureStationId: effectiveDepartureStationId!,
            arrivalStationId: effectiveArrivalStationId!,
            carriageTypeId: quoteCarriageTypeId!,
            passengerType: quotePassengerType,
        }),
        enabled: !!id && selectedRouteIsValid && !!quoteCarriageTypeId,
        staleTime: 60 * 1000,
    });
    const selectedRouteSegmentIds = useMemo(() => {
        if (fareQuote?.segmentIds?.length) return fareQuote.segmentIds;
        if (!itinerary || !selectedDepartureStop || !selectedArrivalStop) return [];
        return (itinerary.segments || [])
            .filter(segment => segment.segmentOrder >= selectedDepartureStop.stopOrder)
            .filter(segment => segment.segmentOrder < selectedArrivalStop.stopOrder)
            .map(segment => segment.id);
    }, [fareQuote?.segmentIds, itinerary, selectedArrivalStop, selectedDepartureStop]);

    useEffect(() => {
        if (!trip || currentBookingId || queuedBookingRequestId) return;
        const availableSeatIds = new Set(
            getAllSeats(trip)
                .filter(seat => isSeatAvailable(seat.status))
                .map(seat => seat.id),
        );
        setSelectedSeats(prev => prev.filter(seatId => availableSeatIds.has(seatId)));
    }, [currentBookingId, queuedBookingRequestId, routeScopedArrivalStationId, routeScopedDepartureStationId, trip]);

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
        if (!routeBookingId || booking?.bookingId === routeBookingId || queuedBookingRequestId) return;

        const routedBooking = myBookings.find(item => item.bookingId === routeBookingId);
        if (!routedBooking || !isPendingBookingStatus(routedBooking.status)) return;

        setBooking({
            bookingId: routedBooking.bookingId,
            requestId: routedBooking.requestId,
            orderNumber: routedBooking.orderNumber,
            storageMonth: routedBooking.storageMonth,
            status: routedBooking.status,
            originalPrice: routedBooking.originalPrice,
            promoCode: routedBooking.promoCode,
            discountAmount: routedBooking.discountAmount,
            totalPrice: routedBooking.totalPrice,
            expiredAt: routedBooking.expiredAt || '',
            seatNumbers: routedBooking.seatNumbers,
            ticketIds: routedBooking.ticketIds,
        });
        if (routedBooking.departureStationId) {
            setSelectedDepartureStationId(routedBooking.departureStationId);
        }
        if (routedBooking.arrivalStationId) {
            setSelectedArrivalStationId(routedBooking.arrivalStationId);
        }
        setPaymentMethod(prev => prev || routedBooking.paymentMethod?.toLowerCase() || '');
        setLoginError(null);
        if (routedBooking.ticketIds?.length) {
            setSelectedSeats(routedBooking.ticketIds);
        }
        if (shouldResumePayment) {
            setStep(3);
        }
    }, [booking?.bookingId, myBookings, queuedBookingRequestId, routeBookingId, shouldResumePayment]);

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
            passengerType: requiredPassengerSlots[index]?.type || 'ADULT',
        })));
        setActivePassengerIndex(0);
    }, [booking, bookingContact.idCard, bookingContact.name, requiredPassengerSlots]);

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

        setPassengers(bookingDetail.details.map((detail, index) => ({
            ticketId: detail.ticketId,
            name: detail.passengerName || '',
            idCard: detail.passengerIdCard || '',
            passengerType: detail.passengerType || requiredPassengerSlots[index]?.type || 'ADULT',
        })));
    }, [bookingDetail, requiredPassengerSlots]);

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

    const markQueuedSeatsInTripCache = useCallback((ticketIds: number[] = []) => {
        if (!ticketIds.length) return;
        const queuedTicketIds = new Set(ticketIds);
        const markSeat = (seat: Seat): Seat => (
            queuedTicketIds.has(seat.id)
                ? {
                    ...seat,
                    status: 'QUEUED',
                    heldByCurrentBooking: false,
                    holdingBookingId: null,
                }
                : seat
        );

        queryClient.setQueryData(tripQueryKey, (prevTrip: Trip | undefined) => {
            if (!prevTrip) return prevTrip;
            return {
                ...prevTrip,
                seats: prevTrip.seats?.map(markSeat),
                carriages: prevTrip.carriages?.map(carriage => ({
                    ...carriage,
                    seats: carriage.seats.map(markSeat),
                })) ?? prevTrip.carriages,
            };
        });
    }, [queryClient, tripQueryKey]);

    // Mutations
    const createBookingMutation = useMutation({
        mutationFn: bookingApi.createBooking,
        onSuccess: (res) => {
            if (!res.bookingId && res.requestId && isQueuedBookingStatus(res.status)) {
                setQueuedBookingRequestId(res.requestId);
                setBooking(null);
                if (res.ticketIds?.length) {
                    setSelectedSeats(res.ticketIds);
                    markQueuedSeatsInTripCache(res.ticketIds);
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

    const updatePassengerCriteria = (type: PassengerTypeCode, delta: number) => {
        if (currentBookingId || isBookingQueued) return;

        const nextCounts = { ...passengerCounts };
        const currentTotal = totalPassengerCount(nextCounts);
        if (delta > 0 && currentTotal >= MAX_PASSENGER_SEATS) return;

        const minValue = type === 'ADULT' ? 1 : 0;
        const nextValue = Math.max(minValue, (nextCounts[type] || 0) + delta);
        if (nextValue === nextCounts[type]) return;

        nextCounts[type] = nextValue;
        const nextTotal = totalPassengerCount(nextCounts);
        const params = new URLSearchParams(location.search);
        params.set('passengers', String(nextTotal));
        params.set('passenger_adult', String(nextCounts.ADULT || 1));
        if (nextCounts.CHILD) params.set('passenger_child', String(nextCounts.CHILD));
        else params.delete('passenger_child');
        if (nextCounts.SENIOR) params.set('passenger_senior', String(nextCounts.SENIOR));
        else params.delete('passenger_senior');
        if (nextCounts.STUDENT) params.set('passenger_student', String(nextCounts.STUDENT));
        else params.delete('passenger_student');

        setSelectedSeats([]);
        setPassengers([]);
        setActivePassengerIndex(0);
        setLoginError(null);
        navigate(
            {
                pathname: location.pathname,
                search: `?${params.toString()}`,
            },
            { replace: true },
        );
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
            const nextSeats = selectedSeats.filter(s => s !== seatId);
            setSelectedSeats(nextSeats);
            setActivePassengerIndex(Math.min(nextSeats.length, Math.max(0, requiredSeatCount - 1)));
            setLoginError(validateChildSeatCarriages(trip, nextSeats, requiredPassengerSlots));
        } else {
            if (currentBookingTicketIds.includes(seatId)) {
                setSelectedSeats(prev => [...prev, seatId]);
                return;
            }
            if (currentBookingId) return;
            if (selectedSeats.length >= requiredSeatCount) {
                setLoginError(`Bạn chỉ cần chọn ${requiredSeatCount} ghế cho ${requiredSeatCount} hành khách. Bỏ chọn một ghế nếu muốn đổi chỗ.`);
                return;
            }
            const nextSeats = [...selectedSeats, seatId];
            const childCarriageError = validateChildSeatCarriages(trip, nextSeats, requiredPassengerSlots);
            if (childCarriageError) {
                setLoginError(childCarriageError);
                return;
            }
            setSelectedSeats(nextSeats);
            setActivePassengerIndex(Math.min(selectedSeats.length + 1, Math.max(0, requiredSeatCount - 1)));
            setLoginError(null);
        }
    };

    const handleCreateBooking = async () => {
        if (!isAuthenticated) {
            navigate('/login', { state: { from: `${location.pathname}${location.search}` } });
            return;
        }
        const processSeatIds = selectedSeats.length > 0 ? selectedSeats : currentBookingTicketIds;
        if (!trip || processSeatIds.length === 0) return;

        if (booking) {
            const hasPassengerInfo = arePassengersValid(passengers);
            setStep(hasPassengerInfo ? 3 : 2);
            return;
        }

        if (processSeatIds.length !== requiredSeatCount) {
            setLoginError(`Vui lòng chọn đủ ${requiredSeatCount} ghế cho ${requiredSeatCount} hành khách trước khi tiếp tục.`);
            return;
        }

        const childCarriageError = validateChildSeatCarriages(trip, processSeatIds, requiredPassengerSlots);
        if (childCarriageError) {
            setLoginError(childCarriageError);
            return;
        }

        setPassengers(processSeatIds.map((ticketId, index) => ({
            ticketId,
            name: index === 0 ? bookingContact.name : '',
            idCard: index === 0 ? bookingContact.idCard : '',
            passengerType: requiredPassengerSlots[index]?.type || 'ADULT',
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
        if (step === 2 && passengerInfoDeadlineMs && Date.now() >= passengerInfoDeadlineMs) {
            setLoginError('Hết thời gian nhập thông tin. Vui lòng quay lại chọn ghế để giữ chỗ lại.');
            return;
        }
        if (!bookingContact.phone.trim() || !bookingContact.email.trim()) {
            setLoginError('Vui lòng nhập số điện thoại và email để nhận vé điện tử.');
            return;
        }
        if (!booking && selectedSeats.length !== requiredSeatCount) {
            setStep(1);
            setLoginError(`Vui lòng chọn đủ ${requiredSeatCount} ghế cho ${requiredSeatCount} hành khách trước khi đặt vé.`);
            return;
        }
        const processSeatIds = selectedSeats.length > 0 ? selectedSeats : currentBookingTicketIds;
        const childCarriageError = validateChildSeatCarriages(trip, processSeatIds, requiredPassengerSlots);
        if (childCarriageError) {
            setStep(1);
            setLoginError(childCarriageError);
            return;
        }
        if (!arePassengersValid(passengers)) {
            const firstInvalidIndex = passengers.findIndex(passenger => !isPassengerValid(passenger));
            if (firstInvalidIndex >= 0) setActivePassengerIndex(firstInvalidIndex);
            return;
        }
        if (!selectedRouteIsValid || !effectiveDepartureStationId || !effectiveArrivalStationId) {
            setLoginError('Vui lòng chọn chặng đi hợp lệ trước khi đặt vé.');
            return;
        }

        const normalizedPassengers = passengers.map((passenger, index) => ({
            ...passenger,
            name: passenger.name.trim(),
            idCard: normalizeCccd(passenger.idCard),
            passengerType: passenger.passengerType || requiredPassengerSlots[index]?.type || 'ADULT',
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
    const processSeatIds = selectedSeats.length > 0 ? selectedSeats : currentBookingTicketIds;
    const selectedSeatDetails = processSeatIds
        .map(ticketId => allSeats.find(seat => seat.id === ticketId))
        .filter(Boolean) as Seat[];
    const isSeatSelectionComplete = processSeatIds.length === requiredSeatCount;
    const childSeatValidationMessage = validateChildSeatCarriages(trip, processSeatIds, requiredPassengerSlots);
    const canContinueSeatSelection = isSeatSelectionComplete && !childSeatValidationMessage;
    const passengerSeatAssignments = requiredPassengerSlots.map((slot, index) => {
        const seat = selectedSeatDetails[index];
        return {
            ...slot,
            seat,
            seatPlace: getSeatPlaceLabel(trip, seat),
        };
    });
    const passengerSeatPrices = selectedSeatDetails.map((seat, index) => {
        const slot = requiredPassengerSlots[index];
        const carriage = findSeatCarriage(trip, seat?.id);
        const carriageTypeId = resolveCarriageTypeId(itinerary, carriage?.carriageTypeName);
        const itineraryPrice = calculatePassengerFareFromItinerary(
            itinerary,
            selectedRouteSegmentIds,
            carriageTypeId,
            slot?.type || 'ADULT',
            passengerFareRules,
        );
        if (typeof itineraryPrice === 'number' && Number.isFinite(itineraryPrice)) {
            return itineraryPrice;
        }

        const passengerType = slot?.type || 'ADULT';
        const quotePrice = Number(fareQuote?.totalPrice);
        if (fareQuote && String(fareQuote.passengerType || 'ADULT').toUpperCase() === passengerType && Number.isFinite(quotePrice)) {
            return quotePrice;
        }

        const basePrice = Number.isFinite(Number(seat.price)) ? Number(seat.price) : quotePrice;
        return Number.isFinite(basePrice)
            ? applyPassengerFareRule(basePrice, passengerFareRules, passengerType)
            : 0;
    });
    const totalPrice = passengerSeatPrices.reduce((total, price) => total + price, 0);
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
    const criteriaTicketType = routeSearchParams.get('ticketType') || (routeSearchParams.get('roundTrip') === 'true' ? 'round-trip' : 'one-way');
    const isRoundTripCriteria = criteriaTicketType === 'round-trip';
    const criteriaDateValue = routeSearchParams.get('date') || trip.departureTime?.split('T')[0] || '';
    const criteriaReturnDateValue = routeSearchParams.get('returnDate') || '';
    const passengerInfoRemainingSeconds = step === 2 && passengerInfoDeadlineMs
        ? Math.max(0, Math.ceil((passengerInfoDeadlineMs - clockNowMs) / 1000))
        : PASSENGER_INFO_TIMEOUT_MS / 1000;
    const passengerInfoCountdown = formatCountdown(passengerInfoRemainingSeconds);
    const passengerInfoExpired = step === 2 && passengerInfoRemainingSeconds <= 0;
    const serviceFee = 0;
    const bookingFee = 0;
    const passengerInfoTotal = payableTotal + serviceFee + bookingFee;
    const isContactInfoValid = Boolean(bookingContact.phone.trim() && bookingContact.email.trim());

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
                                <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm md:p-5">
                                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-[120px_minmax(0,1fr)_180px_180px_240px]">
                                        <div className="flex min-h-16 items-center rounded-2xl border border-gray-100 bg-gray-50 px-4">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Loại vé</p>
                                                <p className="mt-1 text-sm font-black text-gray-900">
                                                    {isRoundTripCriteria ? 'Khứ hồi' : 'Một chiều'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4">
                                            <Train size={18} className="shrink-0 text-tet-red" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Chặng</p>
                                                <p className="mt-1 truncate text-sm font-black text-gray-900">
                                                    {departureStationLabel}{' -> '}{arrivalStationLabel}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4">
                                            <Calendar size={18} className="shrink-0 text-tet-red" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ngày đi</p>
                                                <p className="mt-1 truncate text-sm font-black text-gray-900">
                                                    {formatCriteriaDate(criteriaDateValue)}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex min-h-16 items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4">
                                            <Calendar size={18} className="shrink-0 text-gray-400" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Ngày về</p>
                                                <p className="mt-1 truncate text-sm font-black text-gray-900">
                                                    {isRoundTripCriteria ? formatCriteriaDate(criteriaReturnDateValue) : 'Một chiều'}
                                                </p>
                                            </div>
                                        </div>

                                        <button
                                            type="button"
                                            onClick={() => setIsPassengerPickerOpen(prev => !prev)}
                                            className="flex min-h-16 items-center gap-3 rounded-2xl border border-gray-100 bg-gray-50 px-4 text-left transition hover:border-red-100 hover:bg-white"
                                        >
                                            <Users size={18} className="shrink-0 text-tet-red" />
                                            <div className="min-w-0">
                                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Số lượng vé</p>
                                                <p className="mt-1 text-sm font-black text-gray-900">{requiredSeatCount} khách</p>
                                                <p className="truncate text-[11px] font-bold text-gray-400">{requiredPassengerBreakdown}</p>
                                            </div>
                                        </button>

                                    </div>

                                    <AnimatePresence>
                                        {isPassengerPickerOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: -8 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                exit={{ opacity: 0, y: -8 }}
                                                className="mt-4 grid grid-cols-1 gap-4 rounded-3xl border border-gray-100 bg-gray-50 p-4 lg:grid-cols-[minmax(0,1fr)_320px]"
                                            >
                                                <div className="rounded-2xl bg-white p-2">
                                                    {PASSENGER_TYPE_ORDER.map((type) => {
                                                        const count = requiredPassengerCounts[type] || 0;
                                                        const meta = passengerTypeMeta[type];
                                                        const minValue = type === 'ADULT' ? 1 : 0;
                                                        const canDecrease = !currentBookingId && !isBookingQueued && count > minValue;
                                                        const canIncrease = !currentBookingId && !isBookingQueued && requiredSeatCount < MAX_PASSENGER_SEATS;

                                                        return (
                                                            <div key={type} className="flex items-center justify-between gap-4 border-b border-gray-100 px-3 py-4 last:border-b-0">
                                                                <div className="min-w-0">
                                                                    <div className="flex flex-wrap items-center gap-2">
                                                                        <p className="text-sm font-black text-gray-900">{meta.label}</p>
                                                                        {meta.discountLabel && (
                                                                            <span className="rounded-full bg-orange-50 px-2 py-0.5 text-[10px] font-black text-orange-500">
                                                                                {meta.discountLabel}
                                                                            </span>
                                                                        )}
                                                                    </div>
                                                                    <p className="mt-1 text-xs font-bold text-gray-400">{meta.description || PASSENGER_TYPE_SUB_LABELS[type]}</p>
                                                                </div>
                                                                <div className="flex shrink-0 items-center gap-3">
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updatePassengerCriteria(type, -1)}
                                                                        disabled={!canDecrease}
                                                                        className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-black text-gray-500 transition hover:border-tet-red hover:text-tet-red disabled:cursor-not-allowed disabled:opacity-35"
                                                                    >
                                                                        -
                                                                    </button>
                                                                    <span className="w-6 text-center text-base font-black text-gray-900">{count}</span>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => updatePassengerCriteria(type, 1)}
                                                                        disabled={!canIncrease}
                                                                        className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 bg-white text-lg font-black text-gray-500 transition hover:border-tet-red hover:text-tet-red disabled:cursor-not-allowed disabled:opacity-35"
                                                                    >
                                                                        +
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        );
                                                    })}
                                                </div>

                                                <div className="rounded-2xl bg-white p-5">
                                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Lưu ý</p>
                                                    <div className="mt-3 space-y-3 text-sm font-bold leading-relaxed text-gray-600">
                                                        {PASSENGER_TYPE_ORDER
                                                            .filter(type => PASSENGER_TYPE_NOTES[type])
                                                            .map(type => (
                                                                <p key={type}>
                                                                    <span className="font-black text-gray-900">{passengerTypeMeta[type].label}:</span>{' '}
                                                                    {PASSENGER_TYPE_NOTES[type]}
                                                                </p>
                                                            ))}
                                                        <p>Đặt vé đoàn từ 10 khách: liên hệ hỗ trợ.</p>
                                                    </div>
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>

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
                                        {trip.carriages?.map((car, idx) => {
                                            const availableInCarriage = getCarriageAvailableSeatCount(car);
                                            const minSeatPrice = getCarriageMinSeatPrice(car);

                                            return (
                                                <button
                                                    key={idx}
                                                    onClick={() => setSelectedCarIndex(idx)}
                                                    className={cn(
                                                        "min-w-[230px] p-4 rounded-2xl border-2 transition-all flex items-start gap-3 group relative overflow-hidden text-left",
                                                        selectedCarIndex === idx
                                                            ? "border-tet-red bg-white shadow-xl shadow-red-50"
                                                            : "border-gray-100 bg-white hover:border-gray-200 text-gray-400 opacity-70"
                                                    )}
                                                >
                                                    {selectedCarIndex === idx && (
                                                        <motion.div layoutId="car-glow" className="absolute inset-0 bg-tet-red/5" />
                                                    )}
                                                    <div className={cn(
                                                        "relative z-10 w-12 h-12 shrink-0 rounded-xl flex items-center justify-center transition-all",
                                                        selectedCarIndex === idx ? "bg-tet-red text-white" : "bg-gray-50 text-gray-300"
                                                    )}>
                                                        <Train size={24} />
                                                    </div>
                                                    <div className="relative z-10 min-w-0 flex-1">
                                                        <p className={cn("text-[10px] font-black uppercase tracking-widest mb-1", selectedCarIndex === idx ? "text-tet-red" : "text-gray-400")}>
                                                            {formatCarriageNumberLabel(car.carriageNumber)}
                                                        </p>
                                                        <p className="text-sm font-black text-gray-900 line-clamp-2">
                                                            {formatCarriageTypeName(car.carriageTypeName)}
                                                        </p>
                                                        <p className="mt-2 text-[11px] font-bold text-gray-400">
                                                            Còn {availableInCarriage} chỗ
                                                            {minSeatPrice > 0 ? ` | Từ ${formatPrice(minSeatPrice)}` : ''}
                                                        </p>
                                                    </div>
                                                </button>
                                            );
                                        })}
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
                                                {formatCarriageShortNumber(currentCarriage?.carriageNumber)}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{t('ticket_details.carriage.active')}</p>
                                                <p className="text-sm font-black text-gray-900">{formatCarriageTypeName(currentCarriage?.carriageTypeName)}</p>
                                                <p className="mt-1 text-[10px] font-bold text-gray-400">
                                                    Còn {getCarriageAvailableSeatCount(currentCarriage)} chỗ trong toa
                                                </p>
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center justify-center gap-4 md:justify-end">
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-gray-100 border border-gray-200" />
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('ticket_details.seats.available')}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-tet-red shadow-sm shadow-tet-red/20" />
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('ticket_details.seats.selected')}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-blue-500 shadow-sm shadow-blue-500/20" />
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Chờ xử lý</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <div className="w-3 h-3 rounded-full bg-emerald-500 shadow-sm shadow-emerald-500/20" />
                                                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Đã giữ</span>
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
                                        <div className="mb-8 p-4 rounded-2xl border border-emerald-100 bg-emerald-50 text-emerald-900">
                                            <p className="text-[10px] font-black uppercase tracking-[0.25em] mb-2">Ghế đang giữ</p>
                                            <p className="text-sm font-bold leading-relaxed">
                                                Ghế màu xanh là ghế hệ thống đang giữ cho đơn hiện tại. Bạn có thể tiếp tục nhập thông tin hoặc thanh toán.
                                            </p>
                                        </div>
                                    )}

                                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-4">
                                        {currentCarriage?.seats.map(seat => {
                                            const isSelected = selectedSeats.includes(seat.id);
                                            const isAvailable = isSeatAvailable(seat.status);
                                            const isHeld = isSeatHeld(seat.status);
                                            const isHeldByMe = isSeatHeldByCurrentBooking(seat, currentBookingId, currentBookingTicketIds);
                                            const normalizedStatus = normalizeSeatStatus(seat.status);
                                            const isQueued = ['QUEUED', 'PENDING'].includes(normalizedStatus) && !isHeldByMe;
                                            const isSold = !isAvailable && !isHeld && !isHeldByMe;
                                            const canSelectFreshSeat = isAvailable && !currentBookingId && !isBookingQueued;
                                            const canInteract = canSelectFreshSeat || isHeldByMe;
                                            const seatStatusLabel = isQueued
                                                ? 'QUEUE'
                                                : isHeldByMe
                                                    ? 'HOLD'
                                                    : isHeld
                                                        ? 'HOLD'
                                                        : isSold
                                                            ? 'SOLD'
                                                            : isSelected
                                                                ? 'CHON'
                                                                : null;
                                            
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
                                                            ? "bg-emerald-500 text-white shadow-xl shadow-emerald-500/20 ring-4 ring-emerald-50"
                                                            : isQueued
                                                            ? "bg-blue-500 text-white shadow-xl shadow-blue-500/20 ring-4 ring-blue-50 cursor-wait"
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
                                                    {seatStatusLabel && (
                                                        <span className={cn(
                                                            "absolute right-1.5 top-1.5 rounded-full px-1.5 py-0.5 text-[7px] font-black leading-none",
                                                            isQueued
                                                                ? "bg-white/20 text-white"
                                                                : isHeldByMe || isSelected || isSold
                                                                    ? "bg-white/20 text-white"
                                                                    : "bg-yellow-200 text-yellow-800"
                                                        )}>
                                                            {seatStatusLabel}
                                                        </span>
                                                    )}
                                                    <Armchair size={16} className={cn(
                                                        "transition-colors",
                                                        isQueued || isHeldByMe || isSelected
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
                                                        isQueued || isHeldByMe
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

                                    <div className="mt-8 rounded-3xl border border-gray-100 bg-gray-50/70 p-4 md:p-5">
                                        <div className="mb-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                            <div>
                                                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-tet-red">
                                                    Ghế theo hành khách
                                                </p>
                                                <p className="mt-1 text-sm font-bold text-gray-500">
                                                    Mỗi hành khách cần một ghế riêng trước khi tiếp tục.
                                                </p>
                                            </div>
                                            <span className={cn(
                                                "rounded-full px-4 py-2 text-xs font-black uppercase tracking-widest",
                                                isSeatSelectionComplete ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-tet-red"
                                            )}>
                                                Đã chọn {processSeatIds.length}/{requiredSeatCount} chỗ
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
                                            {passengerSeatAssignments.map((slot, index) => (
                                                <button
                                                    key={`${slot.type}-${index}`}
                                                    type="button"
                                                    onClick={() => setActivePassengerIndex(index)}
                                                    className={cn(
                                                        "rounded-2xl border bg-white p-4 text-left transition-all",
                                                        activePassengerIndex === index
                                                            ? "border-tet-red ring-4 ring-red-50"
                                                            : "border-gray-100 hover:border-red-100"
                                                    )}
                                                >
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="min-w-0">
                                                            <p className="truncate text-sm font-black text-gray-900">{slot.label}</p>
                                                            <p className={cn(
                                                                "mt-1 text-xs font-bold",
                                                                slot.seat ? "text-tet-red" : "text-gray-400"
                                                            )}>
                                                                {slot.seat ? slot.seatPlace : 'Chưa chọn'}
                                                            </p>
                                                        </div>
                                                        {slot.discountLabel && (
                                                            <span className="shrink-0 rounded-full bg-orange-50 px-2 py-1 text-[10px] font-black text-orange-500">
                                                                {slot.discountLabel}
                                                            </span>
                                                        )}
                                                    </div>
                                                </button>
                                            ))}
                                        </div>
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
                                                {selectedSeatDetails.length === 0 ? (
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
                                                    selectedSeatDetails.map((seat, index) => {
                                                        const slot = requiredPassengerSlots[index];
                                                        const normalizedStatus = normalizeSeatStatus(seat.status);
                                                        const summaryStatus = isSeatHeldByCurrentBooking(seat, currentBookingId, currentBookingTicketIds)
                                                            ? 'HOLD'
                                                            : ['QUEUED', 'PENDING'].includes(normalizedStatus)
                                                            ? 'QUEUE'
                                                            : normalizedStatus === 'HOLD'
                                                                ? 'HOLD'
                                                                : 'CHON';
                                                        return (
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
                                                                    <div>
                                                                        <span className="text-xs font-bold text-gray-700">{getSeatPlaceLabel(trip, seat)}</span>
                                                                        <span className={cn(
                                                                            "ml-2 rounded-full px-2 py-0.5 text-[8px] font-black",
                                                                            summaryStatus === 'QUEUE'
                                                                                ? "bg-blue-50 text-blue-600"
                                                                                : summaryStatus === 'HOLD'
                                                                                    ? "bg-emerald-50 text-emerald-600"
                                                                                    : "bg-red-50 text-tet-red"
                                                                        )}>
                                                                            {summaryStatus}
                                                                        </span>
                                                                        {slot && (
                                                                            <p className="mt-0.5 text-[10px] font-bold text-gray-400">
                                                                                {slot.label}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                </div>
                                                                <span className="text-xs font-black text-gray-900">{formatPrice(passengerSeatPrices[index] ?? seat.price ?? 0)}</span>
                                                            </motion.div>
                                                        );
                                                    })
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

                                        {!isSeatSelectionComplete && (
                                            <div className="mb-4 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-center text-xs font-black text-orange-600">
                                                Vui lòng chọn đủ {requiredSeatCount} ghế cho {requiredSeatCount} hành khách.
                                            </div>
                                        )}

                                        {childSeatValidationMessage && childSeatValidationMessage !== loginError && (
                                            <div className="mb-4 rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-center text-xs font-black text-orange-600">
                                                {childSeatValidationMessage}
                                            </div>
                                        )}

                                        <button 
                                            disabled={!canContinueSeatSelection || isSubmitting}
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
                            className="mx-auto grid max-w-6xl grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_380px]"
                        >
                            <div className="space-y-5">
                                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
                                    <h3 className="text-2xl font-semibold text-[#003b70]">Thông tin liên hệ</h3>
                                    <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-gray-700">
                                                Số điện thoại <span className="text-tet-red">*</span>
                                            </label>
                                            <input
                                                type="tel"
                                                placeholder="Nhập số điện thoại để liên lạc"
                                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-tet-red focus:ring-4 focus:ring-red-50"
                                                value={bookingContact.phone}
                                                onChange={e => updateBookingContact('phone', e.target.value)}
                                            />
                                        </div>
                                        <div className="space-y-2">
                                            <label className="text-sm font-semibold text-gray-700">
                                                Email <span className="text-tet-red">*</span>
                                            </label>
                                            <input
                                                type="email"
                                                placeholder="Nhập email để nhận vé điện tử"
                                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-tet-red focus:ring-4 focus:ring-red-50"
                                                value={bookingContact.email}
                                                onChange={e => updateBookingContact('email', e.target.value)}
                                            />
                                        </div>
                                    </div>
                                    <label className="mt-5 flex items-center gap-3 text-sm font-semibold text-gray-700">
                                        <input type="checkbox" className="h-4 w-4 rounded border-gray-300 text-tet-red focus:ring-tet-red" />
                                        Xuất hóa đơn điện tử
                                    </label>
                                </section>

                                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm md:p-6">
                                    <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                                        <div>
                                            <h3 className="text-2xl font-semibold text-[#003b70]">Thông tin hành khách</h3>
                                            <p className="mt-1 text-sm font-semibold text-gray-500">
                                                {passengers.filter(passenger => isPassengerValid(passenger)).length}/{passengers.length} hành khách đã nhập đủ.
                                            </p>
                                        </div>
                                        <button
                                            type="button"
                                            className="inline-flex items-center gap-2 self-start rounded-xl border border-cyan-300 px-4 py-2 text-sm font-bold text-cyan-600 transition-all hover:bg-cyan-50"
                                        >
                                            <Info size={16} />
                                            Nhập dạng bảng
                                        </button>
                                    </div>

                                    <div className="space-y-6">
                                        {passengers.map((p, i) => {
                                            const slot = requiredPassengerSlots[i];
                                            const seat = selectedSeatDetails[i];
                                            const carriage = findSeatCarriage(trip, seat?.id);
                                            const passengerLabel = slot?.label || `Hành khách ${i + 1}`;
                                            const passengerSubLabel = slot ? (passengerTypeMeta[slot.type]?.description || PASSENGER_TYPE_SUB_LABELS[slot.type]) : '';
                                            const seatPlace = getSeatPlaceLabel(trip, seat) || `Ghế ${p.ticketId}`;
                                            const carriageTypeName = formatCarriageTypeName(carriage?.carriageTypeName) || 'Hạng ghế';
                                            const passengerSeatPrice = passengerSeatPrices[i] ?? seat?.price ?? 0;

                                            return (
                                                <motion.div
                                                    key={p.ticketId}
                                                    initial={{ opacity: 0, x: -16, delay: i * 0.05 }}
                                                    animate={{ opacity: 1, x: 0 }}
                                                    onFocusCapture={() => setActivePassengerIndex(i)}
                                                    className="space-y-3"
                                                >
                                                    <div className="flex items-center justify-between gap-3">
                                                        <h4 className="text-lg font-bold text-gray-900">
                                                            {passengerLabel}
                                                            {passengerSubLabel && <span className="ml-1 font-semibold text-gray-700">({passengerSubLabel})</span>}
                                                        </h4>
                                                        {isPassengerValid(p) && <CheckCircle2 size={18} className="text-emerald-500" />}
                                                    </div>

                                                    <div className="inline-grid min-w-[300px] grid-cols-[1fr_1fr_auto] overflow-hidden rounded-xl bg-slate-100 text-sm font-semibold text-gray-700">
                                                        <div className="px-4 py-2">
                                                            <p className="text-gray-500">Chiều đi</p>
                                                            <p className="mt-1 text-gray-900">{seatPlace}</p>
                                                        </div>
                                                        <div className="px-4 py-2">
                                                            <p className="text-gray-500">{carriageTypeName}</p>
                                                            <p className="mt-1 text-gray-900">{formatCarriageNumberLabel(carriage?.carriageNumber)}</p>
                                                        </div>
                                                        <div className="px-4 py-2 text-right">
                                                            <p className="text-gray-500">Giá vé</p>
                                                            <p className="mt-1 text-gray-900">{formatPrice(passengerSeatPrice)}</p>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1fr)]">
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-semibold text-gray-700">
                                                                Họ và tên <span className="text-tet-red">*</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                placeholder="Vd: Nguyễn Văn Nam"
                                                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-tet-red focus:ring-4 focus:ring-red-50"
                                                                value={p.name}
                                                                onChange={e => updatePassenger(i, 'name', e.target.value)}
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-semibold text-gray-700">
                                                                Ngày sinh <span className="text-tet-red">*</span>
                                                            </label>
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                placeholder="dd/mm/yyyy"
                                                                className="w-full rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-semibold outline-none transition-all focus:border-tet-red focus:ring-4 focus:ring-red-50"
                                                            />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <label className="text-sm font-semibold text-gray-700">CCCD / Passport</label>
                                                            <input
                                                                type="text"
                                                                inputMode="numeric"
                                                                pattern="\d{12}"
                                                                maxLength={CCCD_LENGTH}
                                                                placeholder="Nhập CCCD hoặc Passport"
                                                                className={cn(
                                                                    "w-full rounded-xl border bg-white px-4 py-3 text-sm font-semibold outline-none transition-all focus:ring-4 focus:ring-red-50",
                                                                    p.idCard && !isValidCccd(p.idCard) ? "border-tet-red" : "border-gray-200 focus:border-tet-red"
                                                                )}
                                                                value={p.idCard}
                                                                onChange={e => updatePassenger(i, 'idCard', e.target.value)}
                                                            />
                                                            {p.idCard && !isValidCccd(p.idCard) && (
                                                                <p className="text-[11px] font-bold text-tet-red">CCCD phải gồm đúng 12 chữ số.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            );
                                        })}
                                    </div>
                                </section>

                                {loginError && (
                                    <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-tet-red">
                                        {loginError}
                                    </div>
                                )}

                                {passengerInfoExpired && (
                                    <div className="rounded-2xl border border-orange-100 bg-orange-50 px-4 py-3 text-sm font-bold text-orange-600">
                                        Hết thời gian nhập thông tin. Vui lòng quay lại chọn ghế để giữ chỗ lại.
                                    </div>
                                )}

                                <div className="flex flex-col gap-3 sm:flex-row">
                                    <button
                                        type="button"
                                        onClick={() => setStep(1)}
                                        className="inline-flex min-h-[54px] flex-1 items-center justify-center gap-2 rounded-xl border border-gray-300 bg-white px-6 text-base font-bold text-gray-700 transition-all hover:border-tet-red hover:text-tet-red"
                                    >
                                        <ChevronLeft size={20} />
                                        Quay lại
                                    </button>
                                    <button
                                        onClick={handleUpdatePassengers}
                                        disabled={isSubmitting || passengerInfoExpired || !isContactInfoValid || !arePassengersValid(passengers)}
                                        className="inline-flex min-h-[54px] flex-[1.6] items-center justify-center gap-3 rounded-xl bg-[#ff8800] px-6 text-base font-black text-white shadow-lg shadow-orange-200 transition-all hover:bg-[#f07b00] disabled:cursor-not-allowed disabled:opacity-40"
                                    >
                                        {isSubmitting ? <Train className="animate-spin" /> : `Thanh toán (${passengerInfoCountdown})`}
                                        {!isSubmitting && <ChevronRight size={20} />}
                                    </button>
                                </div>
                            </div>

                            <aside className="space-y-4 lg:sticky lg:top-[170px] lg:self-start">
                                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                    <div className="flex items-start justify-between gap-4">
                                        <div>
                                            <p className="text-lg font-bold text-gray-900">
                                                {departureStationLabel} <span className="mx-2 text-gray-400">→</span> {arrivalStationLabel}
                                            </p>
                                        </div>
                                        <span className="text-lg font-black text-gray-900">{trip.trainCode}</span>
                                    </div>

                                    <div className="mt-5 grid grid-cols-[1fr_auto_1fr] items-center gap-3 border-b border-gray-200 pb-5">
                                        <div>
                                            <p className="text-2xl font-black text-gray-900">{formatTime(trip.departureTime)}</p>
                                            <p className="mt-1 text-sm font-semibold text-gray-600">{formatTravelDateShort(trip.departureTime)}</p>
                                        </div>
                                        <Train size={22} className="text-gray-400" />
                                        <div className="text-right">
                                            <p className="text-2xl font-black text-gray-900">{formatTime(trip.arrivalTime || trip.departureTime)}</p>
                                            <p className="mt-1 text-sm font-semibold text-gray-600">{formatTravelDateShort(trip.arrivalTime || trip.departureTime)}</p>
                                        </div>
                                    </div>

                                    <div className="mt-5 space-y-3 text-sm font-semibold">
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-700">Tổng tiền vé</span>
                                            <span className="text-gray-900">{formatPrice(originalPrice)}</span>
                                        </div>
                                        <div className="flex items-center justify-between">
                                            <span className="text-gray-700">Phí dịch vụ</span>
                                            <span className="text-gray-900">{formatPrice(serviceFee)}</span>
                                        </div>
                                        {discountAmount > 0 && (
                                            <div className="flex items-center justify-between">
                                                <span className="text-tet-red">Khuyến mãi</span>
                                                <span className="text-tet-red">-{formatPrice(discountAmount)}</span>
                                            </div>
                                        )}
                                        <div className="flex items-center justify-between border-t border-gray-200 pt-4">
                                            <span className="font-black text-gray-900">Tổng tiền</span>
                                            <span className="text-2xl font-black text-[#ff8800]">{formatPrice(passengerInfoTotal)}</span>
                                        </div>
                                    </div>
                                </section>

                                <section className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
                                    <p className="text-base font-semibold text-gray-900">Bước tiếp theo:</p>
                                    <ul className="mt-2 list-disc space-y-2 pl-5 text-sm font-medium leading-relaxed text-gray-700">
                                        <li>Vé điện tử sẽ gửi qua email và điện thoại sau khi thanh toán.</li>
                                        <li>Thanh toán qua mã QR, chuyển khoản, thẻ nội địa/quốc tế hoặc MoMo.</li>
                                        <li>Hỗ trợ: Gọi <span className="font-black">1900 2087</span>.</li>
                                    </ul>
                                </section>
                            </aside>
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
                                            {processSeatIds.length} vé
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
