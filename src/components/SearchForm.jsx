import React, { useEffect, useMemo, useRef, useState } from 'react';
import { MapPin, Calendar as CalendarIcon, Users, Search, ArrowRightLeft, ChevronDown, Check, Ticket } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { stationApi } from '../api/station.api';
import { tripApi } from '../api/trip.api';
import { useQuery } from '@tanstack/react-query';
import { writeSearchState } from '../lib/searchState';
import { buildPassengerOptions } from '../lib/passengerFareRules';

const POPULAR_ROUTE_KEYS = [
    ['saigon', 'hanoi'],
    ['saigon', 'danang'],
    ['hanoi', 'vinh'],
];

const toScheduleTrainType = (category) => {
    if (category === 'HIGH_QUALITY') return 'CLC';
    return category;
};

const toSearchCategory = (trainType) => {
    if (trainType === 'CLC') return 'HIGH_QUALITY';
    return trainType;
};

const getNextDateValue = (value) => {
    const baseDate = value ? parseDateInput(value) : new Date();
    if (!baseDate || Number.isNaN(baseDate.getTime())) return '';
    baseDate.setDate(baseDate.getDate() + 1);
    return toDateInputValue(baseDate);
};

const parseDateInput = (value) => {
    if (!value) return null;
    const [year, month, day] = String(value).split('-').map(Number);
    if (!year || !month || !day) return null;
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
};

const toDateInputValue = (date = new Date()) => {
    const normalizedDate = date instanceof Date ? date : new Date(date);
    if (Number.isNaN(normalizedDate.getTime())) return '';
    const year = normalizedDate.getFullYear();
    const month = `${normalizedDate.getMonth() + 1}`.padStart(2, '0');
    const day = `${normalizedDate.getDate()}`.padStart(2, '0');
    return `${year}-${month}-${day}`;
};

const formatDateDisplay = (value) => {
    const date = parseDateInput(value);
    if (!date) return '--';
    const day = `${date.getDate()}`.padStart(2, '0');
    const month = `${date.getMonth() + 1}`.padStart(2, '0');
    return `${day}-${month}-${date.getFullYear()}`;
};

const formatWeekdayDisplay = (value) => {
    const date = parseDateInput(value);
    if (!date) return 'Chọn ngày';
    const weekdays = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
    return weekdays[date.getDay()];
};

const MAX_TICKETS = 10;
const passengerDefaults = { adult: 1, child: 0, senior: 0, student: 0 };

const passengerOptions = [
    { key: 'adult', label: 'Người lớn', description: 'Từ 10 - 59 tuổi' },
    { key: 'child', label: 'Trẻ em', description: '6 - 9 tuổi', discount: '-25%' },
    { key: 'senior', label: 'Người cao tuổi', description: 'Từ 60 tuổi', discount: '-15%' },
    { key: 'student', label: 'Sinh viên', description: 'Thẻ SV', discount: '-10%' },
];

const passengerNotes = [
    'Một người lớn được kèm 1 trẻ dưới 6 tuổi miễn vé, ngồi chung chỗ.',
    'Người cao tuổi: Công dân Việt Nam từ 60 tuổi.',
    'Sinh viên: Công dân Việt Nam có thẻ sinh viên hợp lệ.',
];

const passengerTotal = (counts) => Object.values(counts || passengerDefaults)
    .reduce((total, value) => total + Math.max(0, Number(value) || 0), 0);

const normalizePassengerCounts = (counts = passengerDefaults) => {
    const normalized = Object.keys(passengerDefaults).reduce((acc, key) => ({
        ...acc,
        [key]: Math.max(key === 'adult' ? 1 : 0, Math.min(MAX_TICKETS, Number(counts[key]) || 0)),
    }), {});
    return passengerTotal(normalized) > 0 ? normalized : passengerDefaults;
};

