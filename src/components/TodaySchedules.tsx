import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { ArrowRight, ChevronRight, Train } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { tripApi } from '../api/trip.api';
import { Trip } from '../types/api.types';

const formatTime = (value?: string) => {
    if (!value) return '--:--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
};

const getScheduleType = (trip: Trip) => {
    if (trip.trainCategory === 'HIGH_QUALITY') return 'EXPRESS';
    if (trip.trainCategory === 'SUBURBAN') return 'ECONOMY';
    if (trip.trainCategory === 'SE_TN') return 'SE/TN';
    return 'NORMAL';
};

const getStatusLabel = (status?: string) => {
    const normalized = (status || '').toUpperCase();
    if (!normalized || normalized === 'SCHEDULED' || normalized === 'ACTIVE' || normalized === 'ON_TIME') return 'ON TIME';
    return normalized.replace(/_/g, ' ');
};

const isOnTime = (status?: string) => {
    const normalized = (status || '').toUpperCase();
    return !normalized || normalized === 'SCHEDULED' || normalized === 'ACTIVE' || normalized === 'ON_TIME';
};

const TodaySchedules: React.FC = () => {
    const navigate = useNavigate();
    const { data: trips = [], isLoading } = useQuery({
        queryKey: ['today-schedules'],
        queryFn: () => tripApi.getSchedules({ limit: 6 }),
        staleTime: 30_000,
    });

    return (
        <section className="bg-gray-50/50 py-24">
            <div className="mx-auto max-w-7xl px-6 md:px-12">
                <div className="mb-12 flex flex-col justify-between gap-6 md:flex-row md:items-end">
                    <div className="max-w-2xl">
                        <div className="mb-3 flex items-center gap-2">
                            <span className="h-1 w-8 rounded-full bg-tet-red" />
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-tet-red">Today</span>
                        </div>
                        <h2 className="mb-4 text-3xl font-black leading-tight text-gray-900 md:text-5xl">
                            Train <span className="text-tet-red">Today</span> Tickets
                        </h2>
                        <p className="max-w-lg font-medium text-gray-500">
                            The train trips scheduled for today.
                        </p>
                    </div>
                </div>

                <div className="overflow-hidden rounded-3xl border border-gray-100 bg-white shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="w-full min-w-[920px]">
                            <thead>
                                <tr className="border-b border-gray-100 text-[10px] font-black uppercase tracking-[0.2em] text-gray-300">
                                    <th className="px-8 py-5 text-left">Train</th>
                                    <th className="px-8 py-5 text-left">Route</th>
                                    <th className="px-8 py-5 text-left">Departure</th>
                                    <th className="px-8 py-5 text-left">Arrival</th>
                                    <th className="px-8 py-5 text-left">Status</th>
                                    <th className="px-8 py-5 text-right">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {isLoading ? (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-14 text-center">
                                            <div className="inline-flex items-center gap-3 text-xs font-black uppercase tracking-widest text-gray-400">
                                                <Train className="animate-spin text-tet-red" size={18} />
                                                Loading today trips...
                                            </div>
                                        </td>
                                    </tr>
                                ) : trips.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-8 py-14 text-center text-xs font-black uppercase tracking-widest text-gray-400">
                                            No trips scheduled today
                                        </td>
                                    </tr>
                                ) : (
                                    trips.map((trip) => {
                                        const onTime = isOnTime(trip.status);

                                        return (
                                            <tr key={trip.id} className="group transition-all hover:bg-gray-50/60">
                                                <td className="px-8 py-7">
                                                    <div className="flex items-center gap-4">
                                                        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50 font-black text-tet-red transition group-hover:bg-white group-hover:shadow-md">
                                                            {trip.trainCode || <Train size={20} />}
                                                        </div>
                                                        <div>
                                                            <p className="font-black text-gray-900">{trip.trainCode || 'Train'} Express</p>
                                                            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{getScheduleType(trip)}</p>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-7">
                                                    <div className="flex items-center gap-3 whitespace-nowrap">
                                                        <span className="font-bold text-gray-900">{trip.departureStation}</span>
                                                        <ArrowRight size={14} className="text-gray-300" />
                                                        <span className="font-bold text-gray-900">{trip.arrivalStation}</span>
                                                    </div>
                                                </td>
                                                <td className="px-8 py-7 font-black text-gray-900">{formatTime(trip.departureTime)}</td>
                                                <td className="px-8 py-7 font-black text-gray-900">{formatTime(trip.arrivalTime)}</td>
                                                <td className="px-8 py-7">
                                                    <span
                                                        className={cn(
                                                            'rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest',
                                                            onTime ? 'bg-green-50 text-green-500' : 'bg-red-50 text-tet-red'
                                                        )}
                                                    >
                                                        . {getStatusLabel(trip.status)}
                                                    </span>
                                                </td>
                                                <td className="px-8 py-7 text-right">
                                                    <button
                                                        type="button"
                                                        onClick={() => navigate(`/ticket/${trip.id}`)}
                                                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gray-50 text-gray-400 shadow-sm transition-all hover:bg-tet-red hover:text-white"
                                                        aria-label={`Open ${trip.trainCode}`}
                                                    >
                                                        <ChevronRight size={20} />
                                                    </button>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default TodaySchedules;
