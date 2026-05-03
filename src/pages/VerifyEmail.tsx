import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight, ChevronLeft, RotateCw, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { cn } from '@/lib/utils';
import { authApi } from '../api/auth.api';

const OTP_LENGTH = 6;

const maskEmail = (email: string) => {
    const [localPart, domain = ''] = String(email || '').split('@');
    if (!localPart) return email;
    if (localPart.length <= 6) return `${localPart.slice(0, 2)}***@${domain}`;
    return `${localPart.slice(0, 4)}***${localPart.slice(-2)}@${domain}`;
};

const VerifyEmail: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [searchParams] = useSearchParams();
    const email = searchParams.get('email') || '';
    const initialMessage = typeof location.state?.message === 'string' ? location.state.message : null;
    const emailAlreadyRegistered = !!location.state?.emailAlreadyRegistered;

    const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(initialMessage);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    const otpValue = useMemo(() => otpDigits.join(''), [otpDigits]);
    const maskedEmail = useMemo(() => maskEmail(email), [email]);

    const focusOtpIndex = (index: number) => {
        otpRefs.current[index]?.focus();
        otpRefs.current[index]?.select();
    };

    const applyOtp = (value: string, startIndex = 0) => {
        const normalized = value.replace(/\D/g, '').slice(0, OTP_LENGTH);
        if (!normalized) return;

        const nextDigits = [...otpDigits];
        normalized.split('').forEach((digit, offset) => {
            const targetIndex = startIndex + offset;
            if (targetIndex < OTP_LENGTH) nextDigits[targetIndex] = digit;
        });
        setOtpDigits(nextDigits);
        focusOtpIndex(Math.min(startIndex + normalized.length, OTP_LENGTH - 1));
    };

    const handleOtpChange = (index: number, rawValue: string) => {
        const normalized = rawValue.replace(/\D/g, '');
        if (!normalized) {
            const nextDigits = [...otpDigits];
            nextDigits[index] = '';
            setOtpDigits(nextDigits);
            return;
        }

        if (normalized.length > 1) {
            applyOtp(normalized, index);
            return;
        }

        const nextDigits = [...otpDigits];
        nextDigits[index] = normalized;
        setOtpDigits(nextDigits);
        if (index < OTP_LENGTH - 1) focusOtpIndex(index + 1);
    };

    const handleOtpKeyDown = (index: number, event: React.KeyboardEvent<HTMLInputElement>) => {
        if (event.key === 'Backspace' && !otpDigits[index] && index > 0) {
            focusOtpIndex(index - 1);
        }
        if (event.key === 'ArrowLeft' && index > 0) {
            event.preventDefault();
            focusOtpIndex(index - 1);
        }
        if (event.key === 'ArrowRight' && index < OTP_LENGTH - 1) {
            event.preventDefault();
            focusOtpIndex(index + 1);
        }
    };

    const handleOtpPaste = (index: number, event: React.ClipboardEvent<HTMLInputElement>) => {
        event.preventDefault();
        applyOtp(event.clipboardData.getData('text'), index);
    };

    const handleVerify = async () => {
        if (!email) {
            setError('Khong tim thay email can xac thuc.');
            return;
        }
        if (otpValue.length !== OTP_LENGTH) {
            setError('Vui long nhap du 6 so OTP.');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setMessage(null);
        try {
            const res = await authApi.verifyEmail({ email, otp: otpValue });
            navigate('/login', {
                state: {
                    email: res.email,
                    message: res.message || 'Xac thuc email thanh cong. Vui long dang nhap.',
                },
            });
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || 'OTP verification failed.';
            setError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResend = async () => {
        if (!email) {
            setError('Khong tim thay email can xac thuc.');
            return;
        }

        setIsResending(true);
        setError(null);
        setMessage(null);
        try {
            await authApi.resendVerificationOtp({ email });
            setOtpDigits(Array(OTP_LENGTH).fill(''));
            setMessage(`Da gui lai OTP toi ${email}`);
            focusOtpIndex(0);
        } catch (err: any) {
            const errorMessage = err.response?.data?.message || err.message || 'Resend OTP failed.';
            setError(errorMessage);
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#fafafa] relative overflow-hidden flex items-center justify-center px-4">
            <Helmet>
                <title>Verify email - Ve Tau Viet Nam</title>
            </Helmet>

            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-tet-red/[0.05] rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] bg-tet-yellow/[0.05] rounded-full blur-[120px]" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
            </div>

            <button
                onClick={() => navigate('/register')}
                className="absolute top-8 left-8 z-20 flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-bold group"
            >
                <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                Quay lai dang ky
            </button>

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="relative z-10 w-full max-w-xl rounded-[2rem] border border-white/60 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.12)] overflow-hidden"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-tet-red via-[#ff8357] to-tet-yellow" />
                <div className="p-8 md:p-10">
                    <div className="flex items-start gap-4 mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-red-50 text-tet-red flex items-center justify-center shadow-inner">
                            <ShieldCheck size={28} />
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-tet-red mb-2">Email verification</p>
                            <h1 className="text-3xl font-black text-gray-900 leading-tight">Nhap ma OTP de kich hoat tai khoan</h1>
                            <p className="mt-3 text-sm text-gray-500 font-medium leading-relaxed">
                                Ma xac thuc 6 so da duoc gui toi <span className="text-gray-900 font-bold">{maskedEmail || 'email dang ky'}</span>.
                            </p>
                            {emailAlreadyRegistered && (
                                <p className="mt-2 text-xs font-bold text-amber-600">
                                    Email nay da dang ky nhung chua xac thuc. Vui long nhap OTP moi nhat.
                                </p>
                            )}
                        </div>
                    </div>

                    {error && (
                        <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-tet-red">
                            <AlertCircle size={18} className="shrink-0" />
                            <p className="text-xs font-bold leading-tight">{error}</p>
                        </div>
                    )}

                    {message && (
                        <div className="mb-5 p-4 bg-green-50 border border-green-100 rounded-2xl text-green-700">
                            <p className="text-xs font-bold leading-tight">{message}</p>
                        </div>
                    )}

                    <div className="rounded-[1.75rem] border border-gray-100 bg-gray-50/70 p-5 mb-6">
                        <div className="flex items-center justify-between gap-3 mb-4">
                            {otpDigits.map((digit, index) => (
                                <input
                                    key={index}
                                    ref={(element) => {
                                        otpRefs.current[index] = element;
                                    }}
                                    type="text"
                                    inputMode="numeric"
                                    autoComplete={index === 0 ? 'one-time-code' : 'off'}
                                    maxLength={OTP_LENGTH}
                                    value={digit}
                                    onChange={(event) => handleOtpChange(index, event.target.value)}
                                    onKeyDown={(event) => handleOtpKeyDown(index, event)}
                                    onPaste={(event) => handleOtpPaste(index, event)}
                                    className="w-12 h-14 md:w-14 md:h-16 rounded-2xl border border-gray-200 bg-white text-center text-2xl font-black text-gray-900 outline-none focus:border-tet-red focus:ring-4 focus:ring-tet-red/5 transition-all shadow-sm"
                                />
                            ))}
                        </div>
                        <p className="text-xs font-bold text-gray-500 leading-relaxed">
                            Ban co the go tung o hoac paste ca ma OTP vao bat ky o nao.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                        <button
                            type="button"
                            onClick={handleVerify}
                            disabled={isSubmitting || otpValue.length !== OTP_LENGTH}
                            className="w-full bg-tet-red hover:bg-tet-red-dark text-white font-black py-4 rounded-2xl shadow-xl shadow-tet-red/20 transition-all flex items-center justify-center gap-2 group transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                                <>
                                    Verify email <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>

                        <button
                            type="button"
                            onClick={handleResend}
                            disabled={isResending}
                            className="inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:border-tet-red hover:text-tet-red transition-colors disabled:opacity-60"
                        >
                            <RotateCw size={16} className={cn(isResending && 'animate-spin')} />
                            Gui lai OTP
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
};

export default VerifyEmail;
