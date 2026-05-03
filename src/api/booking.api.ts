import axiosInstance from './axiosInstance';
import {
  BookingDetailResponse,
  BookingRequest,
  BookingResponse,
  MyBookingSummary,
  PaymentRedirectResponse,
  UpdateBookingRequest,
} from '../types/api.types';

export const bookingApi = {
  createBooking: async (data: BookingRequest): Promise<BookingResponse> => {
    const response = await axiosInstance.post<BookingResponse>('/bookings', data);
    return response.data;
  },

  updateBooking: async (id: number, data: UpdateBookingRequest): Promise<any> => {
    const response = await axiosInstance.put(`/bookings/${id}`, data);
    return response.data;
  },

  confirmPayment: async (id: number): Promise<any> => {
    const response = await axiosInstance.post(`/bookings/${id}/confirm-payment`);
    return response.data;
  },

  createMomoPayment: async (id: number): Promise<PaymentRedirectResponse> => {
    const response = await axiosInstance.post<PaymentRedirectResponse>(`/payments/momo/bookings/${id}`);
    return response.data;
  },

  createVnpayPayment: async (id: number): Promise<PaymentRedirectResponse> => {
    const response = await axiosInstance.post<PaymentRedirectResponse>(`/payments/vnpay/bookings/${id}`);
    return response.data;
  },

  getMyBookings: async (): Promise<MyBookingSummary[]> => {
    const response = await axiosInstance.get<MyBookingSummary[]>('/bookings/my');
    return response.data;
  },

  getBookingById: async (id: number): Promise<BookingDetailResponse> => {
    const response = await axiosInstance.get<BookingDetailResponse>(`/bookings/${id}`);
    return response.data;
  },

  downloadInvoicePdf: async (id: number): Promise<Blob> => {
    const response = await axiosInstance.get(`/bookings/${id}/invoice.pdf`, {
      responseType: 'blob',
    });
    return response.data;
  },

  verifyVnpayReturn: async (params: Record<string, string>): Promise<any> => {
    const response = await axiosInstance.get('/payments/vnpay/return', { params });
    return response.data;
  },
};
