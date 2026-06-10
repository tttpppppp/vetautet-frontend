import * as React from 'react';
import TicketCard from './TicketCard';
import { CalendarDays, ChevronRight } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

const TicketList = () => {
    const { t } = useTranslation();

    const dummyTickets = [
        {
            id: 1,
            trainName: 'SE1 Express',
            from: t('search.stations.hanoi'),
            to: t('search.stations.saigon'),
            departureTime: '19:30',
            arrivalTime: '05:30',
            duration: '34h 00m',
            seatType: t('tickets.seat_types.sleeper_4'),
            price: 1550000,
            remainingSeats: 24,
            popular: true
        },
        {
            id: 2,
            trainName: 'SE3 Express',
            from: t('search.stations.hanoi'),
            to: t('search.stations.saigon'),
            departureTime: '18:00',
            arrivalTime: '04:00',
            duration: '34h 00m',
            seatType: t('tickets.seat_types.soft_seat'),
            price: 980000,
            remainingSeats: 12,
            popular: false
        },
        {
            id: 3,
            trainName: 'SE2 Express',
            from: t('search.stations.saigon'),
            to: t('search.stations.hanoi'),
            departureTime: '21:00',
            arrivalTime: '07:30',
            duration: '34h 30m',
            seatType: t('tickets.seat_types.sleeper_6'),
            price: 1250000,
            remainingSeats: 45,
            popular: true
        },
        {
            id: 4,
            trainName: 'SE4 Express',
            from: t('search.stations.danang'),
            to: t('search.stations.saigon'),
            departureTime: '14:20',
            arrivalTime: '08:15',
            duration: '18h 00m',
            seatType: t('tickets.seat_types.sleeper_4'),
            price: 850000,
            remainingSeats: 8,
            popular: false
        },
        {
            id: 5,
            trainName: 'SE7 Express',
            from: t('search.stations.vinh'),
            to: t('search.stations.danang'),
            departureTime: '06:00',
            arrivalTime: '14:30',
            duration: '8h 30m',
            seatType: t('tickets.seat_types.soft_seat'),
            price: 450000,
            remainingSeats: 32,
            popular: false
        },
        {
            id: 6,
            trainName: 'TN1 Express',
            from: t('search.stations.hanoi'),
            to: t('search.stations.nhatrang'),
            departureTime: '10:00',
            arrivalTime: '09:00',
            duration: '23h 00m',
            seatType: t('tickets.seat_types.sleeper_6'),
            price: 1100000,
            remainingSeats: 18,
            popular: true
        }
    ];

    return (
        <section className="py-24 bg-gray-50/50">
            <div className="max-w-7xl mx-auto px-6 md:px-12">
                {/* Section Header */}
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
                            to="/search"
                            className="inline-flex items-center gap-1.5 self-start rounded-full px-1 py-1 text-[11px] font-black uppercase tracking-[0.14em] text-gray-500 transition-colors hover:text-tet-red md:mt-4"
                        >
                            <CalendarDays size={15} />
                            <span>{t('tickets.view_all')}</span>
                            <ChevronRight size={14} />
                        </Link>
                    </div>
                </div>

                {/* Ticket Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {dummyTickets.map((ticket) => (
                        <TicketCard key={ticket.id} ticket={ticket} />
                    ))}
                </div>

            </div>
        </section>
    );
};

export default TicketList;
