import React from 'react';
import { ArrowRight, Clock3, MapPin, Train } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { stationApi } from '../api/station.api';

const formatPrice = (price) => (price ?? 0).toLocaleString('vi-VN') + 'd';

const formatTime = (value) => {
    if (!value) return '--';
    return new Date(value).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
};

const DestinationsSection = () => {
    const { data: destinations = [], isLoading } = useQuery({
        queryKey: ['homepage-popular-destinations'],
        queryFn: () => stationApi.getPopularStations(6),
        staleTime: 60_000,
    });

    return (
        <section className="py-24 bg-white">
            <div className="max-w-7xl mx-auto px-6 md:px-12">
                <div className="max-w-2xl mb-12">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="h-1 w-8 bg-tet-red rounded-full"></span>
                        <span className="text-tet-red font-black text-[10px] uppercase tracking-[0.2em]">Khám phá ngay</span>
                    </div>
                    <h2 className="text-3xl md:text-5xl font-black text-gray-900 mb-4 leading-tight">
                        Điểm đến <span className="text-tet-red">phổ biến</span>
                    </h2>
                    <p className="text-gray-500 font-medium max-w-lg">
                        Các ga đến đang có nhiều chuyến và nhiều chỗ trống nhất lúc này.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {(isLoading ? Array.from({ length: 6 }) : destinations).map((destination, index) => (
                        <div key={isLoading ? index : destination.stationId} className="bg-white rounded-3xl border border-gray-100 p-6 hover:shadow-2xl hover:shadow-red-500/10 transition-all duration-500 overflow-hidden">
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
                                                <MapPin size={22} />
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-gray-900">{destination.stationName}</h3>
                                                <p className="text-xs text-gray-500 font-medium">{destination.location || destination.stationCode}</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xl font-black text-tet-red">
                                                {formatPrice(destination.minPrice)}
                                            </span>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-4 mb-6">
                                        <div className="bg-gray-50 rounded-2xl p-4">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Trips</p>
                                            <p className="text-2xl font-black text-gray-900">{destination.tripsCount}</p>
                                        </div>
                                        <div className="bg-gray-50 rounded-2xl p-4">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Seats</p>
                                            <p className="text-2xl font-black text-gray-900">{destination.availableSeats}</p>
                                        </div>
                                    </div>

                                    <div className="mt-auto border-t border-gray-100 pt-5 flex items-center justify-between">
                                        <div className="flex items-center gap-2 text-[11px] font-bold text-gray-700">
                                            <Clock3 size={14} className="text-tet-red" />
                                            {formatTime(destination.nextDepartureTime)}
                                        </div>
                                        <button type="button" className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-tet-red transition-all flex items-center gap-1 shadow-lg shadow-gray-200">
                                            Xem ga <ArrowRight size={14} />
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

export default DestinationsSection;
