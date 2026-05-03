import React, { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { cn } from '@/lib/utils';
import { AnimatePresence, motion } from 'framer-motion';
import {
    ArrowUpDown,
    BadgePercent,
    CalendarClock,
    CheckCircle2,
    ChevronRight,
    CircleDollarSign,
    Clock3,
    Copy,
    Filter,
    Gift,
    MapPin,
    Percent,
    RotateCcw,
    Search,
    SlidersHorizontal,
    Sparkles,
    Tag,
    TicketPercent,
    WalletCards,
    X,
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
    Promotion,
    PromotionCategory,
    PromotionDiscountType,
    PromotionFilterStatus,
    PromotionSearchParams,
    promotionApi,
} from '../api/promotion.api';
import { mockPromotions } from '../constants/mockPromotions';

type PromotionSort = 'newest' | 'expiring' | 'discount' | 'easy';
interface PromotionFilterValues {
    q: string;
    discount: string;
    type: PromotionDiscountType | '';
    category: PromotionCategory | '';
    status: PromotionFilterStatus | '';
    route: string;
    sort: PromotionSort;
}

const QUICK_FILTERS: { label: string; updates: Partial<PromotionFilterValues> }[] = [
    { label: 'Tất cả', updates: { category: '', status: '' } },
    { label: 'Vé Tết', updates: { category: 'tet', status: '' } },
    { label: 'Sinh viên', updates: { category: 'student', status: '' } },
    { label: 'Khứ hồi', updates: { category: 'roundTrip', status: '' } },
    { label: 'Thanh toán online', updates: { category: 'onlinePayment', status: '' } },
    { label: 'Gia đình / nhóm', updates: { category: 'group', status: '' } },
    { label: 'Sắp hết hạn', updates: { status: 'expiring', category: '' } },
];

const DISCOUNT_LEVELS = [
    { value: '5', label: '5%+' },
    { value: '10', label: '10%+' },
    { value: '15', label: '15%+' },
    { value: '20', label: '20%+' },
];

const DISCOUNT_TYPES: { value: PromotionDiscountType; label: string; icon: React.ElementType }[] = [
    { value: 'percent', label: 'Giảm %', icon: Percent },
    { value: 'amount', label: 'Giảm tiền', icon: CircleDollarSign },
    { value: 'serviceFee', label: 'Miễn phí dịch vụ', icon: WalletCards },
];

const CATEGORY_FILTERS: { value: PromotionCategory; label: string }[] = [
    { value: 'tet', label: 'Vé Tết' },
    { value: 'student', label: 'Sinh viên' },
    { value: 'roundTrip', label: 'Khứ hồi' },
    { value: 'onlinePayment', label: 'Thanh toán online' },
    { value: 'group', label: 'Gia đình / nhóm' },
];

const STATUS_FILTERS: { value: PromotionFilterStatus; label: string }[] = [
    { value: 'active', label: 'Còn hiệu lực' },
    { value: 'expiring', label: 'Sắp hết hạn' },
];

const SORT_OPTIONS: { value: PromotionSort; label: string }[] = [
    { value: 'newest', label: 'Mới nhất' },
    { value: 'expiring', label: 'Sắp hết hạn' },
    { value: 'discount', label: 'Giảm nhiều nhất' },
    { value: 'easy', label: 'Dễ dùng nhất' },
];

const today = new Date();
today.setHours(0, 0, 0, 0);

const getDaysLeft = (dateValue: string) => {
    const end = new Date(dateValue);
    end.setHours(23, 59, 59, 999);
    return Math.ceil((end.getTime() - today.getTime()) / 86400000);
};

const isActivePromotion = (promotion: Promotion) => {
    if (typeof promotion.active === 'boolean') return promotion.active;

    const startsAt = new Date(promotion.startsAt);
    const endsAt = new Date(promotion.endsAt);
    startsAt.setHours(0, 0, 0, 0);
    endsAt.setHours(23, 59, 59, 999);
    return startsAt <= today && endsAt >= today;
};

const isExpiringSoon = (promotion: Promotion) => {
    if (typeof promotion.expiringSoon === 'boolean') return promotion.expiringSoon;

    const daysLeft = getDaysLeft(promotion.endsAt);
    return daysLeft >= 0 && daysLeft <= 7;
};

const formatDateRange = (start: string, end: string) => {
    const formatter = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' });
    return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`;
};

const getCategoryLabel = (value: string) => CATEGORY_FILTERS.find((item) => item.value === value)?.label || value;
const getDiscountTypeLabel = (value: string) => DISCOUNT_TYPES.find((item) => item.value === value)?.label || value;
const getStatusLabel = (value: string) => STATUS_FILTERS.find((item) => item.value === value)?.label || value;

const isQuickFilterActive = (filter: (typeof QUICK_FILTERS)[number], values: PromotionFilterValues) => {
    const nextCategory = filter.updates.category ?? values.category;
    const nextStatus = filter.updates.status ?? values.status;
    return values.category === nextCategory && values.status === nextStatus;
};

const PromotionSkeleton = () => (
    <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="animate-pulse rounded-2xl border border-gray-100 bg-white p-5">
                <div className="mb-5 flex items-start justify-between">
                    <div className="h-12 w-12 rounded-2xl bg-gray-100" />
                    <div className="h-7 w-24 rounded-full bg-gray-100" />
                </div>
                <div className="space-y-3">
                    <div className="h-5 w-4/5 rounded bg-gray-100" />
                    <div className="h-3 w-full rounded bg-gray-100" />
                    <div className="h-3 w-2/3 rounded bg-gray-100" />
                </div>
                <div className="mt-6 h-24 rounded-2xl bg-gray-100" />
                <div className="mt-5 grid grid-cols-2 gap-3">
                    <div className="h-11 rounded-xl bg-gray-100" />
                    <div className="h-11 rounded-xl bg-gray-100" />
                </div>
            </div>
        ))}
    </div>
);

interface PillGroupProps<T extends string> {
    title: string;
    options: { value: T; label: string; icon?: React.ElementType }[];
    value: T | '';
    onChange: (value: T | '') => void;
}

const PillGroup = <T extends string>({ title, options, value, onChange }: PillGroupProps<T>) => (
    <div>
        <p className="mb-3 text-[10px] font-black uppercase tracking-widest text-gray-400">{title}</p>
        <div className="flex flex-wrap gap-2">
            {options.map((option) => {
                const active = value === option.value;
                const Icon = option.icon;
                return (
                    <button
                        key={option.value}
                        type="button"
                        onClick={() => onChange(active ? '' : option.value)}
                        className={cn(
                            'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-sm font-black transition',
                            active
                                ? 'border-tet-red bg-red-50 text-tet-red'
                                : 'border-gray-200 bg-white text-gray-600 hover:border-red-100 hover:bg-red-50 hover:text-tet-red'
                        )}
                    >
                        {Icon && <Icon size={15} />}
                        {option.label}
                        {active && <CheckCircle2 size={15} />}
                    </button>
                );
            })}
        </div>
    </div>
);

interface AdvancedFiltersProps {
    values: PromotionFilterValues;
    routes: string[];
    updateParams: (updates: Partial<PromotionFilterValues>) => void;
}

const AdvancedFilters: React.FC<AdvancedFiltersProps> = ({ values, routes, updateParams }) => (
    <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
        <PillGroup
            title="Mức giảm"
            options={DISCOUNT_LEVELS}
            value={values.discount}
            onChange={(value) => updateParams({ discount: value })}
        />
        <PillGroup
            title="Loại ưu đãi"
            options={DISCOUNT_TYPES}
            value={values.type}
            onChange={(value) => updateParams({ type: value as PromotionDiscountType | '' })}
        />
        <PillGroup
            title="Danh mục"
            options={CATEGORY_FILTERS}
            value={values.category}
            onChange={(value) => updateParams({ category: value as PromotionCategory | '' })}
        />
        <PillGroup
            title="Trạng thái"
            options={STATUS_FILTERS}
            value={values.status}
            onChange={(value) => updateParams({ status: value as PromotionFilterStatus | '' })}
        />
        <label className="space-y-3 lg:col-span-2 xl:col-span-1">
            <span className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400">
                <MapPin size={13} className="text-tet-red" />
                Tuyến áp dụng
            </span>
            <select
                value={values.route}
                onChange={(event) => updateParams({ route: event.target.value })}
                className="h-11 w-full rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold text-gray-900 outline-none transition focus:border-tet-red focus:ring-4 focus:ring-red-100"
            >
                <option value="">Tất cả tuyến</option>
                {routes.map((route) => (
                    <option key={route} value={route}>
                        {route}
                    </option>
                ))}
            </select>
        </label>
    </div>
);

interface PromotionFilterBarProps {
    values: PromotionFilterValues;
    routes: string[];
    activeCount: number;
    updateParams: (updates: Partial<PromotionFilterValues>) => void;
    clearFilters: () => void;
    onOpenMobileFilters?: () => void;
}

const PromotionFilterBar: React.FC<PromotionFilterBarProps> = ({ values, routes, activeCount, updateParams, clearFilters, onOpenMobileFilters }) => {
    const [advancedOpen, setAdvancedOpen] = useState(false);

    return (
        <div className="space-y-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(260px,1fr)_auto_auto] lg:items-center">
                <label className="relative block">
                    <Search size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                        value={values.q}
                        onChange={(event) => updateParams({ q: event.target.value })}
                        placeholder="Tìm theo tên khuyến mãi, mã giảm giá, mô tả"
                        className="h-12 w-full rounded-2xl border border-gray-200 bg-white pl-11 pr-10 text-sm font-bold text-gray-900 outline-none transition placeholder:text-gray-400 focus:border-tet-red focus:ring-4 focus:ring-red-100"
                    />
                    {values.q && (
                        <button
                            type="button"
                            onClick={() => updateParams({ q: '' })}
                            className="absolute right-3 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full bg-gray-100 text-gray-400 hover:text-tet-red"
                            aria-label="Xóa tìm kiếm"
                        >
                            <X size={14} />
                        </button>
                    )}
                </label>

                <label className="hidden items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500 lg:flex">
                    <ArrowUpDown size={14} className="text-tet-red" />
                    Sắp xếp
                    <select
                        value={values.sort}
                        onChange={(event) => updateParams({ sort: event.target.value as PromotionSort })}
                        className="h-11 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-gray-900 outline-none focus:border-tet-red focus:ring-4 focus:ring-red-100"
                    >
                        {SORT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>

                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={() => setAdvancedOpen((open) => !open)}
                        className="hidden h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-black uppercase tracking-widest text-gray-600 transition hover:border-tet-red hover:text-tet-red lg:inline-flex"
                    >
                        <SlidersHorizontal size={15} />
                        Thêm bộ lọc
                        {activeCount > 0 && <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] text-tet-red">{activeCount}</span>}
                    </button>
                    <button
                        type="button"
                        onClick={onOpenMobileFilters}
                        className="inline-flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-xs font-black uppercase tracking-widest text-white lg:hidden"
                    >
                        <Filter size={15} />
                        Bộ lọc
                        {activeCount > 0 && <span className="rounded-full bg-tet-yellow px-2 py-0.5 text-[10px] text-red-900">{activeCount}</span>}
                    </button>
                    {activeCount > 0 && (
                        <button
                            type="button"
                            onClick={clearFilters}
                            className="hidden h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 text-xs font-black uppercase tracking-widest text-gray-500 transition hover:border-tet-red hover:text-tet-red sm:inline-flex"
                        >
                            <RotateCcw size={14} />
                            Xóa tất cả
                        </button>
                    )}
                </div>
            </div>

            <div className="flex gap-2 overflow-x-auto pb-1 lg:flex-wrap lg:overflow-visible">
                {QUICK_FILTERS.map((filter) => {
                    const active = isQuickFilterActive(filter, values);
                    return (
                        <button
                            key={filter.label}
                            type="button"
                            onClick={() => updateParams(filter.updates)}
                            className={cn(
                                'inline-flex h-10 shrink-0 items-center gap-2 rounded-full border px-4 text-sm font-black transition',
                                active
                                    ? 'border-tet-red bg-tet-red text-white shadow-lg shadow-red-500/20'
                                    : 'border-gray-200 bg-white text-gray-600 hover:border-red-100 hover:bg-red-50 hover:text-tet-red'
                            )}
                        >
                            {active && <CheckCircle2 size={15} />}
                            {filter.label}
                        </button>
                    );
                })}
            </div>

            <div className="lg:hidden">
                <label className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-gray-500">
                    <ArrowUpDown size={14} className="text-tet-red" />
                    Sắp xếp
                    <select
                        value={values.sort}
                        onChange={(event) => updateParams({ sort: event.target.value as PromotionSort })}
                        className="h-10 flex-1 rounded-xl border border-gray-200 bg-white px-3 text-sm font-bold normal-case tracking-normal text-gray-900 outline-none focus:border-tet-red focus:ring-4 focus:ring-red-100"
                    >
                        {SORT_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                                {option.label}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            <AnimatePresence initial={false}>
                {advancedOpen && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="hidden overflow-hidden lg:block"
                    >
                        <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-5">
                            <AdvancedFilters values={values} routes={routes} updateParams={updateParams} />
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};

interface PromotionCardProps {
    promotion: Promotion;
    copied: boolean;
    onCopy: (code: string) => void;
    onUse: (promotion: Promotion) => void;
}

const PromotionCard: React.FC<PromotionCardProps> = ({ promotion, copied, onCopy, onUse }) => {
    const daysLeft = getDaysLeft(promotion.endsAt);
    const expiring = isExpiringSoon(promotion);
    const active = isActivePromotion(promotion);

    return (
        <article className="group flex h-full flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-red-100 hover:shadow-xl hover:shadow-red-500/10">
            <div className="border-b border-gray-100 bg-gradient-to-br from-red-50 via-white to-yellow-50 p-5">
                <div className="mb-5 flex items-start justify-between gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white text-tet-red shadow-sm ring-1 ring-red-100 transition group-hover:bg-tet-red group-hover:text-white">
                        <TicketPercent size={24} />
                    </div>
                    <div className="flex flex-wrap justify-end gap-2">
                        <span className="rounded-full border border-yellow-100 bg-yellow-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-yellow-700">
                            {promotion.discountLabel}
                        </span>
                        {expiring && (
                            <span className="rounded-full border border-red-100 bg-red-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-tet-red">
                                Sắp hết hạn
                            </span>
                        )}
                        {active && (
                            <span className="rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-emerald-700">
                                Còn hiệu lực
                            </span>
                        )}
                    </div>
                </div>

                <div className="rounded-2xl border-2 border-dashed border-red-200 bg-white p-4 shadow-sm">
                    <p className="mb-2 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-tet-red">
                        <Tag size={13} />
                        Coupon code
                    </p>
                    <div className="flex items-center justify-between gap-3">
                        <span className="min-w-0 break-all font-mono text-2xl font-black tracking-[0.18em] text-gray-900">{promotion.code}</span>
                        <span className="shrink-0 rounded-full bg-tet-yellow px-3 py-1 text-xs font-black text-red-900">{promotion.discountLabel}</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-1 flex-col p-5">
                <div className="flex-1">
                    <h2 className="text-xl font-black leading-tight text-gray-900">{promotion.title}</h2>
                    <p className="mt-2 text-sm font-medium leading-6 text-gray-500">{promotion.description}</p>

                    <div className="mt-5 space-y-3 text-sm font-bold text-gray-600">
                        <p className="flex gap-2">
                            <CalendarClock size={16} className="mt-0.5 shrink-0 text-tet-red" />
                            <span>{formatDateRange(promotion.startsAt, promotion.endsAt)}</span>
                        </p>
                        <p className="flex gap-2">
                            <WalletCards size={16} className="mt-0.5 shrink-0 text-tet-red" />
                            <span>{promotion.conditions}</span>
                        </p>
                        {promotion.route && (
                            <p className="flex gap-2">
                                <MapPin size={16} className="mt-0.5 shrink-0 text-tet-red" />
                                <span>{promotion.route}</span>
                            </p>
                        )}
                        {daysLeft >= 0 && (
                            <p className="flex gap-2 text-tet-red">
                                <Clock3 size={16} className="mt-0.5 shrink-0" />
                                <span>Còn {daysLeft} ngày</span>
                            </p>
                        )}
                    </div>
                </div>

                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <button
                        type="button"
                        onClick={() => onCopy(promotion.code)}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 text-xs font-black uppercase tracking-widest text-gray-700 transition hover:border-tet-red hover:text-tet-red"
                    >
                        <Copy size={15} />
                        {copied ? 'Đã sao chép' : 'Sao chép mã'}
                    </button>
                    <button
                        type="button"
                        onClick={() => onUse(promotion)}
                        className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-gray-900 px-4 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-gray-200 transition hover:bg-tet-red"
                    >
                        Dùng ngay
                        <ChevronRight size={16} />
                    </button>
                </div>
            </div>
        </article>
    );
};

const Promotions: React.FC = () => {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [sheetOpen, setSheetOpen] = useState(false);
    const [isFiltering, setIsFiltering] = useState(false);
    const [copiedCode, setCopiedCode] = useState('');
    const queryString = searchParams.toString();

    const values: PromotionFilterValues = {
        q: searchParams.get('q') || '',
        discount: searchParams.get('discount') || '',
        type: (searchParams.get('type') as PromotionDiscountType) || '',
        category: (searchParams.get('category') as PromotionCategory) || '',
        status: (searchParams.get('status') as PromotionFilterStatus) || '',
        route: searchParams.get('route') || '',
        sort: (searchParams.get('sort') as PromotionSort) || 'newest',
    };

    const promotionQueryParams = useMemo<PromotionSearchParams>(() => ({
        q: values.q || undefined,
        discount: values.discount ? Number(values.discount) : undefined,
        type: values.type || undefined,
        category: values.category || undefined,
        status: values.status || undefined,
        route: values.route || undefined,
        sort: values.sort,
    }), [values.q, values.discount, values.type, values.category, values.status, values.route, values.sort]);

    const {
        data: promotions = [],
        isLoading,
        isFetching,
        error,
    } = useQuery({
        queryKey: ['promotions', promotionQueryParams],
        queryFn: () => promotionApi.getPromotions(promotionQueryParams),
        staleTime: 60_000,
    });

    const routeOptions = useMemo(() => {
        const source = promotions.length ? promotions : mockPromotions;
        return Array.from(new Set(source.map((promotion) => promotion.route).filter(Boolean) as string[])).sort((a, b) => a.localeCompare(b, 'vi'));
    }, [promotions]);

    const statsPromotions = (promotions.length ? promotions : mockPromotions) as Promotion[];
    const expiringCount = statsPromotions.filter(isExpiringSoon).length;
    const maxPercentDiscount = statsPromotions.reduce((max, promotion) => (
        promotion.discountType === 'percent' ? Math.max(max, Number(promotion.discountValue) || 0) : max
    ), 0);

    const updateParams = (updates: Partial<PromotionFilterValues>) => {
        const next = new URLSearchParams(searchParams);

        Object.entries(updates).forEach(([key, rawValue]) => {
            const value = rawValue === undefined || rawValue === null ? '' : String(rawValue).trim();
            const shouldDelete = !value || (key === 'sort' && value === 'newest');

            if (shouldDelete) next.delete(key);
            else next.set(key, value);
        });

        setSearchParams(next);
    };

    const clearFilters = () => setSearchParams(new URLSearchParams());

    useEffect(() => {
        setIsFiltering(true);
        const timer = window.setTimeout(() => setIsFiltering(false), 240);
        return () => window.clearTimeout(timer);
    }, [queryString]);

    useEffect(() => {
        if (!copiedCode) return;
        const timer = window.setTimeout(() => setCopiedCode(''), 1400);
        return () => window.clearTimeout(timer);
    }, [copiedCode]);

    const isBusy = isLoading || isFetching || isFiltering;

    const activeChips = useMemo(() => {
        const chips: { key: string; label: string; remove: () => void }[] = [];
        if (values.q) chips.push({ key: 'q', label: `Tìm: ${values.q}`, remove: () => updateParams({ q: '' }) });
        if (values.discount) chips.push({ key: 'discount', label: `Mức giảm ${values.discount}%+`, remove: () => updateParams({ discount: '' }) });
        if (values.type) chips.push({ key: 'type', label: getDiscountTypeLabel(values.type), remove: () => updateParams({ type: '' }) });
        if (values.category) chips.push({ key: 'category', label: getCategoryLabel(values.category), remove: () => updateParams({ category: '' }) });
        if (values.status) chips.push({ key: 'status', label: getStatusLabel(values.status), remove: () => updateParams({ status: '' }) });
        if (values.route) chips.push({ key: 'route', label: values.route, remove: () => updateParams({ route: '' }) });
        if (values.sort !== 'newest') {
            chips.push({
                key: 'sort',
                label: SORT_OPTIONS.find((option) => option.value === values.sort)?.label || values.sort,
                remove: () => updateParams({ sort: 'newest' }),
            });
        }
        return chips;
    }, [queryString, values]);

    const handleCopy = async (code: string) => {
        setCopiedCode(code);
        try {
            await navigator.clipboard?.writeText(code);
        } catch {
            // The visible coupon code remains available when clipboard access is blocked.
        }
    };

    const handleUsePromotion = (promotion: Promotion) => {
        const params = new URLSearchParams({ promoCode: promotion.code });
        if (promotion.route) {
            const [departure, arrival] = promotion.route.split(/\s*(?:->|→)\s*/).map((part) => part.trim());
            if (departure) params.set('departure', departure);
            if (arrival) params.set('arrival', arrival);
        }
        if (promotion.categories.includes('roundTrip')) params.set('ticketType', 'round-trip');
        navigate(`/schedules?${params.toString()}`);
    };

    return (
        <main className="min-h-screen bg-[#fcfcfc]">
            <Helmet>
                <title>Khuyến mãi vé tàu - Vé Tàu Việt Nam</title>
                <meta name="description" content="Tổng hợp mã giảm giá vé tàu, ưu đãi vé Tết, sinh viên, khứ hồi và thanh toán online." />
            </Helmet>
            <Header />

            <section className="bg-white pt-28 md:pt-40">
                <div className="mx-auto max-w-7xl px-4 pb-7 md:px-12">
                    <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                        <div className="max-w-3xl">
                            <div className="mb-3 flex items-center gap-2">
                                <span className="inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.2em] text-tet-red">
                                    <Gift size={13} />
                                    Khuyến mãi
                                </span>
                                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                                    {promotions.length} ưu đãi phù hợp
                                </span>
                            </div>
                            <h1 className="text-3xl font-black tracking-tight text-gray-900 md:text-5xl">Ưu đãi vé tàu đang áp dụng</h1>
                            <p className="mt-3 max-w-2xl text-sm font-medium leading-6 text-gray-500">
                                Tìm và áp dụng mã giảm giá cho vé Tết, sinh viên, khứ hồi, nhóm gia đình hoặc thanh toán online.
                            </p>
                        </div>

                        <div className="grid grid-cols-3 gap-2 rounded-2xl border border-gray-100 bg-gray-50 p-2 lg:w-[380px]">
                            <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                                <p className="text-xl font-black text-tet-red">{statsPromotions.length}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Mã</p>
                            </div>
                            <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                                <p className="text-xl font-black text-tet-red">{expiringCount}</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Sắp hết hạn</p>
                            </div>
                            <div className="rounded-xl bg-white p-3 text-center shadow-sm">
                                <p className="text-xl font-black text-tet-red">{maxPercentDiscount}%</p>
                                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Cao nhất</p>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="sticky top-[72px] z-30 border-y border-gray-100 bg-white/95 backdrop-blur-xl">
                    <div className="mx-auto max-w-7xl px-4 py-4 md:px-12">
                        <PromotionFilterBar
                            values={values}
                            routes={routeOptions}
                            activeCount={activeChips.length}
                            updateParams={updateParams}
                            clearFilters={clearFilters}
                            onOpenMobileFilters={() => setSheetOpen(true)}
                        />
                    </div>
                </div>
            </section>

            <section className="py-8 md:py-10">
                <div className="mx-auto max-w-7xl px-4 md:px-12">
                    <div className="mb-5 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                            <div>
                                <p className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-gray-400">
                                    <BadgePercent size={13} className="text-tet-red" />
                                    Danh sách ưu đãi
                                </p>
                                <p className="mt-1 text-sm font-bold text-gray-700">
                                    {isBusy ? 'Đang cập nhật...' : `${promotions.length} khuyến mãi được tìm thấy`}
                                </p>
                            </div>
                            {activeChips.length > 0 && (
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

                    {error && !isBusy && (
                        <div className="mb-5 rounded-2xl border border-red-100 bg-red-50 p-5 text-sm font-bold text-tet-red">
                            Không tải được danh sách khuyến mãi từ API. Vui lòng kiểm tra backend hoặc thử lại sau.
                        </div>
                    )}

                    {isBusy ? (
                        <PromotionSkeleton />
                    ) : promotions.length === 0 ? (
                        <div className="rounded-2xl border border-dashed border-gray-200 bg-white px-6 py-16 text-center">
                            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-gray-50 text-gray-300">
                                <Sparkles size={30} />
                            </div>
                            <h2 className="text-xl font-black text-gray-900">Không tìm thấy khuyến mãi</h2>
                            <p className="mx-auto mt-2 max-w-md text-sm font-medium text-gray-500">
                                Thử đổi từ khóa, tuyến áp dụng hoặc nới rộng điều kiện ưu đãi.
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
                        <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                            {promotions.map((promotion) => (
                                <PromotionCard
                                    key={promotion.id}
                                    promotion={promotion}
                                    copied={copiedCode === promotion.code}
                                    onCopy={handleCopy}
                                    onUse={handleUsePromotion}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </section>

            <AnimatePresence>
                {sheetOpen && (
                    <motion.div className="fixed inset-0 z-[140] lg:hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                        <button
                            type="button"
                            aria-label="Đóng bộ lọc"
                            className="absolute inset-0 bg-black/40"
                            onClick={() => setSheetOpen(false)}
                        />
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: 'spring', damping: 28, stiffness: 260 }}
                            className="absolute bottom-0 left-0 right-0 max-h-[88vh] overflow-y-auto rounded-t-3xl bg-white p-5 shadow-2xl"
                        >
                            <div className="mb-5 flex items-center justify-between">
                                <div>
                                    <p className="text-xs font-black uppercase tracking-[0.2em] text-tet-red">Bộ lọc nâng cao</p>
                                    <h2 className="text-lg font-black text-gray-900">Thêm bộ lọc</h2>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSheetOpen(false)}
                                    className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-100 text-gray-500"
                                >
                                    <X size={18} />
                                </button>
                            </div>

                            <div className="space-y-5">
                                <AdvancedFilters values={values} routes={routeOptions} updateParams={updateParams} />
                                <div className="grid grid-cols-2 gap-3 border-t border-gray-100 pt-4">
                                    <button
                                        type="button"
                                        onClick={clearFilters}
                                        className="h-11 rounded-xl border border-gray-200 bg-white text-xs font-black uppercase tracking-widest text-gray-500"
                                    >
                                        Xóa tất cả
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setSheetOpen(false)}
                                        className="h-11 rounded-xl bg-gray-900 text-xs font-black uppercase tracking-widest text-white"
                                    >
                                        Xem kết quả
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            <Footer />
        </main>
    );
};

export default Promotions;
