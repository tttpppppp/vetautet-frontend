import React, { useEffect, useState, useRef } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { motion, AnimatePresence } from 'framer-motion';
import {
    User, Mail, Phone, MapPin, Camera,
    Shield, Bell, CreditCard, ChevronRight,
    LogOut, Settings, Award, History,
    Train, Ticket, Globe, Edit3,
    CheckCircle2, ArrowRight, Zap, Loader2, X, Save
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth.api';
import { uploadApi } from '../api/upload.api';
import { useAuthStore } from '../store/useAuthStore';
import { useNavigate } from 'react-router-dom';

const Profile = () => {
    const { t } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isAuthenticated, logout: storeLogout, setUser } = useAuthStore();
    const fileInputRef = useRef(null);

    const [activeSection, setActiveSection] = useState('profile');
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', phone: '', address: '', nationality: '' });

    // Fetch user profile
    const { data: userInfo, isLoading } = useQuery({
        queryKey: ['profile'],
        queryFn: authApi.getMe,
        enabled: isAuthenticated,
        onSuccess: (data) => {
            setEditForm({
                name: data.name || '',
                phone: data.phone || '',
                address: data.address || '',
                nationality: data.nationality || '',
            });
        }
    });

    useEffect(() => {
        if (userInfo) {
            setUser(userInfo);
        }
    }, [setUser, userInfo]);

    // Upload avatar mutation
    const uploadMutation = useMutation({
        mutationFn: (file) => uploadApi.uploadImage(file, 'avatars'),
        onSuccess: async (res) => {
            await authApi.updateProfile({ imageUrl: res.imageUrl });
            queryClient.invalidateQueries({ queryKey: ['profile'] });
        },
    });

    // Update profile mutation
    const updateProfileMutation = useMutation({
        mutationFn: (data) => authApi.updateProfile(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] });
            setIsEditing(false);
        },
    });

    // Logout handler
    const handleLogout = async () => {
        try {
            await authApi.logout();
        } catch (_) { /* ignore */ }
        storeLogout();
        navigate('/');
    };

    const handleAvatarClick = () => fileInputRef.current?.click();

    const handleFileChange = (e) => {
        const file = e.target.files?.[0];
        if (file) uploadMutation.mutate(file);
    };

    const handleEditStart = () => {
        if (userInfo) {
            setEditForm({
                name: userInfo.name || '',
                phone: userInfo.phone || '',
                address: userInfo.address || '',
                nationality: userInfo.nationality || '',
            });
        }
        setIsEditing(true);
    };

    const handleSaveProfile = () => {
        updateProfileMutation.mutate(editForm);
    };

    const getRankLabel = (rank) => {
        const ranks = { BRONZE: 'Bronze', SILVER: 'Silver', GOLD: 'Gold', PLATINUM: 'Platinum', DIAMOND: 'Diamond' };
        return ranks[rank] || rank || 'Member';
    };

    const formatJoinDate = (dateStr) => {
        if (!dateStr) return '';
        const d = new Date(dateStr);
        return `${(d.getMonth() + 1).toString().padStart(2, '0')}/${d.getFullYear()}`;
    };

    if (!isAuthenticated) {
        navigate('/login');
        return null;
    }

    if (isLoading) {
        return (
            <main className="min-h-screen bg-[#F8F9FB] flex flex-col">
                <Header />
                <div className="flex-grow flex items-center justify-center">
                    <Train className="animate-spin text-tet-red" size={32} />
                </div>
                <Footer />
            </main>
        );
    }

    const sidebarItems = [
        { id: 'profile', icon: User, label: t('profile.sidebar.profile'), desc: t('profile.sidebar.profile_desc') },
        { id: 'orders', icon: Ticket, label: t('profile.sidebar.orders'), desc: t('profile.sidebar.orders_desc') },
        { id: 'security', icon: Shield, label: t('profile.sidebar.security'), desc: t('profile.sidebar.security_desc') },
        { id: 'notifications', icon: Bell, label: t('profile.sidebar.notifications'), desc: t('profile.sidebar.notifications_desc') },
        { id: 'payment', icon: CreditCard, label: t('profile.sidebar.payment'), desc: t('profile.sidebar.payment_desc') },
    ];

    const defaultAvatar = `https://ui-avatars.com/api/?name=${encodeURIComponent(userInfo?.name || 'U')}&background=D32F2F&color=fff&size=200&bold=true`;
    const avatarUrl = userInfo?.imageUrl || defaultAvatar;

    const profileFields = [
        { label: t('profile.labels.fullname'), value: userInfo?.name, icon: User, color: 'text-tet-red', key: 'name' },
        { label: t('profile.labels.email'), value: userInfo?.email, icon: Mail, color: 'text-blue-500' },
        { label: t('profile.labels.phone'), value: userInfo?.phone || '—', icon: Phone, color: 'text-green-500', key: 'phone' },
        { label: t('profile.labels.address'), value: userInfo?.address || '—', icon: MapPin, color: 'text-orange-500', key: 'address' },
        { label: t('profile.labels.join_date'), value: formatJoinDate(userInfo?.createdAt), icon: History, color: 'text-purple-500' },
        { label: t('profile.labels.nationality'), value: userInfo?.nationality || 'Vietnam', icon: Globe, color: 'text-cyan-500', key: 'nationality' },
    ];

    return (
        <main className="min-h-screen bg-[#F8F9FB] flex flex-col selection:bg-tet-red selection:text-white">
            <Helmet>
                <title>{t('profile.seo_title')}</title>
                <meta name="description" content={t('profile.seo_desc')} />
            </Helmet>
            <Header />

            {/* Hidden file input for avatar upload */}
            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

            {/* Premium Header/Cover */}
            <div className="relative pt-24 h-32 md:h-48 overflow-hidden transition-all duration-500">
                <div className="absolute inset-0 bg-gradient-to-br from-gray-900 via-red-950 to-black" />
                <div className="absolute inset-0 opacity-20 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]" />
                <div className="absolute bottom-0 left-0 w-full h-16 md:h-24 bg-gradient-to-t from-[#F8F9FB] to-transparent" />
                <div className="absolute top-8 md:top-16 left-5 md:left-10 w-24 md:w-48 h-24 md:h-48 bg-tet-red/20 rounded-full blur-[60px] md:blur-[80px] animate-pulse" />
                <div className="absolute bottom-8 md:bottom-16 right-5 md:right-10 w-32 md:w-64 h-32 md:h-64 bg-tet-yellow/10 rounded-full blur-[80px] md:blur-[100px] animate-pulse delay-700" />
            </div>

            <section className="-mt-4 md:-mt-16 pb-24 relative z-10">
                <div className="max-w-7xl mx-auto px-4 md:px-12">
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">

                        {/* LEFT: Profile Overview Card */}
                        <div className="lg:col-span-4 space-y-4">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="bg-white rounded-[1.5rem] md:rounded-[1.8rem] p-4 md:p-5 shadow-[0_15px_40px_rgba(0,0,0,0.04)] border border-white relative overflow-hidden group"
                            >
                                <div className="absolute top-0 right-0 w-20 md:w-24 h-20 md:h-24 bg-red-50/50 rounded-full -mr-10 md:-mr-12 -mt-10 md:-mt-12 group-hover:scale-110 transition-transform duration-700" />

                                <div className="relative flex flex-col items-center text-center">
                                    <div className="relative mb-3">
                                        <div className="w-16 h-16 md:w-20 md:h-20 rounded-[1.5rem] md:rounded-[1.8rem] overflow-hidden border-[3px] border-white shadow-xl relative">
                                            <img src={avatarUrl} className="w-full h-full object-cover" alt={userInfo?.name} />
                                            <div
                                                onClick={handleAvatarClick}
                                                className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-pointer"
                                            >
                                                {uploadMutation.isPending
                                                    ? <Loader2 className="text-white animate-spin" size={14} />
                                                    : <Camera className="text-white" size={14} />
                                                }
                                            </div>
                                        </div>
                                        <motion.div
                                            animate={{ scale: [1, 1.2, 1], rotate: [0, 10, 0] }}
                                            transition={{ duration: 4, repeat: Infinity }}
                                            className="absolute -bottom-1 -right-1 w-7 h-7 md:w-9 md:h-9 bg-tet-red rounded-lg md:rounded-xl flex items-center justify-center text-white shadow-lg border-[2px] md:border-[3px] border-white"
                                        >
                                            <Zap size={14} fill="currentColor" />
                                        </motion.div>
                                    </div>

                                    <h2 className="text-base md:text-lg font-black text-gray-900 mb-0.5 tracking-tight">{userInfo?.name}</h2>
                                    <div className="flex items-center gap-1.5 mb-4">
                                        <Award size={10} className="text-tet-red" />
                                        <span className="text-tet-red font-black text-[8px] md:text-[9px] uppercase tracking-[0.15em]">
                                            {getRankLabel(userInfo?.membershipRank)}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 w-full pt-3 border-t border-gray-50">
                                        <div className="p-2 md:p-2.5 bg-gray-50/50 rounded-lg md:rounded-xl">
                                            <p className="text-[7px] md:text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{t('profile.stats.points')}</p>
                                            <p className="text-sm md:text-base font-black text-gray-900">{userInfo?.rewardPoints || 0}</p>
                                        </div>
                                        <div className="p-2 md:p-2.5 bg-gray-50/50 rounded-lg md:rounded-xl">
                                            <p className="text-[7px] md:text-[8px] font-black text-gray-400 uppercase tracking-widest mb-0.5">{t('profile.stats.trips')}</p>
                                            <p className="text-sm md:text-base font-black text-gray-900">{userInfo?.tripsCount || 0}</p>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>

                            {/* Sidebar Menu */}
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="bg-white rounded-[1.5rem] md:rounded-[1.8rem] p-1.5 md:p-2.5 shadow-[0_15px_40px_rgba(0,0,0,0.04)] border border-white"
                            >
                                <nav className="flex lg:flex-col overflow-x-auto lg:overflow-x-visible no-scrollbar pb-1 md:pb-0 gap-1 md:gap-1">
                                    {sidebarItems.map(item => (
                                        <button
                                            key={item.id}
                                            onClick={() => setActiveSection(item.id)}
                                            className={cn(
                                                "flex-shrink-0 lg:w-full flex items-center gap-2 md:gap-3 p-2.5 md:p-3 rounded-lg md:rounded-xl transition-all relative group overflow-hidden",
                                                activeSection === item.id
                                                    ? "bg-gray-900 text-white shadow-lg shadow-gray-200"
                                                    : "text-gray-500 hover:bg-gray-50 bg-gray-50/30 lg:bg-transparent"
                                            )}
                                        >
                                            <div className={cn(
                                                "w-7 h-7 md:w-8 md:h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                                                activeSection === item.id ? "bg-white/10" : "bg-white group-hover:bg-gray-100"
                                            )}>
                                                <item.icon size={14} className={activeSection === item.id ? "text-tet-yellow" : "text-gray-400 group-hover:text-gray-900"} />
                                            </div>
                                            <div className="text-left">
                                                <p className="font-black text-[10px] md:text-xs whitespace-nowrap">{item.label}</p>
                                                <p className={cn("hidden md:block text-[8px] font-bold tracking-tight uppercase", activeSection === item.id ? "text-white/40" : "text-gray-300")}>{item.desc}</p>
                                            </div>
                                            {activeSection === item.id && (
                                                <motion.div layoutId="activePill" className="absolute bottom-0 left-0 right-0 h-0.5 lg:bottom-1/2 lg:translate-y-1/2 lg:right-3 lg:left-auto lg:w-1 lg:h-5 bg-tet-yellow rounded-full" />
                                            )}
                                        </button>
                                    ))}

                                    <div className="hidden lg:block pt-2 mt-2 border-t border-gray-50">
                                        <button onClick={handleLogout} className="w-full flex items-center gap-3 p-3 rounded-xl text-red-500 font-black hover:bg-red-50 transition-all">
                                            <div className="w-8 h-8 bg-red-50 rounded-lg flex items-center justify-center shrink-0">
                                                <LogOut size={16} />
                                            </div>
                                            <span className="text-xs">{t('profile.sidebar.logout')}</span>
                                        </button>
                                    </div>
                                </nav>
                            </motion.div>
                        </div>

                        {/* RIGHT: Main Content Area */}
                        <div className="lg:col-span-8 space-y-8">

                            {/* Feature Highlight Cards */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
                                    className="bg-white rounded-[1.8rem] p-5 border border-white shadow-sm hover:shadow-lg transition-all relative overflow-hidden group cursor-pointer">
                                    <div className="absolute inset-0 bg-gradient-to-br from-tet-red to-red-600 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className="relative z-10 flex items-center gap-4">
                                        <div className="w-10 h-10 bg-red-50 rounded-xl flex items-center justify-center text-tet-red group-hover:bg-white/20 group-hover:text-white transition-all">
                                            <Ticket size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-gray-900 group-hover:text-white text-sm transition-colors">{t('profile.features.active_tickets')}</h4>
                                            <p className="text-gray-400 group-hover:text-white/70 font-bold text-xs transition-colors">{t('profile.features.active_tickets_desc', { count: userInfo?.tripsCount || 0 })}</p>
                                        </div>
                                    </div>
                                </motion.div>

                                <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
                                    className="bg-white rounded-[1.8rem] p-5 border border-white shadow-sm hover:shadow-lg transition-all relative overflow-hidden group cursor-pointer">
                                    <div className="absolute inset-0 bg-gradient-to-br from-gray-900 to-black opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                                    <div className="relative z-10 flex items-center gap-4">
                                        <div className="w-10 h-10 bg-gray-50 rounded-xl flex items-center justify-center text-gray-900 group-hover:bg-white/20 group-hover:text-white transition-all">
                                            <Globe size={20} />
                                        </div>
                                        <div>
                                            <h4 className="font-black text-gray-900 group-hover:text-white text-sm transition-colors">{t('profile.features.membership')}</h4>
                                            <p className="text-gray-400 group-hover:text-white/70 font-bold text-xs transition-colors">{getRankLabel(userInfo?.membershipRank)} · {userInfo?.rewardPoints || 0} pts</p>
                                        </div>
                                    </div>
                                </motion.div>
                            </div>

                            {/* Section Details Card */}
                            <AnimatePresence mode="wait">
                                <motion.div
                                    key={activeSection}
                                    initial={{ opacity: 0, scale: 0.98 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.98 }}
                                    className="bg-white rounded-[2rem] p-6 md:p-8 border border-white shadow-xl shadow-gray-200/40"
                                >
                                    {activeSection === 'profile' && (
                                        <div className="space-y-8">
                                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-gray-50">
                                                <div>
                                                    <h3 className="text-2xl font-black text-gray-900 mb-0.5 tracking-tight">{t('profile.sections.identity.title')}</h3>
                                                    <p className="text-gray-400 font-bold text-xs max-w-sm">{t('profile.sections.identity.desc')}</p>
                                                </div>
                                                {isEditing ? (
                                                    <div className="flex gap-2">
                                                        <button onClick={() => setIsEditing(false)} className="flex items-center gap-2 bg-gray-100 text-gray-600 px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-gray-200 transition-all active:scale-95">
                                                            <X size={12} /> Hủy
                                                        </button>
                                                        <button
                                                            onClick={handleSaveProfile}
                                                            disabled={updateProfileMutation.isPending}
                                                            className="flex items-center gap-2 bg-tet-red text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-red-700 transition-all active:scale-95 disabled:opacity-50"
                                                        >
                                                            {updateProfileMutation.isPending ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
                                                            Lưu
                                                        </button>
                                                    </div>
                                                ) : (
                                                    <button onClick={handleEditStart} className="flex items-center gap-2 bg-gray-900 text-white px-5 py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-tet-red transition-all active:scale-95 group">
                                                        <Edit3 size={12} className="group-hover:rotate-12 transition-transform" />
                                                        {t('profile.sections.identity.edit')}
                                                    </button>
                                                )}
                                            </div>

                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-y-6 gap-x-8">
                                                {profileFields.map((info, idx) => (
                                                    <div key={idx} className="group space-y-1.5">
                                                        <div className="flex items-center gap-2">
                                                            <div className={cn("w-1 h-1 rounded-full", info.color.replace('text-', 'bg-'))} />
                                                            <label className="text-[8px] font-black text-gray-300 uppercase tracking-widest">{info.label}</label>
                                                        </div>
                                                        {isEditing && info.key ? (
                                                            <input
                                                                type="text"
                                                                value={editForm[info.key] || ''}
                                                                onChange={(e) => setEditForm(prev => ({ ...prev, [info.key]: e.target.value }))}
                                                                className="w-full text-sm font-bold text-gray-900 pl-3 py-1.5 border border-gray-200 rounded-lg focus:border-tet-red focus:ring-1 focus:ring-tet-red/20 outline-none transition-all"
                                                            />
                                                        ) : (
                                                            <div className="text-sm font-black text-gray-900 flex items-center gap-2.5 pl-3">
                                                                {info.value}
                                                                <CheckCircle2 size={10} className="text-green-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>

                                            {/* Verification Status */}
                                            <div className="p-5 rounded-[1.5rem] bg-gradient-to-br from-gray-50 to-white border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4 hover:shadow-md transition-shadow">
                                                <div className="flex items-center gap-4">
                                                    <div className="relative">
                                                        <div className="w-12 h-12 bg-white rounded-xl flex items-center justify-center text-tet-red shadow-lg border border-red-50">
                                                            <Zap size={24} fill="currentColor" />
                                                        </div>
                                                        {userInfo?.isIdentityVerified && (
                                                            <div className="absolute -top-0.5 -right-0.5 w-3.5 h-3.5 bg-green-500 rounded-full border-[2px] border-white" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <h4 className="text-lg font-black text-gray-900 mb-0.5 tracking-tight">{t('profile.verification.title')}</h4>
                                                        <p className="text-gray-400 font-bold max-w-xs text-[10px] leading-relaxed">
                                                            {userInfo?.isIdentityVerified ? 'Tài khoản đã xác minh danh tính' : t('profile.verification.desc')}
                                                        </p>
                                                    </div>
                                                </div>
                                                {!userInfo?.isIdentityVerified && (
                                                    <button className="whitespace-nowrap bg-white text-gray-900 border-2 border-gray-900 px-5 py-2 rounded-lg font-black text-[9px] uppercase tracking-widest hover:bg-gray-900 hover:text-white transition-all active:scale-95">
                                                        {t('profile.verification.cta')}
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    )}

                                    {activeSection === 'orders' && (
                                        <div className="space-y-6">
                                            <div className="flex items-center justify-between pb-6 border-b border-gray-50">
                                                <div>
                                                    <h3 className="text-2xl font-black text-gray-900 mb-1">{t('profile.sections.orders.title')}</h3>
                                                    <p className="text-gray-400 font-bold uppercase tracking-widest text-[9px]">{t('profile.sections.orders.desc')}</p>
                                                </div>
                                            </div>
                                            <div className="flex flex-col items-center justify-center py-12 text-center">
                                                <div className="w-16 h-16 bg-gray-50 rounded-2xl flex items-center justify-center text-gray-200 mb-4">
                                                    <Ticket size={32} />
                                                </div>
                                                <p className="text-gray-400 font-bold text-sm">Đang phát triển tính năng này</p>
                                            </div>
                                        </div>
                                    )}

                                    {!['profile', 'orders'].includes(activeSection) && (
                                        <div className="flex flex-col items-center justify-center py-20 text-center">
                                            <div className="w-24 h-24 bg-gray-50 rounded-[2rem] flex items-center justify-center text-gray-200 mb-8 animate-pulse">
                                                <Settings size={48} />
                                            </div>
                                            <h3 className="text-2xl font-black text-gray-900 mb-2">{t('profile.development.title')}</h3>
                                            <p className="text-gray-400 font-bold max-w-xs">{t('profile.development.desc')}</p>
                                        </div>
                                    )}
                                </motion.div>
                            </AnimatePresence>
                        </div>
                    </div>
                </div>
            </section>

            <Footer />
        </main>
    );
};

export default Profile;
