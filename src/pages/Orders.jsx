import React, { useEffect, useMemo, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { motion, AnimatePresence } from 'framer-motion';
import {
    ShoppingBag, Search, Calendar, Train, Clock, CheckCircle2,
    XCircle, AlertCircle, Ticket, ArrowRight, Download,
    ShieldCheck, ReceiptText, QrCode
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { bookingApi } from '../api/booking.api';
import { ticketApi } from '../api/ticket.api';

const statusAlias = (status) => {
    const normalized = String(status || '').toUpperCase();
    if (['PENDING', 'AWAITING_PAYMENT', 'ACTIVE'].includes(normalized)) return 'active';
    if (['CONFIRMED', 'COMPLETED', 'PAID', 'BOOKED', 'SUCCESS'].includes(normalized)) return 'completed';
    if (['CANCELLED', 'CANCELED', 'EXPIRED', 'FAILED'].includes(normalized)) return 'cancelled';
    return 'active';
};

const canDownloadInvoice = (booking) => {
    const bookingStatus = String(booking?.status || '').toUpperCase();
    const paymentStatus = String(booking?.paymentStatus || '').toUpperCase();
    return bookingStatus === 'CONFIRMED' && (!paymentStatus || paymentStatus === 'SUCCESS');
};

const triggerPdfDownload = (blob, bookingId) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `vetau-booking-${bookingId}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
};

const TicketQrImage = ({ ticketId, bookingId }) => {
    const [qrSrc, setQrSrc] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [isError, setIsError] = useState(false);

    useEffect(() => {
        if (!ticketId || !bookingId) return undefined;

        let isMounted = true;
        let objectUrl = '';
        setIsLoading(true);
        setIsError(false);
        setQrSrc('');

        ticketApi.getTicketQrPng(ticketId, bookingId)
            .then((blob) => {
                objectUrl = URL.createObjectURL(blob);
                if (isMounted) {
                    setQrSrc(objectUrl);
                } else {
                    URL.revokeObjectURL(objectUrl);
                }
            })
            .catch((error) => {
                console.error('Failed to load ticket QR:', error);
                if (isMounted) setIsError(true);
            })
            .finally(() => {
                if (isMounted) setIsLoading(false);
            });

        return () => {
            isMounted = false;
            if (objectUrl) URL.revokeObjectURL(objectUrl);
        };
    }, [bookingId, ticketId]);

    return (
        <div className="w-24">
            <div className="w-24 h-24 rounded-2xl border border-gray-100 bg-white flex items-center justify-center overflow-hidden shadow-sm">
                {qrSrc ? (
                    <img src={qrSrc} alt={`QR ticket ${ticketId}`} className="w-full h-full object-contain p-2" />
                ) : isError ? (
                    <QrCode size={28} className="text-gray-300" />
                ) : (
                    <Train size={24} className={cn('text-tet-red', isLoading && 'animate-spin')} />
                )}
            </div>
            <p className="mt-2 text-center text-[9px] font-black text-gray-400 uppercase tracking-widest">
                QR #{ticketId}
            </p>
        </div>
    );
};

const Orders = () => {
    const { t, i18n } = useTranslation();
    const [searchParams] = useSearchParams();
    const selectedBookingId = Number(searchParams.get('bookingId') || 0);
    const [activeTab, setActiveTab] = useState('all');
    const [searchQuery, setSearchQuery] = useState(searchParams.get('bookingId') || '');
    const [downloadingInvoiceId, setDownloadingInvoiceId] = useState(null);

    const { data: orders = [], isLoading, isError } = useQuery({
        queryKey: ['my-bookings'],
        queryFn: bookingApi.getMyBookings,
    });

    const {
        data: bookingDetail,
        isLoading: isDetailLoading,
        isError: isDetailError,
    } = useQuery({
        queryKey: ['booking-detail', selectedBookingId],
        queryFn: () => bookingApi.getBookingById(selectedBookingId),
        enabled: selectedBookingId > 0,
    });

    const filteredOrders = useMemo(() => {
        return orders.filter((order) => {
            const mappedStatus = statusAlias(order.status);
            const bookingCode = String(order.bookingId);

            if (activeTab !== 'all' && mappedStatus !== activeTab) return false;
            if (searchQuery && !bookingCode.toLowerCase().includes(searchQuery.toLowerCase())) return false;
            return true;
        });
    }, [activeTab, orders, searchQuery]);

    const formatDate = (value) => {
        if (!value) return '--';
        return new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-GB' : 'vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
        }).format(new Date(value));
    };

    const formatTime = (value) => {
        if (!value) return '--';
        return new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-GB' : 'vi-VN', {
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(new Date(value));
    };

    const formatDateTime = (value) => {
        if (!value) return '--';
        return new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-GB' : 'vi-VN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: false,
        }).format(new Date(value));
    };

    const handleDownloadInvoice = async (bookingId) => {
        setDownloadingInvoiceId(bookingId);
        try {
            const blob = await bookingApi.downloadInvoicePdf(bookingId);
            triggerPdfDownload(blob, bookingId);
        } catch (error) {
            console.error('Failed to download invoice pdf:', error);
        } finally {
            setDownloadingInvoiceId(null);
        }
    };

    const formatCurrency = (value) => {
        return Number(value || 0).toLocaleString(i18n.language === 'en' ? 'en-US' : 'vi-VN') + 'đ';
    };

    const statusConfig = {
        active: { icon: Clock, color: 'text-tet-red', bg: 'bg-red-50', label: t('orders.status.active'), border: 'border-red-100' },
        completed: { icon: CheckCircle2, color: 'text-green-500', bg: 'bg-green-50', label: t('orders.status.completed'), border: 'border-green-100' },
        cancelled: { icon: XCircle, color: 'text-gray-400', bg: 'bg-gray-50', label: t('orders.status.cancelled'), border: 'border-gray-200' },
    };

    return (
        <main className="min-h-screen bg-[#FDFDFD] flex flex-col">
            <Helmet>
                <title>{t('orders.seo_title')}</title>
                <meta name="description" content={t('orders.seo_desc')} />
            </Helmet>
            <Header />

            <section className="pt-52 pb-24">
                <div className="max-w-7xl mx-auto px-6 md:px-12">
                    <div className="flex flex-col md:flex-row md:items-end justify-between gap-8 mb-16">
                        <div className="space-y-4">
                            <span className="inline-flex items-center gap-2 bg-red-50 px-4 py-2 rounded-full text-[10px] font-black text-tet-red uppercase tracking-widest">
                                <ShoppingBag size={14} /> {t('orders.manage_label')}
                            </span>
                            <h1 className="text-5xl font-black text-gray-900 tracking-tight">{t('orders.title')}</h1>
                            <p className="text-gray-400 font-bold max-w-md">{t('orders.desc')}</p>
                        </div>

                        <div className="relative group min-w-[300px]">
                            <div className="absolute inset-y-0 left-0 pl-6 flex items-center text-gray-400">
                                <Search size={20} />
                            </div>
                            <input
                                type="text"
                                placeholder={t('orders.search_placeholder')}
                                className="w-full pl-14 pr-6 py-4 bg-white rounded-2xl border border-gray-100 focus:border-tet-red focus:bg-white focus:ring-4 focus:ring-tet-red/5 outline-none font-bold text-gray-800 transition-all shadow-sm group-hover:shadow-md"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                            />
                        </div>
                    </div>

                    {selectedBookingId > 0 && (
                        <div className="mb-10 bg-white border border-gray-100 rounded-[2.5rem] p-8 md:p-10 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.22)]">
                            {isDetailLoading ? (
                                <div className="py-10 text-center">
                                    <Train size={36} className="text-tet-red animate-spin mx-auto mb-4" />
                                    <p className="text-sm font-black text-gray-900 uppercase tracking-widest">Đang tải đơn #{selectedBookingId}</p>
                                </div>
                            ) : isDetailError || !bookingDetail ? (
                                <div className="py-10 text-center">
                                    <AlertCircle size={36} className="text-tet-red mx-auto mb-4" />
                                    <p className="text-sm font-black text-gray-900 uppercase tracking-widest">Không thể tải đơn #{selectedBookingId}</p>
                                </div>
                            ) : (
                                <>
                                    <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-8 mb-10">
                                        <div className="space-y-3">
                                            <p className="text-[10px] font-black text-tet-red uppercase tracking-[0.3em]">Chi tiết đơn vé</p>
                                            <h2 className="text-3xl font-black text-gray-900">#{bookingDetail.bookingId} • {bookingDetail.trainCode}</h2>
                                            <div className="flex items-center gap-3 text-lg font-bold text-gray-700">
                                                <span>{bookingDetail.departureStation}</span>
                                                <ArrowRight size={18} className="text-gray-300" />
                                                <span>{bookingDetail.arrivalStation}</span>
                                            </div>
                                            <p className="text-sm font-bold text-gray-400">
                                                {formatDateTime(bookingDetail.departureTime)} - {formatDateTime(bookingDetail.arrivalTime)}
                                            </p>
                                        </div>
                                        <div className="flex flex-wrap gap-3">
                                            {(() => {
                                                const Config = statusConfig[statusAlias(bookingDetail.status)];
                                                return (
                                                    <div
                                                        className={cn(
                                                            'flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border',
                                                            Config.bg,
                                                            Config.color,
                                                            Config.border
                                                        )}
                                                    >
                                                        <Config.icon size={14} />
                                                        {Config.label}
                                                    </div>
                                                );
                                            })()}
                                            {bookingDetail.paymentStatus && (
                                                <div className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border border-gray-100 bg-gray-50 text-gray-700">
                                                    <ShieldCheck size={14} />
                                                    {bookingDetail.paymentStatus}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                                        <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Ghế</p>
                                            <p className="text-lg font-black text-gray-900">{bookingDetail.seatNumbers?.join(', ') || '--'}</p>
                                            <p className="text-sm font-bold text-gray-400 mt-1">{bookingDetail.passengerCount || bookingDetail.details?.length || 0} hành khách</p>
                                        </div>
                                        <div className="p-5 rounded-2xl bg-gray-50 border border-gray-100">
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Thanh toán</p>
                                            <p className="text-lg font-black text-gray-900">{bookingDetail.paymentMethod || '--'}</p>
                                            <p className="text-sm font-bold text-gray-400 mt-1">{bookingDetail.paymentTransactionId || 'Chưa có mã giao dịch'}</p>
                                        </div>
                                        <div className="p-5 rounded-2xl bg-gray-900 text-white">
                                            <p className="text-[10px] font-black text-white/50 uppercase tracking-widest mb-2">Tổng tiền</p>
                                            <p className="text-3xl font-black">{formatCurrency(bookingDetail.totalPrice)}</p>
                                            <p className="text-sm font-bold text-white/50 mt-1">
                                                {bookingDetail.paidAt ? `Thanh toán lúc ${formatDateTime(bookingDetail.paidAt)}` : 'Đang chờ thanh toán'}
                                            </p>
                                        </div>
                                    </div>

                                    {canDownloadInvoice(bookingDetail) && (
                                        <div className="mb-8">
                                            <button
                                                type="button"
                                                onClick={() => handleDownloadInvoice(bookingDetail.bookingId)}
                                                disabled={downloadingInvoiceId === bookingDetail.bookingId}
                                                className="inline-flex items-center gap-2 rounded-xl bg-gray-900 px-5 py-3 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-black disabled:opacity-70"
                                            >
                                                {downloadingInvoiceId === bookingDetail.bookingId ? <Train size={16} className="animate-spin" /> : <Download size={16} />}
                                                Tải hóa đơn PDF
                                            </button>
                                        </div>
                                    )}

                                    <div className="space-y-4">
                                        <div className="flex items-center gap-3">
                                            <ReceiptText size={20} className="text-tet-red" />
                                            <h3 className="text-lg font-black text-gray-900">Chi tiết hành khách và vé</h3>
                                        </div>
                                        <div className="space-y-3">
                                            {bookingDetail.details?.map((detail) => (
                                                <div key={detail.bookingDetailId} className="grid grid-cols-1 md:grid-cols-6 gap-4 p-5 rounded-2xl bg-gray-50/70 border border-gray-100 items-center">
                                                    <div>
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Ghế</p>
                                                        <p className="text-sm font-black text-gray-900">{detail.seatNumber}</p>
                                                        <p className="text-xs font-bold text-gray-400 mt-1">{detail.carriageNumber} {detail.carriageTypeName || ''}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Hành khách</p>
                                                        <p className="text-sm font-black text-gray-900">{detail.passengerName || '--'}</p>
                                                        <p className="text-xs font-bold text-gray-400 mt-1">{detail.passengerType || 'Người lớn'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">CCCD / CMND</p>
                                                        <p className="text-sm font-black text-gray-900">{detail.passengerIdCard || '--'}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Vé</p>
                                                        <p className="text-sm font-black text-gray-900">#{detail.ticketId}</p>
                                                        <p className="text-xs font-bold text-gray-400 mt-1">{detail.ticketStatus}</p>
                                                    </div>
                                                    <div>
                                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Giá</p>
                                                        <p className="text-sm font-black text-tet-red">{formatCurrency(detail.price)}</p>
                                                    </div>
                                                    <div className="md:justify-self-end">
                                                        <TicketQrImage ticketId={detail.ticketId} bookingId={bookingDetail.bookingId} />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    <div className="flex items-center gap-2 mb-10 overflow-x-auto pb-4 scrollbar-hide">
                        {[
                            { id: 'all', label: t('orders.tabs.all') },
                            { id: 'active', label: t('orders.tabs.active') },
                            { id: 'completed', label: t('orders.tabs.completed') },
                            { id: 'cancelled', label: t('orders.tabs.cancelled') },
                        ].map((tab) => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={cn(
                                    'px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all whitespace-nowrap',
                                    activeTab === tab.id
                                        ? 'bg-gray-900 text-white shadow-xl shadow-gray-200 translate-y-[-2px]'
                                        : 'bg-white text-gray-400 hover:text-gray-900 border border-gray-100'
                                )}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="space-y-6 min-h-[400px]">
                        {isLoading ? (
                            <div className="py-24 text-center bg-gray-50/50 rounded-[3rem] border-2 border-dashed border-gray-100 w-full">
                                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-sm mb-6">
                                    <Train size={40} className="text-tet-red animate-spin" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 mb-2">Đang tải đơn hàng</h3>
                                <p className="text-gray-400 font-bold">Đang lấy lịch sử đơn hàng mới nhất của bạn.</p>
                            </div>
                        ) : isError ? (
                            <div className="py-24 text-center bg-gray-50/50 rounded-[3rem] border-2 border-dashed border-gray-100 w-full">
                                <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-sm mb-6">
                                    <AlertCircle size={40} className="text-tet-red" />
                                </div>
                                <h3 className="text-xl font-black text-gray-900 mb-2">Không thể tải đơn hàng</h3>
                                <p className="text-gray-400 font-bold">Hệ thống chưa trả về dữ liệu đơn hàng cho tài khoản này.</p>
                            </div>
                        ) : (
                            <AnimatePresence mode="popLayout">
                                {filteredOrders.length === 0 ? (
                                    <motion.div
                                        initial={{ opacity: 0, scale: 0.95 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        exit={{ opacity: 0, scale: 0.95 }}
                                        className="py-24 text-center bg-gray-50/50 rounded-[3rem] border-2 border-dashed border-gray-100 w-full"
                                    >
                                        <div className="w-20 h-20 bg-white rounded-3xl flex items-center justify-center mx-auto shadow-sm mb-6">
                                            <AlertCircle size={40} className="text-gray-200" />
                                        </div>
                                        <h3 className="text-xl font-black text-gray-900 mb-2">{t('orders.not_found')}</h3>
                                        <p className="text-gray-400 font-bold mb-8">{t('orders.not_found_desc')}</p>
                                        <Link to="/explore" className="bg-tet-red text-white px-10 py-4 rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-black transition-all shadow-lg active:scale-95 inline-block">
                                            {t('orders.find_now')}
                                        </Link>
                                    </motion.div>
                                ) : (
                                    filteredOrders.map((order, index) => {
                                        const mappedStatus = statusAlias(order.status);
                                        const Config = statusConfig[mappedStatus];
                                        const passengerCount = order.passengerCount || order.seatNumbers?.length || 0;
                                        const arrivalLabel = order.arrivalTime ? formatTime(order.arrivalTime) : '--';

                                        return (
                                            <motion.div
                                                key={order.bookingId}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                exit={{ opacity: 0, x: 20 }}
                                                transition={{ delay: index * 0.05 }}
                                                className="group bg-white rounded-[2.5rem] p-8 md:p-10 border border-gray-100 shadow-[0_8px_30px_rgba(0,0,0,0.02)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.05)] transition-all relative overflow-hidden"
                                            >
                                                <div className="absolute top-0 right-0 w-32 h-full bg-gray-50/50 -skew-x-12 translate-x-20 group-hover:scale-110 transition-transform duration-700" />

                                                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-10 relative z-10">
                                                    <div className="flex items-center gap-8">
                                                        <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-tet-red shrink-0 shadow-inner group-hover:scale-110 transition-transform duration-500">
                                                            <Train size={32} />
                                                        </div>
                                                        <div className="space-y-2">
                                                            <div className="flex items-center gap-3">
                                                                <h3 className="text-2xl font-black text-gray-900 group-hover:text-tet-red transition-colors">{order.trainCode}</h3>
                                                                {mappedStatus === 'active' && (
                                                                    <span className="bg-red-50 text-tet-red text-[8px] font-black px-2 py-0.5 rounded-lg uppercase tracking-widest border border-red-100">{t('orders.priority')}</span>
                                                                )}
                                                            </div>
                                                            <div className="flex items-center gap-3 text-lg font-bold text-gray-700">
                                                                <span>{order.departureStation}</span>
                                                                <ArrowRight size={18} className="text-gray-300" />
                                                                <span>{order.arrivalStation}</span>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="grid grid-cols-2 md:grid-cols-3 gap-10">
                                                        <div>
                                                            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                <Calendar size={12} /> {t('orders.date')}
                                                            </p>
                                                            <p className="font-black text-gray-900 text-lg">{formatDate(order.departureTime)}</p>
                                                            <p className="text-sm font-bold text-gray-400">{formatTime(order.departureTime)} - {arrivalLabel}</p>
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 flex items-center gap-2">
                                                                <Ticket size={12} /> {t('orders.seat')}
                                                            </p>
                                                            <p className="font-black text-gray-900 text-lg">{order.seatNumbers?.join(', ') || '--'}</p>
                                                            <p className="text-sm font-bold text-gray-400">{t('orders.passenger_count', { count: passengerCount })}</p>
                                                        </div>
                                                        <div className="hidden md:block">
                                                            <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest mb-2 ">
                                                                {t('orders.total_price')}
                                                            </p>
                                                            <p className="font-black text-tet-red text-xl">{formatCurrency(order.totalPrice)}</p>
                                                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{t('orders.vat_included')}</p>
                                                        </div>
                                                    </div>

                                                    <div className="flex flex-row lg:flex-col items-center lg:items-end justify-between gap-6 border-t lg:border-t-0 lg:border-l border-gray-100 pt-6 lg:pt-0 lg:pl-10">
                                                        <div className={cn(
                                                            'flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest',
                                                            Config.bg, Config.color, Config.border, 'border'
                                                        )}>
                                                            <Config.icon size={14} />
                                                            {Config.label}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            <button
                                                                type="button"
                                                                onClick={() => handleDownloadInvoice(order.bookingId)}
                                                                disabled={!canDownloadInvoice(order) || downloadingInvoiceId === order.bookingId}
                                                                className={cn(
                                                                    'w-12 h-12 rounded-xl flex items-center justify-center transition-all shadow-sm',
                                                                    canDownloadInvoice(order)
                                                                        ? 'bg-gray-50 text-gray-400 hover:bg-tet-red hover:text-white'
                                                                        : 'bg-gray-50/70 text-gray-300 cursor-not-allowed'
                                                                )}
                                                            >
                                                                {downloadingInvoiceId === order.bookingId ? <Train size={20} className="animate-spin" /> : <Download size={20} />}
                                                            </button>
                                                            <Link
                                                                to={`/orders?bookingId=${order.bookingId}`}
                                                                className="bg-gray-900 hover:bg-black text-white px-6 py-3 rounded-xl font-black text-xs uppercase tracking-widest transition-all shadow-lg active:scale-95"
                                                            >
                                                                {t('orders.details_cta')}
                                                            </Link>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex md:hidden items-center justify-between mt-6 pt-6 border-t border-gray-50">
                                                    <span className="text-sm font-bold text-gray-400 tracking-wider">MÃ ĐƠN: #{order.bookingId}</span>
                                                    <span className="text-xl font-black text-tet-red">{formatCurrency(order.totalPrice)}</span>
                                                </div>
                                            </motion.div>
                                        );
                                    })
                                )}
                            </AnimatePresence>
                        )}
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
};

export default Orders;
