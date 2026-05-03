import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Train, MapPin, Calendar, Clock, User, Users,
    ChevronLeft, CreditCard, Armchair, Info, QrCode, WalletCards,
    CheckCircle2, AlertCircle, AlertTriangle, ChevronRight,
    ShoppingBag, ShieldCheck, Zap
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tripApi } from '../api/trip.api';
import { bookingApi } from '../api/booking.api';
import { useAuthStore } from '../store/useAuthStore';
import { useSeatSocket } from '../hooks/useSeatSocket';
import { Trip, BookingResponse, Seat, SeatStatus, PassengerRequest, SeatStatusEvent } from '../types/api.types';

// Local extension for new backend field
interface EnhancedBookingResponse extends BookingResponse {
    seatNumbers?: string[];
    ticketIds?: number[];
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

const isSeatAvailable = (status: SeatStatus | string | undefined) => normalizeSeatStatus(status) === 'AVAILABLE';

const isSeatHeld = (status: SeatStatus | string | undefined) => {
    return ['HOLD', 'HELD', 'PENDING'].includes(normalizeSeatStatus(status));
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

const TicketDetails: React.FC = () => {
    const { t, i18n } = useTranslation();
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const location = useLocation();
    const { isAuthenticated } = useAuthStore();
    const queryClient = useQueryClient();
    const routeSearchParams = new URLSearchParams(location.search);
    const promoCode = (routeSearchParams.get('promoCode') || routeSearchParams.get('promo') || '').trim();
    
    const [step, setStep] = useState(1);
    const [booking, setBooking] = useState<EnhancedBookingResponse | null>(null);
    const [selectedCarIndex, setSelectedCarIndex] = useState(0);
    const [selectedSeats, setSelectedSeats] = useState<number[]>([]);
    const [passengers, setPassengers] = useState<PassengerRequest[]>([]);
    const [paymentMethod, setPaymentMethod] = useState('');
    const [loginError, setLoginError] = useState<string | null>(null);
    const syncedBookingRef = useRef<number | null>(null);
    const currentBookingId = booking?.bookingId;
    const currentBookingTicketIds = booking?.ticketIds || [];
    const tripQueryKey = ['trip', id, currentBookingId || 'guest'];

    // Query Trip Details
    const { data: trip, isLoading: loading } = useQuery({
        queryKey: tripQueryKey,
        queryFn: () => tripApi.getTripDetails(parseInt(id!), currentBookingId),
        enabled: !!id,
    });

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
        if (!trip || booking) return;

        const pendingBooking = myBookings.find(item =>
            item.tripId === trip.id &&
            isPendingBookingStatus(item.status) &&
            item.ticketIds?.length
        );

        if (!pendingBooking) return;

        setBooking({
            bookingId: pendingBooking.bookingId,
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
    }, [booking, myBookings, trip]);

    useEffect(() => {
        if (!booking?.bookingId || !booking.ticketIds?.length) return;
        if (syncedBookingRef.current === booking.bookingId) return;

        syncedBookingRef.current = booking.bookingId;
        setSelectedSeats(booking.ticketIds);
        setPassengers(prev => prev.length > 0 ? prev : booking.ticketIds!.map(ticketId => ({ ticketId, name: '', idCard: '' })));
    }, [booking]);

    useEffect(() => {
        if (!bookingDetail?.details?.length) return;

        setBooking(prev => prev && prev.bookingId === bookingDetail.bookingId ? ({
            ...prev,
            originalPrice: bookingDetail.originalPrice,
            promoCode: bookingDetail.promoCode,
            discountAmount: bookingDetail.discountAmount,
            totalPrice: bookingDetail.totalPrice,
        }) : prev);

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
    }, [currentBookingId, currentBookingTicketIds, queryClient, step, tripQueryKey]);

    useSeatSocket(trip?.id, handleSeatUpdate);

    // Mutations
    const createBookingMutation = useMutation({
        mutationFn: bookingApi.createBooking,
        onSuccess: (res) => {
            setBooking(res);
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
            const hasPassengerInfo = passengers.length > 0 && passengers.every(p => p.name && p.idCard);
            setStep(hasPassengerInfo ? 3 : 2);
            return;
        }

        setPassengers(selectedSeats.map(ticketId => ({ ticketId, name: '', idCard: '' })));
        setLoginError(null);
        setStep(2);
    };

    const handleUpdatePassengers = () => {
        if (!trip) return;
        if (booking) {
            updatePassengersMutation.mutate({
                bookingId: booking.bookingId,
                data: { passengers },
            });
            return;
        }

        createBookingMutation.mutate({
            tripId: trip.id,
            ticketIds: selectedSeats,
            ...(promoCode ? { promoCode } : {}),
            passengers,
        });
    };

    const startMomoPayment = () => {
        if (!booking || momoPaymentMutation.isPending) return;
        sessionStorage.setItem('pendingPayment', JSON.stringify({ bookingId: booking.bookingId, method: 'momo' }));
        momoPaymentMutation.mutate(booking.bookingId);
    };

    const startVnpayPayment = () => {
        if (!booking || vnpayPaymentMutation.isPending) return;
        sessionStorage.setItem('pendingPayment', JSON.stringify({ bookingId: booking.bookingId, method: 'vnpay' }));
        vnpayPaymentMutation.mutate(booking.bookingId);
    };

    const handleSelectPaymentMethod = (methodId: string) => {
        setPaymentMethod(methodId);
    };

    const handleConfirmPayment = () => {
        if (!booking) return;
        if (paymentMethod === 'momo') {
            startMomoPayment();
            return;
        }
        if (paymentMethod === 'vnpay') {
            startVnpayPayment();
            return;
        }
    };

    const isSubmitting = createBookingMutation.isPending || 
                       updatePassengersMutation.isPending || 
                       momoPaymentMutation.isPending ||
                       vnpayPaymentMutation.isPending;

    if (loading) return <div className="min-h-screen flex items-center justify-center"><Train className="animate-spin text-tet-red" /></div>;
    if (!trip) return <div className="min-h-screen flex items-center justify-center">Không tìm thấy chuyến tàu</div>;

    const currentCarriage = trip.carriages?.[selectedCarIndex];
    const departureStationLabel = formatStationName(trip.departureStation);
    const arrivalStationLabel = formatStationName(trip.arrivalStation);
    const allSeats = getAllSeats(trip);
    const selectedSeatDetails = selectedSeats
        .map(ticketId => allSeats.find(seat => seat.id === ticketId))
        .filter(Boolean) as Seat[];
    const totalPrice = selectedSeatDetails.reduce((total, seat) => total + (seat.price || 0), 0);
    const payableTotal = booking?.totalPrice ?? totalPrice;
    const originalPrice = booking?.originalPrice ?? totalPrice;
    const discountAmount = booking?.discountAmount ?? 0;
    const appliedPromoCode = booking?.promoCode || promoCode;
    const hasPendingBooking = !!booking && isPendingBookingStatus(booking.status);
    const hasPassengerInfo = passengers.length > 0 && passengers.every(p => p.name && p.idCard);

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

            <div className="max-w-7xl mx-auto px-4 md:px-12 py-8 flex-grow">
                <AnimatePresence mode="wait">
                    {step === 1 && (
                        <motion.div 
                            key="step1" 
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -20 }}
                            className="grid grid-cols-1 lg:grid-cols-12 gap-10"
                        >
                            <div className="lg:col-span-8 space-y-10">
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
                                                    <p className="text-xs font-black text-gray-900 line-clamp-1">{car.carriageTypeName}</p>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Main Seat Selection Grid */}
                                <div className="bg-white p-6 md:p-10 rounded-[3rem] border border-gray-100 shadow-[0_20px_50px_-20px_rgba(0,0,0,0.05)] relative overflow-hidden">
                                    {/* Decoration */}
                                    <div className="absolute top-0 right-0 w-64 h-64 bg-tet-red/[0.02] rounded-full blur-3xl -mr-32 -mt-32" />
                                    
                                    <div className="flex flex-col md:flex-row justify-between items-center mb-10 gap-6">
                                        <div className="flex items-center gap-3 bg-gray-50 px-5 py-3 rounded-2xl">
                                            <div className="w-8 h-8 bg-white rounded-lg border border-gray-100 flex items-center justify-center text-tet-red font-black text-sm">
                                                {currentCarriage?.carriageNumber}
                                            </div>
                                            <div>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none mb-1">{t('ticket_details.carriage.active')}</p>
                                                <p className="text-sm font-black text-gray-900">{currentCarriage?.carriageTypeName}</p>
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
                                                <div className="w-3 h-3 rounded-full bg-gray-200 opacity-50" />
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
                                            const canSelectFreshSeat = isAvailable && !currentBookingId;
                                            const canInteract = canSelectFreshSeat || isHeldByMe;
                                            
                                            return (
                                                <motion.button
                                                    key={seat.id}
                                                    whileHover={canInteract ? { y: -4, scale: 1.05 } : {}}
                                                    whileTap={canInteract ? { scale: 0.95 } : {}}
                                                    disabled={!canInteract}
                                                    onClick={() => toggleSeat(seat.id)}
                                                    className={cn(
                                                        "group relative aspect-square rounded-2xl flex flex-col items-center justify-center gap-1 transition-all",
                                                        isHeldByMe
                                                            ? "bg-blue-600 text-white shadow-xl shadow-blue-600/20 ring-4 ring-blue-50"
                                                            : isHeld
                                                                ? "bg-yellow-100 border-2 border-yellow-300 text-yellow-800 shadow-lg shadow-yellow-200/40 cursor-not-allowed"
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
                                                                : ""
                                                    )}>{seat.seatNumber}</span>
                                                </motion.button>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>

                            {/* Sidebar Summary */}
                            <div className="lg:col-span-4">
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
                                                            <span className="text-xs font-black text-gray-900">{formatPrice(seat.price || 0)}</span>
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
                            className="max-w-3xl mx-auto space-y-10"
                        >
                            <div className="text-center space-y-2">
                                <h3 className="text-3xl font-black text-gray-900 tracking-tight">{t('ticket_details.passengers.title')}</h3>
                                <p className="text-gray-500 font-medium">Vui lòng nhập đúng thông tin để xuất vé.</p>
                            </div>

                            <div className="space-y-6">
                                {passengers.map((p, i) => (
                                    <motion.div 
                                        key={p.ticketId} 
                                        initial={{ opacity: 0, x: -20, delay: i * 0.1 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        className="bg-white p-8 rounded-[2.5rem] border border-gray-100 shadow-sm relative overflow-hidden"
                                    >
                                        <div className="absolute top-0 left-0 w-1.5 h-full bg-tet-red" />
                                        <div className="flex items-center gap-4 mb-8">
                                            <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center text-tet-red font-black">
                                                {i + 1}
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-black text-gray-900">Thông tin hành khách</h4>
                                                <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Ghế {p.ticketId}</p>
                                            </div>
                                        </div>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Họ và tên</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Ví dụ: Nguyễn Văn A" 
                                                    className="w-full px-5 py-4 bg-gray-50/50 rounded-xl border border-gray-100 focus:bg-white focus:border-tet-red focus:ring-4 focus:ring-tet-red/5 outline-none transition-all font-bold text-sm"
                                                    value={p.name}
                                                    onChange={e => {
                                                        const newPs = [...passengers];
                                                        newPs[i].name = e.target.value;
                                                        setPassengers(newPs);
                                                    }}
                                                />
                                            </div>
                                            <div className="space-y-2">
                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">CCCD / Hộ chiếu</label>
                                                <input 
                                                    type="text" 
                                                    placeholder="Nhập số giấy tờ" 
                                                    className="w-full px-5 py-4 bg-gray-50/50 rounded-xl border border-gray-100 focus:bg-white focus:border-tet-red focus:ring-4 focus:ring-tet-red/5 outline-none transition-all font-bold text-sm"
                                                    value={p.idCard}
                                                    onChange={e => {
                                                        const newPs = [...passengers];
                                                        newPs[i].idCard = e.target.value;
                                                        setPassengers(newPs);
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                ))}
                            </div>

                            <button 
                                onClick={handleUpdatePassengers}
                                disabled={isSubmitting || passengers.some(p => !p.name || !p.idCard)}
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
                                    {isSubmitting ? <Train className="animate-spin" /> : 'Xác nhận và thanh toán'}
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
                                        <p className="text-3xl font-black text-tet-red">#{booking?.bookingId || 'VTT882'}</p>
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
