import React from 'react';
import { ChevronRight, Train } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
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
                <div className="max-w-2xl mb-12">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="h-1 w-8 bg-tet-red rounded-full"></span>
                        <span className="text-tet-red font-black text-[10px] uppercase tracking-[0.2em]">Sắp khởi hành</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-4 leading-tight">
                        Chuyến tàu <span className="text-tet-red">sắp chạy</span>
                    </h2>
                    <p className="text-gray-500 font-medium max-w-lg">
                        Danh sách các chuyến sắp khởi hành gần nhất để đặt nhanh.
                    </p>
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

                <div className="mt-16 text-center">
                    <button type="button" className="px-10 py-5 bg-white border border-gray-100 text-gray-900 font-black rounded-2xl shadow-sm hover:shadow-md transition-all inline-flex items-center gap-3 group">
                        Xem các chuyến sắp chạy
                        <ChevronRight className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </div>
            </div>
        </section>
    );
};

export default UpcomingDeparturesSection;
