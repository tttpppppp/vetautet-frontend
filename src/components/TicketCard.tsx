import React from 'react';
import { Train, Clock, Armchair, BadgePercent, ChevronRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Trip } from '../types/api.types';

interface TicketCardProps {
    ticket: Trip;
    viewType?: 'list' | 'grid';
}

const TicketCard: React.FC<TicketCardProps> = ({ ticket, viewType = 'grid' }) => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();

    const formatPrice = (price?: number) => {
        if (price === undefined || price === null) return '0';
        return price.toLocaleString(i18n.language === 'en' ? 'en-US' : 'vi-VN');
    };

    const formatDuration = (duration?: number | string) => {
        if (typeof duration === 'number') {
            const hours = Math.floor(duration / 60);
            const minutes = duration % 60;
            if (!hours) return `${minutes}m`;
            if (!minutes) return `${hours}h`;
            return `${hours}h ${minutes}m`;
        }
        return duration || '--';
    };

    const durationStr = formatDuration(ticket.duration);
    const displayPrice = ticket.price ?? ticket.minPrice ?? 0;
    const remainingSeats = ticket.availableSeats ?? 0;
    const carriageLabel = ticket.carriages?.[0]?.carriageTypeName || t('tickets.seat_types.soft_seat');

    // Format times
    const formatTime = (timeStr: string) => {
        try {
            const date = new Date(timeStr);
            return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
        } catch {
            return timeStr;
        }
    };

    if (viewType === 'list') {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 p-4 hover:shadow-xl hover:shadow-red-500/5 transition-all duration-300 group relative overflow-hidden flex flex-col sm:flex-row gap-4 sm:gap-6">
                <div className="flex flex-row sm:flex-col items-center justify-between sm:justify-center p-3 sm:p-4 bg-gray-50/50 rounded-xl sm:min-w-[120px]">
                    <div className="w-8 h-8 sm:w-10 sm:h-10 bg-white text-tet-red rounded-lg sm:rounded-xl flex items-center justify-center group-hover:bg-tet-red group-hover:text-white transition-colors duration-500 shadow-sm">
                        <Train size={18} />
                    </div>
                    <span className="text-base sm:text-lg font-black text-tet-red mt-0 sm:mt-3">
                        {formatPrice(displayPrice)}
                        <span className="text-[10px] font-bold ml-0.5">đ</span>
                    </span>
                </div>

                <div className="flex-1 py-1">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-4 gap-3">
                        <div>
                            <h3 className="font-bold text-gray-900 group-hover:text-tet-red transition-colors text-sm">
                                {ticket.trainCode}
                            </h3>
                            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.15em] mt-0.5">
                                {carriageLabel}
                            </p>
                        </div>
                        <div className="flex items-center gap-3 sm:gap-4">
                            <div className="flex items-center gap-1.5 grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                                <Armchair size={12} className="text-tet-red" />
                                <span className="text-[10px] font-black text-gray-700">{remainingSeats} {t('tickets.seats_left')}</span>
                            </div>
                            <div className="flex items-center gap-1.5 grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                                <BadgePercent size={12} className="text-tet-yellow" />
                                <span className="text-[10px] font-black text-gray-700">{t('tickets.discount')} 10%</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
                        <div className="flex items-center justify-between sm:justify-start gap-4 sm:gap-8 flex-1">
                            <div className="text-center sm:text-left">
                                <p className="text-lg font-black text-gray-900 leading-none">{formatTime(ticket.departureTime)}</p>
                                <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">{ticket.departureStation}</p>
                            </div>
                            <div className="flex flex-col items-center min-w-[50px] sm:min-w-[60px]">
                                <div className="w-full border-t border-gray-200 relative">
                                    <Clock size={10} className="absolute -top-1.5 left-1/2 -translate-x-1/2 bg-white px-1 text-gray-300" />
                                </div>
                                <span className="text-[8px] font-black text-gray-400 mt-1 uppercase tracking-tighter">{durationStr}</span>
                            </div>
                            <div className="text-center sm:text-right">
                                <p className="text-lg font-black text-gray-900 leading-none">{formatTime(ticket.arrivalTime)}</p>
                                <p className="text-[10px] font-bold text-gray-400 mt-1 uppercase">{ticket.arrivalStation}</p>
                            </div>
                        </div>

                        <div className="flex justify-stretch sm:justify-end mt-2 sm:mt-0">
                            <button
                                onClick={() => navigate(`/ticket/${ticket.id}`)}
                                className="w-full sm:w-auto bg-gray-900 text-white px-6 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-tet-red transition-all shadow-lg shadow-gray-200 flex items-center justify-center gap-2"
                            >
                                {t('tickets.select')} <ChevronRight size={14} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-3xl border border-gray-100 p-6 hover:shadow-2xl hover:shadow-red-500/10 transition-all duration-500 group relative overflow-hidden">
            <div className="flex flex-col h-full">
                <div className="flex justify-between items-start mb-6">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-red-50 text-tet-red rounded-2xl flex items-center justify-center group-hover:bg-tet-red group-hover:text-white transition-colors duration-500 shadow-inner">
                            <Train size={24} />
                        </div>
                        <div>
                            <h3 className="font-bold text-gray-900 group-hover:text-tet-red transition-colors">{ticket.trainCode}</h3>
                            <p className="text-xs text-gray-500 font-medium uppercase tracking-widest">{carriageLabel}</p>
                        </div>
                    </div>
                    <div className="text-right">
                        <span className="text-xl font-black text-tet-red">
                            {formatPrice(displayPrice)}
                            <span className="text-sm font-bold ml-1">đ</span>
                        </span>
                    </div>
                </div>

                <div className="flex items-center justify-between mb-8 relative">
                    <div className="text-left">
                        <p className="text-2xl font-bold text-gray-900">{formatTime(ticket.departureTime)}</p>
                        <p className="text-sm font-semibold text-gray-500 mt-1">{ticket.departureStation}</p>
                    </div>

                    <div className="flex flex-col items-center flex-1 px-4 relative">
                        <div className="w-full border-t-2 border-dashed border-gray-200 relative">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 group-hover:rotate-12 transition-transform">
                                <Clock size={16} className="text-gray-300" />
                            </div>
                        </div>
                        <p className="text-[10px] font-bold text-gray-400 mt-2 uppercase tracking-tighter">{durationStr}</p>
                    </div>

                    <div className="text-right">
                        <p className="text-2xl font-bold text-gray-900">{formatTime(ticket.arrivalTime)}</p>
                        <p className="text-sm font-semibold text-gray-500 mt-1">{ticket.arrivalStation}</p>
                    </div>
                </div>

                <div className="mt-auto border-t border-gray-100 pt-5 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center gap-1.5 grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                            <Armchair size={14} className="text-tet-red" />
                            <span className="text-[11px] font-bold text-gray-700">{remainingSeats} {t('tickets.seats_left')}</span>
                        </div>
                        <div className="flex items-center gap-1.5 grayscale opacity-60 group-hover:grayscale-0 group-hover:opacity-100 transition-all">
                            <BadgePercent size={14} className="text-tet-yellow" />
                            <span className="text-[11px] font-bold text-gray-700">{t('tickets.discount')} 10%</span>
                        </div>
                    </div>

                    <button
                        onClick={() => navigate(`/ticket/${ticket.id}`)}
                        className="bg-gray-900 text-white px-5 py-2.5 rounded-xl text-xs font-bold hover:bg-tet-red transition-all transform hover:scale-105 active:scale-95 flex items-center gap-1 shadow-lg shadow-gray-200"
                    >
                        {t('tickets.select')} <ChevronRight size={14} />
                    </button>
                </div>
            </div>
        </div>
    );
};

export default TicketCard;
