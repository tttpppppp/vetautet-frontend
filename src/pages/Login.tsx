import React, { useMemo, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Train, Mail, Lock, ArrowRight, Github, ChevronLeft, AlertCircle, ShieldCheck, Sparkles, RotateCw } from 'lucide-react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { authApi } from '../api/auth.api';
import { useAuthStore } from '../store/useAuthStore';
import { getAuthResponseCode, resolveAuthMessage } from '../utils/authMessage';
import GoogleLoginButton from '../components/GoogleLoginButton';

const OTP_LENGTH = 6;

const maskEmail = (email: string) => {
    const [localPart, domain = ''] = String(email || '').split('@');
    if (!localPart) return email;
    if (localPart.length <= 6) return `${localPart.slice(0, 2)}***@${domain}`;
    return `${localPart.slice(0, 4)}***${localPart.slice(-2)}@${domain}`;
};

const Login: React.FC = () => {
    const { t } = useTranslation();
    const loginStore = useAuthStore();
    const navigate = useNavigate();
    const location = useLocation();

    const initialMessage = typeof location.state?.message === 'string' ? location.state.message : null;
    const initialEmail = typeof location.state?.email === 'string' ? location.state.email : '';

    const [loginError, setLoginError] = useState<string | null>(initialMessage);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [verificationEmail, setVerificationEmail] = useState(initialEmail);
    const [verifyError, setVerifyError] = useState<string | null>(null);
    const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
    const [isResending, setIsResending] = useState(false);
    const [otpDigits, setOtpDigits] = useState<string[]>(Array(OTP_LENGTH).fill(''));
    const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

    const loginSchema = yup.object({
        email: yup.string().email(t('login.validation.email_invalid')).required(t('login.validation.email_required')),
        password: yup.string().min(6, t('login.validation.password_min')).required(t('login.validation.password_required')),
    }).required();

    const { register, handleSubmit, getValues, formState: { errors } } = useForm({
        defaultValues: {
            email: initialEmail,
            password: '',
        },
        resolver: yupResolver(loginSchema)
    });

    const otpValue = useMemo(() => otpDigits.join(''), [otpDigits]);
    const maskedEmail = useMemo(() => maskEmail(verificationEmail), [verificationEmail]);

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

    const onSubmit = async (data: any) => {
        setIsSubmitting(true);
        setLoginError(null);
        setVerifyError(null);

        try {
            const res = await authApi.login({
                email: data.email,
                password: data.password
            });
            loginStore.login(res);
            navigate('/');
        } catch (err: any) {
            const errorCode = getAuthResponseCode(err.response?.data);
            const errorMessage = resolveAuthMessage(
                t,
                err.response?.data,
                err.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.'
            );
            setLoginError(errorMessage);

            if (errorCode === 'LOGIN_REQUIRES_EMAIL_VERIFICATION') {
                setVerificationEmail(data.email);
                setOtpDigits(Array(OTP_LENGTH).fill(''));
                setVerifyMessage(null);
                setShowVerifyModal(true);
            }
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleVerifyOtp = async () => {
        if (otpValue.length !== OTP_LENGTH) {
            setVerifyError('Vui lòng nhập đủ 6 số OTP.');
            return;
        }

        setIsSubmitting(true);
        setVerifyError(null);
        setVerifyMessage(null);
        try {
            const res = await authApi.verifyEmail({
                email: verificationEmail,
                otp: otpValue,
            });
            setShowVerifyModal(false);
            setLoginError(resolveAuthMessage(t, res, 'Xác thực email thành công. Vui lòng đăng nhập lại.'));
        } catch (err: any) {
            const errorMessage = resolveAuthMessage(
                t,
                err.response?.data,
                err.message || 'Xác thực OTP thất bại.'
            );
            setVerifyError(errorMessage);
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleResendOtp = async () => {
        if (!verificationEmail) return;
        setIsResending(true);
        setVerifyError(null);
        setVerifyMessage(null);
        try {
            await authApi.resendVerificationOtp({ email: verificationEmail });
            setOtpDigits(Array(OTP_LENGTH).fill(''));
            setVerifyMessage(resolveAuthMessage(t, { code: 'OTP_RESENT' }, `Đã gửi lại OTP tới ${verificationEmail}`));
            focusOtpIndex(0);
        } catch (err: any) {
            const errorMessage = resolveAuthMessage(
                t,
                err.response?.data,
                err.message || 'Gửi lại OTP thất bại.'
            );
            setVerifyError(errorMessage);
        } finally {
            setIsResending(false);
        }
    };

    return (
        <div className="min-h-screen w-full flex items-center justify-center relative overflow-hidden bg-[#fafafa]">
            <Helmet>
                <title>{t('login.seo_title')}</title>
                <meta name="description" content={t('login.seo_desc')} />
            </Helmet>

            <div className="absolute inset-0 z-0 pointer-events-none">
                <div className="absolute top-[-10%] left-[-5%] w-[50%] h-[50%] bg-tet-red/[0.04] rounded-full blur-[120px] animate-pulse" />
                <div className="absolute bottom-[-10%] right-[-5%] w-[50%] h-[50%] bg-tet-yellow/[0.04] rounded-full blur-[120px]" />
                <div className="absolute inset-0 bg-[url('https://images.unsplash.com/photo-1474487024260-327706241864?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center opacity-[0.03] grayscale mix-blend-multiply" />
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:40px_40px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,#000_70%,transparent_100%)]" />
            </div>

            <nav className="absolute top-0 left-0 w-full p-8 z-50 flex justify-between items-center">
                <motion.button
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    onClick={() => navigate('/')}
                    className="flex items-center gap-2 text-gray-500 hover:text-gray-900 transition-all font-bold group bg-white/50 backdrop-blur-md px-4 py-2 rounded-full border border-gray-100 shadow-sm"
                >
                    <ChevronLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
                    <span>{t('login.back_to_home')}</span>
                </motion.button>
            </nav>

            <div className="container max-w-5xl mx-auto px-4 relative z-10">
                <div className="flex flex-col lg:flex-row items-center gap-10 lg:gap-16">
                    <div className="hidden lg:block lg:w-1/2 space-y-8">
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                        >
                            <div className="inline-flex items-center gap-2.5 mb-6 bg-white/80 backdrop-blur-md p-1.5 pr-5 rounded-xl shadow-sm border border-gray-50">
                                <div className="w-10 h-10 bg-tet-red rounded-lg flex items-center justify-center shadow-lg shadow-tet-red/20">
                                    <Train className="text-white" size={20} />
                                </div>
                                <div>
                                    <span className="block text-[9px] font-black text-tet-red uppercase tracking-[0.2em] leading-none mb-1">Vận tải cao cấp</span>
                                    <h1 className="text-lg font-black text-gray-900 tracking-tighter leading-none">Vé Tàu Việt Nam</h1>
                                </div>
                            </div>

                            <h2 className="text-4xl md:text-5xl font-black text-gray-900 leading-[1.1] mb-6 tracking-tight">
                                {t('login.branding.title')} <br />
                                <span className="text-transparent bg-clip-text bg-gradient-to-r from-tet-red via-[#ff4d4d] to-tet-red bg-[length:200%_auto] animate-gradient whitespace-nowrap">
                                    {t('login.branding.highlight')}
                                </span>
                            </h2>

                            <p className="text-base text-gray-500 font-medium leading-relaxed max-w-sm mb-8">
                                {t('login.branding.desc')}
                            </p>

                            <div className="flex items-center gap-4">
                                <div className="flex -space-x-2.5">
                                    {[1, 2, 3, 4].map((i) => (
                                        <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-gray-200 overflow-hidden ring-2 ring-gray-50">
                                            <img src={`https://i.pravatar.cc/100?img=${i + 10}`} alt="Người dùng" />
                                        </div>
                                    ))}
                                    <div className="w-8 h-8 rounded-full border-2 border-white bg-tet-red flex items-center justify-center text-[9px] font-bold text-white ring-2 ring-gray-50">
                                        +2k
                                    </div>
                                </div>
                                <div className="text-xs font-bold text-gray-400">
                                    <span className="text-gray-900">10,000+</span> hành khách hôm nay
                                </div>
                            </div>
                        </motion.div>

                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 0.4, duration: 0.8 }}
                            className="grid grid-cols-3 gap-6 pt-8 border-t border-gray-100"
                        >
                            <div className="space-y-0.5">
                                <p className="text-xl font-black text-gray-900">1M+</p>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('login.branding.stats.passengers')}</p>
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-xl font-black text-gray-900">99.9%</p>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('login.branding.stats.satisfied')}</p>
                            </div>
                            <div className="space-y-0.5">
                                <p className="text-xl font-black text-gray-900">24/7</p>
                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{t('login.branding.stats.support')}</p>
                            </div>
                        </motion.div>
                    </div>

                    <motion.div
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.6, delay: 0.1 }}
                        className="w-full lg:w-[440px]"
                    >
                        <div
                            className={cn(
                                "bg-white border border-gray-100 p-7 md:p-10 rounded-[2rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.06)] relative overflow-hidden group/card",
                                showVerifyModal && "opacity-40 pointer-events-none blur-[1px] select-none"
                            )}
                        >
                            <div className="absolute -top-20 -right-20 w-40 h-40 bg-tet-red/5 rounded-full blur-3xl group-hover/card:bg-tet-red/10 transition-colors duration-700" />

                            <div className="mb-8 relative h-[72px]">
                                <h3 className="text-2xl md:text-3xl font-black text-gray-900 tracking-tight mb-1">
                                    {t('login.form.title')}
                                </h3>
                                <AnimatePresence mode="wait">
                                    {loginError ? (
                                        <motion.p
                                            key="error"
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: 10 }}
                                            className="text-sm text-tet-red font-bold flex items-center gap-2"
                                        >
                                            <AlertCircle size={14} /> {loginError}
                                        </motion.p>
                                    ) : (
                                        <motion.p
                                            key="subtitle"
                                            initial={{ opacity: 0 }}
                                            animate={{ opacity: 1 }}
                                            className="text-sm text-gray-500 font-medium flex items-center gap-2"
                                        >
                                            <Sparkles size={14} className="text-tet-yellow" />
                                            {t('login.form.subtitle')}
                                        </motion.p>
                                    )}
                                </AnimatePresence>
                            </div>

                            <form className="space-y-5" onSubmit={handleSubmit(onSubmit)}>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest px-1">
                                        {t('login.form.email_label')}
                                    </label>
                                    <div className="relative group/input">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-tet-red transition-colors">
                                            <Mail size={18} />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="ten@example.com"
                                            {...register('email')}
                                            className={cn(
                                                "w-full bg-gray-50/50 border border-gray-200 rounded-xl py-3.5 pl-12 pr-5 text-gray-900 placeholder:text-gray-400 outline-none focus:border-tet-red focus:bg-white focus:ring-4 focus:ring-tet-red/5 transition-all font-bold text-sm",
                                                errors.email && "border-red-300 bg-red-50/10 focus:ring-red-500/5"
                                            )}
                                        />
                                    </div>
                                    {errors.email && (
                                        <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-red-500 text-[9px] font-black px-1 flex items-center gap-1">
                                            <AlertCircle size={9} /> {errors.email.message}
                                        </motion.p>
                                    )}
                                </div>

                                <div className="space-y-1.5">
                                    <div className="flex justify-between items-center px-1">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                                            {t('login.form.password_label')}
                                        </label>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/forgot-password', { state: { email: getValues('email') } })}
                                            className="text-[9px] font-black text-tet-red hover:text-tet-red-dark transition-colors uppercase tracking-widest"
                                        >
                                            {t('login.form.forgot_password')}
                                        </button>
                                    </div>
                                    <div className="relative group/input">
                                        <div className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 group-focus-within/input:text-tet-red transition-colors">
                                            <Lock size={18} />
                                        </div>
                                        <input
                                            type="password"
                                            placeholder="********"
                                            {...register('password')}
                                            className={cn(
                                                "w-full bg-gray-50/50 border border-gray-200 rounded-xl py-3.5 pl-12 pr-5 text-gray-900 placeholder:text-gray-400 outline-none focus:border-tet-red focus:bg-white focus:ring-4 focus:ring-tet-red/5 transition-all font-bold text-sm",
                                                errors.password && "border-red-300 bg-red-50/10 focus:ring-red-500/5"
                                            )}
                                        />
                                    </div>
                                    {errors.password && (
                                        <motion.p initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="text-red-500 text-[9px] font-black px-1 flex items-center gap-1">
                                            <AlertCircle size={9} /> {errors.password.message}
                                        </motion.p>
                                    )}
                                </div>

                                <button
                                    disabled={isSubmitting}
                                    className="w-full bg-tet-red hover:bg-tet-red-dark text-white font-black py-3.5 rounded-xl shadow-lg shadow-tet-red/20 transition-all flex items-center justify-center gap-2.5 group relative overflow-hidden disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
                                    <span className="relative z-10 flex items-center gap-2">
                                        {isSubmitting ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : (
                                            <>
                                                {t('login.form.submit')}
                                                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                            </>
                                        )}
                                    </span>
                                </button>
                            </form>

                            <div className="mt-8">
                                <div className="relative flex items-center justify-center mb-6">
                                    <div className="border-t border-gray-100 w-full" />
                                    <span className="bg-white px-3 text-[9px] font-black text-gray-400 uppercase tracking-[0.2em] absolute">
                                        {t('login.form.or_continue')}
                                    </span>
                                </div>

                                <div className="space-y-3">
                                    <GoogleLoginButton />
                                    <button className="flex min-h-[46px] w-full items-center justify-center gap-2 bg-white border border-gray-200 hover:bg-gray-50 hover:border-gray-300 py-3 rounded-xl transition-all group shadow-sm active:scale-[0.98]">
                                        <Github size={18} className="text-gray-400 group-hover:text-gray-900 transition-colors" />
                                        <span className="text-xs font-bold text-gray-600">Đăng nhập bằng GitHub</span>
                                    </button>
                                </div>
                            </div>

                            <div className="mt-8 pt-6 border-t border-gray-50 flex flex-col items-center gap-3">
                                <p className="text-center text-gray-500 font-bold text-xs">
                                    {t('login.form.no_account')}{' '}
                                    <Link
                                        to="/register"
                                        className="text-tet-red hover:text-tet-red-dark font-black underline decoration-2 underline-offset-4 decoration-tet-red/20 transition-all"
                                    >
                                        {t('login.form.register_now')}
                                    </Link>
                                </p>

                                <div className="flex items-center gap-1.5 text-[9px] font-black text-gray-400 uppercase tracking-widest">
                                    <ShieldCheck size={10} className="text-green-500" />
                                    Xác thực bảo mật
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </div>

            <div className="absolute bottom-8 left-0 w-full text-center pointer-events-none opacity-40">
                <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.3em]">
                    © 2026 Vé Tàu Việt Nam • Bảo lưu mọi quyền
                </p>
            </div>

            {showVerifyModal && (
                <div className="fixed inset-0 z-[70] flex items-center justify-center px-4">
                    <div className="absolute inset-0 bg-gray-950/45 backdrop-blur-[3px]" />
                    <motion.div
                        initial={{ opacity: 0, y: 24, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        className="relative w-full max-w-xl rounded-[2rem] border border-white/60 bg-white shadow-[0_30px_90px_rgba(15,23,42,0.20)] overflow-hidden"
                    >
                        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-tet-red via-[#ff8357] to-tet-yellow" />
                        <div className="p-8 md:p-10">
                            <div className="flex items-start justify-between gap-4 mb-8">
                                <div className="flex items-start gap-4">
                                    <div className="w-14 h-14 rounded-2xl bg-red-50 text-tet-red flex items-center justify-center shadow-inner">
                                        <ShieldCheck size={28} />
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-tet-red mb-2">Xác thực email</p>
                                        <h3 className="text-3xl font-black text-gray-900 leading-tight">Nhập mã OTP để kích hoạt tài khoản</h3>
                                        <p className="mt-3 text-sm text-gray-500 font-medium leading-relaxed">
                                            Mã xác thực 6 số vừa được gửi tới <span className="text-gray-900 font-bold">{maskedEmail}</span>.
                                        </p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setShowVerifyModal(false)}
                                    className="text-sm font-bold text-gray-400 hover:text-gray-700 transition-colors"
                                >
                                    Đóng
                                </button>
                            </div>

                            {verifyError && (
                                <div className="mb-5 p-4 bg-red-50 border border-red-100 rounded-2xl flex items-center gap-3 text-tet-red">
                                    <AlertCircle size={18} className="shrink-0" />
                                    <p className="text-xs font-bold leading-tight">{verifyError}</p>
                                </div>
                            )}

                            {verifyMessage && (
                                <div className="mb-5 p-4 bg-green-50 border border-green-100 rounded-2xl text-green-700">
                                    <p className="text-xs font-bold leading-tight">{verifyMessage}</p>
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
                                    Bạn có thể gõ từng ô hoặc paste cả mã OTP vào bất kỳ ô nào.
                                </p>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
                                <button
                                    type="button"
                                    onClick={handleVerifyOtp}
                                    disabled={isSubmitting || otpValue.length !== OTP_LENGTH}
                                    className="w-full bg-tet-red hover:bg-tet-red-dark text-white font-black py-4 rounded-2xl shadow-xl shadow-tet-red/20 transition-all flex items-center justify-center gap-2 group transform active:scale-[0.98] disabled:opacity-70 disabled:cursor-not-allowed"
                                >
                                    {isSubmitting ? (
                                        <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    ) : (
                                        <>
                                            Xác thực email <ArrowRight size={20} className="group-hover:translate-x-1 transition-transform" />
                                        </>
                                    )}
                                </button>

                                <button
                                    type="button"
                                    onClick={handleResendOtp}
                                    disabled={isResending}
                                    className="inline-flex items-center justify-center gap-2 px-5 py-4 rounded-2xl border border-gray-200 bg-white text-sm font-bold text-gray-700 hover:border-tet-red hover:text-tet-red transition-colors disabled:opacity-60"
                                >
                                    <RotateCw size={16} className={cn(isResending && 'animate-spin')} />
                                    Gửi lại OTP
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
};

export default Login;
