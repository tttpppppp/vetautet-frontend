export type PromotionCategory =
    | 'tet'
    | 'student'
    | 'roundTrip'
    | 'popularRoute'
    | 'onlinePayment'
    | 'group'
    | 'expiring';

export type PromotionDiscountType = 'percent' | 'amount' | 'serviceFee';

export interface MockPromotion {
    id: string;
    title: string;
    description: string;
    code: string;
    discountType: PromotionDiscountType;
    discountLabel: string;
    discountValue: number;
    startsAt: string;
    endsAt: string;
    conditions: string;
    route?: string;
    categories: PromotionCategory[];
    createdAt: string;
    easeScore: number;
}

export const mockPromotions: MockPromotion[] = [
    {
        id: 'tet-sum-vay-2027',
        title: 'Vé Tết sum vầy',
        description: 'Ưu đãi sớm cho các chuyến tàu Tết trên trục Bắc - Nam.',
        code: 'TETSUMVAY',
        discountType: 'percent',
        discountLabel: 'Giảm 18%',
        discountValue: 18,
        startsAt: '2026-11-01',
        endsAt: '2027-01-20',
        conditions: 'Áp dụng cho đơn từ 2 vé, đặt trước ngày khởi hành tối thiểu 7 ngày.',
        route: 'Ga Sai Gon → Ga Ha Noi',
        categories: ['tet', 'popularRoute'],
        createdAt: '2026-04-28',
        easeScore: 84,
    },
    {
        id: 'student-rail-2026',
        title: 'Sinh viên lên tàu',
        description: 'Tiết kiệm cho sinh viên khi đặt vé ghế ngồi hoặc giường nằm.',
        code: 'SVRAIL',
        discountType: 'percent',
        discountLabel: 'Giảm 15%',
        discountValue: 15,
        startsAt: '2026-05-01',
        endsAt: '2026-08-31',
        conditions: 'Cần xuất trình thẻ sinh viên còn hiệu lực khi lên tàu.',
        route: 'Ga Ha Noi → Vinh',
        categories: ['student'],
        createdAt: '2026-04-30',
        easeScore: 78,
    },
    {
        id: 'round-trip-save',
        title: 'Đi về tiết kiệm hơn',
        description: 'Giảm trực tiếp cho hành trình khứ hồi trong cùng một đơn.',
        code: 'KHUTHOI',
        discountType: 'amount',
        discountLabel: 'Giảm 120.000đ',
        discountValue: 120000,
        startsAt: '2026-04-15',
        endsAt: '2026-07-15',
        conditions: 'Áp dụng khi đặt tối thiểu 1 vé chiều đi và 1 vé chiều về.',
        categories: ['roundTrip'],
        createdAt: '2026-04-18',
        easeScore: 88,
    },
    {
        id: 'online-pay-weekend',
        title: 'Thanh toán online cuối tuần',
        description: 'Miễn phí dịch vụ khi thanh toán bằng ví điện tử hoặc thẻ nội địa.',
        code: 'PAYONLINE',
        discountType: 'serviceFee',
        discountLabel: 'Miễn phí dịch vụ',
        discountValue: 35000,
        startsAt: '2026-05-01',
        endsAt: '2026-05-08',
        conditions: 'Áp dụng từ thứ Sáu đến Chủ nhật cho đơn thanh toán online.',
        categories: ['onlinePayment', 'expiring'],
        createdAt: '2026-05-01',
        easeScore: 96,
    },
    {
        id: 'family-cabin',
        title: 'Gia đình chọn khoang',
        description: 'Ưu đãi cho nhóm gia đình đặt khoang 4 hoặc khoang 6.',
        code: 'GIADINH',
        discountType: 'amount',
        discountLabel: 'Giảm 200.000đ',
        discountValue: 200000,
        startsAt: '2026-05-10',
        endsAt: '2026-09-30',
        conditions: 'Đơn từ 4 hành khách, áp dụng cho khoang 4 hoặc khoang 6.',
        route: 'Ga Da Nang → Ga Sai Gon',
        categories: ['group'],
        createdAt: '2026-04-22',
        easeScore: 72,
    },
    {
        id: 'popular-sgn-dad',
        title: 'Tuyến biển miền Trung',
        description: 'Giảm mạnh cho tuyến Sài Gòn - Đà Nẵng trong mùa du lịch.',
        code: 'BIENXANH',
        discountType: 'percent',
        discountLabel: 'Giảm 20%',
        discountValue: 20,
        startsAt: '2026-05-01',
        endsAt: '2026-06-30',
        conditions: 'Áp dụng cho vé từ thứ Hai đến thứ Năm, không cộng dồn ưu đãi.',
        route: 'Ga Sai Gon → Ga Da Nang',
        categories: ['popularRoute'],
        createdAt: '2026-04-25',
        easeScore: 81,
    },
    {
        id: 'last-call-may',
        title: 'Chốt vé tháng 5',
        description: 'Ưu đãi ngắn ngày cho các chuyến còn nhiều ghế trống.',
        code: 'MAYLAST',
        discountType: 'amount',
        discountLabel: 'Giảm 80.000đ',
        discountValue: 80000,
        startsAt: '2026-05-01',
        endsAt: '2026-05-06',
        conditions: 'Số lượng mã có hạn, áp dụng cho đơn từ 300.000đ.',
        categories: ['expiring', 'onlinePayment'],
        createdAt: '2026-05-01',
        easeScore: 90,
    },
    {
        id: 'group-summer',
        title: 'Nhóm bạn mùa hè',
        description: 'Càng đông càng tiết kiệm cho nhóm từ 6 hành khách.',
        code: 'NHOMHE',
        discountType: 'percent',
        discountLabel: 'Giảm 12%',
        discountValue: 12,
        startsAt: '2026-05-15',
        endsAt: '2026-08-15',
        conditions: 'Áp dụng cho đơn từ 6 vé cùng chuyến, cùng hạng ghế.',
        categories: ['group'],
        createdAt: '2026-04-20',
        easeScore: 69,
    },
];
