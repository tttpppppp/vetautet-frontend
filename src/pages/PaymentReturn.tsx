import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
    ArrowRight,
    CheckCircle2,
    Clock,
    Copy,
    Download,
    Home,
    Loader2,
    Mail,
    ReceiptText,
    ShieldCheck,
    TicketCheck,
    XCircle,
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { bookingApi } from '../api/booking.api';
import { cn } from '@/lib/utils';

type PaymentProvider = 'momo' | 'vnpay';
type ReturnStatus = 'checking' | 'success' | 'pending' | 'failed';

interface PaymentReturnProps {
    provider: PaymentProvider;
}

interface PaymentResult {
    code?: string;
    message?: string;
    bookingId?: number | string;
    vnpTxnRef?: string;
    transactionNo?: string;
    responseCode?: string;
    transactionStatus?: string;
    RspCode?: string;
    status?: string;
    amount?: number | string;
    resultCode?: number;
    orderId?: string;
    requestId?: string;
}

const parseBookingId = (query: Record<string, string>, result?: PaymentResult | null) => {
    if (result?.bookingId) return String(result.bookingId);

    const orderId = result?.orderId || query.orderId || query.vnp_TxnRef || '';
    const bookingMatch = orderId.match(/BOOKING-(\d+)-/i);
    if (bookingMatch) return bookingMatch[1];

    const vnpayMatch = orderId.match(/B(\d+)T/i);
    if (vnpayMatch) return vnpayMatch[1];

    const extraData = query.extraData;
    if (extraData) {
        try {
            const parsed = JSON.parse(atob(extraData));
            if (parsed.bookingId) return String(parsed.bookingId);
        } catch {
            // Ignore malformed gateway metadata.
        }
    }

    try {
        const pendingPayment = JSON.parse(sessionStorage.getItem('pendingPayment') || '{}');
        if (pendingPayment.bookingId) return String(pendingPayment.bookingId);
    } catch {
        // Ignore malformed local state.
    }

    return null;
};

const isBackendSuccess = (payload: PaymentResult) => {
    return payload?.code === '00'
        || payload?.RspCode === '00'
        || payload?.resultCode === 0
        || payload?.responseCode === '00'
        || payload?.status === 'CONFIRMED'
        || /success|confirmed/i.test(String(payload?.message || ''));
};

const formatCurrency = (value?: number | string) => {
    const amount = Number(value);
    if (!Number.isFinite(amount) || amount <= 0) return '--';
    return amount.toLocaleString('vi-VN') + 'd';
};

const triggerPdfDownload = (blob: Blob, bookingId: string | number) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `vetau-booking-${bookingId}.pdf`;
    anchor.click();
    URL.revokeObjectURL(url);
};

