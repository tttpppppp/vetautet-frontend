import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Helmet } from 'react-helmet-async';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { cn } from '@/lib/utils';
import {
    AlertCircle,
    Camera,
    CameraOff,
    CheckCircle2,
    ClipboardCheck,
    LoaderCircle,
    QrCode,
    RotateCw,
    ScanLine,
    ShieldCheck,
    Train,
    XCircle,
} from 'lucide-react';
import { ticketApi } from '../api/ticket.api';
import { TicketQrVerifyResponse } from '../types/api.types';

type ScannerState = 'idle' | 'scanning' | 'unsupported' | 'blocked';

const getVerifyStatus = (result: TicketQrVerifyResponse | null) => {
    if (!result) return '';
    return String(result.status || result.code || (result.valid ? 'VALID_TICKET' : '')).toUpperCase();
};

const isValidTicket = (result: TicketQrVerifyResponse | null) => {
    const status = getVerifyStatus(result);
    return result?.valid === true || ['VALID_TICKET', 'VALID', 'SUCCESS', 'OK'].includes(status);
};

const getVerifyStatusLabel = (result: TicketQrVerifyResponse | null) => {
    const status = getVerifyStatus(result);
    if (['VALID_TICKET', 'VALID', 'SUCCESS', 'OK'].includes(status)) return 'Vé hợp lệ';
    if (['USED_TICKET', 'USED'].includes(status)) return 'Vé đã sử dụng';
    if (['EXPIRED_TICKET', 'EXPIRED'].includes(status)) return 'Vé đã hết hạn';
    if (['INVALID_TICKET', 'INVALID', 'VERIFY_FAILED'].includes(status)) return 'Vé không hợp lệ';
    return status || '';
};

const getVerifyMessage = (
    result: TicketQrVerifyResponse | null,
    verifyError: string,
    validTicket: boolean,
) => {
    const message = String(result?.message || '').trim();
    const status = getVerifyStatus(result);
    const statusLabel = getVerifyStatusLabel(result);

    if (message && message.toUpperCase() !== status) return message;
    if (statusLabel) return `${statusLabel}.`;
    if (verifyError) return verifyError;
    return validTicket ? 'Vé hợp lệ.' : 'Vé không hợp lệ hoặc không thể xác minh.';
};

