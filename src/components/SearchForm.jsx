import React, { useEffect, useRef, useState } from 'react';
import { MapPin, Calendar as CalendarIcon, Users, Search, ArrowRightLeft, ChevronDown, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { stationApi } from '../api/station.api';
import { tripApi } from '../api/trip.api';
import { useQuery } from '@tanstack/react-query';

const POPULAR_ROUTE_KEYS = [
    ['saigon', 'hanoi'],
    ['saigon', 'danang'],
    ['hanoi', 'vinh'],
];

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
                        "w-full rounded-lg py-2 px-3 outline-none transition-all flex items-center justify-between",
                        variant === 'dark'
                            ? "bg-white/90 backdrop-blur-sm border border-white/50 group-hover:border-white"
                            : "bg-white border border-gray-200 group-hover:border-gray-300 shadow-sm",
                        isOpen && (variant === 'dark' ? "border-white ring-2 ring-white/30 shadow-md bg-white" : "border-tet-red ring-2 ring-red-100 shadow-md bg-white")
                    )}
                >
                    <span className={cn("font-bold text-sm transition-colors", value ? "text-gray-900" : "text-gray-400")}>
                        {value || placeholder}
                    </span>
                    <ChevronDown size={14} className={cn("text-gray-400 transition-transform duration-300", isOpen && "rotate-180 text-tet-red")} />
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

const SearchForm = ({ variant = 'dark' }) => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();

    const [activeQuickFilter, setActiveQuickFilter] = useState('ALL');
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');
    const [date, setDate] = useState('');
    const [passengers, setPassengers] = useState(1);

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
        if (location.pathname !== '/search') return;

        setFrom(searchParams.get('departure') || '');
        setTo(searchParams.get('arrival') || '');
        setDate(searchParams.get('date') || '');
        setActiveQuickFilter(searchParams.get('trainCategory') || 'ALL');
    }, [location.pathname, searchParams]);

    const swapStations = () => {
        setFrom(to);
        setTo(from);
    };

    const handleSearch = () => {
        const params = new URLSearchParams();

        if (from) params.set('departure', from);
        if (to) params.set('arrival', to);
        if (date) params.set('date', date);
        if (activeQuickFilter && activeQuickFilter !== 'ALL') {
            params.set('trainCategory', activeQuickFilter);
        }

        navigate(`/search?${params.toString()}`);
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

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5 sm:gap-3 md:gap-4 items-end">
                    <div className="sm:col-span-2 lg:col-span-7 relative flex flex-col sm:flex-row items-end gap-5 sm:gap-3 md:gap-4">
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

                    <div className="sm:col-span-1 lg:col-span-2 space-y-1">
                        <label className={cn("text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 px-1 drop-shadow-sm", variant === 'dark' ? "text-white/90" : "text-gray-500")}>
                            <CalendarIcon size={11} className={variant === 'dark' ? "text-tet-yellow" : "text-tet-red"} /> {t('search.date_label')}
                        </label>
                        <div className="relative group">
                            <input
                                type="date"
                                className={cn(
                                    "w-full rounded-lg py-2 px-3 outline-none font-bold text-sm text-gray-900 transition-all cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0",
                                    variant === 'dark'
                                        ? "bg-white/90 backdrop-blur-sm border border-white/50 focus:border-white focus:ring-2 focus:ring-white/30 group-hover:border-white"
                                        : "bg-white border border-gray-200 focus:border-tet-red focus:ring-2 focus:ring-red-100 group-hover:border-gray-300 shadow-sm"
                                )}
                                value={date}
                                onChange={(event) => setDate(event.target.value)}
                            />
                            <CalendarIcon size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 group-hover:text-tet-red transition-colors pointer-events-none" />
                        </div>
                    </div>

                    <div className="sm:col-span-1 lg:col-span-1 space-y-1">
                        <label className={cn("text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 px-1 drop-shadow-sm", variant === 'dark' ? "text-white/90" : "text-gray-500")}>
                            <Users size={11} className={variant === 'dark' ? "text-tet-yellow" : "text-tet-red"} /> {t('search.passengers_label')}
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="4"
                            value={passengers}
                            onChange={(event) => setPassengers(Number(event.target.value) || 1)}
                            className={cn(
                                "w-full rounded-lg py-2 px-2 outline-none font-black text-sm text-center text-gray-900 transition-all",
                                variant === 'dark'
                                    ? "bg-white/90 backdrop-blur-sm border border-white/50 focus:border-white focus:ring-2 focus:ring-white/30 hover:border-white"
                                    : "bg-white border border-gray-200 focus:border-tet-red focus:ring-2 focus:ring-red-100 hover:border-gray-300 shadow-sm"
                            )}
                        />
                    </div>

                    <div className="sm:col-span-2 lg:col-span-2 mt-1 sm:mt-0">
                        <button
                            type="button"
                            onClick={handleSearch}
                            className="w-full h-10 lg:h-[38px] bg-tet-yellow hover:bg-[#FFB300] text-red-900 font-black rounded-lg flex items-center justify-center gap-2 shadow-lg shadow-tet-yellow/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] text-sm uppercase tracking-tight"
                        >
                            <Search size={16} className="stroke-[3]" /> {t('search.cta')}
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
