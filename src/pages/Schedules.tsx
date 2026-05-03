import React, { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { cn } from '@/lib/utils';
import { useQuery } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'framer-motion';
import {
    AlertCircle,
    Armchair,
    ArrowRightLeft,
    ArrowUpDown,
    BadgeCheck,
    Ban,
    CalendarDays,
    CheckCircle2,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Filter,
    MapPin,
    RotateCcw,
    Search,
    SlidersHorizontal,
    Ticket,
    Train,
    Users,
    X,
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { tripApi } from '../api/trip.api';
import { Seat, Trip } from '../types/api.types';

type SortValue = 'earliest' | 'price-asc' | 'price-desc' | 'duration-asc' | 'seats-desc';

const ITEMS_PER_PAGE = 6;

const TIME_WINDOWS = [
    { value: '00-06', label: '00:00 - 06:00', shortLabel: '00:00 - 06:00', start: 0, end: 6 * 60 },
    { value: '06-12', label: '06:00 - 12:00', shortLabel: '06:00 - 12:00', start: 6 * 60, end: 12 * 60 },
    { value: '12-18', label: '12:00 - 18:00', shortLabel: '12:00 - 18:00', start: 12 * 60, end: 18 * 60 },
    { value: '18-24', label: '18:00 - 24:00', shortLabel: '18:00 - 24:00', start: 18 * 60, end: 24 * 60 },
];

const TRAIN_TYPES = [
    { value: 'SE_TN', label: 'SE/TN' },
    { value: 'CLC', label: 'CLC' },
    { value: 'TET', label: 'Tàu Tết' },
    { value: 'SUBURBAN', label: 'Ngoại ô' },
];

const SEAT_TYPES = [
    { value: 'seat', label: 'Ghế ngồi' },
    { value: 'bed', label: 'Giường nằm' },
    { value: 'cabin4', label: 'Khoang 4' },
    { value: 'cabin6', label: 'Khoang 6' },
];

const TICKET_STATUSES = [
    { value: 'available', label: 'Còn vé' },
    { value: 'low', label: 'Sắp hết vé' },
    { value: 'soldout', label: 'Hết vé' },
];

const DURATION_FILTERS = [
    { value: 'under-6', label: 'Dưới 6 giờ' },
    { value: '6-12', label: '6 - 12 giờ' },
    { value: 'over-12', label: 'Trên 12 giờ' },
];

const SORT_OPTIONS: { value: SortValue; label: string }[] = [
    { value: 'earliest', label: 'Giờ đi sớm nhất' },
    { value: 'price-asc', label: 'Giá thấp nhất' },
    { value: 'price-desc', label: 'Giá cao nhất' },
    { value: 'duration-asc', label: 'Thời gian chạy ngắn nhất' },
    { value: 'seats-desc', label: 'Còn nhiều ghế nhất' },
];

const TICKET_TYPES = [
    { value: 'one-way', label: 'Một chiều' },
    { value: 'round-trip', label: 'Khứ hồi' },
];

const formatCurrency = (value?: number | null) => {
    const amount = Number(value || 0);
    return `${amount.toLocaleString('vi-VN')}đ`;
};

const normalizeText = (value = '') =>
    value
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/g, 'd')
        .replace(/Đ/g, 'D')
        .toLowerCase();

const readDate = (value?: string) => {
    if (!value) return null;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
};

const toDateInputValue = (value?: string) => {
    const date = readDate(value);
    if (!date) return '';
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
};

const formatDate = (value?: string) => {
    const date = readDate(value);
    if (!date) return value || '--';
    return date.toLocaleDateString('vi-VN', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const formatTime = (value?: string) => {
    if (!value) return '--:--';
    const date = readDate(value);
    if (date) return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
    const match = value.match(/(\d{1,2}):(\d{2})/);
    return match ? `${match[1].padStart(2, '0')}:${match[2]}` : value;
};

const getTimeMinutes = (value?: string) => {
    const date = readDate(value);
    if (date) return date.getHours() * 60 + date.getMinutes();
    const match = value?.match(/(\d{1,2}):(\d{2})/);
    return match ? Number(match[1]) * 60 + Number(match[2]) : Number.MAX_SAFE_INTEGER;
};

const getTripSeats = (trip: Trip): Seat[] => {
    const directSeats = trip.seats || [];
    const carriageSeats = (trip.carriages || []).flatMap((carriage) => carriage.seats || []);
    return directSeats.length ? directSeats : carriageSeats;
};

const getTripPrice = (trip: Trip) => {
    const seatPrices = getTripSeats(trip)
        .map((seat) => seat.price)
        .filter((price) => typeof price === 'number' && Number.isFinite(price));
    return trip.finalPrice ?? trip.price ?? trip.minPrice ?? (seatPrices.length ? Math.min(...seatPrices) : 0);
};

const getTripOriginalPrice = (trip: Trip) => trip.originalPrice ?? trip.minPrice ?? trip.price ?? getTripPrice(trip);

const getAvailableSeats = (trip: Trip) => {
    if (typeof trip.availableSeats === 'number') return trip.availableSeats;
    return getTripSeats(trip).filter((seat) => seat.status === 'AVAILABLE').length;
};

const parseDurationMinutes = (trip: Trip) => {
    if (typeof trip.duration === 'number') return trip.duration;

    if (typeof trip.duration === 'string') {
        const duration = normalizeText(trip.duration);
        const hourMatch = duration.match(/(\d+)\s*(h|gio|hour)/);
        const minuteMatch = duration.match(/(\d+)\s*(m|phut|min)/);
        if (hourMatch || minuteMatch) {
            return Number(hourMatch?.[1] || 0) * 60 + Number(minuteMatch?.[1] || 0);
        }

        const colonMatch = duration.match(/(\d{1,2}):(\d{2})/);
        if (colonMatch) return Number(colonMatch[1]) * 60 + Number(colonMatch[2]);
    }

    const departure = readDate(trip.departureTime);
    const arrival = readDate(trip.arrivalTime);
    if (departure && arrival) {
        const minutes = Math.round((arrival.getTime() - departure.getTime()) / 60000);
        return minutes > 0 ? minutes : minutes + 24 * 60;
    }

    return Number.MAX_SAFE_INTEGER;
};

const formatDuration = (trip: Trip) => {
    const minutes = parseDurationMinutes(trip);
    if (!Number.isFinite(minutes) || minutes === Number.MAX_SAFE_INTEGER) return '--';
    const hours = Math.floor(minutes / 60);
    const rest = minutes % 60;
    if (!hours) return `${rest} phút`;
    if (!rest) return `${hours} giờ`;
    return `${hours} giờ ${rest} phút`;
};

const getTrainType = (trip: Trip) => {
    const code = normalizeText(trip.trainCode || '');
    const carriageText = normalizeText((trip.carriages || []).map((carriage) => carriage.carriageTypeName).join(' '));
    if (code.includes('tet') || code.includes('tt')) return 'Tàu Tết';
    if (code.includes('clc') || code.includes('vip') || carriageText.includes('vip') || carriageText.includes('chat luong cao')) return 'CLC';
    if (code.startsWith('lp') || code.startsWith('sp') || code.includes('ngoai o')) return 'Ngoại ô';
    return 'SE/TN';
};

const getSeatLabels = (trip: Trip) => {
    const text = normalizeText((trip.carriages || []).map((carriage) => carriage.carriageTypeName).join(' '));
    const labels = new Set<string>();

    if (text.includes('ghe') || text.includes('ngoi') || text.includes('seat') || text.includes('chair')) labels.add('Ghế ngồi');
    if (text.includes('giuong') || text.includes('nam') || text.includes('bed') || text.includes('berth')) labels.add('Giường nằm');
    if (text.includes('4')) labels.add('Khoang 4');
    if (text.includes('6')) labels.add('Khoang 6');

    if (!labels.size) labels.add('Ghế ngồi');
    return Array.from(labels);
};

const getInventoryStatus = (trip: Trip) => {
    const seats = getAvailableSeats(trip);
    if (seats <= 0) return { value: 'soldout', label: 'Hết vé', icon: Ban, className: 'bg-gray-100 text-gray-500 border-gray-200' };
    if (seats <= 10) return { value: 'low', label: 'Sắp hết vé', icon: AlertCircle, className: 'bg-yellow-50 text-yellow-700 border-yellow-100' };
    return { value: 'available', label: 'Còn vé', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
};

const matchesSeatType = (trip: Trip, value: string) => {
    if (!value) return true;
    const labels = getSeatLabels(trip).map(normalizeText);
    if (value === 'seat') return labels.some((label) => label.includes('ghe') || label.includes('ngoi'));
    if (value === 'bed') return labels.some((label) => label.includes('giuong') || label.includes('nam'));
    if (value === 'cabin4') return labels.some((label) => label.includes('4'));
    if (value === 'cabin6') return labels.some((label) => label.includes('6'));
    return true;
};

const getLabel = (items: { value: string; label: string }[], value: string) =>
    items.find((item) => item.value === value)?.label || value;

interface SelectFieldProps {
    icon: React.ElementType;
    label: string;
    value: string;
    onChange: (value: string) => void;
    options: { value: string; label: string }[];
}

const SelectField: React.FC<SelectFieldProps> = ({ icon: Icon, label, value, onChange, options }) => (
    <label className="space-y-1.5">
        <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
            <Icon size={12} className="text-tet-red" />
            {label}
        </span>
        <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none transition focus:border-tet-red focus:ring-4 focus:ring-red-100"
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    </label>
);

interface FilterOptionGroupProps {
    title: string;
    options: { value: string; label: string }[];
    value: string;
    onChange: (value: string) => void;
}

const FilterOptionGroup: React.FC<FilterOptionGroupProps> = ({ title, options, value, onChange }) => (
    <div>
        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-400">{title}</p>
        <div className="space-y-2">
            {options.map((option) => {
                const active = value === option.value;
                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(active ? '' : option.value)}
                        className={cn(
                            'flex w-full items-center justify-between rounded-xl border px-3 py-2.5 text-left text-sm font-bold transition',
                            active
                                ? 'border-tet-red bg-red-50 text-tet-red shadow-sm shadow-red-100'
                                : 'border-gray-100 bg-white text-gray-600 hover:border-gray-200 hover:bg-gray-50'
                        )}
                    >
                        <span>{option.label}</span>
                        {active && <CheckCircle2 size={16} />}
                    </button>
                );
            })}
        </div>
    </div>
);

interface ScheduleFilterPanelProps {
    values: {
        timeWindow: string;
        trainType: string;
        seatType: string;
        ticketStatus: string;
        duration: string;
        minPrice: string;
        maxPrice: string;
    };
    updateParams: (updates: Record<string, string | number | null>) => void;
    clearFilters: () => void;
    activeCount: number;
}

const ScheduleFilterPanel: React.FC<ScheduleFilterPanelProps> = ({ values, updateParams, clearFilters, activeCount }) => {
    const [advancedOpen, setAdvancedOpen] = useState(false);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-black uppercase tracking-[0.2em] text-tet-red">Bộ lọc</p>
                    <h2 className="text-lg font-black text-gray-900">Tinh chỉnh chuyến</h2>
                </div>
                {activeCount > 0 && (
                    <button
                        type="button"
                        onClick={clearFilters}
                        className="text-xs font-black text-gray-400 transition hover:text-tet-red"
                    >
                        Xóa tất cả
                    </button>
                )}
            </div>

            <FilterOptionGroup
                title="Khoảng giờ khởi hành"
                options={TIME_WINDOWS}
                value={values.timeWindow}
                onChange={(value) => updateParams({ time: value })}
            />

            <FilterOptionGroup
                title="Loại tàu"
                options={TRAIN_TYPES}
                value={values.trainType}
                onChange={(value) => updateParams({ trainType: value })}
            />

            <FilterOptionGroup
                title="Hạng ghế"
                options={SEAT_TYPES}
                value={values.seatType}
                onChange={(value) => updateParams({ seatType: value })}
            />

            <FilterOptionGroup
                title="Trạng thái vé"
                options={TICKET_STATUSES}
                value={values.ticketStatus}
                onChange={(value) => updateParams({ ticketStatus: value })}
            />

            <div className="rounded-2xl border border-gray-100 bg-gray-50/70 p-3">
                <button
                    type="button"
                    onClick={() => setAdvancedOpen((open) => !open)}
                    className="flex w-full items-center justify-between text-left"
                >
                    <span className="inline-flex items-center gap-2 text-sm font-black text-gray-900">
                        <SlidersHorizontal size={16} className="text-tet-red" />
                        Thêm bộ lọc
                    </span>
                    <ChevronRight size={16} className={cn('text-gray-400 transition', advancedOpen && 'rotate-90 text-tet-red')} />
                </button>

                <AnimatePresence initial={false}>
                    {advancedOpen && (
                        <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="mt-4 space-y-5 border-t border-gray-200 pt-4">
                                <div>
                                    <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-400">Khoảng giá</p>
                                    <div className="grid grid-cols-2 gap-2">
                                        <input
                                            inputMode="numeric"
                                            value={values.minPrice}
                                            onChange={(event) => updateParams({ minPrice: event.target.value })}
                                            placeholder="Từ"
                                            className="h-10 min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-tet-red focus:ring-4 focus:ring-red-100"
                                        />
                                        <input
                                            inputMode="numeric"
                                            value={values.maxPrice}
                                            onChange={(event) => updateParams({ maxPrice: event.target.value })}
                                            placeholder="Đến"
                                            className="h-10 min-w-0 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold outline-none focus:border-tet-red focus:ring-4 focus:ring-red-100"
                                        />
                                    </div>
                                </div>

                                <FilterOptionGroup
                                    title="Thời lượng chuyến"
                                    options={DURATION_FILTERS}
                                    value={values.duration}
                                    onChange={(value) => updateParams({ duration: value })}
                                />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

const ScheduleSkeleton = () => (
    <div className="space-y-4">
        {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5">
                <div className="mb-5 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-2xl bg-gray-100" />
                        <div className="space-y-2">
                            <div className="h-4 w-24 rounded bg-gray-100" />
                            <div className="h-3 w-36 rounded bg-gray-100" />
                        </div>
                    </div>
                    <div className="h-6 w-28 rounded bg-gray-100" />
                </div>
                <div className="grid grid-cols-3 gap-4">
                    <div className="h-16 rounded-xl bg-gray-100" />
                    <div className="h-16 rounded-xl bg-gray-100" />
                    <div className="h-16 rounded-xl bg-gray-100" />
                </div>
            </div>
        ))}
    </div>
);

interface ScheduleTripCardProps {
    trip: Trip;
    passengers: number;
    promoCode?: string;
}

const ScheduleTripCard: React.FC<ScheduleTripCardProps> = ({ trip, passengers, promoCode }) => {
    const navigate = useNavigate();
    const trainType = getTrainType(trip);
    const inventory = getInventoryStatus(trip);
    const InventoryIcon = inventory.icon;
    const seats = getAvailableSeats(trip);
    const seatLabels = getSeatLabels(trip);
    const displayPrice = getTripPrice(trip);
    const originalPrice = getTripOriginalPrice(trip);
    const hasDiscount = Boolean(trip.promotionApplied && trip.discountAmount && trip.discountAmount > 0);
    const handleBook = () => {
        const params = new URLSearchParams();
        if (promoCode) params.set('promoCode', promoCode);
        navigate(`/ticket/${trip.id}${params.toString() ? `?${params.toString()}` : ''}`);
    };

    return (
        <article className="group rounded-2xl border border-gray-100 bg-white p-4 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-red-100 hover:shadow-xl hover:shadow-red-500/10 md:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                <div className="min-w-0 flex-1">
                    <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-red-50 text-tet-red transition group-hover:bg-tet-red group-hover:text-white">
                                <Train size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-black text-gray-900">{trip.trainCode || 'Chuyến tàu'}</h3>
                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                    <span className="rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-widest text-tet-red">
                                        {trainType}
                                    </span>
                                    <span className={cn('inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest', inventory.className)}>
                                        <InventoryIcon size={12} />
                                        {inventory.label}
                                    </span>
                                </div>
                            </div>
                        </div>
                        <div className="text-left sm:text-right">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Giá thấp nhất</p>
                            {hasDiscount && (
                                <p className="text-xs font-black text-gray-400 line-through">{formatCurrency(originalPrice)}</p>
                            )}
                            <p className="text-2xl font-black text-tet-red">{formatCurrency(displayPrice)}</p>
                            {hasDiscount && (
                                <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-emerald-600">
                                    {trip.promotionDiscountLabel || `Ma ${promoCode}`}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid gap-3 md:grid-cols-[1fr_auto_1fr] md:items-center">
                        <div className="rounded-xl bg-gray-50 p-4">
                            <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                                <MapPin size={12} className="text-tet-red" />
                                Ga đi
                            </p>
                            <p className="text-xl font-black text-gray-900">{formatTime(trip.departureTime)}</p>
                            <p className="mt-1 text-sm font-bold text-gray-600">{trip.departureStation}</p>
                        </div>

                        <div className="flex items-center justify-center gap-3 md:w-32 md:flex-col">
                            <div className="hidden h-px w-full bg-gray-200 md:block" />
                            <span className="inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-black text-gray-500 shadow-sm ring-1 ring-gray-100">
                                <Clock3 size={13} className="text-tet-yellow" />
                                {formatDuration(trip)}
                            </span>
                            <div className="hidden h-px w-full bg-gray-200 md:block" />
                        </div>

                        <div className="rounded-xl bg-gray-50 p-4 md:text-right">
                            <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 md:justify-end">
                                Ga đến
                                <MapPin size={12} className="text-tet-red" />
                            </p>
                            <p className="text-xl font-black text-gray-900">{formatTime(trip.arrivalTime)}</p>
                            <p className="mt-1 text-sm font-bold text-gray-600">{trip.arrivalStation}</p>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2">
                            <CalendarDays size={14} className="text-tet-red" />
                            {formatDate(trip.departureTime)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2">
                            <Armchair size={14} className="text-tet-red" />
                            {seatLabels.join(', ')}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2">
                            <BadgeCheck size={14} className="text-tet-red" />
                            {seats} ghế trống
                        </span>
                        {passengers > 1 && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2">
                                <Users size={14} className="text-tet-red" />
                                {passengers} hành khách
                            </span>
                        )}
                    </div>
                </div>

                <div className="flex shrink-0 flex-col gap-3 lg:w-40">
                    <button
                        type="button"
                        onClick={handleBook}
                        disabled={seats <= 0}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gray-900 px-5 text-sm font-black uppercase tracking-widest text-white shadow-lg shadow-gray-200 transition hover:bg-tet-red disabled:cursor-not-allowed disabled:bg-gray-200 disabled:text-gray-500"
                    >
                        Đặt vé
                        <ChevronRight size={16} />
                    </button>
                    <p className="text-center text-[10px] font-bold uppercase tracking-widest text-gray-400">Không giữ chỗ trước thanh toán</p>
                </div>
            </div>
        </article>
    );
};

const Schedules: React.FC = () => {
    const [searchParams, setSearchParams] = useSearchParams();
    const [currentPage, setCurrentPage] = useState(1);
    const [isFilterSheetOpen, setIsFilterSheetOpen] = useState(false);
    const [isFiltering, setIsFiltering] = useState(false);
    const queryString = searchParams.toString();

    const { data: trips = [], isLoading, error } = useQuery({
        queryKey: ['all-trips', searchParams.get('promoCode') || searchParams.get('promo') || ''],
        queryFn: () => tripApi.getAllTrips(searchParams.get('promoCode') || searchParams.get('promo') || undefined),
    });

    const values = useMemo(() => {
        const passengers = Number(searchParams.get('passengers') || 1);
        return {
            departure: searchParams.get('departure') || '',
            arrival: searchParams.get('arrival') || '',
            date: searchParams.get('date') || '',
            passengers: Number.isFinite(passengers) && passengers > 0 ? passengers : 1,
            ticketType: searchParams.get('ticketType') || 'one-way',
            timeWindow: searchParams.get('time') || '',
            trainType: searchParams.get('trainType') || '',
            seatType: searchParams.get('seatType') || '',
            minPrice: searchParams.get('minPrice') || '',
            maxPrice: searchParams.get('maxPrice') || '',
            ticketStatus: searchParams.get('ticketStatus') || '',
            duration: searchParams.get('duration') || '',
            sort: (searchParams.get('sort') as SortValue) || 'earliest',
            promo: searchParams.get('promoCode') || searchParams.get('promo') || '',
        };
    }, [queryString, searchParams]);

    const stationOptions = useMemo(() => {
        const stations = trips.flatMap((trip) => [trip.departureStation, trip.arrivalStation]).filter(Boolean);
        return Array.from(new Set(stations)).sort((a, b) => a.localeCompare(b, 'vi'));
    }, [trips]);

    const priceBounds = useMemo(() => {
        const prices = trips.map(getTripPrice).filter((price) => price > 0);
        return {
            min: prices.length ? Math.min(...prices) : 0,
            max: prices.length ? Math.max(...prices) : 0,
        };
    }, [trips]);

    const updateParams = (updates: Record<string, string | number | null>) => {
        const next = new URLSearchParams(searchParams);

        Object.entries(updates).forEach(([key, rawValue]) => {
            const value = rawValue === null || rawValue === undefined ? '' : String(rawValue).trim();
            const shouldDelete =
                !value ||
                (key === 'sort' && value === 'earliest') ||
                (key === 'ticketType' && value === 'one-way') ||
                (key === 'passengers' && value === '1');

            if (shouldDelete) next.delete(key);
            else next.set(key, value);
        });

        setSearchParams(next);
    };

    const clearFilters = () => {
        setSearchParams(new URLSearchParams());
        setCurrentPage(1);
    };

    useEffect(() => {
        setCurrentPage(1);
        if (isLoading) return;

        setIsFiltering(true);
        const timer = window.setTimeout(() => setIsFiltering(false), 260);
        return () => window.clearTimeout(timer);
    }, [queryString, isLoading]);

    const filteredTrips = useMemo(() => {
        const minPrice = Number(values.minPrice);
        const maxPrice = Number(values.maxPrice);

        const filtered = trips.filter((trip) => {
            if (values.departure && trip.departureStation !== values.departure) return false;
            if (values.arrival && trip.arrivalStation !== values.arrival) return false;
            if (values.date && toDateInputValue(trip.departureTime) !== values.date) return false;

            if (values.timeWindow) {
                const window = TIME_WINDOWS.find((item) => item.value === values.timeWindow);
                const minutes = getTimeMinutes(trip.departureTime);
                if (window && (minutes < window.start || minutes >= window.end)) return false;
            }

            if (values.trainType && getLabel(TRAIN_TYPES, values.trainType) !== getTrainType(trip)) return false;
            if (values.seatType && !matchesSeatType(trip, values.seatType)) return false;

            const tripPrice = getTripPrice(trip);
            if (Number.isFinite(minPrice) && minPrice > 0 && tripPrice < minPrice) return false;
            if (Number.isFinite(maxPrice) && maxPrice > 0 && tripPrice > maxPrice) return false;

            if (values.ticketStatus && getInventoryStatus(trip).value !== values.ticketStatus) return false;

            const duration = parseDurationMinutes(trip);
            if (values.duration === 'under-6' && duration >= 360) return false;
            if (values.duration === '6-12' && (duration < 360 || duration > 720)) return false;
            if (values.duration === 'over-12' && duration <= 720) return false;

            return true;
        });

        return [...filtered].sort((a, b) => {
            if (values.sort === 'price-asc') return getTripPrice(a) - getTripPrice(b);
            if (values.sort === 'price-desc') return getTripPrice(b) - getTripPrice(a);
            if (values.sort === 'duration-asc') return parseDurationMinutes(a) - parseDurationMinutes(b);
            if (values.sort === 'seats-desc') return getAvailableSeats(b) - getAvailableSeats(a);
            return getTimeMinutes(a.departureTime) - getTimeMinutes(b.departureTime);
        });
    }, [trips, values]);

    const activeChips = useMemo(() => {
        const chips: { key: string; label: string; remove: () => void }[] = [];

        if (values.departure || values.arrival) {
            chips.push({
                key: 'route',
                label: `${values.departure || 'Mọi ga'} → ${values.arrival || 'Mọi ga'}`,
                remove: () => updateParams({ departure: null, arrival: null }),
            });
        }

        if (values.date) {
            chips.push({
                key: 'date',
                label: new Date(values.date).toLocaleDateString('vi-VN'),
                remove: () => updateParams({ date: null }),
            });
        }

        if (searchParams.has('passengers') || values.passengers > 1) {
            chips.push({
                key: 'passengers',
                label: `${values.passengers} hành khách`,
                remove: () => updateParams({ passengers: null }),
            });
        }

        if (values.ticketType !== 'one-way') {
            chips.push({
                key: 'ticketType',
                label: getLabel(TICKET_TYPES, values.ticketType),
                remove: () => updateParams({ ticketType: null }),
            });
        }

        if (values.timeWindow) chips.push({ key: 'time', label: getLabel(TIME_WINDOWS, values.timeWindow), remove: () => updateParams({ time: null }) });
        if (values.trainType) chips.push({ key: 'trainType', label: getLabel(TRAIN_TYPES, values.trainType), remove: () => updateParams({ trainType: null }) });
        if (values.seatType) chips.push({ key: 'seatType', label: getLabel(SEAT_TYPES, values.seatType), remove: () => updateParams({ seatType: null }) });
        if (values.ticketStatus) chips.push({ key: 'ticketStatus', label: getLabel(TICKET_STATUSES, values.ticketStatus), remove: () => updateParams({ ticketStatus: null }) });
        if (values.duration) chips.push({ key: 'duration', label: getLabel(DURATION_FILTERS, values.duration), remove: () => updateParams({ duration: null }) });
        if (values.minPrice || values.maxPrice) {
            chips.push({
                key: 'price',
                label: `${values.minPrice ? formatCurrency(Number(values.minPrice)) : formatCurrency(priceBounds.min)} - ${values.maxPrice ? formatCurrency(Number(values.maxPrice)) : formatCurrency(priceBounds.max)}`,
                remove: () => updateParams({ minPrice: null, maxPrice: null }),
            });
        }
        if (values.promo) chips.push({ key: 'promo', label: `Mã ${values.promo}`, remove: () => updateParams({ promoCode: null, promo: null }) });

        return chips;
    }, [queryString, searchParams, values, priceBounds]);

    const totalPages = Math.max(1, Math.ceil(filteredTrips.length / ITEMS_PER_PAGE));
    const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
    const paginatedTrips = filteredTrips.slice(startIndex, startIndex + ITEMS_PER_PAGE);
    const isBusy = isLoading || isFiltering;
    const activeFilterCount = activeChips.length;

    const goToPage = (page: number) => {
        if (page < 1 || page > totalPages) return;
        setCurrentPage(page);
        window.scrollTo({ top: 360, behavior: 'smooth' });
    };

    return (
        <main className="min-h-screen bg-[#fcfcfc]">
            <Helmet>
                <title>Lịch trình tàu hỏa toàn quốc - Vé Tàu Việt Nam</title>
                <meta name="description" content="Tra cứu lịch trình tàu, lọc theo giờ đi, loại tàu, hạng ghế, giá vé và số ghế trống." />
            </Helmet>
            <Header />

            <section className="bg-white pt-28 md:pt-40">
                <div className="mx-auto max-w-7xl px-4 pb-6 md:px-12">
                    <div className="max-w-3xl">
                        <div className="mb-3 flex items-center gap-2">
                            <span className="rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-tet-red">
                                Lịch trình
                            </span>
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                                {filteredTrips.length} chuyến phù hợp
                            </span>
                        </div>
                        <h1 className="text-3xl font-black tracking-tight text-gray-900 md:text-5xl">Tìm chuyến tàu phù hợp</h1>
                        <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-gray-500">
                            Lọc nhanh theo tuyến, khung giờ, hạng ghế và tình trạng vé để chọn chuyến đi tốt nhất.
                        </p>
                    </div>
                </div>

                <div className="sticky top-[72px] z-30 border-y border-gray-100 bg-white/95 backdrop-blur-xl">
                    <div className="mx-auto max-w-7xl px-4 py-4 md:px-12">
                        <div className="grid gap-3 lg:grid-cols-[1.2fr_1.2fr_0.9fr_0.7fr_0.9fr_auto] lg:items-end">
                            <SelectField
                                icon={MapPin}
                                label="Ga đi"
                                value={values.departure}
                                onChange={(value) => updateParams({ departure: value })}
                                options={[{ value: '', label: 'Tất cả ga đi' }, ...stationOptions.map((station) => ({ value: station, label: station }))]}
                            />
                            <SelectField
                                icon={MapPin}
                                label="Ga đến"
                                value={values.arrival}
                                onChange={(value) => updateParams({ arrival: value })}
                                options={[{ value: '', label: 'Tất cả ga đến' }, ...stationOptions.map((station) => ({ value: station, label: station }))]}
                            />
                            <label className="space-y-1.5">
                                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                                    <CalendarDays size={12} className="text-tet-red" />
                                    Ngày đi
                                </span>
                                <input
                                    type="date"
                                    value={values.date}
                                    onChange={(event) => updateParams({ date: event.target.value })}
                                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none transition focus:border-tet-red focus:ring-4 focus:ring-red-100"
                                />
                            </label>
                            <label className="space-y-1.5">
                                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                                    <Users size={12} className="text-tet-red" />
                                    Hành khách
                                </span>
                                <input
                                    type="number"
                                    min={1}
                                    max={10}
                                    value={values.passengers}
                                    onChange={(event) => updateParams({ passengers: Math.max(1, Number(event.target.value) || 1) })}
                                    className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-center text-sm font-black text-gray-900 outline-none transition focus:border-tet-red focus:ring-4 focus:ring-red-100"
                                />
                            </label>
                            <SelectField
                                icon={Ticket}
                                label="Loại vé"
                                value={values.ticketType}
                                onChange={(value) => updateParams({ ticketType: value })}
                                options={TICKET_TYPES}
                            />
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => updateParams({ departure: values.arrival, arrival: values.departure })}
                                    className="hidden h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-500 transition hover:border-tet-red hover:text-tet-red lg:inline-flex"
                                    aria-label="Đổi chiều tuyến"
                                >
                                    <ArrowRightLeft size={18} />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setIsFilterSheetOpen(true)}
                                    className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-sm font-black uppercase tracking-widest text-white lg:hidden"
                                >
                                    <Filter size={16} />
                                    Lọc
                                    {activeFilterCount > 0 && <span className="rounded-full bg-tet-yellow px-2 py-0.5 text-[10px] text-red-900">{activeFilterCount}</span>}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            <section className="py-8 md:py-10">
                <div className="mx-auto grid max-w-7xl gap-6 px-4 md:px-12 lg:grid-cols-[300px_1fr]">
                    <aside className="hidden lg:block">
                        <div className="sticky top-36 max-h-[calc(100vh-10rem)] overflow-y-auto overscroll-contain rounded-2xl border border-gray-100 bg-white p-5 pr-4 shadow-sm [scrollbar-width:thin] [scrollbar-color:#D32F2F_#F3F4F6] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-tet-red/70">
                            <ScheduleFilterPanel values={values} updateParams={updateParams} clearFilters={clearFilters} activeCount={activeFilterCount} />
                        </div>
                    </aside>

                    <div className="min-w-0">
                        <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                                <div>
                                    <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                                        <Search size={13} className="text-tet-red" />
                                        Kết quả tìm kiếm
                                    </p>
                                    <p className="mt-1 text-sm font-bold text-gray-700">
                                        {isBusy ? 'Đang cập nhật...' : `${filteredTrips.length} chuyến tàu được tìm thấy`}
                                    </p>
                                </div>

                                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                                    <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500">
                                        <ArrowUpDown size={14} className="text-tet-red" />
                                        Sort
                                        <select
                                            value={values.sort}
                                            onChange={(event) => updateParams({ sort: event.target.value })}
                                            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-gray-900 outline-none focus:border-tet-red focus:ring-4 focus:ring-red-100"
                                        >
                                            {SORT_OPTIONS.map((option) => (
                                                <option key={option.value} value={option.value}>
                                                    {option.label}
                                                </option>
                                            ))}
                                        </select>
                                    </label>
                                    {activeFilterCount > 0 && (
                                        <button
                                            type="button"
                                            onClick={clearFilters}
                                            className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-black uppercase tracking-widest text-gray-500 transition hover:border-tet-red hover:text-tet-red"
                                        >
                                            <RotateCcw size={14} />
                                            Xóa tất cả
                                        </button>
                                    )}
                                </div>
                            </div>

                            {activeChips.length > 0 && (
                                <div className="mt-4 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
                                    {activeChips.map((chip) => (
                                        <button
                                            key={chip.key}
                                            type="button"
                                            onClick={chip.remove}
                                            className="inline-flex max-w-full items-center gap-2 rounded-full border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-black text-tet-red transition hover:border-tet-red"
                                        >
                                            <span className="truncate">{chip.label}</span>
                                            <X size={13} />
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {error && (
                            <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-bold text-tet-red">
                                Không tải được danh sách chuyến. Vui lòng thử lại sau.
                            </div>
                        )}

                        {isBusy ? (
                            <ScheduleSkeleton />
                        ) : filteredTrips.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
                                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-300">
                                    <Train size={30} />
                                </div>
                                <h3 className="text-xl font-black text-gray-900">Không tìm thấy chuyến phù hợp</h3>
                                <p className="mx-auto mt-2 max-w-md text-sm font-medium text-gray-500">
                                    Thử đổi ga đi, ga đến hoặc nới rộng khoảng giờ và mức giá.
                                </p>
                                <button
                                    type="button"
                                    onClick={clearFilters}
                                    className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-tet-red"
                                >
                                    <RotateCcw size={15} />
                                    Xóa tất cả
                                </button>
                            </div>
                        ) : (
                            <>
                                <div className="space-y-4">
                                    {paginatedTrips.map((trip) => (
                                        <ScheduleTripCard key={trip.id} trip={trip} passengers={values.passengers} promoCode={values.promo} />
                                    ))}
                                </div>

                                {totalPages > 1 && (
                                    <div className="mt-8 flex flex-col items-center justify-between gap-4 rounded-2xl border border-gray-100 bg-white p-4 sm:flex-row">
                                        <p className="text-xs font-black uppercase tracking-widest text-gray-400">
                                            Hiển thị {startIndex + 1}-{Math.min(startIndex + ITEMS_PER_PAGE, filteredTrips.length)} / {filteredTrips.length} chuyến
                                        </p>
                                        <div className="flex items-center gap-2">
                                            <button
                                                type="button"
                                                onClick={() => goToPage(currentPage - 1)}
                                                disabled={currentPage === 1}
                                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-500 disabled:opacity-40"
                                            >
                                                <ChevronLeft size={18} />
                                            </button>
                                            {Array.from({ length: totalPages }).map((_, index) => {
                                                const page = index + 1;
                                                return (
                                                    <button
                                                        key={page}
                                                        type="button"
                                                        onClick={() => goToPage(page)}
                                                        className={cn(
                                                            'h-10 min-w-10 rounded-xl px-3 text-sm font-black',
                                                            currentPage === page ? 'bg-tet-red text-white' : 'border border-gray-200 text-gray-500 hover:border-tet-red hover:text-tet-red'
                                                        )}
                                                    >
                                                        {page}
                                                    </button>
                                                );
                                            })}
                                            <button
                                                type="button"
                                                onClick={() => goToPage(currentPage + 1)}
                                                disabled={currentPage === totalPages}
                                                className="flex h-10 w-10 items-center justify-center rounded-xl border border-gray-200 text-gray-500 disabled:opacity-40"
                                            >
                                                <ChevronRight size={18} />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </div>
            </section>

            <AnimatePresence>
                {isFilterSheetOpen && (
                    <motion.div className="fixed inset-0 z-[140] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <button
                            type="button"
                            aria-label="Đóng bộ lọc"
                            className="absolute inset-0 bg-black/40"
                            onClick={() => setIsFilterSheetOpen(false)}
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                            className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl"
                        >
                            <div className="mb-5 flex items-center justify-between">
                                <div className="h-1.5 w-12 rounded-full bg-gray-200" />
                                <button
                                    type="button"
                                    onClick={() => setIsFilterSheetOpen(false)}
                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                                >
                                    <X size={18} />
                                </button>
                            </div>
                            <ScheduleFilterPanel values={values} updateParams={updateParams} clearFilters={clearFilters} activeCount={activeFilterCount} />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Footer />
        </main>
    );
};

export default Schedules;
