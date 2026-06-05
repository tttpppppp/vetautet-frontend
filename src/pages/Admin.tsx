import React, { useEffect, useMemo, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import {
    CalendarClock,
    BarChart3,
    Check,
    LoaderCircle,
    Percent,
    RefreshCw,
    Route,
    Save,
    ShieldAlert,
    SquarePen,
    Ticket,
    Train,
    Trash2,
    UserRound,
    Warehouse,
} from 'lucide-react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { cn } from '@/lib/utils';
import { adminApi } from '../api/admin.api';
import { useAuthStore } from '../store/useAuthStore';
import { TripSegmentPriceRequest, TripStopRequest } from '../types/api.types';

const bookingStatuses = ['PENDING', 'CONFIRMED', 'CANCELLED', 'EXPIRED'];
const ticketStatuses = ['AVAILABLE', 'HOLD', 'BOOKED'];
const commonStatuses = ['ACTIVE', 'INACTIVE'];
const promotionStatuses = ['ACTIVE', 'INACTIVE', 'EXPIRING'];

const tabs = [
    { id: 'stats', label: 'Thống kê', icon: BarChart3, meta: 'Dashboard tổng quan' },
    { id: 'bookings', label: 'Bookings', icon: Ticket },
    { id: 'promotions', label: 'Promotions', icon: Percent },
    { id: 'stations', label: 'Stations', icon: Warehouse },
    { id: 'tickets', label: 'Tickets', icon: Ticket },
    { id: 'trains', label: 'Trains', icon: Train },
    { id: 'trips', label: 'Trips', icon: CalendarClock },
    { id: 'segments', label: 'Chặng', icon: Route, meta: 'Stops, segments và bảng giá' },
    { id: 'users', label: 'Users', icon: UserRound },
];

const initialStation = { name: '', code: '', location: '' };
const initialTrain = { code: '', category: 'SE_TN', description: '' };
const initialTrip = {
    trainId: '',
    departureStationId: '',
    arrivalStationId: '',
    departureTime: '',
    arrivalTime: '',
    status: 'ACTIVE',
};
const initialTripStop = (order = 1): TripStopRequest => ({
    stationId: 0,
    stopOrder: order,
    scheduledArrivalTime: '',
    scheduledDepartureTime: '',
    estimatedArrivalTime: '',
    estimatedDepartureTime: '',
    distanceFromOriginKm: 0,
    status: 'SCHEDULED',
    platform: '',
    note: '',
});
const initialSegmentPrice = (): TripSegmentPriceRequest => ({
    segmentId: 0,
    carriageTypeId: 1,
    passengerType: 'ADULT',
    price: 0,
    currency: 'VND',
    status: 'ACTIVE',
});
const initialTicket = { price: '', status: 'AVAILABLE' };
const initialUser = { name: '', phone: '', roles: 'CUSTOMER' };
const initialPromotion = {
    title: '',
    description: '',
    code: '',
    discountType: 'percent',
    discountValue: '10',
    maxDiscountAmount: '',
    minOrderAmount: '',
    startsAt: '',
    endsAt: '',
    conditions: '',
    route: '',
    categories: 'SE_TN',
    usageLimit: '',
    usedCount: '0',
    easeScore: '70',
    status: 'ACTIVE',
};

const formatMoney = (value: unknown) => `${Number(value || 0).toLocaleString('vi-VN')}đ`;

const formatDateTime = (value: unknown) => {
    if (!value) return '--';
    const date = new Date(String(value));
    if (Number.isNaN(date.getTime())) return String(value);
    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);
};

const toDateTimePayload = (value: string) => {
    if (!value) return '';
    return value.length === 16 ? `${value}:00` : value;
};

const toLocalDateTimeInput = (value?: string) => {
    if (!value) return '';
    return String(value).slice(0, 16);
};

const toNullableNumber = (value: string) => {
    const trimmed = String(value || '').trim();
    return trimmed ? Number(trimmed) : null;
};

const getItemId = (item: any) => Number(item?.id ?? item?.bookingId ?? item?.ticketId);

const StatusPill = ({ status }: { status?: string }) => {
    const normalized = String(status || '').toUpperCase();
    const tone = ['ACTIVE', 'CONFIRMED', 'AVAILABLE'].includes(normalized)
        ? 'text-green-700 bg-green-50'
        : ['PENDING', 'HOLD', 'EXPIRING'].includes(normalized)
            ? 'text-amber-700 bg-amber-50'
            : 'text-gray-700 bg-gray-100';

    return (
        <span className={cn('inline-flex rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest', tone)}>
            {status || '--'}
        </span>
    );
};

const EmptyState = ({ isLoading, isError }: { isLoading?: boolean; isError?: boolean }) => (
    <div className="py-14 text-center">
        {isLoading ? (
            <LoaderCircle size={28} className="mx-auto animate-spin text-tet-red" />
        ) : (
            <>
                <ShieldAlert size={30} className="mx-auto text-gray-300" />
                <p className="mt-3 text-sm font-bold text-gray-400">{isError ? 'Không tải được dữ liệu.' : 'Chưa có dữ liệu.'}</p>
            </>
        )}
    </div>
);