const formatDateTime = (value: unknown) => {
    if (!value || (typeof value !== 'string' && typeof value !== 'number')) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return String(value);

    return new Intl.DateTimeFormat('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    }).format(date);
};

const getErrorMessage = (error: any) => {
    const responseData = error?.response?.data;
    if (typeof responseData === 'string') return responseData;
    if (responseData?.message) return String(responseData.message);
    if (responseData?.code) return String(responseData.code);
    return error?.message || 'Xác minh QR thất bại';
};

const TicketQrVerify: React.FC = () => {
    const [qrToken, setQrToken] = useState('');
    const [result, setResult] = useState<TicketQrVerifyResponse | null>(null);
    const [verifyError, setVerifyError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [scannerState, setScannerState] = useState<ScannerState>('idle');
    const [scannerError, setScannerError] = useState('');

    const videoRef = useRef<HTMLVideoElement | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const animationFrameRef = useRef<number | null>(null);
    const detectorRef = useRef<any>(null);
    const lastScannedRef = useRef('');

    const stopScanner = useCallback(() => {
        if (animationFrameRef.current) {
            window.cancelAnimationFrame(animationFrameRef.current);
            animationFrameRef.current = null;
        }

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        detectorRef.current = null;

        if (videoRef.current) {
            videoRef.current.srcObject = null;
        }

        setScannerState('idle');
    }, []);

    const handleVerify = useCallback(async (overrideToken?: string) => {
        const token = String(overrideToken ?? qrToken).trim();
        if (!token) {
            setVerifyError('Nhập mã QR token trước khi xác minh.');
            return;
        }

        setIsSubmitting(true);
        setVerifyError('');
        setResult(null);

        try {
            const data = await ticketApi.verifyQr({ qrToken: token });
            setResult(data);
        } catch (error: any) {
            const responseData = error?.response?.data;
            if (responseData && typeof responseData === 'object') {
                setResult(responseData);
            }
            setVerifyError(getErrorMessage(error));
        } finally {
            setIsSubmitting(false);
        }
    }, [qrToken]);

    const startScanner = useCallback(async () => {
        setScannerError('');

        if (!('BarcodeDetector' in window)) {
            setScannerState('unsupported');
            setScannerError('Trình duyệt chưa hỗ trợ quét QR trực tiếp. Hãy dán qrToken vào ô bên dưới.');
            return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            setScannerState('unsupported');
            setScannerError('Thiết bị hoặc trình duyệt không cấp quyền camera.');
            return;
        }

        stopScanner();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: { ideal: 'environment' } },
                audio: false,
            });
            streamRef.current = stream;

            if (!videoRef.current) return;
            videoRef.current.srcObject = stream;
            await videoRef.current.play();

            const BarcodeDetectorCtor = (window as any).BarcodeDetector;
            const supportedFormats = typeof BarcodeDetectorCtor.getSupportedFormats === 'function'
                ? await BarcodeDetectorCtor.getSupportedFormats()
                : [];
            const detectorOptions = !supportedFormats.length || supportedFormats.includes('qr_code')
                ? { formats: ['qr_code'] }
                : undefined;

            detectorRef.current = new BarcodeDetectorCtor(detectorOptions);
            lastScannedRef.current = '';
            setScannerState('scanning');

            const scanFrame = async () => {
                try {
                    const video = videoRef.current;
                    const detector = detectorRef.current;
                    if (video && detector && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
                        const codes = await detector.detect(video);
                        const rawValue = codes?.find((code: any) => code?.rawValue)?.rawValue;
                        const token = String(rawValue || '').trim();

                        if (token && token !== lastScannedRef.current) {
                            lastScannedRef.current = token;
                            setQrToken(token);
                            await handleVerify(token);
                            stopScanner();
                            return;
                        }
                    }
                } catch (error) {
                    console.error('QR scan frame failed:', error);
                }

                animationFrameRef.current = window.requestAnimationFrame(scanFrame);
            };

            animationFrameRef.current = window.requestAnimationFrame(scanFrame);
        } catch (error: any) {
            console.error('Failed to start QR scanner:', error);
            setScannerState('blocked');
            setScannerError(error?.message || 'Không thể mở camera.');
            stopScanner();
        }
    }, [handleVerify, stopScanner]);

    useEffect(() => {
        return () => stopScanner();
    }, [stopScanner]);

    const validTicket = isValidTicket(result);
    const verifyStatus = getVerifyStatus(result);
    const verifyStatusLabel = getVerifyStatusLabel(result);
    const routeLabel = result?.departureStation && result?.arrivalStation
        ? `${result.departureStation} -> ${result.arrivalStation}`
        : '';
    const detailRows = [
        ['Trạng thái', verifyStatusLabel || result?.ticketStatus],
        ['Tàu', result?.trainCode],
        ['Tuyến', routeLabel],
        ['Ghế', result?.seatNumber],
        ['Toa', [result?.carriageNumber, result?.carriageTypeName].filter(Boolean).join(' ')],
        ['Hành khách', result?.passengerName],
        ['CCCD/CMND', result?.passengerIdCard],
        ['Khởi hành', formatDateTime(result?.departureTime)],
        ['Đến nơi', formatDateTime(result?.arrivalTime)],
        ['Mã đặt chỗ', result?.bookingId ? `#${result.bookingId}` : ''],
        ['Mã vé', result?.ticketId ? `#${result.ticketId}` : ''],
    ].filter(([, value]) => Boolean(value));

    return (
        <main className="min-h-screen bg-[#FDFDFD] flex flex-col">
            <Helmet>
                <title>Xác minh vé QR - Vé Tàu Việt Nam</title>
                <meta name="description" content="Trang quét và xác minh vé QR cho nhân viên và quản trị viên" />
            </Helmet>
            <Header />

            <section className="pt-44 pb-20 flex-1">
                <div className="max-w-7xl mx-auto px-6 md:px-12">
                    <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-8 mb-10">
                        <div className="space-y-4">
                            <span className="inline-flex items-center gap-2 bg-red-50 px-4 py-2 rounded-full text-[10px] font-black text-tet-red uppercase tracking-widest">
                                <ShieldCheck size={14} /> Nhân viên / Quản trị
                            </span>
                            <h1 className="text-4xl md:text-5xl font-black text-gray-900 tracking-tight">Quét vé QR</h1>
                            <p className="text-gray-500 font-bold max-w-xl">
                                Quét QR trên vé hoặc dán qrToken bắt đầu bằng VETAU để xác minh vé.
                            </p>
                        </div>

                        <div className="flex items-center gap-3">
                            <button
                                type="button"
                                onClick={scannerState === 'scanning' ? stopScanner : startScanner}
                                className={cn(
                                    'inline-flex items-center gap-2 px-5 py-3 rounded-xl text-xs font-black uppercase tracking-widest transition-all',
                                    scannerState === 'scanning'
                                        ? 'bg-red-50 text-tet-red hover:bg-red-100'
                                        : 'bg-gray-900 text-white hover:bg-black'
                                )}
                            >
                                {scannerState === 'scanning' ? <CameraOff size={16} /> : <Camera size={16} />}
                                {scannerState === 'scanning' ? 'Tắt camera' : 'Mở camera'}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    setQrToken('');
                                    setResult(null);
                                    setVerifyError('');
                                    setScannerError('');
                                    lastScannedRef.current = '';
                                }}
                                className="w-12 h-12 rounded-xl bg-white border border-gray-100 text-gray-500 flex items-center justify-center hover:text-gray-900 hover:bg-gray-50 transition-all"
                                aria-label="Reset"
                            >
                                <RotateCw size={18} />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-[1.05fr_0.95fr] gap-8">
                        <div className="bg-white border border-gray-100 rounded-[2rem] p-5 md:p-6 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.22)]">
                            <div className="aspect-[4/3] rounded-[1.5rem] bg-gray-950 overflow-hidden relative flex items-center justify-center">
                                <video
                                    ref={videoRef}
                                    className={cn('w-full h-full object-cover', scannerState !== 'scanning' && 'hidden')}
                                    muted
                                    playsInline
                                />

                                {scannerState !== 'scanning' && (
                                    <div className="text-center px-8">
                                        <div className="w-20 h-20 rounded-3xl bg-white/10 flex items-center justify-center mx-auto mb-5">
                                            <ScanLine size={38} className="text-white" />
                                        </div>
                                        <p className="text-sm font-black text-white uppercase tracking-widest mb-2">Camera QR</p>
                                        <p className="text-xs font-bold text-white/50 max-w-sm">
                                            Dùng nút Mở camera để quét trực tiếp, hoặc dùng ô nhập token bên dưới.
                                        </p>
                                    </div>
                                )}

                                {scannerState === 'scanning' && (
                                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                                        <div className="w-56 h-56 border-2 border-white rounded-3xl shadow-[0_0_0_999px_rgba(0,0,0,0.22)]" />
                                    </div>
                                )}
                            </div>

                            {scannerError && (
                                <div className="mt-4 rounded-xl border border-red-100 bg-red-50 px-4 py-3 text-sm font-bold text-red-700 flex items-start gap-2">
                                    <AlertCircle size={18} className="mt-0.5 shrink-0" />
                                    <span>{scannerError}</span>
                                </div>
                            )}

                            <form
                                className="mt-5 space-y-4"
                                onSubmit={(event) => {
                                    event.preventDefault();
                                    handleVerify();
                                }}
                            >
                                <label className="block">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">QR token</span>
                                    <textarea
                                        value={qrToken}
                                        onChange={(event) => setQrToken(event.target.value)}
                                        rows={4}
                                        placeholder="VETAU1..."
                                        className="mt-2 w-full resize-none rounded-2xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm font-bold text-gray-900 outline-none transition-all focus:border-tet-red focus:bg-white focus:ring-4 focus:ring-tet-red/5"
                                    />
                                </label>

                                <button
                                    type="submit"
                                    disabled={isSubmitting || !qrToken.trim()}
                                    className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-tet-red px-5 py-4 text-xs font-black uppercase tracking-widest text-white transition-all hover:bg-red-700 disabled:opacity-60 disabled:hover:bg-tet-red"
                                >
                                    {isSubmitting ? <LoaderCircle size={18} className="animate-spin" /> : <ClipboardCheck size={18} />}
                                    Xác minh vé
                                </button>
                            </form>
                        </div>

                        <div className="bg-white border border-gray-100 rounded-[2rem] p-6 md:p-8 shadow-[0_18px_50px_-30px_rgba(0,0,0,0.22)] min-h-[420px]">
                            {!result && !verifyError ? (
                                <div className="h-full flex flex-col items-center justify-center text-center py-16">
                                    <div className="w-20 h-20 rounded-3xl bg-gray-50 flex items-center justify-center mb-5">
                                        <QrCode size={38} className="text-gray-300" />
                                    </div>
                                    <p className="text-lg font-black text-gray-900 mb-2">Chờ mã QR</p>
                                    <p className="text-sm font-bold text-gray-400 max-w-sm">
                                        Kết quả xác minh sẽ hiển thị tại đây sau khi nhân viên hoặc quản trị viên quét QR.
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className={cn(
                                        'rounded-2xl px-5 py-4 border flex items-start gap-3',
                                        validTicket
                                            ? 'bg-green-50 border-green-100 text-green-700'
                                            : 'bg-red-50 border-red-100 text-red-700'
                                    )}>
                                        {validTicket ? <CheckCircle2 size={24} className="shrink-0 mt-0.5" /> : <XCircle size={24} className="shrink-0 mt-0.5" />}
                                        <div>
                                            <p className="text-sm font-black uppercase tracking-widest">
                                                {validTicket ? 'VÉ HỢP LỆ' : verifyStatusLabel || 'XÁC MINH THẤT BẠI'}
                                            </p>
                                            <p className="text-sm font-bold opacity-80 mt-1">
                                                {getVerifyMessage(result, verifyError, validTicket)}
                                            </p>
                                        </div>
                                    </div>

                                    {detailRows.length > 0 && (
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                            {detailRows.map(([label, value]) => (
                                                <div key={label} className="rounded-2xl bg-gray-50 border border-gray-100 p-4">
                                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">{label}</p>
                                                    <p className="text-sm font-black text-gray-900 break-words">{String(value)}</p>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {result && (
                                        <details className="rounded-2xl bg-gray-950 text-white overflow-hidden">
                                            <summary className="px-4 py-3 text-xs font-black uppercase tracking-widest cursor-pointer flex items-center gap-2">
                                                <Train size={16} /> Phản hồi gốc
                                            </summary>
                                            <pre className="px-4 pb-4 overflow-x-auto text-xs text-white/75">
                                                {JSON.stringify(result, null, 2)}
                                            </pre>
                                        </details>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
};

export default TicketQrVerify;
