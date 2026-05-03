import axiosInstance from './axiosInstance';
import {
  TicketQrVerifyRequest,
  TicketQrVerifyResponse,
} from '../types/api.types';

export const ticketApi = {
  getTicketQrPng: async (ticketId: number, bookingId: number): Promise<Blob> => {
    const response = await axiosInstance.get(`/tickets/${ticketId}/qr.png`, {
      params: { bookingId },
      responseType: 'blob',
    });
    return response.data;
  },

  verifyQr: async (data: TicketQrVerifyRequest): Promise<TicketQrVerifyResponse> => {
    const response = await axiosInstance.post<TicketQrVerifyResponse>('/tickets/verify-qr', data);
    return response.data;
  },
};
