import axiosInstance from './axiosInstance';
import {
  PopularDestination,
  PopularRoute,
  Trip,
  TripCategory,
  TripFareQuote,
  TripItinerary,
  TripSearchParams,
} from '../types/api.types';

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

  getTripDetails: async (
    id: number,
    params?: {
      bookingId?: number;
      departureStationId?: number;
      arrivalStationId?: number;
    },
  ): Promise<Trip> => {
    const response = await axiosInstance.get<Trip>(`/trips/${id}`, {
      params: params
        ? {
            bookingId: params.bookingId || undefined,
            departureStationId: params.departureStationId || undefined,
            arrivalStationId: params.arrivalStationId || undefined,
          }
        : undefined,
    });
    return response.data;
  },

  getTripItinerary: async (id: number): Promise<TripItinerary> => {
    const response = await axiosInstance.get<TripItinerary>(`/trips/${id}/itinerary`);
    return response.data;
  },

  quoteFare: async (
    id: number,
    params: {
      departureStationId: number;
      arrivalStationId: number;
      carriageTypeId: number;
      passengerType?: string;
    },
  ): Promise<TripFareQuote> => {
    const response = await axiosInstance.get<TripFareQuote>(`/trips/${id}/fare`, {
      params: {
        ...params,
        passengerType: params.passengerType || 'ADULT',
      },
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

  getSchedules: async (params: { date?: string; station?: string; limit?: number } = {}): Promise<Trip[]> => {
    const response = await axiosInstance.get<Trip[]>('/trips/schedules', {
      params: {
        date: params.date || undefined,
        station: params.station || undefined,
        limit: params.limit || 6,
      },
    });
    return response.data;
  },
};
