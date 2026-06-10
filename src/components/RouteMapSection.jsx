import React from 'react';
import { Headphones, Sparkles, TrainFront } from 'lucide-react';

const benefits = [
    {
        icon: Sparkles,
        title: 'Tìm chuyến tàu phù hợp',
        description: 'Lựa chọn lịch trình linh hoạt',
    },
    {
        icon: TrainFront,
        title: 'Đặt vé nhanh, dễ dàng',
        description: 'Nhận vé ngay sau khi đặt',
    },
    {
        icon: Headphones,
        title: 'Luôn sẵn sàng hỗ trợ',
        description: 'Phản hồi trong 15 phút qua điện thoại, zalo',
    },
];

const RouteMapSection = () => {
    return (
        <section className="bg-[#f2f9fd]">
            <div className="bg-white border-y border-sky-100">
                <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 grid grid-cols-1 md:grid-cols-3 gap-5">
                    {benefits.map(({ icon: Icon, title, description }) => (
                        <div key={title} className="flex items-center gap-4">
                            <Icon className="text-sky-500 shrink-0" size={32} strokeWidth={2.3} />
                            <div>
                                <h3 className="text-base sm:text-lg font-bold text-gray-900">{title}</h3>
                                <p className="text-sm text-gray-500 font-medium">{description}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12 md:py-16">
                <div className="mb-7">
                    <h2 className="text-3xl md:text-4xl font-black text-gray-900 leading-tight">
                        Bản đồ tuyến đường sắt Việt Nam
                    </h2>
                    <p className="mt-2 text-base md:text-lg text-gray-600 font-medium">
                        Xem thông tin chi tiết về các tuyến tàu hỏa, lịch trình và điểm dừng
                    </p>
                </div>

                <figure className="overflow-hidden rounded-lg bg-[#cbeefa]">
                    <img
                        src="/ivivu_ban_do_duong_sat.webp"
                        alt="Bản đồ tuyến đường sắt Việt Nam"
                        width="2280"
                        height="2484"
                        className="block w-full h-auto object-contain"
                        loading="eager"
                        decoding="async"
                    />
                </figure>
            </div>
        </section>
    );
};

export default RouteMapSection;
