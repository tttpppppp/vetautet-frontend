import axiosInstance from './axiosInstance';
import { UploadResponse } from '../types/api.types';

export const uploadApi = {
  uploadImage: async (file: File, folder: string = 'avatars'): Promise<UploadResponse> => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('folder', folder);

    const response = await axiosInstance.post<UploadResponse>('/upload/image', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },
};
