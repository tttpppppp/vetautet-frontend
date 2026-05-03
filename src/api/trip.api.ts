import axiosInstance from './axiosInstance';
import { PopularDestination, PopularRoute, Trip, TripCategory, TripSearchParams } from '../types/api.types';

export const tripApi = {
  searchTrips: async (params: TripSearchParams): Promise<Trip[]> => {
    const response = await axiosInstance.get<Trip[]>('/trips/search', {
      params: {
        ...params,
        date: params.date || undefined,
        trainCategory: params.trainCategory || undefined,
        minPrice: typeof params.minPrice === 'number' ? params.minPrice : undefined,
        maxPrice: typeof params.maxPrice === 'number' ? params.maxPrice : undefined,
        promoCode: params.promoCode || undefined,
      },
    });
    return response.data;
  },

  getTripDetails: async (id: number, bookingId?: number): Promise<Trip> => {
    const response = await axiosInstance.get<Trip>(`/trips/${id}`, {
      params: bookingId ? { bookingId } : undefined,
    });
    return response.data;
  },

  getAllTrips: async (promoCode?: string): Promise<Trip[]> => {
    const response = await axiosInstance.get<Trip[]>('/trips', {
      params: promoCode ? { promoCode } : undefined,
    });
    return response.data;
  },

  getTripCategories: async (): Promise<TripCategory[]> => {
    const response = await axiosInstance.get<TripCategory[]>('/trips/categories');
    return response.data;
  },

  getPopularTrips: async (limit = 6): Promise<Trip[]> => {
    const response = await axiosInstance.get<Trip[]>('/trips/popular', { params: { limit } });
    return response.data;
  },

  getPopularRoutes: async (limit = 6): Promise<PopularRoute[]> => {
    const response = await axiosInstance.get<PopularRoute[]>('/trips/popular-routes', { params: { limit } });
    return response.data;
  },

  getPopularDestinations: async (limit = 6): Promise<PopularDestination[]> => {
    const response = await axiosInstance.get<PopularDestination[]>('/trips/popular-destinations', { params: { limit } });
    return response.data;
  },

  getUpcomingTrips: async (limit = 6): Promise<Trip[]> => {
    const response = await axiosInstance.get<Trip[]>('/trips/upcoming', { params: { limit } });
    return response.data;
  },
};
