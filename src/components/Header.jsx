import React, { useState, useEffect, useRef } from 'react';
import { Menu, X, Train, User, ChevronRight, Languages, Check, Bell, Plane, Hotel, TrainFront, Bus, Car, Ticket, MoreHorizontal, LogIn, ScanLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../store/useAuthStore';
import { authApi } from '../api/auth.api';
import { notificationApi } from '../api/notification.api';
import { useNotificationSocket } from '../hooks/useNotificationSocket';
import { LogOut, Settings, LayoutDashboard } from 'lucide-react';

const Header = () => {
    const { t, i18n } = useTranslation();
    const location = useLocation();
    const navigate = useNavigate();
    const [isScrolled, setIsScrolled] = useState(false);
    const isLightHeader = isScrolled || location.pathname !== '/';
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [isLangOpen, setIsLangOpen] = useState(false);
    const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
    const [isNotificationOpen, setIsNotificationOpen] = useState(false);
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const langRef = useRef(null);
    const userMenuRef = useRef(null);
    const notificationRef = useRef(null);

    const { user, isAuthenticated, logout, fetchUser } = useAuthStore();
    const canVerifyTickets = user?.roles?.some((role) => ['STAFF', 'ADMIN'].includes(String(role).toUpperCase()));

    const userDisplayName = user?.name || user?.email?.split('@')[0] || 'Tài khoản';
    const fallbackInitial = user?.name
        ? user.name.charAt(0).toUpperCase()
        : (user?.email ? user.email.charAt(0).toUpperCase() : null);

    const currentLang = i18n.language.includes('en') ? 'EN' : 'VI';

    const renderUserAvatar = (sizeClass = 'w-8 h-8', textClass = 'text-base', iconSize = 18) => {
        if (user?.imageUrl) {
            return (
                <img
                    src={user.imageUrl}
                    alt={userDisplayName}
                    className={cn(sizeClass, 'rounded-full object-cover shadow-md')}
                />
            );
        }

        return (
            <div className={cn(
                sizeClass,
                'rounded-full bg-gradient-to-br from-tet-red to-red-600 flex items-center justify-center text-white font-bold shadow-md'
            )}>
                {fallbackInitial ? <span className={textClass}>{fallbackInitial}</span> : <User size={iconSize} />}
            </div>
        );
    };

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 20);
        };
        const handleClickOutside = (event) => {
            if (langRef.current && !langRef.current.contains(event.target)) {
                setIsLangOpen(false);
            }
            if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
                setIsUserMenuOpen(false);
            }
            if (notificationRef.current && !notificationRef.current.contains(event.target)) {
                setIsNotificationOpen(false);
            }
        };
        window.addEventListener('scroll', handleScroll);
        window.addEventListener('mousedown', handleClickOutside);

        // Fetch user profile if token exists but user info is missing
        if (isAuthenticated && (!user || !user.id)) {
            fetchUser();
        }

        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isAuthenticated, user, fetchUser]);

    useEffect(() => {
        if (!isAuthenticated || !user?.id) {
            setNotifications([]);
            setUnreadCount(0);
            return;
        }

        let active = true;
        const loadNotifications = async () => {
            try {
                const [items, count] = await Promise.all([
                    notificationApi.getNotifications(),
                    notificationApi.getUnreadCount(),
                ]);
                if (!active) return;
                const unread = typeof count === 'number' ? count : (count?.count ?? count?.unreadCount ?? 0);
                setNotifications(Array.isArray(items) ? items.slice(0, 8) : []);
                setUnreadCount(Number(unread) || 0);
            } catch (error) {
                console.error('Failed to load notifications:', error);
            }
        };

        loadNotifications();

        return () => {
            active = false;
        };
    }, [isAuthenticated, user?.id]);

    const getNotificationId = (notification) => notification.notificationId ?? notification.id;
    const isNotificationRead = (notification) => Boolean(notification.read ?? notification.isRead);

    useNotificationSocket(isAuthenticated ? user?.id : undefined, (notification) => {
        const notificationId = getNotificationId(notification);
        setNotifications(prev => {
            const withoutDuplicate = notificationId
                ? prev.filter(item => getNotificationId(item) !== notificationId)
                : prev;
            return [notification, ...withoutDuplicate].slice(0, 8);
        });
        if (!isNotificationRead(notification)) {
            setUnreadCount(count => count + 1);
        }
    });

    const handleNotificationClick = async (notification) => {
        const notificationId = getNotificationId(notification);
        if (notificationId && !isNotificationRead(notification)) {
            setNotifications(prev => prev.map(item => (
                getNotificationId(item) === notificationId ? { ...item, read: true, isRead: true } : item
            )));
            setUnreadCount(count => Math.max(0, count - 1));
            try {
                await notificationApi.markAsRead(notificationId);
            } catch (error) {
                console.error('Failed to mark notification as read:', error);
            }
        }

        setIsNotificationOpen(false);
        const bookingId = notification.bookingId ?? notification.referenceId;
        navigate(bookingId ? `/orders?bookingId=${bookingId}` : '/orders');
    };

    const handleMarkAllNotificationsRead = async () => {
        setNotifications(prev => prev.map(item => ({ ...item, read: true, isRead: true })));
        setUnreadCount(0);
        try {
            await notificationApi.markAllAsRead();
        } catch (error) {
            console.error('Failed to mark notifications as read:', error);
        }
    };

    const changeLanguage = (lng) => {
        i18n.changeLanguage(lng);
        setIsLangOpen(false);
    };

    const topNavLinks = [
        { name: t('header.promotions'), href: '/promotions', icon: <div className="w-5 h-5 flex items-center justify-center bg-tet-yellow rounded-full text-[10px] text-red-700 font-bold">%</div> },
        { name: t('header.explore'), href: '/explore' },
        { name: t('header.contact'), href: '#' },
        { name: t('header.my_bookings'), href: '/orders' },
        ...(canVerifyTickets ? [{ name: 'Quét QR', href: '/staff/verify-qr', icon: <ScanLine size={16} /> }] : []),
    ];

    const bottomNavLinks = [
        { name: t('header.train_se_tn'), icon: <Train size={18} />, href: '#' },
        { name: t('header.train_tet'), icon: <TrainFront size={18} className="text-tet-red" />, href: '#' },
        { name: t('header.schedule'), icon: <Bus size={18} />, href: '/schedules' },
        { name: t('header.promotions'), icon: <Ticket size={18} />, href: '/promotions' },
        ...(canVerifyTickets ? [{ name: 'Quét QR', icon: <ScanLine size={18} />, href: '/staff/verify-qr' }] : []),
        { name: t('header.support'), icon: <MoreHorizontal size={18} />, href: '#' },
    ];

    return (
        <header
            className={cn(
                "fixed top-0 left-0 right-0 z-[100] transition-all duration-500",
                isLightHeader ? "bg-white shadow-md text-gray-800" : "bg-gradient-to-b from-black/50 to-transparent text-white"
            )}
        >
            <div className="max-w-7xl mx-auto">
                {/* Top Bar */}
                <div className="flex items-center justify-between px-4 md:px-6 py-2 md:py-3 border-b border-white/10">
                    <div className="flex items-center gap-8">
                        {/* Logo Section */}
                        <Link to="/" className="flex items-center gap-1.5 md:gap-2 group shrink-0">
                            <div className="w-7 h-7 md:w-8 md:h-8 bg-gradient-to-br from-tet-red to-red-600 rounded-lg md:rounded-xl flex items-center justify-center shadow-lg transform group-hover:rotate-12 transition-transform duration-500">
                                <Train className="text-white" size={16} />
                            </div>
                            <div className="flex flex-col">
                                <span className={cn(
                                    "text-base md:text-lg font-black tracking-tighter leading-none transition-colors",
                                    isLightHeader ? "text-gray-900" : "text-white"
                                )}>
                                    VÉ <span className="text-tet-red group-hover:text-tet-yellow transition-colors">TÀU</span>
                                </span>
                                <span className={cn(
                                    "text-[6px] md:text-[7px] font-bold uppercase tracking-[0.2em] md:tracking-[0.25em] transition-opacity mt-0.5",
                                    isLightHeader ? "text-gray-400" : "text-white/60"
                                )}>{t('header.online_booking')}</span>
                            </div>
                        </Link>

                        {/* Top Nav (Desktop) */}
                        <nav className="hidden xl:flex items-center gap-6">
                            <div className="relative" ref={langRef}>
                                <button
                                    onClick={() => setIsLangOpen(!isLangOpen)}
                                    className={cn(
                                        "flex items-center gap-2 px-2 py-0.5 rounded border text-[11px] font-bold transition-colors cursor-pointer",
                                        isLightHeader ? "bg-gray-100 border-gray-200 hover:bg-gray-200" : "bg-white/10 border-white/20 hover:bg-white/20"
                                    )}
                                >
                                    <img
                                        src={currentLang === 'VI' ? "https://flagcdn.com/w40/vn.png" : "https://flagcdn.com/w40/us.png"}
                                        alt={currentLang}
                                        className="w-4 h-3 object-cover rounded-xs"
                                    />
                                    <span>VND | {currentLang}</span>
                                </button>

                                <AnimatePresence>
                                    {isLangOpen && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 10 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            exit={{ opacity: 0, y: 10 }}
                                            className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl shadow-black/10 border border-gray-100 py-2 hidden xl:block z-50 overflow-hidden"
                                        >
                                            <button
                                                onClick={() => changeLanguage('vi')}
                                                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between group transition-colors cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <img src="https://flagcdn.com/w40/vn.png" alt="VN" className="w-6 h-4 object-cover rounded shadow-sm" />
                                                    <span className="text-sm font-bold text-gray-800 group-hover:text-tet-red transition-colors">Tiếng Việt</span>
                                                </div>
                                                {currentLang === 'VI' && <Check size={16} className="text-tet-red" />}
                                            </button>
                                            <button
                                                onClick={() => changeLanguage('en')}
                                                className="w-full text-left px-4 py-3 hover:bg-gray-50 flex items-center justify-between group transition-colors cursor-pointer"
                                            >
                                                <div className="flex items-center gap-3">
                                                    <img src="https://flagcdn.com/w40/us.png" alt="EN" className="w-6 h-4 object-cover rounded shadow-sm" />
                                                    <span className="text-sm font-bold text-gray-800 group-hover:text-tet-red transition-colors">English</span>
                                                </div>
                                                {currentLang === 'EN' && <Check size={16} className="text-tet-red" />}
                                            </button>
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>
                            {topNavLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    to={link.href}
                                    className="text-[13px] font-bold hover:text-tet-red transition-colors flex items-center gap-2"
                                >
                                    {link.icon}
                                    {link.name}
                                </Link>
                            ))}
                        </nav>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-3">
                            {isAuthenticated ? (
                                <>
                                <div className="relative" ref={notificationRef}>
                                    <button
                                        onClick={() => setIsNotificationOpen(!isNotificationOpen)}
                                        className={cn(
                                            "relative w-10 h-10 rounded-full flex items-center justify-center transition-all",
                                            isLightHeader ? "bg-gray-100 hover:bg-gray-200 text-gray-700" : "bg-white/10 hover:bg-white/20 text-white"
                                        )}
                                        aria-label="Thông báo"
                                    >
                                        <Bell size={18} />
                                        {unreadCount > 0 && (
                                            <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full bg-tet-red text-white text-[10px] font-black flex items-center justify-center border-2 border-white">
                                                {unreadCount > 9 ? '9+' : unreadCount}
                                            </span>
                                        )}
                                    </button>

                                    <AnimatePresence>
                                        {isNotificationOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                className="absolute top-full right-0 mt-2 w-96 max-w-[calc(100vw-2rem)] bg-white rounded-2xl shadow-2xl shadow-black/10 border border-gray-100 z-50 overflow-hidden text-gray-800"
                                            >
                                                <div className="px-4 py-3 border-b border-gray-50 flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="text-xs font-black text-gray-900">Thông báo</p>
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{unreadCount} chưa đọc</p>
                                                    </div>
                                                    {unreadCount > 0 && (
                                                        <button
                                                            onClick={handleMarkAllNotificationsRead}
                                                            className="text-[10px] font-black text-tet-red uppercase tracking-widest"
                                                        >
                                                            Đã đọc tất cả
                                                        </button>
                                                    )}
                                                </div>

                                                <div className="max-h-[420px] overflow-y-auto">
                                                    {notifications.length === 0 ? (
                                                        <div className="px-6 py-10 text-center">
                                                            <Bell size={28} className="text-gray-200 mx-auto mb-3" />
                                                            <p className="text-xs font-bold text-gray-400">Chưa có thông báo</p>
                                                        </div>
                                                    ) : (
                                                        notifications.map((notification, index) => {
                                                            const notificationId = getNotificationId(notification) ?? index;
                                                            const read = isNotificationRead(notification);
                                                            return (
                                                                <button
                                                                    key={notificationId}
                                                                    onClick={() => handleNotificationClick(notification)}
                                                                    className={cn(
                                                                        "w-full text-left px-4 py-3 border-b border-gray-50 last:border-b-0 hover:bg-gray-50 transition-all",
                                                                        !read && "bg-red-50/40"
                                                                    )}
                                                                >
                                                                    <div className="flex items-start gap-3">
                                                                        <span className={cn("mt-1 w-2 h-2 rounded-full shrink-0", read ? "bg-gray-200" : "bg-tet-red")} />
                                                                        <div className="min-w-0 flex-1">
                                                                            <p className="text-sm font-black text-gray-900 truncate">{notification.title}</p>
                                                                            <p className="text-xs font-bold text-gray-500 line-clamp-2 mt-0.5">{notification.content}</p>
                                                                            {notification.createdAt && (
                                                                                <p className="text-[10px] font-bold text-gray-300 mt-2">
                                                                                    {new Date(notification.createdAt).toLocaleString()}
                                                                                </p>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })
                                                    )}
                                                </div>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                <div className="relative" ref={userMenuRef}>
                                    <button
                                        onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                                        className={cn(
                                            "flex items-center gap-3 p-1 pr-4 rounded-full transition-all cursor-pointer",
                                            isLightHeader ? "bg-gray-100 hover:bg-gray-200" : "bg-white/10 hover:bg-white/20"
                                        )}
                                    >
                                        {renderUserAvatar()}
                                        <div className="text-left hidden lg:block">
                                            <p className="text-[12px] font-black leading-none mb-0.5">{userDisplayName}</p>
                                            <p className={cn(
                                                "text-[10px] font-bold opacity-60 leading-none",
                                                isLightHeader ? "text-gray-500" : "text-white"
                                            )}>Thành viên</p>
                                        </div>
                                    </button>

                                    <AnimatePresence>
                                        {isUserMenuOpen && (
                                            <motion.div
                                                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                                                className="absolute top-full right-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl shadow-black/10 border border-gray-100 py-2 z-50 overflow-hidden text-gray-800"
                                            >
                                                <div className="px-4 py-3 border-b border-gray-50 mb-1">
                                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Đang đăng nhập</p>
                                                    <p className="text-sm font-black text-gray-900 truncate">{user?.email}</p>
                                                </div>
                                                
                                                <Link to="/profile" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-tet-red transition-all">
                                                    <Settings size={16} />
                                                    {t('header.profile')}
                                                </Link>
                                                <Link to="/orders" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-tet-red transition-all">
                                                    <Ticket size={16} />
                                                    {t('header.my_bookings')}
                                                </Link>
                                                {canVerifyTickets && (
                                                    <Link to="/staff/verify-qr" onClick={() => setIsUserMenuOpen(false)} className="flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-gray-700 hover:bg-gray-50 hover:text-tet-red transition-all">
                                                        <ScanLine size={16} />
                                                        Quet ve QR
                                                    </Link>
                                                )}
                                                
                                                <div className="h-px bg-gray-50 my-1" />
                                                
                                                <button
                                                    onClick={() => {
                                                        logout();
                                                        setIsUserMenuOpen(false);
                                                    }}
                                                    className="w-full flex items-center gap-3 px-4 py-2.5 text-sm font-bold text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                                                >
                                                    <LogOut size={16} />
                                                    {t('header.logout')}
                                                </button>
                                            </motion.div>
                                        )}
                                    </AnimatePresence>
                                </div>
                                </>
                            ) : (
                                <>
                                    <Link
                                        to="/login"
                                        className={cn(
                                            "flex items-center gap-2 px-4 py-2 rounded-lg font-bold text-[14px] transition-all",
                                            isLightHeader
                                                ? "bg-white border border-gray-200 text-gray-800 hover:bg-gray-50"
                                                : "bg-white/10 hover:bg-white/20 text-white border border-white/20 shadow-sm"
                                        )}
                                    >
                                        <User size={16} />
                                        <span>{t('header.login')}</span>
                                    </Link>
                                    <Link
                                        to="/register"
                                        className="bg-tet-red hover:bg-red-700 text-white px-5 py-2 rounded-lg font-bold text-[14px] shadow-lg shadow-tet-red/20 transition-all"
                                    >
                                        {t('header.register')}
                                    </Link>
                                </>
                            )}
                        </div>

                        {/* Mobile Menu Toggle */}
                        <button
                            className="xl:hidden p-2 rounded-lg"
                            onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
                        >
                            {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
                        </button>
                    </div>
                </div>

                {/* Bottom Bar (Desktop Categories) */}
                <div className="hidden xl:flex items-center gap-8 px-6 py-2 overflow-x-auto scrollbar-hide">
                    {bottomNavLinks.map((link) => (
                        <Link
                            key={link.name}
                            to={link.href}
                            className={cn(
                                "flex items-center gap-2 text-[13px] font-bold py-2 border-b-2 border-transparent hover:border-tet-red hover:text-tet-red transition-all whitespace-nowrap opacity-90 hover:opacity-100",
                                isLightHeader ? "text-gray-600" : "text-white"
                            )}
                        >
                            {link.icon}
                            {link.name}
                        </Link>
                    ))}
                </div>
            </div>

            {/* Mobile Menu Overlay */}
            <AnimatePresence>
                {isMobileMenuOpen && (
                    <motion.div
                        initial={{ opacity: 0, x: '100%' }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: '100%' }}
                        className="fixed inset-0 bg-white z-[110] p-6 text-gray-800"
                    >
                        <div className="flex justify-between items-center mb-8">
                            <Link to="/" className="flex items-center gap-1.5 group" onClick={() => setIsMobileMenuOpen(false)}>
                                <div className="w-8 h-8 bg-gradient-to-br from-tet-red to-red-600 rounded-xl flex items-center justify-center shadow-lg">
                                    <Train className="text-white" size={16} />
                                </div>
                                <span className="text-lg font-black tracking-tighter text-gray-900">
                                    VÉ <span className="text-tet-red">TÀU</span>
                                </span>
                            </Link>
                            <button onClick={() => setIsMobileMenuOpen(false)}>
                                <X size={24} />
                            </button>
                        </div>
                        <nav className="flex flex-col gap-4">
                            <div className="grid grid-cols-1 gap-3">
                                {isAuthenticated ? (
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                                            {renderUserAvatar('w-12 h-12', 'text-lg', 24)}
                                            <div className="flex-1 overflow-hidden">
                                                <p className="text-base font-black text-gray-900 truncate">{userDisplayName}</p>
                                                <p className="text-xs font-bold text-gray-400 truncate">{user?.email}</p>
                                            </div>
                                        </div>
                                        <div className="grid grid-cols-3 gap-3">
                                            <Link
                                                to="/profile"
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className="bg-white p-4 rounded-xl flex flex-col items-center gap-2 border border-gray-100 hover:bg-gray-50 transition-all active:scale-95"
                                            >
                                                <Settings size={20} className="text-gray-400" />
                                                <span className="font-bold text-[11px] uppercase tracking-widest">{t('header.profile')}</span>
                                            </Link>
                                            <Link
                                                to="/orders"
                                                onClick={() => setIsMobileMenuOpen(false)}
                                                className="bg-white p-4 rounded-xl flex flex-col items-center gap-2 border border-gray-100 hover:bg-gray-50 transition-all active:scale-95"
                                            >
                                                <Ticket size={20} className="text-gray-400" />
                                                <span className="font-bold text-[11px] uppercase tracking-widest">{t('header.my_bookings')}</span>
                                            </Link>
                                            {canVerifyTickets && (
                                                <Link
                                                    to="/staff/verify-qr"
                                                    onClick={() => setIsMobileMenuOpen(false)}
                                                    className="bg-white p-4 rounded-xl flex flex-col items-center gap-2 border border-gray-100 hover:bg-gray-50 transition-all active:scale-95"
                                                >
                                                    <ScanLine size={20} className="text-gray-400" />
                                                    <span className="font-bold text-[11px] uppercase tracking-widest">Quet QR</span>
                                                </Link>
                                            )}
                                            <button
                                                onClick={() => {
                                                    setIsMobileMenuOpen(false);
                                                    navigate('/orders');
                                                }}
                                                className="bg-white p-4 rounded-xl flex flex-col items-center gap-2 border border-gray-100 hover:bg-gray-50 transition-all active:scale-95 relative"
                                            >
                                                <Bell size={20} className="text-gray-400" />
                                                {unreadCount > 0 && (
                                                    <span className="absolute top-2 right-2 min-w-5 h-5 px-1 rounded-full bg-tet-red text-white text-[10px] font-black flex items-center justify-center">
                                                        {unreadCount > 9 ? '9+' : unreadCount}
                                                    </span>
                                                )}
                                                <span className="font-bold text-[11px] uppercase tracking-widest">Thông báo</span>
                                            </button>
                                        </div>
                                        <button
                                            onClick={() => {
                                                logout();
                                                setIsMobileMenuOpen(false);
                                            }}
                                            className="w-full bg-red-50 text-red-600 p-4 rounded-xl flex items-center justify-center gap-3 font-black text-sm transition-all active:scale-95"
                                        >
                                            <LogOut size={20} />
                                            {t('header.logout')}
                                        </button>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-2 gap-3">
                                        <Link
                                            to="/login"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="bg-gray-50 p-4 rounded-xl flex flex-col items-center gap-2 border border-gray-100 hover:bg-gray-100 transition-colors"
                                        >
                                            <User size={24} className="text-tet-red" />
                                            <span className="font-bold text-sm">{t('header.login')}</span>
                                        </Link>
                                        <Link
                                            to="/register"
                                            onClick={() => setIsMobileMenuOpen(false)}
                                            className="bg-tet-red text-white p-4 rounded-xl flex flex-col items-center gap-2 shadow-lg shadow-tet-red/20 hover:bg-red-700 transition-colors"
                                        >
                                            <LogIn size={24} />
                                            <span className="font-bold text-sm">{t('header.register')}</span>
                                        </Link>
                                    </div>
                                )}
                            </div>
                            <div className="h-px bg-gray-100 my-2" />
                            {bottomNavLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    to={link.href}
                                    className="flex items-center gap-4 p-3 font-bold hover:text-tet-red hover:bg-red-50 rounded-xl transition-all"
                                    onClick={() => setIsMobileMenuOpen(false)}
                                >
                                    {link.icon}
                                    <span>{link.name}</span>
                                </Link>
                            ))}
                        </nav>
                    </motion.div>
                )}
            </AnimatePresence>
        </header>
    );
};

export default Header;