const Field = ({
    label,
    value,
    onChange,
    type = 'text',
    options,
}: {
    label: string;
    value: string;
    onChange: (value: string) => void;
    type?: string;
    options?: string[];
}) => (
    <label className="block">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">{label}</span>
        {options ? (
            <select
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-900 outline-none focus:border-tet-red"
            >
                {options.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
        ) : (
            <input
                type={type}
                value={value}
                onChange={(event) => onChange(event.target.value)}
                className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-900 outline-none focus:border-tet-red"
            />
        )}
    </label>
);

const TableShell = ({
    columns,
    children,
    empty,
}: {
    columns: string[];
    children: React.ReactNode;
    empty?: React.ReactNode;
}) => (
    <div className="overflow-x-auto border-y border-gray-100">
        <table className="min-w-full text-left">
            <thead>
                <tr className="bg-gray-50/70">
                    {columns.map((column) => (
                        <th key={column} className="px-4 py-3 text-[10px] font-black uppercase tracking-widest text-gray-400">
                            {column}
                        </th>
                    ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
                {children || null}
            </tbody>
        </table>
        {empty}
    </div>
);

const ActionButton = ({
    children,
    onClick,
    tone = 'dark',
    disabled,
}: {
    children: React.ReactNode;
    onClick?: () => void;
    tone?: 'dark' | 'red' | 'plain';
    disabled?: boolean;
}) => (
    <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className={cn(
            'inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-50',
            tone === 'dark' && 'bg-gray-900 text-white hover:bg-black',
            tone === 'red' && 'bg-red-50 text-tet-red hover:bg-red-100',
            tone === 'plain' && 'bg-gray-50 text-gray-600 hover:bg-gray-100',
        )}
    >
        {children}
    </button>
);

const StatCard = ({
    label,
    value,
    note,
    Icon,
    tone = 'red',
}: {
    label: string;
    value: React.ReactNode;
    note?: string;
    Icon: React.ElementType;
    tone?: 'red' | 'green' | 'blue' | 'amber' | 'dark';
}) => {
    const tones = {
        red: 'bg-red-50 text-tet-red',
        green: 'bg-green-50 text-green-700',
        blue: 'bg-blue-50 text-blue-700',
        amber: 'bg-amber-50 text-amber-700',
        dark: 'bg-gray-100 text-gray-900',
    };

    return (
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.25em] text-gray-400">{label}</p>
                    <p className="mt-3 text-3xl font-black tracking-tight text-gray-950">{value}</p>
                    {note && <p className="mt-2 text-xs font-bold text-gray-400">{note}</p>}
                </div>
                <div className={cn('flex h-11 w-11 shrink-0 items-center justify-center rounded-xl', tones[tone])}>
                    <Icon size={20} />
                </div>
            </div>
        </div>
    );
};

const Admin = () => {
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { user, isAuthenticated, fetchUser } = useAuthStore();

    const [activeTab, setActiveTab] = useState('stats');
    const [editing, setEditing] = useState<{ type: string; id: number | string } | null>(null);
    const [bookingStatus, setBookingStatus] = useState<Record<number, string>>({});
    const [promotionFilters, setPromotionFilters] = useState({ q: '', status: '', sort: 'newest', route: '', discount: '', type: '', category: '' });
    const [ticketTripId, setTicketTripId] = useState('');
    const [scheduleTripId, setScheduleTripId] = useState('');

    const [stationForm, setStationForm] = useState(initialStation);
    const [trainForm, setTrainForm] = useState(initialTrain);
    const [tripForm, setTripForm] = useState(initialTrip);
    const [tripStopsForm, setTripStopsForm] = useState<TripStopRequest[]>([initialTripStop(1), initialTripStop(2)]);
    const [segmentPricesForm, setSegmentPricesForm] = useState<TripSegmentPriceRequest[]>([initialSegmentPrice()]);
    const [ticketForm, setTicketForm] = useState(initialTicket);
    const [userForm, setUserForm] = useState(initialUser);
    const [promotionForm, setPromotionForm] = useState(initialPromotion);

    useEffect(() => {
        if (isAuthenticated && (!user || !user.roles)) fetchUser();
        if (!isAuthenticated) navigate('/login');
    }, [fetchUser, isAuthenticated, navigate, user]);

    const isAdmin = user?.roles?.some((role) => String(role).toUpperCase() === 'ADMIN');

    const statsQuery = useQuery({ queryKey: ['admin', 'stats'], queryFn: adminApi.getStats, enabled: activeTab === 'stats' && isAdmin });
    const bookingsQuery = useQuery({ queryKey: ['admin', 'bookings'], queryFn: adminApi.getBookings, enabled: activeTab === 'bookings' && isAdmin });
    const promotionsQuery = useQuery({
        queryKey: ['admin', 'promotions', promotionFilters],
        queryFn: () => adminApi.getPromotions({
            ...promotionFilters,
            discount: promotionFilters.discount ? Number(promotionFilters.discount) : undefined,
        }),
        enabled: activeTab === 'promotions' && isAdmin,
    });
    const stationsQuery = useQuery({ queryKey: ['admin', 'stations'], queryFn: adminApi.getStations, enabled: ['stations', 'segments'].includes(activeTab) && isAdmin });
    const trainsQuery = useQuery({ queryKey: ['admin', 'trains'], queryFn: adminApi.getTrains, enabled: activeTab === 'trains' && isAdmin });
    const tripsQuery = useQuery({ queryKey: ['admin', 'trips'], queryFn: adminApi.getTrips, enabled: ['trips', 'segments'].includes(activeTab) && isAdmin });
    const tripItineraryQuery = useQuery({
        queryKey: ['admin', 'trip-itinerary', scheduleTripId],
        queryFn: () => adminApi.getTripItinerary(Number(scheduleTripId)),
        enabled: ['trips', 'segments'].includes(activeTab) && isAdmin && Number(scheduleTripId) > 0,
    });
    const usersQuery = useQuery({ queryKey: ['admin', 'users'], queryFn: adminApi.getUsers, enabled: activeTab === 'users' && isAdmin });
    const rolesQuery = useQuery({ queryKey: ['admin', 'roles'], queryFn: adminApi.getUserRoles, enabled: activeTab === 'users' && isAdmin });
    const ticketsQuery = useQuery({
        queryKey: ['admin', 'tickets', ticketTripId],
        queryFn: () => adminApi.getTicketsByTrip(Number(ticketTripId)),
        enabled: activeTab === 'tickets' && isAdmin && Number(ticketTripId) > 0,
    });

    const invalidate = (key: string) => queryClient.invalidateQueries({ queryKey: ['admin', key] });

    const bookingStatusMutation = useMutation({
        mutationFn: ({ id, status }: { id: number; status: string }) => adminApi.updateBookingStatus(id, status),
        onSuccess: () => invalidate('bookings'),
    });
    const deleteBookingMutation = useMutation({ mutationFn: adminApi.deleteBooking, onSuccess: () => invalidate('bookings') });

    const saveStationMutation = useMutation({
        mutationFn: () => editing?.type === 'stations'
            ? adminApi.updateStation(Number(editing.id), stationForm)
            : adminApi.createStation(stationForm),
        onSuccess: () => {
            setStationForm(initialStation);
            setEditing(null);
            invalidate('stations');
        },
    });
    const deleteStationMutation = useMutation({ mutationFn: adminApi.deleteStation, onSuccess: () => invalidate('stations') });

    const saveTrainMutation = useMutation({
        mutationFn: () => editing?.type === 'trains'
            ? adminApi.updateTrain(Number(editing.id), trainForm)
            : adminApi.createTrain(trainForm),
        onSuccess: () => {
            setTrainForm(initialTrain);
            setEditing(null);
            invalidate('trains');
        },
    });
    const deleteTrainMutation = useMutation({ mutationFn: adminApi.deleteTrain, onSuccess: () => invalidate('trains') });

    const tripPayload = () => ({
        trainId: Number(tripForm.trainId),
        departureStationId: Number(tripForm.departureStationId),
        arrivalStationId: Number(tripForm.arrivalStationId),
        departureTime: toDateTimePayload(tripForm.departureTime),
        arrivalTime: toDateTimePayload(tripForm.arrivalTime),
        status: tripForm.status,
    });
    const saveTripMutation = useMutation({
        mutationFn: () => editing?.type === 'trips'
            ? adminApi.updateTrip(Number(editing.id), tripPayload())
            : adminApi.createTrip(tripPayload()),
        onSuccess: () => {
            setTripForm(initialTrip);
            setEditing(null);
            invalidate('trips');
        },
    });
    const deleteTripMutation = useMutation({ mutationFn: adminApi.deleteTrip, onSuccess: () => invalidate('trips') });
    const saveTripStopsMutation = useMutation({
        mutationFn: () => adminApi.updateTripStops(Number(scheduleTripId), {
            stops: tripStopsForm
                .filter((stop) => Number(stop.stationId) > 0 && Number(stop.stopOrder) > 0)
                .map((stop) => ({
                    ...stop,
                    stationId: Number(stop.stationId),
                    stopOrder: Number(stop.stopOrder),
                    distanceFromOriginKm: Number(stop.distanceFromOriginKm || 0),
                    scheduledArrivalTime: toDateTimePayload(String(stop.scheduledArrivalTime || '')) || null,
                    scheduledDepartureTime: toDateTimePayload(String(stop.scheduledDepartureTime || '')) || null,
                    estimatedArrivalTime: toDateTimePayload(String(stop.estimatedArrivalTime || '')) || null,
                    estimatedDepartureTime: toDateTimePayload(String(stop.estimatedDepartureTime || '')) || null,
                })),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'trip-itinerary', scheduleTripId] });
        },
    });
    const saveSegmentPricesMutation = useMutation({
        mutationFn: () => adminApi.updateTripSegmentPrices(Number(scheduleTripId), {
            prices: segmentPricesForm
                .filter((price) => Number(price.segmentId) > 0 && Number(price.carriageTypeId) > 0)
                .map((price) => ({
                    ...price,
                    segmentId: Number(price.segmentId),
                    carriageTypeId: Number(price.carriageTypeId),
                    price: Number(price.price || 0),
                    passengerType: price.passengerType || 'ADULT',
                    currency: price.currency || 'VND',
                    status: price.status || 'ACTIVE',
                })),
        }),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['admin', 'trip-itinerary', scheduleTripId] });
        },
    });

    const promotionPayload = () => ({
        title: promotionForm.title,
        description: promotionForm.description,
        code: promotionForm.code,
        discountType: promotionForm.discountType,
        discountValue: Number(promotionForm.discountValue || 0),
        maxDiscountAmount: toNullableNumber(promotionForm.maxDiscountAmount),
        minOrderAmount: toNullableNumber(promotionForm.minOrderAmount),
        startsAt: promotionForm.startsAt,
        endsAt: promotionForm.endsAt,
        conditions: promotionForm.conditions,
        route: promotionForm.route,
        categories: promotionForm.categories.split(',').map((item) => item.trim()).filter(Boolean),
        usageLimit: toNullableNumber(promotionForm.usageLimit),
        usedCount: toNullableNumber(promotionForm.usedCount),
        easeScore: Number(promotionForm.easeScore || 0),
        status: promotionForm.status,
    });
    const savePromotionMutation = useMutation({
        mutationFn: () => editing?.type === 'promotions'
            ? adminApi.updatePromotion(editing.id, promotionPayload())
            : adminApi.createPromotion(promotionPayload()),
        onSuccess: () => {
            setPromotionForm(initialPromotion);
            setEditing(null);
            invalidate('promotions');
        },
    });
    const deletePromotionMutation = useMutation({ mutationFn: adminApi.deletePromotion, onSuccess: () => invalidate('promotions') });

    const saveTicketMutation = useMutation({
        mutationFn: () => adminApi.updateTicket(Number(editing?.id), {
            price: Number(ticketForm.price || 0),
            status: ticketForm.status,
        }),
        onSuccess: () => {
            setTicketForm(initialTicket);
            setEditing(null);
            invalidate('tickets');
        },
    });
    const deleteTicketMutation = useMutation({ mutationFn: adminApi.deleteTicket, onSuccess: () => invalidate('tickets') });

    const saveUserMutation = useMutation({
        mutationFn: () => adminApi.updateUser(Number(editing?.id), {
            name: userForm.name,
            phone: userForm.phone,
            roles: userForm.roles.split(',').map((role) => role.trim()).filter(Boolean),
        }),
        onSuccess: () => {
            setUserForm(initialUser);
            setEditing(null);
            invalidate('users');
        },
    });
    const deleteUserMutation = useMutation({ mutationFn: adminApi.deleteUser, onSuccess: () => invalidate('users') });

    const activeQuery = useMemo(() => ({
        stats: statsQuery,
        bookings: bookingsQuery,
        promotions: promotionsQuery,
        stations: stationsQuery,
        tickets: ticketsQuery,
        trains: trainsQuery,
        trips: tripsQuery,
        segments: tripItineraryQuery,
        users: usersQuery,
    }[activeTab]), [activeTab, bookingsQuery, promotionsQuery, stationsQuery, statsQuery, ticketsQuery, trainsQuery, tripsQuery, tripItineraryQuery, usersQuery]);

    useEffect(() => {
        const itinerary = tripItineraryQuery.data;
        if (!itinerary) return;

        setTripStopsForm(itinerary.stops.length ? itinerary.stops.map((stop) => ({
            stationId: stop.stationId,
            stopOrder: stop.stopOrder,
            scheduledArrivalTime: toLocalDateTimeInput(stop.scheduledArrivalTime || undefined),
            scheduledDepartureTime: toLocalDateTimeInput(stop.scheduledDepartureTime || undefined),
            estimatedArrivalTime: toLocalDateTimeInput(stop.estimatedArrivalTime || undefined),
            estimatedDepartureTime: toLocalDateTimeInput(stop.estimatedDepartureTime || undefined),
            actualArrivalTime: toLocalDateTimeInput(stop.actualArrivalTime || undefined),
            actualDepartureTime: toLocalDateTimeInput(stop.actualDepartureTime || undefined),
            distanceFromOriginKm: Number(stop.distanceFromOriginKm || 0),
            status: stop.status || 'SCHEDULED',
            platform: stop.platform || '',
            note: stop.note || '',
        })) : [initialTripStop(1), initialTripStop(2)]);

        const prices = itinerary.segments.flatMap((segment) => segment.prices || []);
        setSegmentPricesForm(prices.length ? prices.map((price) => ({
            segmentId: price.segmentId,
            carriageTypeId: price.carriageTypeId,
            passengerType: price.passengerType || 'ADULT',
            price: Number(price.price || 0),
            currency: price.currency || 'VND',
            status: price.status || 'ACTIVE',
            effectiveFrom: toLocalDateTimeInput(price.effectiveFrom || undefined),
            effectiveTo: toLocalDateTimeInput(price.effectiveTo || undefined),
        })) : [initialSegmentPrice()]);
    }, [tripItineraryQuery.data]);

    const refreshActivePanel = () => {
        if (activeTab === 'stats') {
            statsQuery.refetch();
            return;
        }

        if (activeTab === 'segments') {
            tripsQuery.refetch();
            stationsQuery.refetch();
            if (Number(scheduleTripId) > 0) {
                tripItineraryQuery.refetch();
            }
            return;
        }

        activeQuery?.refetch();
    };

    if (!isAuthenticated) return null;

    if (!isAdmin) {
        return (
            <main className="min-h-screen bg-white flex flex-col">
                <Header />
                <section className="pt-44 pb-24 flex-1">
                    <div className="max-w-3xl mx-auto px-6 text-center">
                        <ShieldAlert size={42} className="mx-auto text-tet-red" />
                        <h1 className="mt-5 text-3xl font-black text-gray-950">Không có quyền truy cập admin</h1>
                        <p className="mt-3 text-sm font-bold text-gray-500">Tài khoản cần role ADMIN để sử dụng trang này.</p>
                    </div>
                </section>
                <Footer />
            </main>
        );
    }

    const renderToolbar = () => (
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-5 mb-7">
            <div>
                <p className="text-[10px] font-black uppercase tracking-[0.3em] text-tet-red">Admin</p>
                <h1 className="mt-2 text-4xl font-black text-gray-950 tracking-tight">Quản trị hệ thống</h1>
                <p className="mt-2 text-sm font-bold text-gray-500">Quản lý bookings, vé, tàu, chuyến, ga, khuyến mãi và người dùng.</p>
            </div>
            <ActionButton tone="plain" onClick={refreshActivePanel}>
                <RefreshCw size={14} /> Làm mới
            </ActionButton>
        </div>
    );

    const renderStats = () => {
        const stats = statsQuery.data;
        const routeStats = stats?.topRoutes || [];
        const bookingStatusCounts = stats?.bookingStatusCounts || [];
        const isStatsLoading = statsQuery.isLoading;
        return (
            <div className="space-y-7">
                {isStatsLoading && (
                    <div className="rounded-2xl border border-red-100 bg-red-50 px-4 py-3 text-xs font-black uppercase tracking-widest text-tet-red">
                        Đang tải thống kê...
                    </div>
                )}

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <StatCard label="Doanh thu xác nhận" value={formatMoney(stats?.revenue || 0)} note={`${stats?.revenueBookings || 0} booking đã xác nhận`} Icon={Ticket} tone="red" />
                    <StatCard label="Booking chờ xử lý" value={stats?.pendingBookings || 0} note={`${stats?.totalBookings || 0} booking tổng cộng`} Icon={LoaderCircle} tone="amber" />
                    <StatCard label="Chuyến đang mở" value={stats?.activeTrips || 0} note={`${stats?.totalTrips || 0} chuyến trong hệ thống`} Icon={CalendarClock} tone="blue" />
                    <StatCard label="Ghế đã giữ/bán" value={stats?.occupiedSeats || 0} note={`${stats?.availableSeats || 0}/${stats?.totalSeats || 0} ghế còn trống`} Icon={Train} tone="green" />
                </div>

                <div className="grid grid-cols-1 gap-5 xl:grid-cols-3">
                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm xl:col-span-2">
                        <div className="mb-5 flex items-center justify-between">
                            <div>
                                <p className="text-[10px] font-black uppercase tracking-[0.25em] text-tet-red">Top tuyến</p>
                                <h3 className="mt-1 text-xl font-black text-gray-950">Tuyến có nhiều chuyến</h3>
                            </div>
                            <Route size={22} className="text-gray-300" />
                        </div>
                        <div className="space-y-3">
                            {routeStats.map((route) => (
                                <div key={route.route} className="rounded-xl border border-gray-100 p-4">
                                    <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                        <p className="text-sm font-black text-gray-950">{route.route}</p>
                                        <div className="flex flex-wrap gap-2 text-[10px] font-black uppercase tracking-widest">
                                            <span className="rounded-full bg-gray-50 px-2.5 py-1 text-gray-500">{route.tripsCount} chuyến</span>
                                            <span className="rounded-full bg-green-50 px-2.5 py-1 text-green-700">{route.availableSeats} ghế trống</span>
                                            {route.minPrice ? <span className="rounded-full bg-red-50 px-2.5 py-1 text-tet-red">từ {formatMoney(route.minPrice)}</span> : null}
                                        </div>
                                    </div>
                                </div>
                            ))}
                            {!routeStats.length && <EmptyState isLoading={statsQuery.isLoading} isError={statsQuery.isError} />}
                        </div>
                    </div>

                    <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                        <div className="mb-5">
                            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-tet-red">Tổng quan dữ liệu</p>
                            <h3 className="mt-1 text-xl font-black text-gray-950">Danh mục</h3>
                        </div>
                        <div className="space-y-3">
                            {[
                                ['Ga', stats?.totalStations || 0],
                                ['Tàu', stats?.totalTrains || 0],
                                ['Người dùng', stats?.totalUsers || 0],
                                ['Khuyến mãi active', stats?.activePromotions || 0],
                            ].map(([label, value]) => (
                                <div key={String(label)} className="flex items-center justify-between rounded-xl bg-gray-50 px-4 py-3">
                                    <span className="text-xs font-black uppercase tracking-widest text-gray-400">{label}</span>
                                    <span className="text-lg font-black text-gray-950">{value}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
                    <div className="mb-5">
                        <p className="text-[10px] font-black uppercase tracking-[0.25em] text-tet-red">Booking status</p>
                        <h3 className="mt-1 text-xl font-black text-gray-950">Phân bổ trạng thái đơn</h3>
                    </div>
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                        {bookingStatusCounts.map((item) => (
                            <div key={item.status} className="rounded-xl border border-gray-100 p-4">
                                <StatusPill status={item.status} />
                                <p className="mt-3 text-2xl font-black text-gray-950">{item.count}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        );
    };

    const renderBookings = () => {
        const rows = bookingsQuery.data || [];
        return (
            <TableShell columns={['ID', 'Status', 'Seats', 'Total', 'Expired', 'Update', 'Actions']} empty={rows.length === 0 ? <EmptyState isLoading={bookingsQuery.isLoading} isError={bookingsQuery.isError} /> : null}>
                {rows.map((booking) => {
                    const statusValue = bookingStatus[booking.bookingId] || booking.status;
                    return (
                        <tr key={booking.bookingId}>
                            <td className="px-4 py-4 text-sm font-black">#{booking.bookingId}</td>
                            <td className="px-4 py-4"><StatusPill status={booking.status} /></td>
                            <td className="px-4 py-4 text-sm font-bold text-gray-700">{booking.seatNumbers?.join(', ') || '--'}</td>
                            <td className="px-4 py-4 text-sm font-black">{formatMoney(booking.totalPrice)}</td>
                            <td className="px-4 py-4 text-xs font-bold text-gray-500">{formatDateTime(booking.expiredAt)}</td>
                            <td className="px-4 py-4">
                                <div className="flex items-center gap-2">
                                    <select
                                        value={statusValue}
                                        onChange={(event) => setBookingStatus((prev) => ({ ...prev, [booking.bookingId]: event.target.value }))}
                                        className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold"
                                    >
                                        {bookingStatuses.map((status) => <option key={status} value={status}>{status}</option>)}
                                    </select>
                                    <ActionButton onClick={() => bookingStatusMutation.mutate({ id: booking.bookingId, status: statusValue })}>
                                        <Check size={13} /> Lưu
                                    </ActionButton>
                                </div>
                            </td>
                            <td className="px-4 py-4">
                                <ActionButton tone="red" onClick={() => deleteBookingMutation.mutate(booking.bookingId)}>
                                    <Trash2 size={13} /> Xóa
                                </ActionButton>
                            </td>
                        </tr>
                    );
                })}
            </TableShell>
        );
    };

    const renderPromotionForm = () => (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-7">
            <Field label="Title" value={promotionForm.title} onChange={(value) => setPromotionForm((prev) => ({ ...prev, title: value }))} />
            <Field label="Code" value={promotionForm.code} onChange={(value) => setPromotionForm((prev) => ({ ...prev, code: value }))} />
            <Field label="Discount type" value={promotionForm.discountType} onChange={(value) => setPromotionForm((prev) => ({ ...prev, discountType: value }))} options={['percent', 'amount', 'serviceFee']} />
            <Field label="Discount value" value={promotionForm.discountValue} onChange={(value) => setPromotionForm((prev) => ({ ...prev, discountValue: value }))} type="number" />
            <Field label="Starts at" value={promotionForm.startsAt} onChange={(value) => setPromotionForm((prev) => ({ ...prev, startsAt: value }))} type="date" />
            <Field label="Ends at" value={promotionForm.endsAt} onChange={(value) => setPromotionForm((prev) => ({ ...prev, endsAt: value }))} type="date" />
            <Field label="Route" value={promotionForm.route} onChange={(value) => setPromotionForm((prev) => ({ ...prev, route: value }))} />
            <Field label="Categories" value={promotionForm.categories} onChange={(value) => setPromotionForm((prev) => ({ ...prev, categories: value }))} />
            <Field label="Max discount" value={promotionForm.maxDiscountAmount} onChange={(value) => setPromotionForm((prev) => ({ ...prev, maxDiscountAmount: value }))} type="number" />
            <Field label="Min order" value={promotionForm.minOrderAmount} onChange={(value) => setPromotionForm((prev) => ({ ...prev, minOrderAmount: value }))} type="number" />
            <Field label="Usage limit" value={promotionForm.usageLimit} onChange={(value) => setPromotionForm((prev) => ({ ...prev, usageLimit: value }))} type="number" />
            <Field label="Status" value={promotionForm.status} onChange={(value) => setPromotionForm((prev) => ({ ...prev, status: value }))} options={promotionStatuses} />
            <label className="block md:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Description</span>
                <textarea value={promotionForm.description} onChange={(event) => setPromotionForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold outline-none focus:border-tet-red" />
            </label>
            <label className="block md:col-span-2">
                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Conditions</span>
                <textarea value={promotionForm.conditions} onChange={(event) => setPromotionForm((prev) => ({ ...prev, conditions: event.target.value }))} rows={3} className="mt-2 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm font-bold outline-none focus:border-tet-red" />
            </label>
            <div className="md:col-span-4 flex gap-2">
                <ActionButton onClick={() => savePromotionMutation.mutate()} disabled={!promotionForm.title || !promotionForm.code}>
                    <Save size={13} /> {editing?.type === 'promotions' ? 'Cập nhật promotion' : 'Tạo promotion'}
                </ActionButton>
                {editing?.type === 'promotions' && <ActionButton tone="plain" onClick={() => { setEditing(null); setPromotionForm(initialPromotion); }}>Hủy sửa</ActionButton>}
            </div>
        </div>
    );

    const renderPromotions = () => {
        const rows = promotionsQuery.data || [];
        return (
            <>
                <div className="grid grid-cols-1 md:grid-cols-7 gap-3 mb-5">
                    <Field label="Search" value={promotionFilters.q} onChange={(value) => setPromotionFilters((prev) => ({ ...prev, q: value }))} />
                    <Field label="Status" value={promotionFilters.status} onChange={(value) => setPromotionFilters((prev) => ({ ...prev, status: value }))} options={['', 'active', 'expiring']} />
                    <Field label="Sort" value={promotionFilters.sort} onChange={(value) => setPromotionFilters((prev) => ({ ...prev, sort: value }))} options={['newest', 'expiring', 'discount', 'easy']} />
                    <Field label="Route" value={promotionFilters.route} onChange={(value) => setPromotionFilters((prev) => ({ ...prev, route: value }))} />
                    <Field label="Discount" value={promotionFilters.discount} onChange={(value) => setPromotionFilters((prev) => ({ ...prev, discount: value }))} type="number" />
                    <Field label="Type" value={promotionFilters.type} onChange={(value) => setPromotionFilters((prev) => ({ ...prev, type: value }))} />
                    <Field label="Category" value={promotionFilters.category} onChange={(value) => setPromotionFilters((prev) => ({ ...prev, category: value }))} />
                </div>
                {renderPromotionForm()}
                <TableShell columns={['Code', 'Title', 'Discount', 'Route', 'Ends', 'Status', 'Actions']} empty={rows.length === 0 ? <EmptyState isLoading={promotionsQuery.isLoading} isError={promotionsQuery.isError} /> : null}>
                    {rows.map((promotion) => (
                        <tr key={promotion.id}>
                            <td className="px-4 py-4 text-sm font-black">{promotion.code}</td>
                            <td className="px-4 py-4 text-sm font-bold">{promotion.title}</td>
                            <td className="px-4 py-4 text-sm font-black">{promotion.discountType} {promotion.discountValue}</td>
                            <td className="px-4 py-4 text-xs font-bold text-gray-500">{promotion.route || '--'}</td>
                            <td className="px-4 py-4 text-xs font-bold">{promotion.endsAt}</td>
                            <td className="px-4 py-4"><StatusPill status={promotion.status} /></td>
                            <td className="px-4 py-4">
                                <div className="flex gap-2">
                                    <ActionButton tone="plain" onClick={() => {
                                        setEditing({ type: 'promotions', id: promotion.id });
                                        setPromotionForm({
                                            title: promotion.title || '',
                                            description: promotion.description || '',
                                            code: promotion.code || '',
                                            discountType: promotion.discountType || 'percent',
                                            discountValue: String(promotion.discountValue ?? ''),
                                            maxDiscountAmount: String(promotion.maxDiscountAmount ?? ''),
                                            minOrderAmount: String(promotion.minOrderAmount ?? ''),
                                            startsAt: promotion.startsAt || '',
                                            endsAt: promotion.endsAt || '',
                                            conditions: promotion.conditions || '',
                                            route: promotion.route || '',
                                            categories: Array.isArray(promotion.categories) ? promotion.categories.join(',') : '',
                                            usageLimit: String(promotion.usageLimit ?? ''),
                                            usedCount: String(promotion.usedCount ?? 0),
                                            easeScore: String(promotion.easeScore ?? 70),
                                            status: promotion.status || 'ACTIVE',
                                        });
                                    }}><SquarePen size={13} /> Sửa</ActionButton>
                                    <ActionButton tone="red" onClick={() => deletePromotionMutation.mutate(promotion.id)}><Trash2 size={13} /> Xóa</ActionButton>
                                </div>
                            </td>
                        </tr>
                    ))}
                </TableShell>
            </>
        );
    };

    const renderStations = () => {
        const rows = stationsQuery.data || [];
        return (
            <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-7">
                    <Field label="Name" value={stationForm.name} onChange={(value) => setStationForm((prev) => ({ ...prev, name: value }))} />
                    <Field label="Code" value={stationForm.code} onChange={(value) => setStationForm((prev) => ({ ...prev, code: value }))} />
                    <Field label="Location" value={stationForm.location} onChange={(value) => setStationForm((prev) => ({ ...prev, location: value }))} />
                    <div className="flex items-end gap-2">
                        <ActionButton onClick={() => saveStationMutation.mutate()} disabled={!stationForm.name || !stationForm.code}>
                            <Save size={13} /> {editing?.type === 'stations' ? 'Cập nhật' : 'Tạo ga'}
                        </ActionButton>
                    </div>
                </div>
                <TableShell columns={['ID', 'Name', 'Code', 'Location', 'Actions']} empty={rows.length === 0 ? <EmptyState isLoading={stationsQuery.isLoading} isError={stationsQuery.isError} /> : null}>
                    {rows.map((station) => (
                        <tr key={station.id}>
                            <td className="px-4 py-4 text-sm font-black">#{station.id}</td>
                            <td className="px-4 py-4 text-sm font-black">{station.name}</td>
                            <td className="px-4 py-4 text-sm font-bold">{station.code}</td>
                            <td className="px-4 py-4 text-sm font-bold text-gray-500">{station.location}</td>
                            <td className="px-4 py-4">
                                <div className="flex gap-2">
                                    <ActionButton tone="plain" onClick={() => { setEditing({ type: 'stations', id: station.id }); setStationForm({ name: station.name, code: station.code, location: station.location }); }}><SquarePen size={13} /> Sửa</ActionButton>
                                    <ActionButton tone="red" onClick={() => deleteStationMutation.mutate(station.id)}><Trash2 size={13} /> Xóa</ActionButton>
                                </div>
                            </td>
                        </tr>
                    ))}
                </TableShell>
            </>
        );
    };

    const renderTrains = () => {
        const rows = trainsQuery.data || [];
        return (
            <>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-7">
                    <Field label="Code" value={trainForm.code} onChange={(value) => setTrainForm((prev) => ({ ...prev, code: value }))} />
                    <Field label="Category" value={trainForm.category} onChange={(value) => setTrainForm((prev) => ({ ...prev, category: value }))} />
                    <Field label="Description" value={trainForm.description} onChange={(value) => setTrainForm((prev) => ({ ...prev, description: value }))} />
                    <div className="flex items-end"><ActionButton onClick={() => saveTrainMutation.mutate()} disabled={!trainForm.code}><Save size={13} /> {editing?.type === 'trains' ? 'Cập nhật' : 'Tạo tàu'}</ActionButton></div>
                </div>
                <TableShell columns={['ID', 'Code', 'Category', 'Description', 'Actions']} empty={rows.length === 0 ? <EmptyState isLoading={trainsQuery.isLoading} isError={trainsQuery.isError} /> : null}>
                    {rows.map((train) => (
                        <tr key={train.id}>
                            <td className="px-4 py-4 text-sm font-black">#{train.id}</td>
                            <td className="px-4 py-4 text-sm font-black">{train.code}</td>
                            <td className="px-4 py-4 text-sm font-bold">{train.category}</td>
                            <td className="px-4 py-4 text-sm font-bold text-gray-500">{train.description || '--'}</td>
                            <td className="px-4 py-4"><div className="flex gap-2"><ActionButton tone="plain" onClick={() => { setEditing({ type: 'trains', id: train.id }); setTrainForm({ code: train.code, category: train.category, description: train.description || '' }); }}><SquarePen size={13} /> Sửa</ActionButton><ActionButton tone="red" onClick={() => deleteTrainMutation.mutate(train.id)}><Trash2 size={13} /> Xóa</ActionButton></div></td>
                        </tr>
                    ))}
                </TableShell>
            </>
        );
    };

    const renderSegments = () => {
        const itinerary = tripItineraryQuery.data;
        const trips = tripsQuery.data || [];
        const stations = stationsQuery.data || [];
        const updateStop = (index: number, patch: Partial<TripStopRequest>) => {
            setTripStopsForm((prev) => prev.map((stop, itemIndex) => itemIndex === index ? { ...stop, ...patch } : stop));
        };
        const updatePrice = (index: number, patch: Partial<TripSegmentPriceRequest>) => {
            setSegmentPricesForm((prev) => prev.map((price, itemIndex) => itemIndex === index ? { ...price, ...patch } : price));
        };

        return (
            <div className="space-y-6">
                <div className="rounded-2xl border border-gray-100 bg-gray-50/60 p-5">
                    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-tet-red">Trip itinerary</p>
                            <h3 className="mt-1 text-xl font-black text-gray-950">Stops, segments, and fare table</h3>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                            <label className="block min-w-[280px]">
                                <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Chọn chuyến</span>
                                <select
                                    value={scheduleTripId}
                                    onChange={(event) => setScheduleTripId(event.target.value)}
                                    className="mt-2 w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-bold text-gray-900 outline-none focus:border-tet-red"
                                >
                                    <option value="">Chọn chuyến</option>
                                    {trips.map((trip) => (
                                        <option key={trip.id} value={trip.id}>
                                            #{trip.id} - {trip.trainCode}: {trip.departureStation} → {trip.arrivalStation}
                                        </option>
                                    ))}
                                </select>
                            </label>
                            <ActionButton tone="plain" onClick={() => tripItineraryQuery.refetch()} disabled={Number(scheduleTripId) <= 0}>
                                <RefreshCw size={13} /> Load
                            </ActionButton>
                        </div>
                    </div>

                    {tripItineraryQuery.isLoading ? (
                        <EmptyState isLoading />
                    ) : (
                        <div className="grid gap-5 xl:grid-cols-2">
                            <div className="rounded-2xl border border-gray-100 bg-white p-4">
                                <div className="mb-4 flex items-center justify-between">
                                    <h4 className="text-sm font-black text-gray-900">Ga dừng</h4>
                                    <ActionButton tone="plain" onClick={() => setTripStopsForm((prev) => [...prev, initialTripStop(prev.length + 1)])}>+ Stop</ActionButton>
                                </div>
                                <div className="space-y-3">
                                    {tripStopsForm.map((stop, index) => (
                                        <div key={index} className="grid grid-cols-2 gap-2 rounded-xl border border-gray-100 p-3 md:grid-cols-4">
                                            <select className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" value={stop.stationId || ''} onChange={(event) => updateStop(index, { stationId: Number(event.target.value) })}>
                                                <option value="">Ga</option>
                                                {stations.map((station) => (
                                                    <option key={station.id} value={station.id}>{station.name} ({station.code})</option>
                                                ))}
                                            </select>
                                            <input className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" placeholder="Order" type="number" value={stop.stopOrder || ''} onChange={(event) => updateStop(index, { stopOrder: Number(event.target.value) })} />
                                            <input className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" type="datetime-local" value={String(stop.scheduledArrivalTime || '')} onChange={(event) => updateStop(index, { scheduledArrivalTime: event.target.value })} />
                                            <input className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" type="datetime-local" value={String(stop.scheduledDepartureTime || '')} onChange={(event) => updateStop(index, { scheduledDepartureTime: event.target.value })} />
                                            <input className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" placeholder="Km từ ga đầu" type="number" value={stop.distanceFromOriginKm ?? ''} onChange={(event) => updateStop(index, { distanceFromOriginKm: Number(event.target.value) })} />
                                            <select className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" value={stop.status || 'SCHEDULED'} onChange={(event) => updateStop(index, { status: event.target.value })}>
                                                {['SCHEDULED', 'ARRIVING', 'ARRIVED', 'DEPARTED', 'DELAYED', 'SKIPPED', 'CANCELLED'].map((status) => <option key={status} value={status}>{status}</option>)}
                                            </select>
                                            <input className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" placeholder="Platform" value={stop.platform || ''} onChange={(event) => updateStop(index, { platform: event.target.value })} />
                                            <button type="button" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-tet-red" onClick={() => setTripStopsForm((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4">
                                    <ActionButton onClick={() => saveTripStopsMutation.mutate()} disabled={Number(scheduleTripId) <= 0 || saveTripStopsMutation.isPending}>
                                        <Save size={13} /> Save stops
                                    </ActionButton>
                                </div>
                            </div>

                            <div className="rounded-2xl border border-gray-100 bg-white p-4">
                                <div className="mb-4 flex items-center justify-between">
                                    <h4 className="text-sm font-black text-gray-900">Giá theo chặng</h4>
                                    <ActionButton tone="plain" onClick={() => setSegmentPricesForm((prev) => [...prev, initialSegmentPrice()])}>+ Price</ActionButton>
                                </div>
                                {itinerary?.segments?.length ? (
                                    <div className="mb-4 grid gap-2">
                                        {itinerary.segments.map((segment) => (
                                            <div key={segment.id} className="rounded-lg bg-gray-50 px-3 py-2 text-[10px] font-black text-gray-500">
                                                #{segment.id}: {segment.fromStationName}{' → '}{segment.toStationName}
                                            </div>
                                        ))}
                                    </div>
                                ) : null}
                                <div className="space-y-3">
                                    {segmentPricesForm.map((price, index) => (
                                        <div key={index} className="grid grid-cols-2 gap-2 rounded-xl border border-gray-100 p-3 md:grid-cols-5">
                                            <select className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" value={price.segmentId || ''} onChange={(event) => updatePrice(index, { segmentId: Number(event.target.value) })}>
                                                <option value="">Chặng</option>
                                                {itinerary?.segments?.map((segment) => (
                                                    <option key={segment.id} value={segment.id}>#{segment.id} {segment.fromStationName} → {segment.toStationName}</option>
                                                ))}
                                            </select>
                                            <input className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" placeholder="Type ID" type="number" value={price.carriageTypeId || ''} onChange={(event) => updatePrice(index, { carriageTypeId: Number(event.target.value) })} />
                                            <input className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" placeholder="Passenger" value={price.passengerType || 'ADULT'} onChange={(event) => updatePrice(index, { passengerType: event.target.value })} />
                                            <input className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" placeholder="Price" type="number" value={price.price || ''} onChange={(event) => updatePrice(index, { price: Number(event.target.value) })} />
                                            <button type="button" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-tet-red" onClick={() => setSegmentPricesForm((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                                        </div>
                                    ))}
                                </div>
                                <div className="mt-4">
                                    <ActionButton onClick={() => saveSegmentPricesMutation.mutate()} disabled={Number(scheduleTripId) <= 0 || saveSegmentPricesMutation.isPending}>
                                        <Save size={13} /> Save prices
                                    </ActionButton>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        );
    };

    const renderTrips = () => {
        const rows = tripsQuery.data || [];
        const itinerary = tripItineraryQuery.data;
        const updateStop = (index: number, patch: Partial<TripStopRequest>) => {
            setTripStopsForm((prev) => prev.map((stop, itemIndex) => itemIndex === index ? { ...stop, ...patch } : stop));
        };
        const updatePrice = (index: number, patch: Partial<TripSegmentPriceRequest>) => {
            setSegmentPricesForm((prev) => prev.map((price, itemIndex) => itemIndex === index ? { ...price, ...patch } : price));
        };
        return (
            <>
                <div className="grid grid-cols-1 md:grid-cols-7 gap-4 mb-7">
                    <Field label="Train ID" value={tripForm.trainId} onChange={(value) => setTripForm((prev) => ({ ...prev, trainId: value }))} type="number" />
                    <Field label="From station ID" value={tripForm.departureStationId} onChange={(value) => setTripForm((prev) => ({ ...prev, departureStationId: value }))} type="number" />
                    <Field label="To station ID" value={tripForm.arrivalStationId} onChange={(value) => setTripForm((prev) => ({ ...prev, arrivalStationId: value }))} type="number" />
                    <Field label="Departure" value={tripForm.departureTime} onChange={(value) => setTripForm((prev) => ({ ...prev, departureTime: value }))} type="datetime-local" />
                    <Field label="Arrival" value={tripForm.arrivalTime} onChange={(value) => setTripForm((prev) => ({ ...prev, arrivalTime: value }))} type="datetime-local" />
                    <Field label="Status" value={tripForm.status} onChange={(value) => setTripForm((prev) => ({ ...prev, status: value }))} options={commonStatuses} />
                    <div className="flex items-end"><ActionButton onClick={() => saveTripMutation.mutate()} disabled={!tripForm.trainId || !tripForm.departureStationId || !tripForm.arrivalStationId}><Save size={13} /> {editing?.type === 'trips' ? 'Cập nhật' : 'Tạo chuyến'}</ActionButton></div>
                </div>
                <div className="mb-7 rounded-2xl border border-gray-100 bg-gray-50/60 p-5">
                    <div className="mb-5 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.25em] text-tet-red">Trip itinerary</p>
                            <h3 className="mt-1 text-xl font-black text-gray-950">Stops, segments, and fare table</h3>
                        </div>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                            <Field label="Trip ID" value={scheduleTripId} onChange={setScheduleTripId} type="number" />
                            <ActionButton tone="plain" onClick={() => tripItineraryQuery.refetch()} disabled={Number(scheduleTripId) <= 0}>
                                <RefreshCw size={13} /> Load
                            </ActionButton>
                        </div>
                    </div>

                    <div className="grid gap-5 xl:grid-cols-2">
                        <div className="rounded-2xl border border-gray-100 bg-white p-4">
                            <div className="mb-4 flex items-center justify-between">
                                <h4 className="text-sm font-black text-gray-900">Stops</h4>
                                <ActionButton tone="plain" onClick={() => setTripStopsForm((prev) => [...prev, initialTripStop(prev.length + 1)])}>+ Stop</ActionButton>
                            </div>
                            <div className="space-y-3">
                                {tripStopsForm.map((stop, index) => (
                                    <div key={index} className="grid grid-cols-2 gap-2 rounded-xl border border-gray-100 p-3 md:grid-cols-4">
                                        <input className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" placeholder="Station ID" type="number" value={stop.stationId || ''} onChange={(event) => updateStop(index, { stationId: Number(event.target.value) })} />
                                        <input className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" placeholder="Order" type="number" value={stop.stopOrder || ''} onChange={(event) => updateStop(index, { stopOrder: Number(event.target.value) })} />
                                        <input className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" type="datetime-local" value={String(stop.scheduledArrivalTime || '')} onChange={(event) => updateStop(index, { scheduledArrivalTime: event.target.value })} />
                                        <input className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" type="datetime-local" value={String(stop.scheduledDepartureTime || '')} onChange={(event) => updateStop(index, { scheduledDepartureTime: event.target.value })} />
                                        <input className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" placeholder="Km" type="number" value={stop.distanceFromOriginKm ?? ''} onChange={(event) => updateStop(index, { distanceFromOriginKm: Number(event.target.value) })} />
                                        <select className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" value={stop.status || 'SCHEDULED'} onChange={(event) => updateStop(index, { status: event.target.value })}>
                                            {['SCHEDULED', 'ARRIVING', 'ARRIVED', 'DEPARTED', 'DELAYED', 'SKIPPED', 'CANCELLED'].map((status) => <option key={status} value={status}>{status}</option>)}
                                        </select>
                                        <input className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" placeholder="Platform" value={stop.platform || ''} onChange={(event) => updateStop(index, { platform: event.target.value })} />
                                        <button type="button" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-tet-red" onClick={() => setTripStopsForm((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4">
                                <ActionButton onClick={() => saveTripStopsMutation.mutate()} disabled={Number(scheduleTripId) <= 0 || saveTripStopsMutation.isPending}>
                                    <Save size={13} /> Save stops
                                </ActionButton>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-gray-100 bg-white p-4">
                            <div className="mb-4 flex items-center justify-between">
                                <h4 className="text-sm font-black text-gray-900">Segment prices</h4>
                                <ActionButton tone="plain" onClick={() => setSegmentPricesForm((prev) => [...prev, initialSegmentPrice()])}>+ Price</ActionButton>
                            </div>
                            {itinerary?.segments?.length ? (
                                <div className="mb-4 flex flex-wrap gap-2">
                                    {itinerary.segments.map((segment) => (
                                        <span key={segment.id} className="rounded-lg bg-gray-50 px-3 py-2 text-[10px] font-black text-gray-500">
                                            #{segment.id}: {segment.fromStationName}{' -> '}{segment.toStationName}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                            <div className="space-y-3">
                                {segmentPricesForm.map((price, index) => (
                                    <div key={index} className="grid grid-cols-2 gap-2 rounded-xl border border-gray-100 p-3 md:grid-cols-5">
                                        <input className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" placeholder="Segment ID" type="number" value={price.segmentId || ''} onChange={(event) => updatePrice(index, { segmentId: Number(event.target.value) })} />
                                        <input className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" placeholder="Type ID" type="number" value={price.carriageTypeId || ''} onChange={(event) => updatePrice(index, { carriageTypeId: Number(event.target.value) })} />
                                        <input className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" placeholder="Passenger" value={price.passengerType || 'ADULT'} onChange={(event) => updatePrice(index, { passengerType: event.target.value })} />
                                        <input className="rounded-lg border border-gray-200 px-3 py-2 text-xs font-bold" placeholder="Price" type="number" value={price.price || ''} onChange={(event) => updatePrice(index, { price: Number(event.target.value) })} />
                                        <button type="button" className="rounded-lg bg-red-50 px-3 py-2 text-xs font-black text-tet-red" onClick={() => setSegmentPricesForm((prev) => prev.filter((_, itemIndex) => itemIndex !== index))}>Remove</button>
                                    </div>
                                ))}
                            </div>
                            <div className="mt-4">
                                <ActionButton onClick={() => saveSegmentPricesMutation.mutate()} disabled={Number(scheduleTripId) <= 0 || saveSegmentPricesMutation.isPending}>
                                    <Save size={13} /> Save prices
                                </ActionButton>
                            </div>
                        </div>
                    </div>
                </div>
                <TableShell columns={['ID', 'Train', 'Route', 'Departure', 'Arrival', 'Seats', 'Status', 'Actions']} empty={rows.length === 0 ? <EmptyState isLoading={tripsQuery.isLoading} isError={tripsQuery.isError} /> : null}>
                    {rows.map((trip) => (
                        <tr key={trip.id}>
                            <td className="px-4 py-4 text-sm font-black">#{trip.id}</td>
                            <td className="px-4 py-4 text-sm font-black">{trip.trainCode}</td>
                            <td className="px-4 py-4 text-xs font-bold">{trip.departureStation} → {trip.arrivalStation}</td>
                            <td className="px-4 py-4 text-xs font-bold text-gray-500">{formatDateTime(trip.departureTime)}</td>
                            <td className="px-4 py-4 text-xs font-bold text-gray-500">{formatDateTime(trip.arrivalTime)}</td>
                            <td className="px-4 py-4 text-sm font-bold">{trip.availableSeats ?? '--'} / {trip.totalSeats ?? '--'}</td>
                            <td className="px-4 py-4"><StatusPill status={trip.status} /></td>
                            <td className="px-4 py-4">
                                <div className="flex gap-2">
                                    <ActionButton tone="plain" onClick={() => {
                                        setEditing({ type: 'trips', id: trip.id });
                                        setTripForm({ ...initialTrip, departureTime: toLocalDateTimeInput(trip.departureTime), arrivalTime: toLocalDateTimeInput(trip.arrivalTime), status: trip.status || 'ACTIVE' });
                                    }}><SquarePen size={13} /> Sửa</ActionButton>
                                    <ActionButton tone="red" onClick={() => deleteTripMutation.mutate(trip.id)}><Trash2 size={13} /> Xóa</ActionButton>
                                </div>
                            </td>
                        </tr>
                    ))}
                </TableShell>
            </>
        );
    };

    const renderTickets = () => {
        const rows = ticketsQuery.data || [];
        return (
            <>
                <div className="grid grid-cols-1 md:grid-cols-[240px_1fr] gap-4 mb-7">
                    <Field label="Trip ID" value={ticketTripId} onChange={setTicketTripId} type="number" />
                    {editing?.type === 'tickets' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <Field label="Price" value={ticketForm.price} onChange={(value) => setTicketForm((prev) => ({ ...prev, price: value }))} type="number" />
                            <Field label="Status" value={ticketForm.status} onChange={(value) => setTicketForm((prev) => ({ ...prev, status: value }))} options={ticketStatuses} />
                            <div className="flex items-end"><ActionButton onClick={() => saveTicketMutation.mutate()}><Save size={13} /> Cập nhật vé</ActionButton></div>
                        </div>
                    )}
                </div>
                <TableShell columns={['ID', 'Seat', 'Price', 'Status', 'Booking', 'Passenger', 'Actions']} empty={rows.length === 0 ? <EmptyState isLoading={ticketsQuery.isLoading} isError={ticketsQuery.isError} /> : null}>
                    {rows.map((ticket) => {
                        const id = getItemId(ticket);
                        return (
                            <tr key={id}>
                                <td className="px-4 py-4 text-sm font-black">#{id}</td>
                                <td className="px-4 py-4 text-sm font-bold">{ticket.seatNumber || '--'}</td>
                                <td className="px-4 py-4 text-sm font-black">{formatMoney(ticket.price)}</td>
                                <td className="px-4 py-4"><StatusPill status={ticket.status} /></td>
                                <td className="px-4 py-4 text-sm font-bold">{ticket.bookingId ? `#${ticket.bookingId}` : '--'}</td>
                                <td className="px-4 py-4 text-sm font-bold text-gray-500">{ticket.passengerName || '--'}</td>
                                <td className="px-4 py-4"><div className="flex gap-2"><ActionButton tone="plain" onClick={() => { setEditing({ type: 'tickets', id }); setTicketForm({ price: String(ticket.price || 0), status: ticket.status || 'AVAILABLE' }); }}><SquarePen size={13} /> Sửa</ActionButton><ActionButton tone="red" onClick={() => deleteTicketMutation.mutate(id)}><Trash2 size={13} /> Xóa</ActionButton></div></td>
                            </tr>
                        );
                    })}
                </TableShell>
            </>
        );
    };

    const renderUsers = () => {
        const rows = usersQuery.data || [];
        return (
            <>
                <div className="mb-5 text-xs font-bold text-gray-500">Roles từ API: {(rolesQuery.data || []).join(', ') || '--'}</div>
                {editing?.type === 'users' && (
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-7">
                        <Field label="Name" value={userForm.name} onChange={(value) => setUserForm((prev) => ({ ...prev, name: value }))} />
                        <Field label="Phone" value={userForm.phone} onChange={(value) => setUserForm((prev) => ({ ...prev, phone: value }))} />
                        <Field label="Roles comma" value={userForm.roles} onChange={(value) => setUserForm((prev) => ({ ...prev, roles: value }))} />
                        <div className="flex items-end"><ActionButton onClick={() => saveUserMutation.mutate()}><Save size={13} /> Cập nhật user</ActionButton></div>
                    </div>
                )}
                <TableShell columns={['ID', 'Name', 'Email', 'Phone', 'Roles', 'Actions']} empty={rows.length === 0 ? <EmptyState isLoading={usersQuery.isLoading} isError={usersQuery.isError} /> : null}>
                    {rows.map((item) => (
                        <tr key={item.id}>
                            <td className="px-4 py-4 text-sm font-black">#{item.id}</td>
                            <td className="px-4 py-4 text-sm font-black">{item.name}</td>
                            <td className="px-4 py-4 text-sm font-bold">{item.email}</td>
                            <td className="px-4 py-4 text-sm font-bold">{item.phone || '--'}</td>
                            <td className="px-4 py-4 text-xs font-black">{item.roles?.join(', ') || '--'}</td>
                            <td className="px-4 py-4"><div className="flex gap-2"><ActionButton tone="plain" onClick={() => { setEditing({ type: 'users', id: item.id }); setUserForm({ name: item.name || '', phone: item.phone || '', roles: item.roles?.join(',') || 'CUSTOMER' }); }}><SquarePen size={13} /> Sửa</ActionButton><ActionButton tone="red" onClick={() => deleteUserMutation.mutate(item.id)}><Trash2 size={13} /> Xóa</ActionButton></div></td>
                        </tr>
                    ))}
                </TableShell>
            </>
        );
    };

    const renderActivePanel = () => {
        if (activeTab === 'stats') return renderStats();
        if (activeTab === 'bookings') return renderBookings();
        if (activeTab === 'promotions') return renderPromotions();
        if (activeTab === 'stations') return renderStations();
        if (activeTab === 'tickets') return renderTickets();
        if (activeTab === 'trains') return renderTrains();
        if (activeTab === 'trips') return renderTrips();
        if (activeTab === 'segments') return renderSegments();
        if (activeTab === 'users') return renderUsers();
        return null;
    };

    return (
        <main className="min-h-screen bg-white flex flex-col">
            <Helmet>
                <title>Admin - Vé Tàu Việt Nam</title>
                <meta name="description" content="Trang quản trị hệ thống Vé Tàu Việt Nam" />
            </Helmet>
            <Header />

            <section className="pt-44 pb-24 flex-1">
                <div className="max-w-[1500px] mx-auto px-5 md:px-10">
                    {renderToolbar()}

                    <div className="grid grid-cols-1 xl:grid-cols-[220px_1fr] gap-8">
                        <nav className="xl:border-r xl:border-gray-100 xl:pr-5">
                            <div className="flex xl:flex-col gap-2 overflow-x-auto pb-2 xl:pb-0">
                                {tabs.map((tab) => (
                                    <button
                                        key={tab.id}
                                        type="button"
                                        onClick={() => { setActiveTab(tab.id); setEditing(null); }}
                                        className={cn(
                                            'flex shrink-0 items-center gap-3 rounded-xl px-4 py-3 text-sm font-black transition-all',
                                            activeTab === tab.id
                                                ? 'bg-gray-950 text-white'
                                                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-950'
                                        )}
                                    >
                                        <tab.icon size={17} />
                                        {tab.label}
                                    </button>
                                ))}
                            </div>
                        </nav>

                        <section className="min-w-0">
                            <div className="mb-5 flex items-center justify-between gap-4">
                                <div>
                                    <h2 className="text-2xl font-black text-gray-950">{tabs.find((tab) => tab.id === activeTab)?.label}</h2>
                                    <p className="mt-1 text-xs font-bold text-gray-400 uppercase tracking-widest">
                                        {tabs.find((tab) => tab.id === activeTab)?.meta || `CRUD endpoint /admin/${activeTab}`}
                                    </p>
                                </div>
                            </div>
                            {renderActivePanel()}
                        </section>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
};

export default Admin;
