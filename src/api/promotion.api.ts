import axiosInstance from './axiosInstance';

export type PromotionCategory =
  | 'tet'
  | 'student'
  | 'roundTrip'
  | 'popularRoute'
  | 'onlinePayment'
  | 'group'
  | 'expiring';

export type PromotionDiscountType = 'percent' | 'amount' | 'serviceFee';
export type PromotionSort = 'newest' | 'expiring' | 'discount' | 'easy';
export type PromotionFilterStatus = 'active' | 'expiring';

export interface PromotionSearchParams {
  q?: string;
  discount?: number;
  type?: PromotionDiscountType;
  category?: PromotionCategory;
  status?: PromotionFilterStatus;
  route?: string;
  sort?: PromotionSort;
}

export interface Promotion {
  id: string;
  title: string;
  description: string;
  code: string;
  discountType: PromotionDiscountType;
  discountLabel: string;
  discountValue: number;
  maxDiscountAmount?: number | null;
  minOrderAmount?: number | null;
  startsAt: string;
  endsAt: string;
  conditions: string;
  route?: string | null;
  categories: PromotionCategory[];
  usageLimit?: number | null;
  usedCount?: number | null;
  easeScore: number;
  status?: string;
  createdAt: string;
  active?: boolean;
  expiringSoon?: boolean;
  daysLeft?: number;
}

export interface PromotionValidationResponse {
  valid: boolean;
  code: string;
  message: string;
  orderAmount: number;
  discountAmount: number;
  finalAmount: number;
  promotion: Pick<Promotion, 'id' | 'code' | 'discountType' | 'discountLabel'> | null;
}

const cleanParams = (params: PromotionSearchParams) => ({
  q: params.q || undefined,
  discount: params.discount || undefined,
  type: params.type || undefined,
  category: params.category || undefined,
  status: params.status || undefined,
  route: params.route || undefined,
  sort: params.sort || undefined,
});

export const promotionApi = {
  getPromotions: async (params: PromotionSearchParams = {}): Promise<Promotion[]> => {
    const response = await axiosInstance.get<Promotion[]>('/promotions', {
      params: cleanParams(params),
    });
    return response.data;
  },

  getPromotionByCode: async (code: string): Promise<Promotion> => {
    const response = await axiosInstance.get<Promotion>(`/promotions/${encodeURIComponent(code)}`);
    return response.data;
  },

  validateCode: async (code: string, orderAmount: number): Promise<PromotionValidationResponse> => {
    const response = await axiosInstance.get<PromotionValidationResponse>('/promotions/validate-code', {
      params: { code, orderAmount },
    });
    return response.data;
  },
};
