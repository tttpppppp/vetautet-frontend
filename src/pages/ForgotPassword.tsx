import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { AlertCircle, ArrowRight, ChevronLeft, KeyRound, Lock, Mail, RotateCw, ShieldCheck } from 'lucide-react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Helmet } from 'react-helmet-async';
import { cn } from '@/lib/utils';
import { authApi } from '../api/auth.api';

const OTP_LENGTH = 6;

const ERROR_MESSAGES: Record<string, string> = {
    EMAIL_NOT_REGISTERED: 'Email này chưa được đăng ký tài khoản.',
    INVALID_OR_EXPIRED_OTP: 'Mã OTP không hợp lệ hoặc đã hết hạn.',
    OTP_ALREADY_USED: 'Mã OTP này đã được sử dụng.',
    EXPIRED_OTP: 'Mã OTP đã hết hạn. Vui lòng gửi lại OTP.',
    INVALID_OTP: 'Mã OTP không chính xác.',
};

const normalizeError = (err: any, fallback: string) => {
    const responseData = err?.response?.data;
    const code = responseData?.code || responseData?.message || responseData?.error;
    if (typeof code === 'string' && ERROR_MESSAGES[code]) return ERROR_MESSAGES[code];

    const message = responseData?.message || err?.message;
    return typeof message === 'string' && message.trim() ? message : fallback;
};

const maskEmail = (email: string) => {
    const [localPart, domain = ''] = String(email || '').split('@');
    if (!localPart) return email;
    if (localPart.length <= 6) return `${localPart.slice(0, 2)}***@${domain}`;
    return `${localPart.slice(0, 4)}***${localPart.slice(-2)}@${domain}`;
};

