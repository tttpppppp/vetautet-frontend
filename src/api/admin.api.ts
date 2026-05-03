import axiosInstance from './axiosInstance';
import { Trip, User } from '../types/api.types';

export const adminApi = {
  // Trips
  getTrips: async (): Promise<Trip[]> => {
    const response = await axiosInstance.get<Trip[]>('/admin/trips');
    return response.data;
  },
  createTrip: async (data: any): Promise<Trip> => {
    const response = await axiosInstance.post<Trip>('/admin/trips', data);
    return response.data;
  },
  updateTrip: async (id: number, data: any): Promise<Trip> => {
    const response = await axiosInstance.put<Trip>(`/admin/trips/${id}`, data);
    return response.data;
  },
  deleteTrip: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/admin/trips/${id}`);
  },

  // Trains
  getTrains: async (): Promise<any[]> => {
    const response = await axiosInstance.get<any[]>('/admin/trains');
    return response.data;
  },
  createTrain: async (data: any): Promise<any> => {
    const response = await axiosInstance.post<any>('/admin/trains', data);
    return response.data;
  },

  // Bookings
  getBookings: async (): Promise<any[]> => {
    const response = await axiosInstance.get<any[]>('/admin/bookings');
    return response.data;
  },
  updateBookingStatus: async (id: number, status: string): Promise<any> => {
    const response = await axiosInstance.put<any>(`/admin/bookings/${id}/status`, { status });
    return response.data;
  },

  // Users
  getUsers: async (): Promise<User[]> => {
    const response = await axiosInstance.get<User[]>('/admin/users');
    return response.data;
  },
  updateUserRoles: async (id: number, roles: string[]): Promise<User> => {
    const response = await axiosInstance.put<User>(`/admin/users/${id}`, { roles });
    return response.data;
  },
};
