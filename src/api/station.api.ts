import axiosInstance from './axiosInstance';
import { PopularDestination } from '../types/api.types';

export interface Station {
  id: number;
  name: string;
  code: string;
  location: string;
}

export const stationApi = {
  getAllStations: async (): Promise<Station[]> => {
    const response = await axiosInstance.get<Station[]>('/stations');
    return response.data;
  },

  getPopularStations: async (limit = 6): Promise<PopularDestination[]> => {
    const response = await axiosInstance.get<PopularDestination[]>('/stations/popular', { params: { limit } });
    return response.data;
  },
};
