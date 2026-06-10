import React, { useEffect, useMemo, useRef, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { cn } from '@/lib/utils';
import { useQueries, useQuery } from '@tanstack/react-query';
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
    ChevronDown,
    ChevronLeft,
    ChevronRight,
    Clock3,
    Filter,
    MapPin,
    Minus,
    Plus,
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
import { Seat, Trip, TripCategory, TripItinerary, TripSegment, TripStop } from '../types/api.types';
import { buildPassengerOptions } from '../lib/passengerFareRules';

type SortValue = 'earliest' | 'price-asc' | 'price-desc' | 'duration-asc' | 'seats-desc';

const ITEMS_PER_PAGE = 6;
const DATE_RAIL_VISIBLE_DAYS = 9;
const DATE_RAIL_SHIFT_DAYS = 1;

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

type FilterOption = { value: string; label: string };

const TRAIN_TYPE_LABELS: Record<string, string> = {
    SE_TN: 'SE/TN',
    CLC: 'CLC',
    HIGH_QUALITY: 'CLC',
    SUBURBAN: 'Ngoại ô',
    TET: 'Tàu Tết',
    HOLIDAY: 'Tàu Tết',
};

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

type PassengerCounts = {
    adult: number;
    child: number;
    senior: number;
    student: number;
    total: number;
};

const MAX_PASSENGERS = 10;

type PassengerKey = Exclude<keyof PassengerCounts, 'total'>;

const PASSENGER_OPTIONS: { key: PassengerKey; label: string; description: string; discount?: string }[] = [
    { key: 'adult', label: 'Người lớn', description: 'Từ 10 - 59 tuổi' },
    { key: 'child', label: 'Trẻ em', description: '6 - 9 tuổi', discount: '-25%' },
    { key: 'senior', label: 'Người cao tuổi', description: 'Từ 60 tuổi', discount: '-15%' },
    { key: 'student', label: 'Sinh viên', description: 'Thẻ SV', discount: '-10%' },
];

const PASSENGER_NOTES = [
    'Một người lớn được kèm 1 trẻ dưới 6 tuổi miễn vé, ngồi chung chỗ.',
    'Người cao tuổi: Công dân Việt Nam từ 60 tuổi.',
    'Sinh viên: Công dân Việt Nam có thẻ sinh viên hợp lệ.',
];

const normalizePassengerCounts = (counts: Partial<PassengerCounts>): PassengerCounts => {
    let remaining = MAX_PASSENGERS;
    const adult = Math.min(Math.max(1, Math.floor(Number(counts.adult ?? 1) || 1)), remaining);
    remaining -= adult;
    const child = Math.min(Math.max(0, Math.floor(Number(counts.child ?? 0) || 0)), remaining);
    remaining -= child;
    const senior = Math.min(Math.max(0, Math.floor(Number(counts.senior ?? 0) || 0)), remaining);
    remaining -= senior;
    const student = Math.min(Math.max(0, Math.floor(Number(counts.student ?? 0) || 0)), remaining);
    return {
        adult,
        child,
        senior,
        student,
        total: adult + child + senior + student,
    };
};

const passengerSummary = (counts: PassengerCounts, options = PASSENGER_OPTIONS) => {
    const parts = options
        .map((option) => {
            const count = counts[option.key];
            return count > 0 ? `${count} ${option.label.toLowerCase()}` : '';
        })
        .filter(Boolean);
    return parts.join(', ');
};

const readPassengerCount = (params: URLSearchParams, keys: string[], fallback = 0) => {
    const rawValue = keys.map((key) => params.get(key)).find((value) => value !== null);
    const parsed = Number(rawValue ?? fallback);
    if (!Number.isFinite(parsed) || parsed < 0) return fallback;
    return Math.floor(parsed);
};

const readQueryValue = (params: URLSearchParams, keys: string[]) =>
    keys.map((key) => params.get(key)).find((value) => value !== null && value !== '') || '';

const QUERY_ALIASES: Record<string, string[]> = {
    departure: ['departPlaceName', 'departPlaceCode'],
    arrival: ['returnPlaceName', 'returnPlaceCode'],
    date: ['departDate'],
    ticketType: ['roundTrip'],
    passengers: ['totalTicket'],
    passenger_adult: ['adults'],
    passenger_child: ['childs', 'children'],
    passenger_senior: ['elderlys', 'seniors'],
    passenger_student: ['students'],
};

const deleteQueryKey = (params: URLSearchParams, key: string) => {
    [key, ...(QUERY_ALIASES[key] || [])].forEach((alias) => params.delete(alias));
};

const getPassengerCountsFromParams = (params: URLSearchParams): PassengerCounts => {
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

    let remaining = MAX_PASSENGERS;
    adult = Math.min(adult, remaining);
    remaining -= adult;
    const cappedChild = Math.min(child, remaining);
    remaining -= cappedChild;
    const cappedSenior = Math.min(senior, remaining);
    remaining -= cappedSenior;
    const cappedStudent = Math.min(student, remaining);
    const total = Math.max(1, adult + cappedChild + cappedSenior + cappedStudent);

    return {
        adult,
        child: cappedChild,
        senior: cappedSenior,
        student: cappedStudent,
        total,
    };
};

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

const optionValueFromLabel = (value = '') =>
    normalizeText(value)
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '')
        .toUpperCase();

const normalizeTrainTypeValue = (value = '') => {
    const normalized = optionValueFromLabel(value);
    if (normalized === 'ALL') return '';
    if (normalized === 'HIGH_QUALITY') return 'CLC';
    if (normalized === 'HOLIDAY') return 'TET';
    return normalized;
};

const normalizeSeatTypeValue = (value = '') =>
    normalizeText(value)
        .replace(/[^a-z0-9]+/g, '_')
        .replace(/^_+|_+$/g, '');

