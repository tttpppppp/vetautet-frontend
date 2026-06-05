import * as React from 'react';
import TicketCard from './TicketCard.tsx';
import { CalendarDays, ChevronRight, Train } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { tripApi } from '../api/trip.api';
import { useQuery } from '@tanstack/react-query';

const TicketList: React.FC = () => {
    const { t } = useTranslation();
    const { data: trips = [], isLoading: loading } = useQuery({
        queryKey: ['homepage-popular-trips'],
        queryFn: () => tripApi.getPopularTrips(6),
        staleTime: 60_000,
    });

    return (
        <section className="py-24 bg-gray-50/50">
            <div className="max-w-7xl mx-auto px-6 md:px-12">
                <div className="mb-12">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="h-1 w-8 bg-tet-red rounded-full"></span>
                        <span className="text-tet-red font-black text-[10px] uppercase tracking-[0.2em]">{t('tickets.tag')}</span>
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                            <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-4 leading-tight">
                                {t('tickets.title_main')} <span className="text-tet-red">{t('tickets.title_highlight')}</span> {t('tickets.title_end')}
                            </h2>
                            <p className="text-gray-500 font-medium max-w-lg">
                                {t('tickets.subtitle')}
                            </p>
                        </div>
                        <Link
                            to="/schedules"
                            className="inline-flex items-center gap-1.5 self-start rounded-full px-1 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-gray-500 transition-colors hover:text-tet-red md:mt-4"
                        >
                            <CalendarDays size={15} />
                            <span>{t('tickets.view_all')}</span>
                            <ChevronRight size={14} />
                        </Link>
                    </div>
                </div>

                {loading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Train className="animate-spin text-tet-red mb-4" size={32} />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Đang tải danh sách chuyến đi...</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {trips.map((trip) => (
                            <TicketCard key={trip.id} ticket={trip} />
                        ))}
                    </div>
                )}

            </div>
        </section>
    );
};

export default TicketList;