const ForgotPassword: React.FC = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const initialEmail = typeof location.state?.email === 'string' ? location.state.email : '';

    const [step, setStep] = useState<'request' | 'reset'>('request');
    const [email, setEmail] = useState(initialEmail);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const [message, setMessage] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [otpExpiresAt, setOtpExpiresAt] = useState<string | null>(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
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
        if (event.key === 'Backspace' && !otpDigits[index] && index > 0) focusOtpIndex(index - 1);
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

    const handleRequestOtp = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (!email.trim()) {
            setError('Vui lòng nhập email tài khoản.');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setMessage(null);
        try {
            const res = await authApi.requestPasswordReset({ email: email.trim() });
            setEmail(res.email);
            setOtpExpiresAt(res.otpExpiresAt);
            setOtpDigits(Array(OTP_LENGTH).fill(''));
            setStep('reset');
            setMessage('Mã OTP đặt lại mật khẩu đã được gửi tới email của bạn.');
            window.setTimeout(() => focusOtpIndex(0), 80);
        } catch (err: any) {
            setError(normalizeError(err, 'Không thể gửi OTP đặt lại mật khẩu.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResetPassword = async (event?: React.FormEvent) => {
        event?.preventDefault();
        if (otpValue.length !== OTP_LENGTH) {
            setError('Vui lòng nhập đủ 6 số OTP.');
            return;
        }
        if (newPassword.length < 6) {
            setError('Mật khẩu mới cần tối thiểu 6 ký tự.');
            return;
        }
        if (newPassword !== confirmPassword) {
            setError('Mật khẩu xác nhận không khớp.');
            return;
        }

        setIsSubmitting(true);
        setError(null);
        setMessage(null);
        try {
            const res = await authApi.resetPassword({
                email: email.trim(),
                otp: otpValue,
                newPassword,
            });
            navigate('/login', {
                state: {
                    email: res.email,
                    message: 'Đặt lại mật khẩu thành công. Vui lòng đăng nhập bằng mật khẩu mới.',
                },
            });
        } catch (err: any) {
            setError(normalizeError(err, 'Đặt lại mật khẩu thất bại.'));
        } finally {
            setIsSubmitting(false);
        }
    };

    const expiryLabel = otpExpiresAt
        ? new Date(otpExpiresAt).toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit' })
        : null;

    return (
        <div className="min-h-screen bg-[#fafafa] relative overflow-hidden flex items-center justify-center px-4 py-10">
            <Helmet>
                <title>Quên mật khẩu - Vé Tàu Việt Nam</title>
            </Helmet>

            <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-5%] w-[45%] h-[45%] bg-tet-red/[0.05] rounded-full blur-[120px]" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[45%] h-[45%] bg-tet-yellow/[0.05] rounded-full blur-[120px]" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px]" />
            </div>

            <button
                onClick={() => navigate('/login', { state: { email } })}
                className="absolute top-6 left-6 z-20 flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-colors font-bold group rounded-full border border-gray-100 bg-white/70 px-4 py-2 shadow-sm backdrop-blur-md"
            >
                <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
                Quay lại đăng nhập
            </button>

            <motion.div
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                className="relative z-10 w-full max-w-xl rounded-[2rem] border border-white/60 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.12)] overflow-hidden"
            >
                <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-tet-red via-[#ff8357] to-tet-yellow" />
                <div className="p-7 md:p-10">
                    <div className="flex items-start gap-4 mb-8">
                        <div className="w-14 h-14 rounded-2xl bg-red-50 text-tet-red flex items-center justify-center shadow-inner">
                            {step === 'request' ? <Mail size={28} /> : <KeyRound size={28} />}
                        </div>
                        <div>
                            <p className="text-[10px] font-black uppercase tracking-[0.24em] text-tet-red mb-2">Bảo mật tài khoản</p>
                            <h1 className="text-3xl font-black text-gray-900 leading-tight">
                                {step === 'request' ? 'Đặt lại mật khẩu' : 'Nhập OTP và mật khẩu mới'}
                            </h1>
                            <p className="mt-3 text-sm text-gray-500 font-medium leading-relaxed">
                                {step === 'request'
                                    ? 'Nhập email đã đăng ký để nhận mã OTP đặt lại mật khẩu.'
                                    : <>Mã OTP 6 số đã được gửi tới <span className="text-gray-900 font-bold">{maskedEmail}</span>.</>}
                            </p>
                            {expiryLabel && step === 'reset' && (
                                <p className="mt-2 text-xs font-black uppercase tracking-widest text-gray-400">
                                    OTP hết hạn lúc {expiryLabel}
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
                        <div className="mb-5 p-4 bg-green-50 border border-green-100 rounded-2xl text-green-700 flex items-center gap-3">
                            <ShieldCheck size={18} className="shrink-0" />
                            <p className="text-xs font-bold leading-tight">{message}</p>
                        </div>
                    )}

                    {step === 'request' ? (
                        <form className="space-y-5" onSubmit={handleRequestOtp}>
                            <label className="space-y-1.5 block">
                                <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Email</span>
                                <div className="relative group/input">
                                    <Mail size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-tet-red transition-colors" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(event) => setEmail(event.target.value)}
                                        placeholder="ten@example.com"
                                        className="w-full bg-gray-50/50 border border-gray-200 rounded-xl py-3.5 pl-12 pr-5 text-gray-900 placeholder:text-gray-400 outline-none focus:border-tet-red focus:bg-white focus:ring-4 focus:ring-tet-red/5 transition-all font-bold text-sm"
                                    />
                                </div>
                            </label>
                            <button
                                disabled={isSubmitting}
                                className="w-full bg-tet-red hover:bg-tet-red-dark text-white font-black py-4 rounded-2xl shadow-xl shadow-tet-red/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-70"
                            >
                                {isSubmitting ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>Gửi mã OTP <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" /></>
                                )}
                            </button>
                        </form>
                    ) : (
                        <form className="space-y-6" onSubmit={handleResetPassword}>
                            <div className="rounded-[1.75rem] border border-gray-100 bg-gray-50/70 p-5">
                                <div className="flex items-center justify-between gap-2 mb-4">
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
                                            className="w-11 h-14 md:w-14 md:h-16 rounded-2xl border border-gray-200 bg-white text-center text-2xl font-black text-gray-900 outline-none focus:border-tet-red focus:ring-4 focus:ring-tet-red/5 transition-all shadow-sm"
                                        />
                                    ))}
                                </div>
                                <button
                                    type="button"
                                    onClick={() => handleRequestOtp()}
                                    disabled={isSubmitting}
                                    className="inline-flex items-center gap-2 text-xs font-black uppercase tracking-widest text-tet-red hover:text-tet-red-dark disabled:opacity-60"
                                >
                                    <RotateCw size={14} className={cn(isSubmitting && 'animate-spin')} />
                                    Gửi lại OTP
                                </button>
                            </div>

                            <div className="grid gap-4">
                                <label className="space-y-1.5 block">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Mật khẩu mới</span>
                                    <div className="relative group/input">
                                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-tet-red transition-colors" />
                                        <input
                                            type="password"
                                            value={newPassword}
                                            onChange={(event) => setNewPassword(event.target.value)}
                                            placeholder="Tối thiểu 6 ký tự"
                                            className="w-full bg-gray-50/50 border border-gray-200 rounded-xl py-3.5 pl-12 pr-5 text-gray-900 placeholder:text-gray-400 outline-none focus:border-tet-red focus:bg-white focus:ring-4 focus:ring-tet-red/5 transition-all font-bold text-sm"
                                        />
                                    </div>
                                </label>
                                <label className="space-y-1.5 block">
                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">Xác nhận mật khẩu</span>
                                    <div className="relative group/input">
                                        <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-tet-red transition-colors" />
                                        <input
                                            type="password"
                                            value={confirmPassword}
                                            onChange={(event) => setConfirmPassword(event.target.value)}
                                            placeholder="Nhập lại mật khẩu mới"
                                            className="w-full bg-gray-50/50 border border-gray-200 rounded-xl py-3.5 pl-12 pr-5 text-gray-900 placeholder:text-gray-400 outline-none focus:border-tet-red focus:bg-white focus:ring-4 focus:ring-tet-red/5 transition-all font-bold text-sm"
                                        />
                                    </div>
                                </label>
                            </div>

                            <button
                                disabled={isSubmitting || otpValue.length !== OTP_LENGTH}
                                className="w-full bg-tet-red hover:bg-tet-red-dark text-white font-black py-4 rounded-2xl shadow-xl shadow-tet-red/20 transition-all flex items-center justify-center gap-2 group disabled:opacity-70"
                            >
                                {isSubmitting ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>Đặt lại mật khẩu <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" /></>
                                )}
                            </button>
                        </form>
                    )}
                </div>
            </motion.div>
        </div>
    );
};

export default ForgotPassword;