const addUniqueOption = (map: Map<string, FilterOption>, option?: FilterOption) => {
    if (!option?.value || !option.label) return;
    if (!map.has(option.value)) map.set(option.value, option);
};

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

const toDateValueFromDate = (date: Date) => {
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    const day = `${date.getDate()}`.padStart(2, '0');
    return `${date.getFullYear()}-${month}-${day}`;
};

const parseDateValue = (value?: string) => {
    if (!value) return new Date();
    const [year, month, day] = value.split('-').map(Number);
    if (!year || !month || !day) return new Date();
    return new Date(year, month - 1, day);
};

const addDays = (value: string, days: number) => {
    const date = parseDateValue(value);
    date.setDate(date.getDate() + days);
    return toDateValueFromDate(date);
};

const getTodayDateValue = () => toDateValueFromDate(new Date());

const formatDateRailDay = (value: string) => {
    const date = parseDateValue(value);
    const day = `${date.getDate()}`.padStart(2, '0');
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    return `${day}-${month}-${date.getFullYear()}`;
};

const formatDateRailWeekday = (value: string) => {
    const date = parseDateValue(value);
    return date.toLocaleDateString('vi-VN', { weekday: 'short' });
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

const getTripCategoryValue = (trip: Trip) => {
    const category = normalizeTrainTypeValue(trip.trainCategory || '');
    const code = normalizeText(trip.trainCode || '');
    const carriageText = normalizeText((trip.carriages || []).map((carriage) => carriage.carriageTypeName).join(' '));

    if (category) return category;
    if (code.includes('tet') || code.includes('tt')) return 'TET';
    if (code.includes('clc') || code.includes('vip') || carriageText.includes('vip') || carriageText.includes('chat luong cao')) return 'CLC';
    if (code.startsWith('lp') || code.startsWith('sp') || code.includes('ngoai o')) return 'SUBURBAN';
    return 'SE_TN';
};

const getTrainType = (trip: Trip) => {
    return getLabel(TRAIN_TYPES, getTripCategoryValue(trip));
};

const buildTrainTypeOptions = (categories: TripCategory[] = [], trips: Trip[] = []) => {
    const options = new Map<string, FilterOption>();

    categories.forEach((category) => {
        const value = normalizeTrainTypeValue(category.code);
        const label = TRAIN_TYPE_LABELS[value] || TRAIN_TYPE_LABELS[category.code] || category.label || category.code;
        addUniqueOption(options, { value, label });
    });

    trips.forEach((trip) => {
        const value = getTripCategoryValue(trip);
        const label = TRAIN_TYPE_LABELS[value] || getLabel(TRAIN_TYPES, value);
        addUniqueOption(options, { value, label });
    });

    if (!options.size) {
        TRAIN_TYPES.forEach((option) => addUniqueOption(options, option));
    }
    return Array.from(options.values());
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

const buildSeatTypeOptions = (trips: Trip[] = []) => {
    const options = new Map<string, FilterOption>();

    trips.forEach((trip) => {
        (trip.carriages || []).forEach((carriage) => {
            const label = String(carriage.carriageTypeName || '').trim();
            const value = normalizeSeatTypeValue(label);
            addUniqueOption(options, { value, label });
        });
    });

    if (!options.size) {
        SEAT_TYPES.forEach((option) => addUniqueOption(options, option));
    }

    return Array.from(options.values()).sort((a, b) => a.label.localeCompare(b.label, 'vi'));
};

const getTripSeatTypeValues = (trip: Trip) => {
    const values = new Set<string>();
    (trip.carriages || []).forEach((carriage) => {
        values.add(normalizeSeatTypeValue(carriage.carriageTypeName || ''));
    });
    getSeatLabels(trip).forEach((label) => values.add(normalizeSeatTypeValue(label)));
    return values;
};

const getInventoryStatus = (trip: Trip) => {
    const seats = getAvailableSeats(trip);
    if (seats <= 0) return { value: 'soldout', label: 'Hết vé', icon: Ban, className: 'bg-gray-100 text-gray-500 border-gray-200' };
    if (seats <= 10) return { value: 'low', label: 'Sắp hết vé', icon: AlertCircle, className: 'bg-yellow-50 text-yellow-700 border-yellow-100' };
    return { value: 'available', label: 'Còn vé', icon: CheckCircle2, className: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
};

const matchesSeatType = (trip: Trip, value: string) => {
    if (!value) return true;
    const selectedValue = normalizeSeatTypeValue(value);
    const tripSeatValues = getTripSeatTypeValues(trip);
    if (tripSeatValues.has(selectedValue)) return true;

    const labels = getSeatLabels(trip).map(normalizeText);
    if (value === 'seat') return labels.some((label) => label.includes('ghe') || label.includes('ngoi'));
    if (value === 'bed') return labels.some((label) => label.includes('giuong') || label.includes('nam'));
    if (value === 'cabin4') return labels.some((label) => label.includes('4'));
    if (value === 'cabin6') return labels.some((label) => label.includes('6'));
    return false;
};

const getLabel = (items: { value: string; label: string }[], value: string) =>
    items.find((item) => item.value === value)?.label || value;

interface RouteSelection {
    departureStationId: number;
    departureStationName: string;
    arrivalStationId: number;
    arrivalStationName: string;
    departureOrder: number;
    arrivalOrder: number;
    departureTime?: string | null;
    arrivalTime?: string | null;
    segments: TripSegment[];
    availableSeats?: number;
    minFare?: number;
    minFareCarriageType?: string;
}

const sameStation = (left?: string, right?: string) => {
    if (!left || !right) return false;
    return normalizeText(left).trim() === normalizeText(right).trim();
};

const stopTime = (stop: TripStop, type: 'departure' | 'arrival') => {
    if (type === 'departure') {
        return stop.estimatedDepartureTime || stop.scheduledDepartureTime || stop.actualDepartureTime || stop.scheduledArrivalTime || null;
    }
    return stop.estimatedArrivalTime || stop.scheduledArrivalTime || stop.actualArrivalTime || stop.scheduledDepartureTime || null;
};

const resolveRouteSelection = (trip: Trip, itinerary?: TripItinerary, departure?: string, arrival?: string): RouteSelection | null => {
    const stops = itinerary?.stops || [];
    if (stops.length < 2) return null;

    const fromName = departure || trip.departureStation || stops[0].stationName;
    const toName = arrival || trip.arrivalStation || stops[stops.length - 1].stationName;
    const fromStop = stops.find((stop) => sameStation(stop.stationName, fromName));
    const toStop = stops.find((stop) => sameStation(stop.stationName, toName));

    if (!fromStop || !toStop || fromStop.stopOrder >= toStop.stopOrder) return null;

    const segments = (itinerary?.segments || [])
        .filter((segment) => segment.segmentOrder >= fromStop.stopOrder && segment.segmentOrder < toStop.stopOrder)
        .sort((a, b) => a.segmentOrder - b.segmentOrder);

    if (!segments.length) return null;

    const pricesByType = new Map<number, { total: number; count: number; name?: string }>();
    segments.forEach((segment) => {
        (segment.prices || [])
            .filter((price) => String(price.status || 'ACTIVE').toUpperCase() === 'ACTIVE')
            .filter((price) => String(price.passengerType || 'ADULT').toUpperCase() === 'ADULT')
            .forEach((price) => {
                const current = pricesByType.get(price.carriageTypeId) || { total: 0, count: 0, name: price.carriageTypeName };
                current.total += Number(price.price || 0);
                current.count += 1;
                current.name = current.name || price.carriageTypeName;
                pricesByType.set(price.carriageTypeId, current);
            });
    });

    const completePrices = Array.from(pricesByType.values()).filter((item) => item.count === segments.length);
    const lowest = completePrices.sort((a, b) => a.total - b.total)[0];
    const availableSeats = segments.length
        ? Math.min(...segments.map((segment) => Number(segment.availableSeats ?? 0)))
        : undefined;

    return {
        departureStationId: fromStop.stationId,
        departureStationName: fromStop.stationName,
        arrivalStationId: toStop.stationId,
        arrivalStationName: toStop.stationName,
        departureOrder: fromStop.stopOrder,
        arrivalOrder: toStop.stopOrder,
        departureTime: stopTime(fromStop, 'departure'),
        arrivalTime: stopTime(toStop, 'arrival'),
        segments,
        availableSeats,
        minFare: lowest?.total,
        minFareCarriageType: lowest?.name,
    };
};

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

interface DatePickerFieldProps {
    label: string;
    value: string;
    min?: string;
    placeholder?: string;
    onChange: (value: string) => void;
}

const DatePickerField: React.FC<DatePickerFieldProps> = ({ label, value, min, placeholder = 'Chọn ngày', onChange }) => {
    const inputRef = useRef<HTMLInputElement | null>(null);

    const openDatePicker = () => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        if (typeof input.showPicker === 'function') {
            try {
                input.showPicker();
                return;
            } catch (error) {
                // Fall through to click for browsers that reject programmatic picker calls.
            }
        }
        input.click();
    };

    return (
        <div className="space-y-1.5">
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                <CalendarDays size={12} className="text-tet-red" />
                {label}
            </span>
            <div className="group relative">
                <button
                    type="button"
                    onClick={openDatePicker}
                    className="flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-gray-200 bg-white px-3 text-left text-sm font-black text-gray-900 outline-none transition hover:border-gray-300 focus:border-tet-red focus:ring-4 focus:ring-red-100"
                >
                    <span className={cn('truncate', !value && 'font-bold text-gray-400')}>
                        {value ? formatDateRailDay(value) : placeholder}
                    </span>
                    <CalendarDays size={16} className="shrink-0 text-gray-500 transition group-hover:text-tet-red" />
                </button>
                <input
                    ref={inputRef}
                    aria-label={label}
                    type="date"
                    min={min}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    className="pointer-events-none absolute bottom-0 left-3 h-px w-px opacity-0"
                />
            </div>
        </div>
    );
};

interface PassengerPickerFieldProps {
    value: PassengerCounts;
    onChange: (value: PassengerCounts) => void;
}

const PassengerPickerField: React.FC<PassengerPickerFieldProps> = ({ value, onChange }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement | null>(null);
    const counts = normalizePassengerCounts(value);
    const { data: passengerFareRules = [] } = useQuery({
        queryKey: ['passenger-fare-rules'],
        queryFn: tripApi.getPassengerFareRules,
        staleTime: 5 * 60 * 1000,
    });
    const passengerOptions = useMemo(() => buildPassengerOptions(passengerFareRules), [passengerFareRules]);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const updateCount = (key: PassengerKey, delta: number) => {
        const current = counts[key] || 0;
        const minValue = key === 'adult' ? 1 : 0;
        if (delta > 0 && counts.total >= MAX_PASSENGERS) return;
        const nextValue = Math.max(minValue, current + delta);
        onChange(normalizePassengerCounts({ ...counts, [key]: nextValue }));
    };

    return (
        <div className="relative space-y-1.5" ref={containerRef}>
            <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest text-gray-500">
                <Users size={12} className="text-tet-red" />
                Số lượng vé
            </span>
            <button
                type="button"
                onClick={() => setIsOpen((prev) => !prev)}
                className={cn(
                    'flex h-11 w-full items-center justify-between gap-2 rounded-xl border bg-white px-3 text-left outline-none transition',
                    isOpen
                        ? 'border-tet-red ring-4 ring-red-100'
                        : 'border-gray-200 hover:border-gray-300'
                )}
            >
                <span className="min-w-0">
                    <span className="block truncate text-sm font-black text-gray-950">{counts.total} vé</span>
                    <span className="block truncate text-[10px] font-bold text-gray-400">{passengerSummary(counts, passengerOptions)}</span>
                </span>
                <ChevronDown size={15} className={cn('shrink-0 text-gray-400 transition-transform', isOpen && 'rotate-180 text-tet-red')} />
            </button>

            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: 10, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 10, scale: 0.98 }}
                        transition={{ duration: 0.16, ease: 'easeOut' }}
                        className="absolute right-0 z-50 mt-2 w-[min(92vw,560px)] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl"
                    >
                        <div className="grid md:grid-cols-[minmax(0,1fr)_220px]">
                            <div className="p-4">
                                <div className="divide-y divide-gray-100">
                                    {passengerOptions.map((option) => {
                                        const current = counts[option.key] || 0;
                                        const minValue = option.key === 'adult' ? 1 : 0;
                                        return (
                                            <div key={option.key} className="flex items-center justify-between gap-4 py-3 first:pt-0">
                                                <div className="min-w-0">
                                                    <p className="text-base font-black text-gray-800">{option.label}</p>
                                                    <p className="mt-1 text-sm font-bold text-gray-400">
                                                        {option.description}
                                                        {option.discount && (
                                                            <span className="ml-2 rounded-md bg-orange-50 px-1.5 py-0.5 font-black text-orange-500">
                                                                {option.discount}
                                                            </span>
                                                        )}
                                                    </p>
                                                </div>
                                                <div className="flex shrink-0 items-center gap-3">
                                                    <button
                                                        type="button"
                                                        onClick={() => updateCount(option.key, -1)}
                                                        disabled={current <= minValue}
                                                        className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:border-tet-red hover:text-tet-red disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        <Minus size={15} strokeWidth={3} />
                                                    </button>
                                                    <span className="w-5 text-center text-lg font-black text-gray-950">{current}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => updateCount(option.key, 1)}
                                                        disabled={counts.total >= MAX_PASSENGERS}
                                                        className="flex h-9 w-9 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition hover:border-tet-red hover:text-tet-red disabled:cursor-not-allowed disabled:opacity-40"
                                                    >
                                                        <Plus size={15} strokeWidth={3} />
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setIsOpen(false)}
                                    className="mt-3 flex h-11 w-full items-center justify-center rounded-xl bg-gradient-to-r from-tet-yellow via-[#FFC533] to-[#FF9F1C] text-sm font-black uppercase tracking-wide text-[#7A1A12] shadow-[0_12px_28px_rgba(255,193,7,0.25)]"
                                >
                                    Áp dụng
                                </button>
                            </div>

                            <div className="space-y-4 bg-slate-50 p-4 text-sm font-semibold leading-6 text-gray-600">
                                {PASSENGER_NOTES.map((note) => (
                                    <p key={note} className="flex gap-2">
                                        <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-gray-500" />
                                        <span>{note}</span>
                                    </p>
                                ))}
                                <p>
                                    Đặt vé đoàn từ 10 khách{' '}
                                    <span className="font-black text-blue-600 underline">Liên hệ.</span>
                                </p>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

interface DateRailProps {
    date: string;
    departure: string;
    arrival: string;
    onChange: (value: string) => void;
}

const DateRail: React.FC<DateRailProps> = ({ date, departure, arrival, onChange }) => {
    const todayDate = useMemo(() => getTodayDateValue(), []);
    const selectedDate = date || todayDate;
    const [railStartDate, setRailStartDate] = useState(todayDate);
    const days = useMemo(
        () => Array.from({ length: DATE_RAIL_VISIBLE_DAYS }, (_, index) => addDays(railStartDate, index)),
        [railStartDate]
    );
    const canGoPrev = railStartDate > todayDate;

    const shiftRail = (step: number) => {
        setRailStartDate((current) => {
            const next = addDays(current, step);
            return next < todayDate ? todayDate : next;
        });
    };

    return (
        <div className="rounded-md border border-gray-200 bg-white shadow-sm">
            <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
                <h2 className="text-xl font-black text-[#00447A]">Chọn chiều đi</h2>
                {(departure || arrival) && (
                    <p className="text-lg font-semibold text-gray-700">
                        {departure || 'Ga đi'} <span className="mx-1">→</span> {arrival || 'Ga đến'}
                    </p>
                )}
            </div>
            <div className="flex items-stretch gap-1 overflow-x-auto px-4 scrollbar-hide">
                <button
                    type="button"
                    onClick={() => shiftRail(-DATE_RAIL_SHIFT_DAYS)}
                    disabled={!canGoPrev}
                    className="flex w-10 shrink-0 items-center justify-center text-gray-400 transition hover:text-tet-red disabled:cursor-not-allowed disabled:text-gray-200"
                    aria-label="Ngày trước"
                >
                    <ChevronLeft size={23} />
                </button>
                <div className="grid min-w-[900px] flex-1 grid-cols-9">
                    {days.map((item) => {
                        const active = item === selectedDate;
                        return (
                            <button
                                key={item}
                                type="button"
                                onClick={() => onChange(item)}
                                className={cn(
                                    'relative flex min-h-[76px] flex-col items-center justify-center gap-1 px-4 text-center transition',
                                    active ? 'text-[#13B8D1]' : 'text-gray-500 hover:text-tet-red'
                                )}
                            >
                                <span className="whitespace-nowrap text-base font-semibold">{formatDateRailDay(item)}</span>
                                <span className="text-sm font-medium capitalize">{formatDateRailWeekday(item)}</span>
                                {active && <span className="absolute bottom-0 h-1 w-full bg-[#13B8D1]" />}
                            </button>
                        );
                    })}
                </div>
                <button
                    type="button"
                    onClick={() => shiftRail(DATE_RAIL_SHIFT_DAYS)}
                    className="flex w-10 shrink-0 items-center justify-center text-gray-400 transition hover:text-tet-red"
                    aria-label="Ngày sau"
                >
                    <ChevronRight size={23} />
                </button>
            </div>
        </div>
    );
};

interface FilterOptionGroupProps {
    title: string;
    options: FilterOption[];
    value: string;
    onChange: (value: string) => void;
    searchable?: boolean;
    searchPlaceholder?: string;
}

const FilterOptionGroup: React.FC<FilterOptionGroupProps> = ({
    title,
    options,
    value,
    onChange,
    searchable = false,
    searchPlaceholder = 'Nhập để lọc',
}) => {
    const [keyword, setKeyword] = useState('');
    const filteredOptions = useMemo(() => {
        const query = normalizeText(keyword).trim();
        if (!query) return options;
        return options.filter((option) => normalizeText(`${option.label} ${option.value}`).includes(query));
    }, [keyword, options]);

    return (
        <div>
            <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-400">{title}</p>
            {searchable && (
                <div className="relative mb-3">
                    <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-300" />
                    <input
                        value={keyword}
                        onChange={(event) => setKeyword(event.target.value)}
                        placeholder={searchPlaceholder}
                        className="h-10 w-full rounded-xl border border-gray-100 bg-white pl-9 pr-3 text-xs font-bold text-gray-700 outline-none transition focus:border-tet-red focus:ring-4 focus:ring-red-50"
                    />
                </div>
            )}
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
                {filteredOptions.map((option) => {
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
                            <span className="line-clamp-2">{option.label}</span>
                            {active && <CheckCircle2 size={16} className="shrink-0" />}
                        </button>
                    );
                })}
                {!filteredOptions.length && (
                    <div className="rounded-xl border border-dashed border-gray-200 bg-white px-3 py-4 text-center text-xs font-bold text-gray-400">
                        Không có lựa chọn phù hợp
                    </div>
                )}
            </div>
        </div>
    );
};

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
    trainTypeOptions: FilterOption[];
    seatTypeOptions: FilterOption[];
}

const ScheduleFilterPanel: React.FC<ScheduleFilterPanelProps> = ({
    values,
    updateParams,
    clearFilters,
    activeCount,
    trainTypeOptions,
    seatTypeOptions,
}) => {
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
                options={trainTypeOptions}
                value={values.trainType}
                onChange={(value) => updateParams({ trainType: value })}
                searchable
                searchPlaceholder="Nhập loại tàu"
            />

            <FilterOptionGroup
                title="Hạng ghế"
                options={seatTypeOptions}
                value={values.seatType}
                onChange={(value) => updateParams({ seatType: value })}
                searchable
                searchPlaceholder="Nhập hạng ghế"
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
    passengerCounts: PassengerCounts;
    date?: string;
    returnDate?: string;
    ticketType?: string;
    promoCode?: string;
    routeSelection?: RouteSelection | null;
}

const ScheduleTripCard: React.FC<ScheduleTripCardProps> = ({ trip, passengers, passengerCounts, date, returnDate, ticketType, promoCode, routeSelection }) => {
    const navigate = useNavigate();
    const trainType = getTrainType(trip);
    const inventory = getInventoryStatus(trip);
    const InventoryIcon = inventory.icon;
    const seats = routeSelection?.availableSeats ?? getAvailableSeats(trip);
    const seatLabels = getSeatLabels(trip);
    const displayPrice = routeSelection?.minFare ?? getTripPrice(trip);
    const originalPrice = getTripOriginalPrice(trip);
    const hasDiscount = Boolean(trip.promotionApplied && trip.discountAmount && trip.discountAmount > 0);
    const departureTime = routeSelection?.departureTime || trip.departureTime;
    const arrivalTime = routeSelection?.arrivalTime || trip.arrivalTime;
    const departureStation = routeSelection?.departureStationName || trip.departureStation;
    const arrivalStation = routeSelection?.arrivalStationName || trip.arrivalStation;
    const handleBook = () => {
        const params = new URLSearchParams();
        if (promoCode) params.set('promoCode', promoCode);
        if (date) params.set('date', date);
        if (ticketType && ticketType !== 'one-way') params.set('ticketType', ticketType);
        if (ticketType === 'round-trip' && returnDate) params.set('returnDate', returnDate);
        if (routeSelection) {
            params.set('departureStationId', String(routeSelection.departureStationId));
            params.set('arrivalStationId', String(routeSelection.arrivalStationId));
            params.set('departure', routeSelection.departureStationName);
            params.set('arrival', routeSelection.arrivalStationName);
        }
        if (passengerCounts.total > 1 || passengerCounts.child || passengerCounts.senior || passengerCounts.student) {
            params.set('passengers', String(passengerCounts.total));
            params.set('passenger_adult', String(passengerCounts.adult));
            if (passengerCounts.child) params.set('passenger_child', String(passengerCounts.child));
            if (passengerCounts.senior) params.set('passenger_senior', String(passengerCounts.senior));
            if (passengerCounts.student) params.set('passenger_student', String(passengerCounts.student));
        }
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
                            <p className="text-xl font-black text-gray-900">{formatTime(departureTime || undefined)}</p>
                            <p className="mt-1 text-sm font-bold text-gray-600">{departureStation}</p>
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
                            <p className="text-xl font-black text-gray-900">{formatTime(arrivalTime || undefined)}</p>
                            <p className="mt-1 text-sm font-bold text-gray-600">{arrivalStation}</p>
                        </div>
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold text-gray-500">
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2">
                            <CalendarDays size={14} className="text-tet-red" />
                            {formatDate(departureTime || trip.departureTime)}
                        </span>
                        <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2">
                            <Armchair size={14} className="text-tet-red" />
                            {seatLabels.join(', ')}
                        </span>
                        {routeSelection && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-red-50 px-3 py-2 text-tet-red">
                                <MapPin size={14} />
                                {routeSelection.segments.length} chang trung gian
                            </span>
                        )}
                        {routeSelection?.minFareCarriageType && (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-50 px-3 py-2">
                                <Ticket size={14} className="text-tet-red" />
                                Gia theo {routeSelection.minFareCarriageType}
                            </span>
                        )}
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

    const { data: trainCategories = [] } = useQuery({
        queryKey: ['trip-categories'],
        queryFn: tripApi.getTripCategories,
        staleTime: 10 * 60 * 1000,
    });

    const itineraryQueries = useQueries({
        queries: trips.map((trip) => ({
            queryKey: ['trip-itinerary', trip.id],
            queryFn: () => tripApi.getTripItinerary(trip.id),
            staleTime: 5 * 60 * 1000,
            retry: 1,
        })),
    });

    const itineraryByTripId = useMemo(() => {
        const map = new Map<number, TripItinerary>();
        itineraryQueries.forEach((query, index) => {
            if (query.data) {
                map.set(trips[index].id, query.data);
            }
        });
        return map;
    }, [itineraryQueries, trips]);

    const values = useMemo(() => {
        const passengerCounts = getPassengerCountsFromParams(searchParams);
        const isRoundTrip = searchParams.get('roundTrip') === 'true' || searchParams.get('roundTrip') === '1';
        return {
            departure: readQueryValue(searchParams, ['departure', 'departPlaceName']),
            arrival: readQueryValue(searchParams, ['arrival', 'returnPlaceName']),
            date: readQueryValue(searchParams, ['date', 'departDate']),
            returnDate: searchParams.get('returnDate') || '',
            passengers: passengerCounts.total,
            passengerCounts,
            ticketType: searchParams.get('ticketType') || (isRoundTrip ? 'round-trip' : 'one-way'),
            timeWindow: searchParams.get('time') || '',
            trainType: normalizeTrainTypeValue(searchParams.get('trainType') || ''),
            seatType: searchParams.get('seatType') || '',
            minPrice: searchParams.get('minPrice') || '',
            maxPrice: searchParams.get('maxPrice') || '',
            ticketStatus: searchParams.get('ticketStatus') || '',
            duration: searchParams.get('duration') || '',
            upcoming: searchParams.get('upcoming') === 'true' || searchParams.get('upcoming') === '1',
            sort: (searchParams.get('sort') as SortValue) || 'earliest',
            promo: searchParams.get('promoCode') || searchParams.get('promo') || '',
        };
    }, [queryString, searchParams]);

    const stationOptions = useMemo(() => {
        const stations = trips.flatMap((trip) => {
            const itinerary = itineraryByTripId.get(trip.id);
            const stopNames = itinerary?.stops.map((stop) => stop.stationName) || [];
            return [trip.departureStation, trip.arrivalStation, ...stopNames];
        }).filter(Boolean);
        return Array.from(new Set(stations)).sort((a, b) => a.localeCompare(b, 'vi'));
    }, [itineraryByTripId, trips]);

    const stationCodeByName = useMemo(() => {
        const map = new Map<string, string>();
        itineraryByTripId.forEach((itinerary) => {
            itinerary.stops.forEach((stop) => {
                if (stop.stationName && stop.stationCode) {
                    map.set(stop.stationName, stop.stationCode);
                }
            });
        });
        return map;
    }, [itineraryByTripId]);

    const priceBounds = useMemo(() => {
        const prices = trips.map(getTripPrice).filter((price) => price > 0);
        return {
            min: prices.length ? Math.min(...prices) : 0,
            max: prices.length ? Math.max(...prices) : 0,
        };
    }, [trips]);

    const trainTypeOptions = useMemo(
        () => buildTrainTypeOptions(trainCategories, trips),
        [trainCategories, trips],
    );

    const seatTypeOptions = useMemo(
        () => buildSeatTypeOptions(trips),
        [trips],
    );

    const updateParams = (updates: Record<string, string | number | null>) => {
        const next = new URLSearchParams(searchParams);

        Object.entries(updates).forEach(([key, rawValue]) => {
            const value = rawValue === null || rawValue === undefined ? '' : String(rawValue).trim();
            const shouldDelete =
                !value ||
                (key === 'sort' && value === 'earliest') ||
                (key === 'ticketType' && value === 'one-way') ||
                (key === 'passengers' && value === '1');

            deleteQueryKey(next, key);
            if (!shouldDelete) next.set(key, value);
        });

        setSearchParams(next);
    };

    const updateSearchLinkParams = (updates: Partial<{
        departure: string;
        arrival: string;
        date: string;
        returnDate: string;
        ticketType: string;
        passengerCounts: PassengerCounts;
    }>) => {
        const nextValues = {
            departure: values.departure,
            arrival: values.arrival,
            date: values.date || toDateValueFromDate(new Date()),
            returnDate: values.returnDate,
            ticketType: values.ticketType,
            passengerCounts: values.passengerCounts,
            ...updates,
        };
        if (nextValues.ticketType !== 'round-trip' && updates.date && updates.returnDate === undefined) {
            nextValues.returnDate = updates.date;
        }
        const counts = normalizePassengerCounts(nextValues.passengerCounts);
        const next = new URLSearchParams(searchParams);

        ['departure', 'arrival', 'date', 'ticketType', 'passengers', 'passenger_adult', 'passenger_child', 'passenger_senior', 'passenger_student'].forEach((key) => {
            deleteQueryKey(next, key);
        });

        if (nextValues.departure) {
            next.set('departPlaceName', nextValues.departure);
            const code = stationCodeByName.get(nextValues.departure);
            if (code) next.set('departPlaceCode', code);
        }
        if (nextValues.arrival) {
            next.set('returnPlaceName', nextValues.arrival);
            const code = stationCodeByName.get(nextValues.arrival);
            if (code) next.set('returnPlaceCode', code);
        }
        if (nextValues.date) next.set('departDate', nextValues.date);
        next.set('returnDate', nextValues.ticketType === 'round-trip' ? (nextValues.returnDate || nextValues.date) : (nextValues.returnDate || nextValues.date));
        next.set('roundTrip', String(nextValues.ticketType === 'round-trip'));
        next.set('adults', String(counts.adult));
        if (counts.child) next.set('childs', String(counts.child));
        if (counts.senior) next.set('elderlys', String(counts.senior));
        if (counts.student) next.set('students', String(counts.student));
        next.set('totalTicket', String(counts.total));

        setSearchParams(next);
    };

    const updatePassengerCounts = (counts: PassengerCounts) => {
        const normalized = normalizePassengerCounts(counts);
        updateSearchLinkParams({ passengerCounts: normalized });
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
            const itinerary = itineraryByTripId.get(trip.id);
            const routeSelection = resolveRouteSelection(trip, itinerary, values.departure, values.arrival);
            if (values.departure || values.arrival) {
                if (itinerary && !routeSelection) return false;
                if (!itinerary && values.departure && trip.departureStation !== values.departure) return false;
                if (!itinerary && values.arrival && trip.arrivalStation !== values.arrival) return false;
            }

            const routeDepartureTime = routeSelection?.departureTime || trip.departureTime;
            if (values.date && toDateInputValue(routeDepartureTime || undefined) !== values.date) return false;
            if (values.upcoming) {
                const departureTime = readDate(routeDepartureTime || undefined);
                if (!departureTime || departureTime < new Date()) return false;
            }

            if (values.timeWindow) {
                const window = TIME_WINDOWS.find((item) => item.value === values.timeWindow);
                const minutes = getTimeMinutes(routeDepartureTime || undefined);
                if (window && (minutes < window.start || minutes >= window.end)) return false;
            }

            if (values.trainType && getTripCategoryValue(trip) !== values.trainType) return false;
            if (values.seatType && !matchesSeatType(trip, values.seatType)) return false;

            const tripPrice = routeSelection?.minFare ?? getTripPrice(trip);
            if (Number.isFinite(minPrice) && minPrice > 0 && tripPrice < minPrice) return false;
            if (Number.isFinite(maxPrice) && maxPrice > 0 && tripPrice > maxPrice) return false;

            if (values.ticketStatus) {
                const routeSeats = routeSelection?.availableSeats;
                const statusTrip = routeSeats === undefined ? trip : { ...trip, availableSeats: routeSeats };
                if (getInventoryStatus(statusTrip).value !== values.ticketStatus) return false;
            }

            const duration = parseDurationMinutes(trip);
            if (values.duration === 'under-6' && duration >= 360) return false;
            if (values.duration === '6-12' && (duration < 360 || duration > 720)) return false;
            if (values.duration === 'over-12' && duration <= 720) return false;

            return true;
        });

        return [...filtered].sort((a, b) => {
            const routeA = resolveRouteSelection(a, itineraryByTripId.get(a.id), values.departure, values.arrival);
            const routeB = resolveRouteSelection(b, itineraryByTripId.get(b.id), values.departure, values.arrival);
            if (values.sort === 'price-asc') return (routeA?.minFare ?? getTripPrice(a)) - (routeB?.minFare ?? getTripPrice(b));
            if (values.sort === 'price-desc') return (routeB?.minFare ?? getTripPrice(b)) - (routeA?.minFare ?? getTripPrice(a));
            if (values.sort === 'duration-asc') return parseDurationMinutes(a) - parseDurationMinutes(b);
            if (values.sort === 'seats-desc') return (routeB?.availableSeats ?? getAvailableSeats(b)) - (routeA?.availableSeats ?? getAvailableSeats(a));
            return getTimeMinutes(routeA?.departureTime || a.departureTime) - getTimeMinutes(routeB?.departureTime || b.departureTime);
        });
    }, [itineraryByTripId, trips, values]);

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
                label: formatDateRailDay(values.date),
                remove: () => updateParams({ date: null }),
            });
        }

        if (values.ticketType === 'round-trip' && values.returnDate) {
            chips.push({
                key: 'returnDate',
                label: `Ngày về ${formatDateRailDay(values.returnDate)}`,
                remove: () => updateParams({ returnDate: null }),
            });
        }

        if (searchParams.has('passengers') || values.passengers > 1) {
            chips.push({
                key: 'passengers',
                label: `${values.passengers} vé`,
                remove: () => updateParams({
                    passengers: null,
                    passenger_adult: null,
                    passenger_child: null,
                    passenger_senior: null,
                    passenger_student: null,
                }),
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
        if (values.trainType) chips.push({ key: 'trainType', label: getLabel(trainTypeOptions, values.trainType), remove: () => updateParams({ trainType: null }) });
        if (values.seatType) chips.push({ key: 'seatType', label: getLabel(seatTypeOptions, values.seatType), remove: () => updateParams({ seatType: null }) });
        if (values.ticketStatus) chips.push({ key: 'ticketStatus', label: getLabel(TICKET_STATUSES, values.ticketStatus), remove: () => updateParams({ ticketStatus: null }) });
        if (values.duration) chips.push({ key: 'duration', label: getLabel(DURATION_FILTERS, values.duration), remove: () => updateParams({ duration: null }) });
        if (values.upcoming) chips.push({ key: 'upcoming', label: 'Chuyáº¿n sáº¯p cháº¡y', remove: () => updateParams({ upcoming: null }) });
        if (values.minPrice || values.maxPrice) {
            chips.push({
                key: 'price',
                label: `${values.minPrice ? formatCurrency(Number(values.minPrice)) : formatCurrency(priceBounds.min)} - ${values.maxPrice ? formatCurrency(Number(values.maxPrice)) : formatCurrency(priceBounds.max)}`,
                remove: () => updateParams({ minPrice: null, maxPrice: null }),
            });
        }
        if (values.promo) chips.push({ key: 'promo', label: `Mã ${values.promo}`, remove: () => updateParams({ promoCode: null, promo: null }) });

        return chips;
    }, [queryString, searchParams, values, priceBounds, seatTypeOptions, trainTypeOptions]);

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

                <div className="sticky top-[72px] z-30 border-y border-gray-200 bg-[#eef4f7]/95 backdrop-blur-xl">
                    <div className="mx-auto max-w-[86rem] px-4 py-3 md:px-12">
                        <div className={cn(
                            "grid gap-3 rounded-md bg-[#d8d8d8] p-3 shadow-sm lg:items-end",
                            values.ticketType === 'round-trip'
                                ? "lg:grid-cols-[1.05fr_1.05fr_0.85fr_0.85fr_1fr_0.85fr_auto_auto]"
                                : "lg:grid-cols-[1.2fr_1.2fr_0.9fr_1fr_0.9fr_auto_auto]"
                        )}>
                            <SelectField
                                icon={MapPin}
                                label="Ga đi"
                                value={values.departure}
                                onChange={(value) => updateSearchLinkParams({ departure: value })}
                                options={[{ value: '', label: 'Tất cả ga đi' }, ...stationOptions.map((station) => ({ value: station, label: station }))]}
                            />
                            <SelectField
                                icon={MapPin}
                                label="Ga đến"
                                value={values.arrival}
                                onChange={(value) => updateSearchLinkParams({ arrival: value })}
                                options={[{ value: '', label: 'Tất cả ga đến' }, ...stationOptions.map((station) => ({ value: station, label: station }))]}
                            />
                            <DatePickerField
                                label="Ngày đi"
                                value={values.date}
                                onChange={(value) => updateSearchLinkParams({ date: value })}
                            />
                            {values.ticketType === 'round-trip' && (
                                <DatePickerField
                                    label="Ngày về"
                                    min={values.date || undefined}
                                    value={values.returnDate}
                                    placeholder="Chọn nếu mua vé về"
                                    onChange={(value) => updateSearchLinkParams({ returnDate: value })}
                                />
                            )}
                            <PassengerPickerField
                                value={values.passengerCounts}
                                onChange={updatePassengerCounts}
                            />
                            <SelectField
                                icon={Ticket}
                                label="Loại vé"
                                value={values.ticketType}
                                onChange={(value) => updateSearchLinkParams({
                                    ticketType: value,
                                    returnDate: value === 'round-trip' ? (values.returnDate || values.date) : '',
                                })}
                                options={TICKET_TYPES}
                            />
                            <button
                                type="button"
                                onClick={() => updateSearchLinkParams({})}
                                className="hidden h-11 items-center justify-center rounded-xl bg-[#ff8900] px-7 text-sm font-black text-white shadow-sm transition hover:bg-[#f07f00] lg:inline-flex"
                            >
                                Tìm
                            </button>
                            <div className="flex gap-2">
                                <button
                                    type="button"
                                    onClick={() => updateSearchLinkParams({ departure: values.arrival, arrival: values.departure })}
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

                <div className="mx-auto max-w-[86rem] px-4 pt-6 md:px-12">
                    <DateRail
                        date={values.date}
                        departure={values.departure}
                        arrival={values.arrival}
                        onChange={(nextDate) => updateSearchLinkParams({ date: nextDate })}
                    />
                </div>
            </section>

            <section className="py-8 md:py-10">
                <div className="mx-auto grid max-w-[86rem] gap-6 px-4 md:px-12 lg:grid-cols-[300px_1fr]">
                    <aside className="hidden lg:block">
                        <div className="sticky top-36 max-h-[calc(100vh-10rem)] overflow-y-auto overscroll-contain rounded-2xl border border-gray-100 bg-white p-5 pr-4 shadow-sm [scrollbar-width:thin] [scrollbar-color:#D32F2F_#F3F4F6] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-track]:rounded-full [&::-webkit-scrollbar-track]:bg-gray-100 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-tet-red/70">
                            <ScheduleFilterPanel
                                values={values}
                                updateParams={updateParams}
                                clearFilters={clearFilters}
                                activeCount={activeFilterCount}
                                trainTypeOptions={trainTypeOptions}
                                seatTypeOptions={seatTypeOptions}
                            />
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
                                        <ScheduleTripCard
                                            key={trip.id}
                                            trip={trip}
                                            passengers={values.passengers}
                                            passengerCounts={values.passengerCounts}
                                            date={values.date}
                                            returnDate={values.returnDate}
                                            ticketType={values.ticketType}
                                            promoCode={values.promo}
                                            routeSelection={resolveRouteSelection(trip, itineraryByTripId.get(trip.id), values.departure, values.arrival)}
                                        />
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
                            <ScheduleFilterPanel
                                values={values}
                                updateParams={updateParams}
                                clearFilters={clearFilters}
                                activeCount={activeFilterCount}
                                trainTypeOptions={trainTypeOptions}
                                seatTypeOptions={seatTypeOptions}
                            />
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Footer />
        </main>
    );
};

export default Schedules;