const passengerCountsFromParams = (params) => {
    const hasDetailedCounts = ['adult', 'child', 'senior', 'student']
        .some((key) => params.has(`passenger_${key}`))
        || ['adults', 'childs', 'children', 'elderlys', 'seniors', 'students'].some((key) => params.has(key));
    if (hasDetailedCounts) {
        return normalizePassengerCounts({
            adult: params.get('passenger_adult') || params.get('adults') || 1,
            child: params.get('passenger_child') || params.get('childs') || params.get('children') || 0,
            senior: params.get('passenger_senior') || params.get('elderlys') || params.get('seniors') || 0,
            student: params.get('passenger_student') || params.get('students') || 0,
        });
    }
    const total = Math.max(1, Math.min(MAX_TICKETS, Number(params.get('passengers') || params.get('totalTicket')) || 1));
    return { ...passengerDefaults, adult: total };
};

const FieldIcon = ({ icon: Icon, variant = 'dark' }) => (
    <span
        data-field-icon="true"
        className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-full ring-1 transition-all duration-300",
            variant === 'dark'
                ? "bg-gradient-to-br from-white to-red-50 text-tet-red ring-red-100 shadow-[0_8px_20px_rgba(211,47,47,0.16)] group-hover:scale-105 group-hover:shadow-[0_10px_24px_rgba(211,47,47,0.22)]"
                : "bg-red-50 text-tet-red ring-red-100 group-hover:bg-tet-red group-hover:text-white"
        )}
    >
        <Icon size={18} className="stroke-[2.4]" />
    </span>
);

