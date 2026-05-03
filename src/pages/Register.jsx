import React, { useMemo, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { Train, Mail, Lock, User, ArrowRight, Github, ChevronLeft, AlertCircle, Phone, ShieldCheck, RotateCw, MapPin } from 'lucide-react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { cn } from '@/lib/utils';
import { useTranslation } from 'react-i18next';
import { Helmet } from 'react-helmet-async';
import { authApi } from '../api/auth.api';
import { resolveAuthMessage } from '../utils/authMessage';
import GoogleLoginButton from '../components/GoogleLoginButton';

const OTP_LENGTH = 6;

const maskEmail = (email) => {
    const [localPart, domain = ''] = String(email || '').split('@');
    if (!localPart) return email;
    if (localPart.length <= 6) return `${localPart.slice(0, 2)}***@${domain}`;
    return `${localPart.slice(0, 4)}***${localPart.slice(-2)}@${domain}`;
};

const CompactField = React.forwardRef(({ icon: Icon, label, error, className, inputClassName, ...inputProps }, ref) => (
    <div className={cn("min-w-0", className)}>
        <div
            className={cn(
                "group/field rounded-lg border border-gray-200 bg-white px-3 py-2.5 transition-all focus-within:border-tet-red focus-within:ring-4 focus-within:ring-tet-red/5",
                error && "border-red-300 bg-red-50/30 focus-within:ring-red-500/5"
            )}
        >
            <label className="flex items-center gap-2 text-[11px] font-bold uppercase text-gray-500">
                <Icon
                    size={15}
                    className={cn(
                        "shrink-0 text-gray-400 transition-colors group-focus-within/field:text-tet-red",
                        error && "text-red-500"
                    )}
                />
                <span className="truncate">{label}</span>
            </label>
            <input
                {...inputProps}
                ref={ref}
                aria-invalid={!!error}
                className={cn(
                    "mt-1 block h-6 w-full min-w-0 bg-transparent text-sm font-semibold text-gray-900 outline-none placeholder:text-gray-400",
                    inputClassName
                )}
            />
        </div>
        {error && (
            <p className="mt-1 flex items-center gap-1 px-1 text-[10px] font-bold leading-tight text-red-500">
            <AlertCircle size={10} /> {error}
        </p>
    )}
    </div>
));

CompactField.displayName = 'CompactField';

const Register = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const [registerError, setRegisterError] = useState(null);
    const [verifyError, setVerifyError] = useState(null);
    const [verifyMessage, setVerifyMessage] = useState(null);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isResending, setIsResending] = useState(false);
    const [showVerifyModal, setShowVerifyModal] = useState(false);
    const [emailAlreadyRegistered, setEmailAlreadyRegistered] = useState(false);
    const [verificationEmail, setVerificationEmail] = useState('');
    const [otpDigits, setOtpDigits] = useState(Array(OTP_LENGTH).fill(''));
    const otpRefs = useRef([]);

    const registerSchema = yup.object({
        name: yup.string().required(t('register.validation.fullname_required')),
        email: yup.string().email(t('login.validation.email_invalid')).required(t('login.validation.email_required')),
        password: yup.string().min(6, t('login.validation.password_min')).required(t('login.validation.password_required')),
        phone: yup.string()
            .required(t('register.validation.phone_required'))
            .matches(/^(?:\+84|0)(?:3|5|7|8|9)\d{8}$/, t('register.validation.phone_invalid')),
        address: yup.string().trim().required(t('register.validation.address_required')),
    }).required();

    const { register, handleSubmit, formState: { errors } } = useForm({
        resolver: yupResolver(registerSchema)
    });

    const otpValue = useMemo(() => otpDigits.join(''), [otpDigits]);
    const maskedVerificationEmail = useMemo(() => maskEmail(verificationEmail), [verificationEmail]);

    const focusOtpIndex = (index) => {
        otpRefs.current[index]?.focus();
        otpRefs.current[index]?.select?.();
    };

    const applyOtp = (value, startIndex = 0) => {
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

    const handleOtpChange = (index, rawValue) => {
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

    const handleOtpKeyDown = (index, event) => {
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

    const handleOtpPaste = (index, event) => {
        event.preventDefault();
        applyOtp(event.clipboardData.getData('text'), index);
    };

    const onSubmit = async (data) => {
        setIsSubmitting(true);
        setRegisterError(null);

        try {
            const res = await authApi.register({
                name: data.name,
                email: data.email,
                password: data.password,
                phone: data.phone || undefined,
                address: data.address || undefined,
            });

            if (res.requiresEmailVerification) {
                setVerificationEmail(res.email);
                setEmailAlreadyRegistered(!!res.emailAlreadyRegistered);
                setOtpDigits(Array(OTP_LENGTH).fill(''));
                setVerifyError(null);
                setVerifyMessage(resolveAuthMessage(t, res, `Mã OTP đã được gửi tới ${res.email}`));
                setShowVerifyModal(true);
                focusOtpIndex(0);
                return;
            }

            navigate('/login', {
                state: {
                    email: res.email,
                    message: 'Đăng ký thành công. Vui lòng đăng nhập.',
                },
            });
        } catch (err) {
            const errorMessage = resolveAuthMessage(
                t,
                err.response?.data,
                err.message || 'Đăng ký thất bại. Vui lòng kiểm tra lại thông tin.'
            );
            setRegisterError(errorMessage);
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
            navigate('/login', {
                state: {
                    email: res.email,
                    message: resolveAuthMessage(t, res, 'Xác thực email thành công. Vui lòng đăng nhập.'),
                },
            });
        } catch (err) {
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
        } catch (err) {
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
        <div className="relative min-h-screen w-full overflow-hidden bg-[#f7f8fb] px-4 py-5 text-gray-900 sm:px-6 lg:flex lg:items-center lg:justify-center">
            <Helmet>
                <title>{t('register.seo_title')}</title>
                <meta name="description" content={t('register.seo_desc')} />
            </Helmet>

            <div className="pointer-events-none absolute inset-0 z-0">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#d7dde814_1px,transparent_1px),linear-gradient(to_bottom,#d7dde814_1px,transparent_1px)] bg-[size:36px_36px]" />
                <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white to-transparent" />
            </div>

            <nav className="absolute left-0 top-0 z-50 flex w-full items-center justify-between px-4 py-4 sm:px-6 lg:px-8">
                <button
                    onClick={() => navigate('/')}
                    className="group inline-flex h-10 items-center gap-2 rounded-lg border border-gray-200 bg-white/90 px-3 text-sm font-bold text-gray-600 shadow-sm backdrop-blur transition-colors hover:border-gray-300 hover:text-gray-950"
                >
                    <ChevronLeft size={18} className="transition-transform group-hover:-translate-x-0.5" />
                    <span>{t('login.back_to_home')}</span>
                </button>
            </nav>

            <div className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-8 pt-16 lg:min-h-[680px] lg:flex-row lg:items-center lg:gap-12 lg:pt-0">
                <div className="hidden max-w-[470px] flex-1 lg:block">
                    <motion.div
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.6 }}
                    >
                        <div className="mb-6 inline-flex items-center gap-3">
                            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-tet-red shadow-lg shadow-tet-red/20">
                                <Train className="text-white" size={22} />
                            </div>
                            <div>
                                <p className="text-xs font-bold uppercase text-tet-red">Hệ thống tài khoản</p>
                                <h1 className="text-xl font-black text-gray-950">Vé Tàu Việt Nam</h1>
                            </div>
                        </div>
                        <h2 className="mb-4 max-w-md text-4xl font-black leading-[1.08] text-gray-950">
                            {t('login.branding.title')} <br />
                            <span className="text-tet-red">{t('login.branding.highlight')}</span>
                        </h2>
                        <p className="max-w-sm text-base font-medium leading-7 text-gray-500">
                            {t('login.branding.desc')}
                        </p>

                        <div className="mt-8 grid grid-cols-3 gap-4 border-y border-gray-200 py-5">
                            <div>
                                <p className="text-2xl font-black text-gray-950">24/7</p>
                                <p className="text-xs font-bold text-gray-500">Hỗ trợ</p>
                            </div>
                            <div>
                                <p className="text-2xl font-black text-gray-950">OTP</p>
                                <p className="text-xs font-bold text-gray-500">Xác thực email</p>
                            </div>
                            <div>
                                <p className="text-2xl font-black text-gray-950">SSL</p>
                                <p className="text-xs font-bold text-gray-500">Bảo mật</p>
                            </div>
                        </div>

                    </motion.div>
                </div>

                <motion.div
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5 }}
                    className="w-full lg:ml-auto lg:max-w-[640px]"
                >
                    <div
                        className={cn(
                            "relative overflow-hidden rounded-lg border border-gray-200 bg-white p-5 shadow-[0_24px_60px_-32px_rgba(15,23,42,0.45)] sm:p-6",
                            showVerifyModal && 'pointer-events-none select-none opacity-40 blur-[1px]'
                        )}
                    >
                        <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                            <div className="min-w-0">
                                <h3 className="text-2xl font-black text-gray-950 sm:text-3xl">
                                    {t('register.form.title')}
                                </h3>
                                <p className="mt-1 max-w-md text-sm font-medium leading-6 text-gray-500">
                                    {t('register.form.subtitle')}
                                </p>
                            </div>
                        </div>

                        {registerError && (
                            <div className="mb-4 flex items-center gap-3 rounded-lg border border-red-100 bg-red-50 p-3 text-tet-red">
                                <AlertCircle size={17} className="shrink-0" />
                                <p className="text-xs font-bold leading-tight">{registerError}</p>
                            </div>
                        )}

                        <form className="space-y-4" onSubmit={handleSubmit(onSubmit)}>
                            <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                                <CompactField
                                    icon={User}
                                    label={t('register.form.fullname_label')}
                                    type="text"
                                    placeholder="Trần Tiến Phúc"
                                    autoComplete="name"
                                    error={errors.name?.message}
                                    {...register('name')}
                                />
                                <CompactField
                                    icon={Phone}
                                    label={t('register.form.phone_label')}
                                    type="tel"
                                    inputMode="tel"
                                    placeholder="0900000000"
                                    autoComplete="tel"
                                    error={errors.phone?.message}
                                    {...register('phone')}
                                />
                                <CompactField
                                    icon={Mail}
                                    label={t('register.form.email_label')}
                                    type="email"
                                    placeholder="phuc@example.com"
                                    autoComplete="email"
                                    error={errors.email?.message}
                                    {...register('email')}
                                />
                                <CompactField
                                    icon={Lock}
                                    label={t('register.form.password_label')}
                                    type="password"
                                    placeholder="123456"
                                    autoComplete="new-password"
                                    error={errors.password?.message}
                                    {...register('password')}
                                />
                                <CompactField
                                    icon={MapPin}
                                    label={t('register.form.address_label')}
                                    type="text"
                                    placeholder="123 Lê Lợi, Quận 1, TP.HCM"
                                    autoComplete="street-address"
                                    className="md:col-span-2"
                                    error={errors.address?.message}
                                    {...register('address')}
                                />
                            </div>

                            <button
                                disabled={isSubmitting}
                                className="group flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-tet-red text-sm font-black text-white shadow-lg shadow-tet-red/20 transition-colors hover:bg-tet-red-dark disabled:cursor-not-allowed disabled:opacity-70"
                            >
                                {isSubmitting ? (
                                    <div className="h-4 w-4 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                                ) : (
                                    <>
                                        {t('register.form.submit')}
                                        <ArrowRight size={18} className="transition-transform group-hover:translate-x-1" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-5">
                            <div className="mb-3 flex items-center gap-3">
                                <div className="h-px flex-1 bg-gray-100" />
                                <span className="text-[11px] font-bold uppercase text-gray-400">{t('login.form.or_continue')}</span>
                                <div className="h-px flex-1 bg-gray-100" />
                            </div>

                            <div className="space-y-3">
                                <GoogleLoginButton />
                                <button className="group flex min-h-[46px] w-full items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-3 text-xs font-bold text-gray-600 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50 hover:text-gray-950 active:scale-[0.98]">
                                    <Github size={17} className="text-gray-400 transition-colors group-hover:text-gray-950" />
                                    <span>Đăng nhập bằng GitHub</span>
                                </button>
                            </div>
                        </div>

                        <div className="mt-5 flex flex-col gap-2 border-t border-gray-100 pt-4 text-xs font-bold text-gray-500 sm:flex-row sm:items-center sm:justify-between">
                            <p>
                                {t('register.form.has_account')}{' '}
                                <Link
                                    to="/login"
                                    className="font-black text-tet-red underline decoration-2 underline-offset-4 decoration-tet-red/20 transition-colors hover:text-tet-red-dark"
                                >
                                    {t('register.form.login_now')}
                                </Link>
                            </p>
                            <div className="inline-flex items-center gap-1.5 text-gray-400">
                                <ShieldCheck size={12} className="text-green-600" />
                                    <span>Luồng xác thực doanh nghiệp</span>
                            </div>
                        </div>
                    </div>
                </motion.div>
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
                                            Mã xác thực 6 số đã được gửi tới <span className="text-gray-900 font-bold">{maskedVerificationEmail}</span>.
                                        </p>
                                        {emailAlreadyRegistered && (
                                            <p className="mt-2 text-xs font-bold text-amber-600">
                                                Email này đã đăng ký nhưng chưa xác thực. Vui lòng nhập OTP mới nhất.
                                            </p>
                                        )}
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

export default Register;
