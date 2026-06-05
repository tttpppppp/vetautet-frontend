import React from 'react';
import { CalendarClock, ChevronRight, Train } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { tripApi } from '../api/trip.api';
import TicketCard from './TicketCard.tsx';

const UpcomingDeparturesSection = () => {
    const { data: trips = [], isLoading } = useQuery({
        queryKey: ['homepage-upcoming-trips'],
        queryFn: () => tripApi.getUpcomingTrips(6),
        staleTime: 60_000,
    });

    return (
        <section className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-6 md:px-12">
                <div className="mb-12">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="h-1 w-8 bg-tet-red rounded-full"></span>
                        <span className="text-tet-red font-black text-[10px] uppercase tracking-[0.2em]">Sắp khởi hành</span>
                    </div>
                    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                        <div>
                            <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-4 leading-tight">
                                Chuyến tàu <span className="text-tet-red">sắp chạy</span>
                            </h2>
                            <p className="text-gray-500 font-medium max-w-lg">
                                Danh sách các chuyến sắp khởi hành gần nhất để đặt nhanh.
                            </p>
                        </div>
                        <Link
                            to="/schedules?upcoming=true&sort=earliest"
                            className="inline-flex items-center gap-1.5 self-start rounded-full px-1 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-gray-500 transition-colors hover:text-tet-red md:mt-4"
                        >
                            <CalendarClock size={15} />
                            <span>Xem chuyến sắp chạy</span>
                            <ChevronRight size={14} />
                        </Link>
                    </div>
                </div>

                {isLoading ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <Train className="animate-spin text-tet-red mb-4" size={32} />
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Đang tải chuyến sắp khởi hành...</p>
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

export default UpcomingDeparturesSection;