const CustomSelect = ({ value, onChange, options, placeholder, icon: Icon, label, variant = 'dark' }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    return (
        <div className="lg:col-span-3 space-y-1" ref={containerRef}>
            <label className={cn("text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 px-1 drop-shadow-sm", variant === 'dark' ? "text-white/90" : "text-gray-500")}>
                {Icon && <Icon size={11} className={variant === 'dark' ? "text-tet-yellow" : "text-tet-red"} />} {label}
            </label>
            <div className="relative group">
                <button
                    type="button"
                    onClick={() => setIsOpen((prev) => !prev)}
                    className={cn(
                        "flex h-14 w-full items-center justify-between gap-3 rounded-lg px-3 outline-none transition-all",
                        variant === 'dark'
                            ? "bg-white/90 backdrop-blur-sm border border-white/50 group-hover:border-white"
                            : "bg-white border border-gray-200 group-hover:border-gray-300 shadow-sm",
                        isOpen && (variant === 'dark' ? "border-white ring-2 ring-white/30 shadow-md bg-white" : "border-tet-red ring-2 ring-red-100 shadow-md bg-white")
                    )}
                >
                    {Icon && <FieldIcon icon={Icon} variant={variant} />}
                    <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-gray-500">{label}</span>
                        <span className={cn("block truncate text-base font-black leading-tight transition-colors", value ? "text-gray-950" : "text-gray-400")}>
                            {value || placeholder}
                        </span>
                    </span>
                    <ChevronDown size={15} className={cn("shrink-0 text-gray-400 transition-transform duration-300", isOpen && "rotate-180 text-tet-red")} />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.2, ease: 'easeOut' }}
                            className="absolute z-50 left-0 right-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden backdrop-blur-xl"
                        >
                            <div className="max-h-[240px] overflow-y-auto p-1.5 scrollbar-hide">
                                {options.map((option) => (
                                    <button
                                        key={option}
                                        type="button"
                                        onClick={() => {
                                            onChange(option);
                                            setIsOpen(false);
                                        }}
                                        className={cn(
                                            "w-full text-left px-3 py-2.5 rounded-lg font-bold text-sm flex items-center justify-between transition-all",
                                            value === option
                                                ? "bg-red-50 text-tet-red"
                                                : "hover:bg-gray-50 text-gray-700"
                                        )}
                                    >
                                        <span>{option}</span>
                                        {value === option && <Check size={14} className="text-tet-red" />}
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
};

const DateDisplayField = ({ value, onChange, min, label, variant = 'dark' }) => {
    const inputRef = useRef(null);

    const openDatePicker = () => {
        const input = inputRef.current;
        if (!input) return;
        input.focus();
        if (typeof input.showPicker === 'function') {
            try {
                input.showPicker();
                return;
            } catch (error) {
                // Fallback below for browsers that block showPicker.
            }
        }
        input.click();
    };

    return (
        <div className="space-y-1">
            <label className={cn("text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 px-1 drop-shadow-sm", variant === 'dark' ? "text-white/90" : "text-gray-500")}>
                <CalendarIcon size={11} className={variant === 'dark' ? "text-tet-yellow" : "text-tet-red"} /> {label}
            </label>
            <div className="relative group">
                <button
                    type="button"
                    onClick={openDatePicker}
                    className={cn(
                        "relative flex h-14 w-full items-center gap-3 rounded-lg px-3 text-left outline-none transition-all",
                        variant === 'dark'
                            ? "bg-white/90 backdrop-blur-sm border border-white/50 group-hover:border-white focus:border-white focus:ring-2 focus:ring-white/30"
                            : "bg-white border border-gray-200 shadow-sm group-hover:border-gray-300 focus:border-tet-red focus:ring-2 focus:ring-red-100"
                    )}
                >
                    <FieldIcon icon={CalendarIcon} variant={variant} />
                    <span className="min-w-0">
                        <span className="block truncate text-sm font-bold text-gray-500">{formatWeekdayDisplay(value)}</span>
                        <span className={cn("block truncate text-base font-black leading-tight", value ? "text-gray-950" : "text-gray-400")}>
                            {value ? formatDateDisplay(value) : 'Chọn ngày'}
                        </span>
                    </span>
                </button>
                <input
                    ref={inputRef}
                    type="date"
                    min={min}
                    value={value}
                    onChange={(event) => onChange(event.target.value)}
                    aria-label={label}
                    className="pointer-events-none absolute bottom-0 left-3 h-px w-px opacity-0"
                />
            </div>
        </div>
    );
};

const TicketQuantityField = ({ value, onChange, onSearch, variant = 'dark', options = passengerOptions }) => {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef(null);
    const counts = normalizePassengerCounts(value);
    const quantity = passengerTotal(counts);

    useEffect(() => {
        const handleClickOutside = (event) => {
            if (containerRef.current && !containerRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const updateQuantity = (key, delta) => {
        const current = Number(counts[key]) || 0;
        const minValue = key === 'adult' ? 1 : 0;
        if (delta > 0 && quantity >= MAX_TICKETS) return;
        const nextValue = Math.max(minValue, current + delta);
        onChange(normalizePassengerCounts({ ...counts, [key]: nextValue }));
    };

    return (
        <div className="space-y-1" ref={containerRef}>
            <label className={cn("text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 px-1 drop-shadow-sm", variant === 'dark' ? "text-white/90" : "text-gray-500")}>
                <Users size={11} className={variant === 'dark' ? "text-tet-yellow" : "text-tet-red"} /> Số lượng vé
            </label>
            <div className="relative group">
                <button
                    type="button"
                    onClick={() => setIsOpen((prev) => !prev)}
                    className={cn(
                        "flex h-14 w-full items-center justify-between gap-3 rounded-lg px-3 text-left outline-none transition-all",
                        variant === 'dark'
                            ? "bg-white/90 backdrop-blur-sm border border-white/50 group-hover:border-white focus:border-white focus:ring-2 focus:ring-white/30"
                            : "bg-white border border-gray-200 shadow-sm group-hover:border-gray-300 focus:border-tet-red focus:ring-2 focus:ring-red-100"
                    )}
                >
                        <span className="flex min-w-0 items-center gap-3">
                            <FieldIcon icon={Users} variant={variant} />
                            <span className="min-w-0">
                                <span className="block truncate text-sm font-bold text-gray-500">Số lượng vé</span>
                                <span className="block truncate text-base font-black leading-tight text-gray-950">{quantity} vé</span>
                        </span>
                    </span>
                    <ChevronDown size={14} className={cn("shrink-0 text-gray-400 transition-transform", isOpen && "rotate-180 text-tet-red")} />
                </button>

                <AnimatePresence>
                    {isOpen && (
                        <motion.div
                            initial={{ opacity: 0, y: 10, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 10, scale: 0.95 }}
                            transition={{ duration: 0.18, ease: 'easeOut' }}
                            className="absolute left-0 z-50 mt-2 w-[min(92vw,560px)] overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-2xl lg:left-auto lg:right-0"
                        >
                            <div className="grid md:grid-cols-[minmax(0,1fr)_220px]">
                                <div className="p-4">
                                    <div className="divide-y divide-gray-100">
                                        {options.map((option) => {
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
                                                            onClick={() => updateQuantity(option.key, -1)}
                                                            disabled={current <= minValue}
                                                            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-xl font-black text-gray-600 transition hover:border-tet-red hover:text-tet-red disabled:cursor-not-allowed disabled:opacity-40"
                                                        >
                                                            -
                                                        </button>
                                                        <span className="w-5 text-center text-xl font-black text-gray-950">{current}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => updateQuantity(option.key, 1)}
                                                            disabled={quantity >= MAX_TICKETS}
                                                            className="flex h-10 w-10 items-center justify-center rounded-full border border-gray-200 text-xl font-black text-gray-600 transition hover:border-tet-red hover:text-tet-red disabled:cursor-not-allowed disabled:opacity-40"
                                                        >
                                                            +
                                                        </button>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>

                                    <button
                                        type="button"
                                        onClick={() => {
                                            setIsOpen(false);
                                            onSearch?.();
                                        }}
                                        className="mt-3 flex h-12 w-full items-center justify-center rounded-xl bg-gradient-to-r from-tet-yellow via-[#FFC533] to-[#FF9F1C] text-sm font-black uppercase tracking-wide text-[#7A1A12] shadow-[0_12px_28px_rgba(255,193,7,0.25)]"
                                    >
                                        Tìm chuyến tàu
                                    </button>
                                </div>

                                <div className="space-y-4 bg-slate-50 p-4 text-sm font-semibold leading-6 text-gray-600">
                                    {passengerNotes.map((note) => (
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
        </div>
    );
};

const SearchForm = ({ variant = 'dark' }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    const [activeQuickFilter, setActiveQuickFilter] = useState('ALL');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [date, setDate] = useState(toDateInputValue());
    const [returnDate, setReturnDate] = useState('');
    const [ticketType, setTicketType] = useState('one-way');
    const [passengerCounts, setPassengerCounts] = useState(passengerDefaults);

    const { data: stations = [] } = useQuery({
        queryKey: ['stations'],
        queryFn: stationApi.getAllStations,
        staleTime: 1000 * 60 * 10,
    });

    const { data: categories = [] } = useQuery({
        queryKey: ['trip-categories'],
        queryFn: tripApi.getTripCategories,
        staleTime: 1000 * 60 * 10,
    });

    const { data: passengerFareRules = [] } = useQuery({
        queryKey: ['passenger-fare-rules'],
        queryFn: tripApi.getPassengerFareRules,
        staleTime: 1000 * 60 * 5,
    });

    const dynamicPassengerOptions = useMemo(() => buildPassengerOptions(passengerFareRules), [passengerFareRules]);

    const renderedCategories = categories.length
        ? categories
        : [
            { code: 'ALL', label: t('search.quick_filters.all'), description: '' },
            { code: 'SE_TN', label: t('search.quick_filters.se_tn'), description: '' },
            { code: 'HIGH_QUALITY', label: t('search.quick_filters.clc'), description: '' },
            { code: 'SUBURBAN', label: t('search.quick_filters.suburban'), description: '' },
        ];

    const fromOptions = stations.map((station) => station.name);
    const toOptions = stations.map((station) => station.name);

    useEffect(() => {
        if (!['/search', '/schedules'].includes(location.pathname)) return;

        setFrom(searchParams.get('departure') || searchParams.get('departPlaceName') || '');
        setTo(searchParams.get('arrival') || searchParams.get('returnPlaceName') || '');
        setDate(searchParams.get('date') || searchParams.get('departDate') || '');
        setReturnDate(searchParams.get('returnDate') || '');
        setTicketType(searchParams.get('ticketType') || (searchParams.get('roundTrip') === 'true' ? 'round-trip' : 'one-way'));
        setPassengerCounts(passengerCountsFromParams(searchParams));
        setActiveQuickFilter(toSearchCategory(searchParams.get('trainType') || searchParams.get('trainCategory') || 'ALL'));
    }, [location.pathname, searchParams]);

    const totalPassengers = passengerTotal(passengerCounts);

    useEffect(() => {
        writeSearchState({
            departure: from,
            arrival: to,
            date,
            returnDate,
            ticketType,
            passengerCounts,
            trainType: activeQuickFilter && activeQuickFilter !== 'ALL'
                ? toScheduleTrainType(activeQuickFilter)
                : '',
        });
    }, [activeQuickFilter, date, from, passengerCounts, returnDate, ticketType, to]);

    const swapStations = () => {
        setFrom(to);
        setTo(from);
    };

    const getStationCode = (stationName) => (
        stations.find((station) => station.name === stationName)?.code || ''
    );

    const handleSearch = () => {
        const params = new URLSearchParams();

        if (from) {
            params.set('departPlaceName', from);
            const code = getStationCode(from);
            if (code) params.set('departPlaceCode', code);
        }
        if (to) {
            params.set('returnPlaceName', to);
            const code = getStationCode(to);
            if (code) params.set('returnPlaceCode', code);
        }
        if (date) params.set('departDate', date);
        params.set('returnDate', ticketType === 'round-trip' ? (returnDate || date) : (returnDate || date));
        params.set('roundTrip', String(ticketType === 'round-trip'));
        params.set('adults', String(passengerCounts.adult));
        if (passengerCounts.child) params.set('childs', String(passengerCounts.child));
        if (passengerCounts.senior) params.set('elderlys', String(passengerCounts.senior));
        if (passengerCounts.student) params.set('students', String(passengerCounts.student));
        params.set('totalTicket', String(totalPassengers));
        if (activeQuickFilter && activeQuickFilter !== 'ALL') {
            params.set('trainType', toScheduleTrainType(activeQuickFilter));
        }

        const queryString = params.toString();
        navigate(`/search${queryString ? `?${queryString}` : ''}`);
    };

    const popularRoutes = POPULAR_ROUTE_KEYS.map(([fromKey, toKey]) => ({
        from: t(`search.stations.${fromKey}`),
        to: t(`search.stations.${toKey}`),
        label: `${t(`search.stations.${fromKey}`)} -> ${t(`search.stations.${toKey}`)}`,
    }));

    return (
        <div className="max-w-7xl mx-auto px-0 sm:px-4 relative z-30">
            <motion.div
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="rounded-2xl p-3 sm:p-4 md:p-6 lg:p-8"
            >
                <div className="flex gap-1.5 sm:gap-2 md:gap-3 mb-3 sm:mb-4 md:mb-6 overflow-x-auto scrollbar-hide pb-1 justify-center sm:justify-start">
                    {renderedCategories.map((filter) => (
                        <button
                            key={filter.code}
                            type="button"
                            onClick={() => setActiveQuickFilter(filter.code)}
                            title={filter.description || filter.label}
                            className={cn(
                                "px-3 md:px-4 py-1.5 rounded-full text-xs md:text-sm font-bold border transition-all backdrop-blur-sm whitespace-nowrap shrink-0",
                                activeQuickFilter === filter.code
                                    ? "bg-tet-red border-tet-red text-white shadow-md"
                                    : variant === 'dark'
                                        ? "border-white/40 text-white/90 hover:bg-white/20 hover:border-white/60 bg-white/10"
                                        : "border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-gray-900 bg-white shadow-sm"
                            )}
                        >
                            {filter.label}
                        </button>
                    ))}
                </div>

                <div className="mb-3 sm:mb-4 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <span className={cn("text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 px-1 drop-shadow-sm", variant === 'dark' ? "text-white/90" : "text-gray-500")}>
                        <Ticket size={11} className={variant === 'dark' ? "text-tet-yellow" : "text-tet-red"} />
                        {t('search.ticket_type_label')}
                    </span>
                    <div className={cn("inline-flex rounded-full p-1 border backdrop-blur-sm", variant === 'dark' ? "bg-white/10 border-white/25" : "bg-gray-50 border-gray-200")}>
                        {[
                            { value: 'one-way', label: t('search.one_way') },
                            { value: 'round-trip', label: t('search.round_trip') },
                        ].map((option) => (
                            <button
                                key={option.value}
                                type="button"
                                onClick={() => {
                                    setTicketType(option.value);
                                    if (option.value === 'round-trip' && !returnDate) {
                                        setReturnDate(getNextDateValue(date));
                                    }
                                    if (option.value === 'one-way') {
                                        setReturnDate('');
                                    }
                                }}
                                className={cn(
                                    "rounded-full px-4 py-1.5 text-xs font-black transition-all",
                                    ticketType === option.value
                                        ? "bg-tet-red text-white shadow-md"
                                        : variant === 'dark'
                                            ? "text-white/85 hover:bg-white/15"
                                            : "text-gray-500 hover:bg-white"
                                )}
                            >
                                {option.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className={cn(
                    "grid grid-cols-1 gap-2.5 sm:grid-cols-2 sm:gap-3 md:gap-4 lg:grid-cols-12 lg:items-end",
                    ticketType === 'round-trip' && "2xl:grid-cols-[minmax(420px,2.5fr)_minmax(170px,1fr)_minmax(170px,1fr)_minmax(180px,1fr)_minmax(190px,1fr)]"
                )}>
                    <div className={cn(
                        "sm:col-span-2 relative flex flex-col sm:flex-row items-end gap-5 sm:gap-3 md:gap-4",
                        ticketType === 'round-trip'
                            ? "lg:col-span-6 2xl:col-span-1"
                            : "lg:col-span-6"
                    )}>
                        <div className="w-full sm:flex-1 relative z-10">
                            <CustomSelect
                                label={t('search.from_label')}
                                icon={MapPin}
                                placeholder={t('search.from_placeholder')}
                                value={from}
                                onChange={setFrom}
                                options={fromOptions}
                                variant={variant}
                            />
                        </div>

                        <div className="absolute left-1/2 top-[55%] -translate-x-1/2 -translate-y-1/2 sm:static sm:translate-x-0 sm:translate-y-0 z-20 flex items-center justify-center shrink-0 sm:pb-1">
                            <button
                                type="button"
                                onClick={swapStations}
                                className={cn(
                                    "w-8 h-8 rounded-full transition-all transform hover:-rotate-180 duration-500 flex items-center justify-center group shadow-md border-2",
                                    variant === 'dark'
                                        ? "bg-white hover:bg-tet-red border-white/50 text-tet-red hover:text-white"
                                        : "bg-white hover:bg-tet-red border-gray-100 text-tet-red hover:text-white"
                                )}
                            >
                                <ArrowRightLeft size={14} className="group-hover:scale-110 transition-transform rotate-90 sm:rotate-0 stroke-[2.5]" />
                            </button>
                        </div>

                        <div className="w-full sm:flex-1 relative z-10">
                            <CustomSelect
                                label={t('search.to_label')}
                                icon={MapPin}
                                placeholder={t('search.to_placeholder')}
                                value={to}
                                onChange={setTo}
                                options={toOptions}
                                variant={variant}
                            />
                        </div>
                    </div>

                    <div className={cn("sm:col-span-1 lg:col-span-2", ticketType === 'round-trip' && "2xl:col-span-1")}>
                        <DateDisplayField
                            label={t('search.date_label')}
                            value={date}
                            onChange={(nextDate) => {
                                setDate(nextDate);
                                if (ticketType === 'round-trip' && !returnDate) {
                                    setReturnDate(getNextDateValue(nextDate));
                                }
                            }}
                            variant={variant}
                        />
                    </div>

                    {ticketType === 'round-trip' && (
                        <div className="sm:col-span-1 lg:col-span-2 2xl:col-span-1">
                            <DateDisplayField
                                label={t('search.return_date_label')}
                                value={returnDate}
                                min={date || undefined}
                                onChange={setReturnDate}
                                variant={variant}
                            />
                        </div>
                    )}

                    <div className={cn("sm:col-span-1 lg:col-span-2", ticketType === 'round-trip' && "2xl:col-span-1")}>
                        <TicketQuantityField
                            value={passengerCounts}
                            onChange={setPassengerCounts}
                            onSearch={handleSearch}
                            variant={variant}
                            options={dynamicPassengerOptions}
                        />
                    </div>

                    <div className={cn(
                        "sm:col-span-2 lg:col-span-2 mt-1 sm:mt-0",
                        ticketType === 'round-trip' && "lg:col-start-11 2xl:col-start-auto 2xl:col-span-1"
                    )}>
                        <button
                            type="button"
                            onClick={handleSearch}
                            className="group relative w-full h-14 overflow-hidden rounded-xl bg-gradient-to-r from-tet-yellow via-[#FFC533] to-[#FF9F1C] px-5 text-[#7A1A12] shadow-[0_14px_32px_rgba(255,193,7,0.28)] ring-1 ring-white/40 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(255,193,7,0.38)] active:translate-y-0 active:scale-[0.98]"
                        >
                            <span className="absolute inset-y-0 left-0 w-1/3 bg-white/30 blur-2xl transition-transform duration-500 group-hover:translate-x-[220%]" />
                            <span className="relative flex items-center justify-center gap-2.5 text-sm font-black uppercase tracking-wide">
                                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-900/12 ring-1 ring-red-900/10 transition-colors group-hover:bg-red-900/18">
                                    <Search size={16} className="stroke-[3]" />
                                </span>
                                {t('search.cta')}
                            </span>
                        </button>
                    </div>
                </div>

                <div className={cn("mt-3 sm:mt-4 md:mt-4 flex flex-wrap items-center gap-1.5 sm:gap-2 border-t pt-2.5 sm:pt-3", variant === 'dark' ? "border-white/20" : "border-gray-100")}>
                    <span className={cn("text-[9px] font-black uppercase tracking-wider block w-full md:w-auto mb-1 md:mb-0 drop-shadow-sm", variant === 'dark' ? "text-white/70" : "text-gray-500")}>
                        {t('search.suggestions')}
                    </span>
                    <div className="flex flex-wrap gap-2">
                        {popularRoutes.map((route) => (
                            <button
                                key={route.label}
                                type="button"
                                onClick={() => {
                                    setFrom(route.from);
                                    setTo(route.to);
                                }}
                                className={cn(
                                    "text-[9px] font-bold px-3 py-1.5 rounded-md transition-all border",
                                    variant === 'dark'
                                        ? "bg-white/20 backdrop-blur-sm text-white/90 hover:bg-white/30 hover:text-white border-white/20 hover:border-white/40"
                                        : "bg-gray-50 text-gray-600 hover:bg-gray-100 hover:text-gray-900 border-gray-200"
                                )}
                            >
                                {route.label}
                            </button>
                        ))}
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default SearchForm;
