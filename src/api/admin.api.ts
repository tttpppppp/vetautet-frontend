import axiosInstance from './axiosInstance';
import {
  AdminPromotionQuery,
  AdminStatsResponse,
  AdminTripResponse,
  BookingResponse,
  PromotionRequest,
  PromotionResponse,
  StationRequest,
  StationResponse,
  TicketResponse,
  TicketUpdateRequest,
  TrainRequest,
  TrainResponse,
  TripCreateRequest,
  TripItinerary,
  TripSegmentPrice,
  TripSegmentPricesUpsertRequest,
  TripStopsUpsertRequest,
  UserResponse,
  UserUpdateRequest,
} from '../types/api.types';

const cleanParams = (params: AdminPromotionQuery = {}) => ({
  q: params.q || undefined,
  discount: params.discount || undefined,
  type: params.type || undefined,
  category: params.category || undefined,
  status: params.status || undefined,
  route: params.route || undefined,
  sort: params.sort || undefined,
});

export const adminApi = {
  getStats: async (): Promise<AdminStatsResponse> => {
    const response = await axiosInstance.get<AdminStatsResponse>('/admin/stats');
    return response.data;
  },

  getBookings: async (): Promise<BookingResponse[]> => {
    const response = await axiosInstance.get<BookingResponse[]>('/admin/bookings');
    return response.data;
  },
  getBookingById: async (id: number): Promise<BookingResponse> => {
    const response = await axiosInstance.get<BookingResponse>(`/admin/bookings/${id}`);
    return response.data;
  },
  updateBookingStatus: async (id: number, status: string): Promise<BookingResponse> => {
    const response = await axiosInstance.put<BookingResponse>(`/admin/bookings/${id}/status`, { status });
    return response.data;
  },
  deleteBooking: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/admin/bookings/${id}`);
  },

  getPromotions: async (params: AdminPromotionQuery = {}): Promise<PromotionResponse[]> => {
    const response = await axiosInstance.get<PromotionResponse[]>('/admin/promotions', {
      params: cleanParams(params),
    });
    return response.data;
  },
  createPromotion: async (data: PromotionRequest): Promise<PromotionResponse> => {
    const response = await axiosInstance.post<PromotionResponse>('/admin/promotions', data);
    return response.data;
  },
  updatePromotion: async (id: number | string, data: PromotionRequest): Promise<PromotionResponse> => {
    const response = await axiosInstance.put<PromotionResponse>(`/admin/promotions/${id}`, data);
    return response.data;
  },
  deletePromotion: async (id: number | string): Promise<void> => {
    await axiosInstance.delete(`/admin/promotions/${id}`);
  },

  getStations: async (): Promise<StationResponse[]> => {
    const response = await axiosInstance.get<StationResponse[]>('/admin/stations');
    return response.data;
  },
  getStationById: async (id: number): Promise<StationResponse> => {
    const response = await axiosInstance.get<StationResponse>(`/admin/stations/${id}`);
    return response.data;
  },
  createStation: async (data: StationRequest): Promise<StationResponse> => {
    const response = await axiosInstance.post<StationResponse>('/admin/stations', data);
    return response.data;
  },
  updateStation: async (id: number, data: StationRequest): Promise<StationResponse> => {
    const response = await axiosInstance.put<StationResponse>(`/admin/stations/${id}`, data);
    return response.data;
  },
  deleteStation: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/admin/stations/${id}`);
  },

  getTicketsByTrip: async (tripId: number): Promise<TicketResponse[]> => {
    const response = await axiosInstance.get<TicketResponse[]>(`/admin/tickets/trip/${tripId}`);
    return response.data;
  },
  updateTicket: async (id: number, data: TicketUpdateRequest): Promise<TicketResponse> => {
    const response = await axiosInstance.put<TicketResponse>(`/admin/tickets/${id}`, data);
    return response.data;
  },
  deleteTicket: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/admin/tickets/${id}`);
  },

  getTrains: async (): Promise<TrainResponse[]> => {
    const response = await axiosInstance.get<TrainResponse[]>('/admin/trains');
    return response.data;
  },
  getTrainById: async (id: number): Promise<TrainResponse> => {
    const response = await axiosInstance.get<TrainResponse>(`/admin/trains/${id}`);
    return response.data;
  },
  createTrain: async (data: TrainRequest): Promise<TrainResponse> => {
    const response = await axiosInstance.post<TrainResponse>('/admin/trains', data);
    return response.data;
  },
  updateTrain: async (id: number, data: TrainRequest): Promise<TrainResponse> => {
    const response = await axiosInstance.put<TrainResponse>(`/admin/trains/${id}`, data);
    return response.data;
  },
  deleteTrain: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/admin/trains/${id}`);
  },

  getTrips: async (): Promise<AdminTripResponse[]> => {
    const response = await axiosInstance.get<AdminTripResponse[]>('/admin/trips');
    return response.data;
  },
  createTrip: async (data: TripCreateRequest): Promise<AdminTripResponse> => {
    const response = await axiosInstance.post<AdminTripResponse>('/admin/trips', data);
    return response.data;
  },
  updateTrip: async (id: number, data: TripCreateRequest): Promise<AdminTripResponse> => {
    const response = await axiosInstance.put<AdminTripResponse>(`/admin/trips/${id}`, data);
    return response.data;
  },
  getTripItinerary: async (id: number): Promise<TripItinerary> => {
    const response = await axiosInstance.get<TripItinerary>(`/admin/segments/trips/${id}`);
    return response.data;
  },
  updateTripStops: async (id: number, data: TripStopsUpsertRequest): Promise<TripItinerary> => {
    const response = await axiosInstance.put<TripItinerary>(`/admin/segments/trips/${id}/stops`, data);
    return response.data;
  },
  updateTripSegmentPrices: async (id: number, data: TripSegmentPricesUpsertRequest): Promise<TripSegmentPrice[]> => {
    const response = await axiosInstance.put<TripSegmentPrice[]>(`/admin/segments/trips/${id}/prices`, data);
    return response.data;
  },
  deleteTrip: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/admin/trips/${id}`);
  },

  getUsers: async (): Promise<UserResponse[]> => {
    const response = await axiosInstance.get<UserResponse[]>('/admin/users');
    return response.data;
  },
  getUserRoles: async (): Promise<string[]> => {
    const response = await axiosInstance.get<string[]>('/admin/users/roles');
    return response.data;
  },
  updateUser: async (id: number, data: UserUpdateRequest): Promise<UserResponse> => {
    const response = await axiosInstance.put<UserResponse>(`/admin/users/${id}`, data);
    return response.data;
  },
  deleteUser: async (id: number): Promise<void> => {
    await axiosInstance.delete(`/admin/users/${id}`);
  },

  updateUserRoles: async (id: number, roles: string[]): Promise<UserResponse> => {
    const response = await axiosInstance.put<UserResponse>(`/admin/users/${id}`, { roles });
    return response.data;
  },
};
