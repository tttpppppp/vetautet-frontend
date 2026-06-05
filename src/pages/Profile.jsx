import React, { useEffect, useMemo, useRef, useState } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { motion } from 'framer-motion';
import {
    Award,
    Camera,
    CheckCircle2,
    Edit3,
    Globe,
    History,
    Loader2,
    LogOut,
    Mail,
    MapPin,
    Phone,
    Save,
    ShieldCheck,
    Ticket,
    Train,
    User,
    X,
} from 'lucide-react';
import { Helmet } from 'react-helmet-async';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { authApi } from '../api/auth.api';
import { uploadApi } from '../api/upload.api';
import { useAuthStore } from '../store/useAuthStore';

const Profile = () => {
    const { t, i18n } = useTranslation();
    const navigate = useNavigate();
    const queryClient = useQueryClient();
    const { isAuthenticated, logout: storeLogout, setUser } = useAuthStore();
    const fileInputRef = useRef(null);

    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({ name: '', phone: '', address: '', nationality: '' });

    const { data: userInfo, isLoading } = useQuery({
        queryKey: ['profile'],
        queryFn: authApi.getMe,
        enabled: isAuthenticated,
    });

    useEffect(() => {
        if (!userInfo) return;

        setUser(userInfo);
        setEditForm({
            name: userInfo.name || '',
            phone: userInfo.phone || '',
            address: userInfo.address || '',
            nationality: userInfo.nationality || '',
        });
    }, [setUser, userInfo]);

    const uploadMutation = useMutation({
        mutationFn: (file) => uploadApi.uploadImage(file, 'avatars'),
        onSuccess: async (res) => {
            await authApi.updateProfile({ imageUrl: res.imageUrl });
            queryClient.invalidateQueries({ queryKey: ['profile'] });
        },
    });

    const updateProfileMutation = useMutation({
        mutationFn: (data) => authApi.updateProfile(data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['profile'] });
            setIsEditing(false);
        },
    });

    useEffect(() => {
        if (!isAuthenticated) navigate('/login');
    }, [isAuthenticated, navigate]);

    const handleLogout = async () => {
        try {
            await authApi.logout();
        } catch (_) {
            // Logout locally even when the server session has already expired.
        }
        storeLogout();
        navigate('/');
    };

    const handleFileChange = (event) => {
        const file = event.target.files?.[0];
        if (file) uploadMutation.mutate(file);
    };

    const handleEditStart = () => {
        setEditForm({
            name: userInfo?.name || '',
            phone: userInfo?.phone || '',
            address: userInfo?.address || '',
            nationality: userInfo?.nationality || '',
        });
        setIsEditing(true);
    };

    const handleSaveProfile = () => {
        updateProfileMutation.mutate(editForm);
    };

    const getRankLabel = (rank) => {
        const ranks = {
            BRONZE: 'Bronze',
            SILVER: 'Silver',
            GOLD: 'Gold',
            PLATINUM: 'Platinum',
            DIAMOND: 'Diamond',
        };
        return ranks[rank] || rank || 'Member';
    };

    const formatJoinDate = (dateStr) => {
        if (!dateStr) return '--';
        return new Intl.DateTimeFormat(i18n.language === 'en' ? 'en-GB' : 'vi-VN', {
            month: '2-digit',
            year: 'numeric',
        }).format(new Date(dateStr));
    };

    const defaultAvatar = useMemo(() => {
        return `https://ui-avatars.com/api/?name=${encodeURIComponent(userInfo?.name || 'U')}&background=D32F2F&color=fff&size=240&bold=true`;
    }, [userInfo?.name]);

    if (!isAuthenticated) return null;

    if (isLoading) {
        return (
            <main className="min-h-screen bg-white flex flex-col">
                <Header />
                <div className="flex-grow flex items-center justify-center">
                    <Train className="animate-spin text-tet-red" size={32} />
                </div>
                <Footer />
            </main>
        );
    }

    const avatarUrl = userInfo?.imageUrl || defaultAvatar;
    const rankLabel = getRankLabel(userInfo?.membershipRank);
    const profileRows = [
        { label: 'Họ và tên', value: userInfo?.name || '--', key: 'name', icon: User },
        { label: 'Email', value: userInfo?.email || '--', icon: Mail },
        { label: 'Số điện thoại', value: userInfo?.phone || '--', key: 'phone', icon: Phone },
        { label: 'Địa chỉ', value: userInfo?.address || '--', key: 'address', icon: MapPin },
        { label: 'Quốc tịch', value: userInfo?.nationality || 'Vietnam', key: 'nationality', icon: Globe },
        { label: 'Ngày tham gia', value: formatJoinDate(userInfo?.createdAt), icon: History },
    ];

    const stats = [
        { label: 'Vé đã đặt', value: userInfo?.tripsCount || 0, icon: Ticket },
        { label: 'Điểm thưởng', value: userInfo?.rewardPoints || 0, icon: Award },
        { label: 'Hạng thành viên', value: rankLabel, icon: ShieldCheck },
    ];

    return (
        <main className="min-h-screen bg-white flex flex-col selection:bg-tet-red selection:text-white">
            <Helmet>
                <title>{t('profile.seo_title')}</title>
                <meta name="description" content={t('profile.seo_desc')} />
            </Helmet>
            <Header />

            <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" className="hidden" />

            <section className="pt-40 pb-24">
                <div className="max-w-6xl mx-auto px-5 md:px-10">
                    <motion.div
                        initial={{ opacity: 0, y: 18 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-10"
                    >
                        <div className="space-y-10">
                            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                                <div className="flex flex-col md:flex-row md:items-end gap-5">
                                    <button
                                        type="button"
                                        onClick={() => fileInputRef.current?.click()}
                                        className="relative w-28 h-28 rounded-full overflow-hidden group"
                                        aria-label="Đổi ảnh đại diện"
                                    >
                                        <img src={avatarUrl} className="w-full h-full object-cover" alt={userInfo?.name || 'Avatar'} />
                                        <span className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                            {uploadMutation.isPending ? <Loader2 className="animate-spin" size={22} /> : <Camera size={22} />}
                                        </span>
                                    </button>

                                    <div className="pb-1">
                                        <p className="text-[10px] font-black text-tet-red uppercase tracking-[0.28em] mb-2">{rankLabel}</p>
                                        <h1 className="text-3xl md:text-4xl font-black text-gray-950 tracking-tight">{userInfo?.name || 'Tài khoản'}</h1>
                                        <p className="mt-2 text-sm font-bold text-gray-500">{userInfo?.email}</p>
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-3">
                                    {isEditing ? (
                                        <>
                                            <button
                                                type="button"
                                                onClick={() => setIsEditing(false)}
                                                className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-xs font-black uppercase tracking-widest text-gray-600 hover:text-gray-950"
                                            >
                                                <X size={15} /> Hủy
                                            </button>
                                            <button
                                                type="button"
                                                onClick={handleSaveProfile}
                                                disabled={updateProfileMutation.isPending}
                                                className="inline-flex items-center gap-2 rounded-full bg-tet-red px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-red-700 disabled:opacity-60"
                                            >
                                                {updateProfileMutation.isPending ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
                                                Lưu thay đổi
                                            </button>
                                        </>
                                    ) : (
                                        <button
                                            type="button"
                                            onClick={handleEditStart}
                                            className="inline-flex items-center gap-2 rounded-full bg-gray-950 px-5 py-3 text-xs font-black uppercase tracking-widest text-white hover:bg-tet-red"
                                        >
                                            <Edit3 size={15} /> Chỉnh sửa
                                        </button>
                                    )}
                                    <button
                                        type="button"
                                        onClick={handleLogout}
                                        className="inline-flex items-center gap-2 rounded-full px-5 py-3 text-xs font-black uppercase tracking-widest text-tet-red hover:text-red-700"
                                    >
                                        <LogOut size={15} /> Đăng xuất
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-8 py-2">
                                {stats.map((stat, index) => (
                                    <div key={stat.label} className="flex items-center gap-4 md:flex-1">
                                        <div className="w-8 h-8 flex items-center justify-center text-gray-400">
                                            <stat.icon size={18} />
                                        </div>
                                        <div>
                                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
                                            <p className="text-lg font-black text-gray-950">{stat.value}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div className="mt-10 grid grid-cols-1 lg:grid-cols-[1fr_320px] gap-10">
                                <section>
                                    <div className="flex items-end justify-between gap-5 mb-6">
                                        <div>
                                            <h2 className="text-2xl font-black text-gray-950">Thông tin tài khoản</h2>
                                            <p className="mt-1 text-sm font-bold text-gray-400">Các thông tin dùng cho đặt vé và nhận thông báo.</p>
                                        </div>
                                    </div>

                                    <div className="space-y-6">
                                        {profileRows.map((row) => (
                                            <div key={row.label} className="flex flex-col sm:flex-row sm:items-center gap-3">
                                                <div className="flex items-center gap-3 sm:w-56 shrink-0">
                                                    <span className="w-6 h-6 flex items-center justify-center text-gray-400">
                                                        <row.icon size={17} />
                                                    </span>
                                                    <span className="text-xs font-black text-gray-400 uppercase tracking-widest">{row.label}</span>
                                                </div>

                                                {isEditing && row.key ? (
                                                    <input
                                                        type="text"
                                                        value={editForm[row.key] || ''}
                                                        onChange={(event) => setEditForm((prev) => ({ ...prev, [row.key]: event.target.value }))}
                                                        className="flex-1 border-b border-gray-200 px-0 py-2 text-sm font-bold text-gray-950 outline-none focus:border-tet-red"
                                                    />
                                                ) : (
                                                    <p className="flex-1 text-base font-black text-gray-950 break-words">{row.value}</p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </section>

                                <aside className="space-y-6">
                                    <div className="py-1">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Xác minh</p>
                                        <h3 className="text-xl font-black text-gray-950">
                                            {userInfo?.isIdentityVerified ? 'Đã xác thực chính chủ' : 'Chưa xác thực chính chủ'}
                                        </h3>
                                        <p className="mt-2 text-sm font-bold text-gray-500">
                                            {userInfo?.isIdentityVerified
                                                ? 'Tài khoản đã sẵn sàng cho các thao tác đặt vé nhanh.'
                                                : 'Bổ sung định danh để đặt vé và xử lý hỗ trợ thuận tiện hơn.'}
                                        </p>
                                    </div>

                                    <div className="py-1">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Đơn hàng</p>
                                        <h3 className="text-xl font-black text-gray-950">Theo dõi vé đã đặt</h3>
                                        <p className="mt-2 text-sm font-bold text-gray-500">Xem lịch sử, tải hóa đơn và QR vé của bạn.</p>
                                        <button
                                            type="button"
                                            onClick={() => navigate('/orders')}
                                            className="mt-5 inline-flex items-center gap-2 rounded-full px-0 py-3 text-xs font-black uppercase tracking-widest text-tet-red hover:text-red-700"
                                        >
                                            Mở đơn hàng
                                        </button>
                                    </div>
                                </aside>
                            </div>
                        </div>
                    </motion.div>
                </div>
            </section>

            <Footer />
        </main>
    );
};

export default Profile;