const PaymentReturn: React.FC<PaymentReturnProps> = ({ provider }) => {
    const [searchParams] = useSearchParams();
    const [status, setStatus] = useState<ReturnStatus>('checking');
    const [message, setMessage] = useState('Đang xác nhận thanh toán...');
    const [invoiceNotice, setInvoiceNotice] = useState<string | null>(null);
    const [result, setResult] = useState<PaymentResult | null>(null);
    const queryString = searchParams.toString();

    const query = useMemo(
        () => Object.fromEntries(searchParams.entries()),
        [queryString]
    );
    const bookingId = useMemo(() => parseBookingId(query, result), [query, result]);
    const numericBookingId = Number(bookingId || 0);
    const amount = result?.amount || query.vnp_Amount && Number(query.vnp_Amount) / 100;
    const transactionNo = result?.transactionNo || query.vnp_TransactionNo;
    const txnRef = result?.vnpTxnRef || query.vnp_TxnRef || result?.orderId;
    const [isDownloadingInvoice, setIsDownloadingInvoice] = useState(false);
    const [hasTriggeredInvoiceDownload, setHasTriggeredInvoiceDownload] = useState(false);

    useEffect(() => {
        const handleReturn = async () => {
            if (provider === 'momo') {
                const momoResult: PaymentResult = {
                    resultCode: Number(query.resultCode),
                    message: query.message,
                    orderId: query.orderId,
                    requestId: query.requestId,
                    amount: query.amount,
                };
                setResult(momoResult);

                if (query.resultCode === '0') {
                    sessionStorage.removeItem('pendingPayment');
                    setStatus('pending');
                    setMessage('MoMo đã trả về thành công. Vé sẽ được xác nhận khi backend nhận IPN.');
                    return;
                }

                setStatus('failed');
                setMessage(query.message || 'Thanh toán MoMo không thành công.');
                return;
            }

            try {
                const response = await bookingApi.verifyVnpayReturn(query);
                setResult(response);

                if (isBackendSuccess(response)) {
                    sessionStorage.removeItem('pendingPayment');
                    setStatus('success');
                    setMessage('Thanh toán đã được xác nhận. Đơn vé của bạn đã hoàn tất.');
                } else {
                    setStatus('failed');
                    setMessage(response?.Message || response?.message || 'VNPAY trả về kết quả không thành công.');
                }
            } catch (error: any) {
                setStatus('failed');
                setMessage(error.response?.data?.Message || error.response?.data?.message || error.message || 'Không thể xác nhận thanh toán VNPAY.');
            }
        };

        handleReturn();
    }, [provider, queryString]);

    const StatusIcon = status === 'checking'
        ? Loader2
        : status === 'success'
            ? CheckCircle2
            : status === 'pending'
                ? Clock
                : XCircle;

    const statusCopy = {
        checking: {
            eyebrow: 'Đang xác minh',
            title: 'Đang xác nhận thanh toán',
            desc: 'Hệ thống đang kiểm tra giao dịch và cập nhật trạng thái vé.',
            tone: 'bg-gray-50 text-tet-red border-gray-100',
        },
        success: {
            eyebrow: 'Thanh toán thành công',
            title: 'Đặt vé thành công',
            desc: 'Vé của bạn đã được xác nhận và hóa đơn có thể tải ngay.',
            tone: 'bg-green-50 text-green-600 border-green-100',
        },
        pending: {
            eyebrow: 'Đã nhận giao dịch',
            title: 'Đang hoàn tất xác nhận',
            desc: 'Cổng thanh toán đã trả về thành công. Hệ thống sẽ xác nhận vé sau khi nhận callback.',
            tone: 'bg-yellow-50 text-yellow-600 border-yellow-100',
        },
        failed: {
            eyebrow: 'Thanh toán thất bại',
            title: 'Thanh toán chưa thành công',
            desc: 'Giao dịch chưa được xác nhận. Bạn có thể quay lại đơn vé để thử lại.',
            tone: 'bg-red-50 text-red-600 border-red-100',
        },
    }[status];

    const details = [
        { label: 'Mã đơn', value: bookingId ? `#${bookingId}` : '--' },
        { label: 'Số tiền', value: formatCurrency(amount) },
        { label: 'Cổng thanh toán', value: provider.toUpperCase() },
        { label: 'Mã giao dịch', value: transactionNo || '--' },
    ];

    const handleDownloadInvoice = async () => {
        if (!numericBookingId) return;
        setIsDownloadingInvoice(true);
        setInvoiceNotice(null);
        try {
            if (typeof bookingApi.downloadInvoicePdf !== 'function') {
                throw new Error('Chưa thể tải hóa đơn ở phiên hiện tại. Vui lòng tải lại trang.');
            }
            const blob = await bookingApi.downloadInvoicePdf(numericBookingId);
            triggerPdfDownload(blob, numericBookingId);
        } catch (error: any) {
            setInvoiceNotice(error?.response?.data?.message || error?.message || 'Không thể tải hóa đơn PDF lúc này.');
        } finally {
            setIsDownloadingInvoice(false);
        }
    };

    useEffect(() => {
        if (status !== 'success' || !numericBookingId || hasTriggeredInvoiceDownload) return;

        setHasTriggeredInvoiceDownload(true);
        handleDownloadInvoice();
    }, [hasTriggeredInvoiceDownload, numericBookingId, status]);

    return (
        <main className="min-h-screen bg-[#F8F9FB] flex flex-col">
            <Helmet>
                <title>{statusCopy.title} | Ve Tau Viet Nam</title>
            </Helmet>
            <Header />

            <section className="flex-grow pt-28 md:pt-32 pb-10 px-4">
                <div className="max-w-5xl mx-auto">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
                        <div className="lg:col-span-7 bg-white border border-gray-100 rounded-2xl p-5 md:p-7 shadow-[0_18px_50px_-36px_rgba(15,23,42,0.45)] relative overflow-hidden">
                            <div className="absolute top-0 left-0 right-0 h-1 bg-tet-red" />
                            <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                                <div className={cn(
                                    'w-16 h-16 rounded-2xl border flex items-center justify-center shrink-0',
                                    statusCopy.tone
                                )}>
                                    <StatusIcon size={36} className={status === 'checking' ? 'animate-spin' : ''} />
                                </div>

                                <div className="min-w-0 flex-1">
                                    <p className="text-[10px] font-black text-tet-red uppercase tracking-[0.22em] mb-2">
                                        {statusCopy.eyebrow}
                                    </p>
                                    <h1 className="text-3xl md:text-4xl font-black text-gray-900 tracking-tight leading-tight mb-3">
                                        {statusCopy.title}
                                    </h1>
                                    <p className="text-sm md:text-[15px] font-bold text-gray-500 leading-6 max-w-xl">
                                        {status === 'success' || status === 'failed' || status === 'pending' ? message : statusCopy.desc}
                                    </p>

                                    {bookingId && (
                                        <div className="mt-5 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-red-50 border border-red-100 text-tet-red">
                                            <TicketCheck size={16} />
                                            <span className="text-xs font-black uppercase tracking-widest">Booking #{bookingId}</span>
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-7 pt-5 border-t border-gray-100">
                                <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Trạng thái vé</p>
                                    <p className="text-sm font-black text-gray-900">Đã xác nhận</p>
                                </div>
                                <div className="rounded-xl border border-gray-100 bg-gray-50/70 px-4 py-3">
                                    <p className="text-[10px] font-black uppercase tracking-widest text-gray-400 mb-1">Hóa đơn</p>
                                    <p className="text-sm font-black text-gray-900">
                                        {isDownloadingInvoice ? 'Đang tải PDF...' : 'Sẵn sàng tải về'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        <aside className="lg:col-span-5">
                            <div className="bg-white border border-gray-100 rounded-2xl p-5 md:p-6 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.5)]">
                                <div className="flex items-center justify-between gap-4 mb-4">
                                    <div>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Biên nhận</p>
                                        <h2 className="text-lg font-black text-gray-900 mt-1">Chi tiết giao dịch</h2>
                                    </div>
                                    <div className="w-10 h-10 rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-tet-red">
                                        <ReceiptText size={20} />
                                    </div>
                                </div>

                                <div>
                                    {details.map(item => (
                                        <div key={item.label} className="flex items-start justify-between gap-4 py-2.5 border-b border-gray-50 last:border-b-0">
                                            <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.label}</span>
                                            <span className="text-sm font-black text-gray-900 text-right break-all">{item.value}</span>
                                        </div>
                                    ))}
                                </div>

                                {transactionNo && (
                                    <button
                                        type="button"
                                        onClick={() => navigator.clipboard?.writeText(String(transactionNo))}
                                        className="mt-4 w-full bg-gray-50 hover:bg-gray-100 text-gray-700 py-2.5 rounded-lg font-black text-xs uppercase tracking-widest inline-flex items-center justify-center gap-2"
                                    >
                                        <Copy size={14} />
                                        Sao chép mã giao dịch
                                    </button>
                                )}

                                <div className="mt-4 flex items-start gap-3 rounded-xl bg-gray-900 px-4 py-3 text-white">
                                    <ShieldCheck size={18} className="text-tet-yellow shrink-0 mt-0.5" />
                                    <div className="min-w-0">
                                        <p className="font-black text-sm leading-5">Thanh toan an toan</p>
                                        <p className="text-xs font-bold text-white/55 mt-0.5 leading-5">
                                            Kết quả được backend xác thực trước khi cập nhật vé và hóa đơn.
                                        </p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
                                    {status === 'success' && numericBookingId > 0 ? (
                                        <button
                                            type="button"
                                            onClick={handleDownloadInvoice}
                                            disabled={isDownloadingInvoice}
                                            className="bg-tet-red hover:bg-red-700 disabled:opacity-70 text-white py-3 rounded-lg font-black text-xs uppercase tracking-widest inline-flex items-center justify-center gap-2"
                                        >
                                            {isDownloadingInvoice ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                                            Tải hóa đơn PDF
                                        </button>
                                    ) : (
                                        <Link
                                            to={bookingId ? `/orders?bookingId=${bookingId}` : '/orders'}
                                            className="bg-tet-red hover:bg-red-700 text-white py-3 rounded-lg font-black text-xs uppercase tracking-widest inline-flex items-center justify-center gap-2"
                                        >
                                            Đơn vé của tôi
                                            <ArrowRight size={16} />
                                        </Link>
                                    )}
                                    <Link
                                        to={bookingId ? `/orders?bookingId=${bookingId}` : '/'}
                                        className="bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-lg font-black text-xs uppercase tracking-widest inline-flex items-center justify-center gap-2"
                                    >
                                        {status === 'success' && bookingId ? <TicketCheck size={16} /> : <Home size={16} />}
                                        {status === 'success' && bookingId ? 'Đơn vé của tôi' : 'Trang chủ'}
                                    </Link>
                                </div>

                                {invoiceNotice ? (
                                    <p className="mt-3 text-xs font-bold leading-5 text-tet-red">
                                        {invoiceNotice}
                                    </p>
                                ) : null}
                            </div>
                        </aside>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
};

export default PaymentReturn;
