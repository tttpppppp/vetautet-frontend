import React from 'react';
import { ArrowRight, Clock3, MapPin, Train } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { tripApi } from '../api/trip.api';

const formatPrice = (price) => (price ?? 0).toLocaleString('vi-VN') + 'd';

const formatDateTime = (value) => {
    if (!value) return '--';
    const date = new Date(value);
    return `${date.toLocaleDateString('vi-VN')} ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false })}`;
};

const PromotionSection = () => {
    const { data: routes = [], isLoading } = useQuery({
        queryKey: ['homepage-popular-routes'],
        queryFn: () => tripApi.getPopularRoutes(6),
        staleTime: 60_000,
    });

    return (
        <section className="py-24 bg-gray-50/50">
            <div className="max-w-7xl mx-auto px-6 md:px-12">
                <div className="max-w-2xl mb-12">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="h-1 w-8 bg-tet-red rounded-full"></span>
                        <span className="text-tet-red font-black text-[10px] uppercase tracking-[0.2em]">Tuyến nổi bật</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-4 leading-tight">
                        Tuyến tàu <span className="text-tet-red">được tìm nhiều</span>
                    </h2>
                    <p className="text-gray-500 font-medium max-w-lg">
                        Các hành trình có nhiều lựa chọn chuyến nhất, kèm chỗ trống và giờ khởi hành gần nhất.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {(isLoading ? Array.from({ length: 6 }) : routes).map((route, index) => (
                        <div key={isLoading ? index : `${route.departureStationId}-${route.arrivalStationId}`} className="bg-white rounded-3xl border border-gray-100 p-6 hover:shadow-2xl hover:shadow-red-500/10 transition-all duration-500">
                            {isLoading ? (
                                <div className="space-y-4 animate-pulse">
                                    <div className="h-12 bg-gray-100 rounded-2xl" />
                                    <div className="h-8 bg-gray-100 rounded-xl" />
                                    <div className="h-20 bg-gray-100 rounded-xl" />
                                </div>
                            ) : (
                                <div className="flex flex-col h-full">
                                    <div className="flex justify-between items-start mb-5">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 bg-red-50 text-tet-red rounded-2xl flex items-center justify-center shadow-inner">
                                                <Train size={22} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900">{route.departureStation}</h3>
                                                <p className="text-xs text-gray-500 font-medium">to {route.arrivalStation}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xl font-black text-tet-red">
                                                {formatPrice(route.minPrice)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="bg-gray-50 rounded-2xl p-4">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Trips</p>
                                            <p className="text-2xl font-black text-gray-900">{route.tripsCount}</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-2xl p-4">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Seats</p>
                                            <p className="text-2xl font-black text-gray-900">{route.availableSeats}</p>
                                        </div>
                                    </div>

                                    <div className="mt-auto border-t border-gray-100 pt-5 flex items-center justify-between gap-3">
                                        <div className="text-[11px] font-bold text-gray-700">
                                            <div className="inline-flex items-center gap-1.5">
                                                <Clock3 size={14} className="text-tet-red" />
                                                {formatDateTime(route.nextDepartureTime)}
                                            </div>
                                            <div className="mt-2 inline-flex items-center gap-1.5 text-gray-500 uppercase tracking-wider text-[10px]">
                                                <MapPin size={12} />
                                                {(route.trainCategories || []).join(', ') || 'Route'}
                                            </div>
                                        </div>
                                        <button type="button" className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-tet-red transition-all flex items-center gap-1 shadow-lg shadow-gray-200 shrink-0">
                                            Tìm vé <ArrowRight size={14} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default PromotionSection;
