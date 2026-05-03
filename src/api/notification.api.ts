import axiosInstance from './axiosInstance';
import { UserNotification } from '../types/api.types';

const extractNotifications = (payload: unknown): UserNotification[] => {
  if (Array.isArray(payload)) return payload as UserNotification[];

  if (payload && typeof payload === 'object') {
    const record = payload as Record<string, unknown>;
    const candidates = [
      record.content,
      record.data,
      record.items,
      record.notifications,
      record.results,
    ];

    const list = candidates.find(Array.isArray);
    if (Array.isArray(list)) return list as UserNotification[];
  }

  return [];
};

export const notificationApi = {
  getNotifications: async (): Promise<UserNotification[]> => {
    const response = await axiosInstance.get<unknown>('/notifications');
    return extractNotifications(response.data);
  },

  getUnreadCount: async (): Promise<number | { count?: number; unreadCount?: number }> => {
    const response = await axiosInstance.get<number | { count?: number; unreadCount?: number }>('/notifications/unread-count');
    return response.data;
  },

  markAsRead: async (id: number): Promise<void> => {
    await axiosInstance.put(`/notifications/${id}/read`);
  },

  markAllAsRead: async (): Promise<void> => {
    await axiosInstance.put('/notifications/read-all');
  },
};
