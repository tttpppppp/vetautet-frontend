import * as React from 'react';
import { useState, useEffect } from 'react';
import Header from '@/components/Header';
import SearchForm from '@/components/SearchForm';
import TicketCard from '@/components/TicketCard.tsx';
import Footer from '@/components/Footer';
import { LayoutGrid, ListFilter, ChevronRight, ChevronLeft, Train, Clock, CreditCard, Star, Filter, X, Check } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { tripApi } from '../api/trip.api';
import { Trip, TripSearchParams } from '../types/api.types';

const SearchResults: React.FC = () => {
    const { t } = useTranslation();
    const [searchParams] = useSearchParams();

    const departure = searchParams.get('departure') || '';
    const arrival = searchParams.get('arrival') || '';
    const date = searchParams.get('date') || '';
    const trainCategory = searchParams.get('trainCategory') || undefined;
    const minPriceParam = searchParams.get('minPrice');
    const maxPriceParam = searchParams.get('maxPrice');
    const minPrice = minPriceParam ? Number(minPriceParam) : undefined;
    const maxPrice = maxPriceParam ? Number(maxPriceParam) : undefined;

    const searchQuery: TripSearchParams = {
        departure,
        arrival,
        date,
        trainCategory,
        minPrice: Number.isFinite(minPrice) ? minPrice : undefined,
        maxPrice: Number.isFinite(maxPrice) ? maxPrice : undefined,
    };

    const { data: trips = [], isLoading: loading, error } = useQuery({
        queryKey: ['trips', searchQuery],
        queryFn: () => tripApi.searchTrips(searchQuery),
        enabled: !!(departure && arrival),
    });

    const [isFilterOpen, setIsFilterOpen] = useState(false);
    const [viewType, setViewType] = useState<'list' | 'grid'>('list');
    const [selectedTrains, setSelectedTrains] = useState<string[]>([]);
    const [currentPage, setCurrentPage] = useState(1);
    const ITEMS_PER_PAGE = 6;

    const totalPages = Math.ceil(trips.length / ITEMS_PER_PAGE);
    const paginatedTickets = trips.slice(
        (currentPage - 1) * ITEMS_PER_PAGE,
        currentPage * ITEMS_PER_PAGE
    );
    const startItem = (currentPage - 1) * ITEMS_PER_PAGE + 1;
    const endItem = Math.min(currentPage * ITEMS_PER_PAGE, trips.length);

    const goToPage = (page: number) => {
        if (page >= 1 && page <= totalPages) {
            setCurrentPage(page);
            window.scrollTo({ top: 400, behavior: 'smooth' });
        }
    };

    const getPageNumbers = () => {
        const pages: (number | string)[] = [];
        if (totalPages <= 5) {
            for (let i = 1; i <= totalPages; i++) pages.push(i);
        } else {
            pages.push(1);
            if (currentPage > 3) pages.push('...');
            for (let i = Math.max(2, currentPage - 1); i <= Math.min(totalPages - 1, currentPage + 1); i++) {
                pages.push(i);
            }
            if (currentPage < totalPages - 2) pages.push('...');
            pages.push(totalPages);
        }
        return pages;
    };

    const toggleTrain = (type: string) => {
        setSelectedTrains(prev =>
            prev.includes(type) ? prev.filter(t => t !== type) : [...prev, type]
        );
    };

    return (
        <main className="min-h-screen bg-white">
            <Helmet>
                <title>{t('search_results.seo_title', { from: departure, to: arrival })}</title>
                <meta name="description" content={t('search_results.seo_desc', { from: departure, to: arrival })} />
            </Helmet>
            <Header />

            <div className="pt-32 md:pt-40 pb-6 relative transition-all duration-300">
                <div className="max-w-7xl mx-auto px-4 md:px-12 relative z-10">
                    <motion.div
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                    >
                        <h1 className="text-xl md:text-3xl font-black text-gray-900 mb-2 tracking-tighter">{t('search_results.title')}</h1>
                        <div className="flex items-center gap-2">
                            <span className="px-2 py-0.5 bg-red-50 text-tet-red rounded-full text-[8px] md:text-[9px] font-black uppercase tracking-widest border border-red-100">{t('explore.schedules.table.train')}</span>
                            <p className="text-gray-500 font-bold text-[10px] md:text-xs">
                                {loading ? '...' : t('search_results.found', { count: trips.length })}
                            </p>
                        </div>
                    </motion.div>
                </div>
            </div>

            <div className="relative mb-6 md:mb-8 px-2 md:px-4">
                <SearchForm variant="light" />
            </div>

            <section className="pb-16 bg-white">
                <div className="max-w-7xl mx-auto px-4 md:px-12">
                    {error && (
                        <div className="bg-red-50 text-tet-red p-4 rounded-xl mb-8 font-bold text-center">
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
                        {/* Sidebar Filters */}
                        <aside className={cn(
                            "lg:col-span-1 space-y-6 lg:block",
                            isFilterOpen ? "fixed inset-0 z-50 bg-white p-6 overflow-y-auto" : "hidden"
                        )}>
                            {/* Filter content - keeping as is but maybe updating types if needed */}
                            {/* ... (Omitted for brevity, keep existing filter UI) ... */}
                        </aside>

                        {/* Main Content */}
                        <div className="lg:col-span-3">
                            {loading ? (
                                <div className="flex flex-col items-center justify-center py-20">
                                    <div className="w-12 h-12 border-4 border-tet-red border-t-transparent rounded-full animate-spin mb-4" />
                                    <p className="font-bold text-gray-400 uppercase tracking-widest text-xs">Đang tìm kiếm chuyến đi...</p>
                                </div>
                            ) : trips.length === 0 ? (
                                <div className="text-center py-20 bg-gray-50 rounded-3xl border border-dashed border-gray-200">
                                    <Train size={48} className="text-gray-300 mx-auto mb-4" />
                                    <h3 className="text-lg font-black text-gray-900 mb-2">Không tìm thấy chuyến đi</h3>
                                    <p className="text-gray-500 text-sm">Vui lòng thử lại với ngày hoặc ga khác.</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4 px-2">
                                        <div className="flex items-center gap-3">
                                            <div className="w-1.5 h-6 bg-tet-red rounded-full" />
                                            <p className="text-xs font-black text-gray-900 uppercase tracking-widest">
                                                {t('search_results.view.showing', { start: startItem, end: endItem, total: trips.length })}
                                            </p>
                                        </div>
                                        {/* View toggle UI */}
                                    </div>

                                    <div className={cn(
                                        "grid gap-6 transition-all duration-300",
                                        viewType === 'grid' ? "grid-cols-1 md:grid-cols-2 lg:grid-cols-3" : "grid-cols-1"
                                    )}>
                                        {paginatedTickets.map((trip) => (
                                            <TicketCard key={trip.id} ticket={trip} viewType={viewType} />
                                        ))}
                                    </div>

                                    {/* Pagination UI */}
                                </>
                            )}
                        </div>
                    </div>
                </div>
            </section>
            <Footer />
        </main>
    );
};

export default SearchResults;
