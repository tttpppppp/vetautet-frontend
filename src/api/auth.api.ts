import axiosInstance from './axiosInstance';
import {
  LoginResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  RegisterRequest,
  ResendVerificationOtpRequest,
  ResetPasswordRequest,
  UpdateProfileRequest,
  User,
  VerifyEmailRequest,
  VerifyEmailResponse,
} from '../types/api.types';

export const authApi = {
  login: async (credentials: any): Promise<LoginResponse> => {
    const response = await axiosInstance.post<LoginResponse>('/auth/login', credentials);
    return response.data;
  },

  googleLogin: async (token: string): Promise<LoginResponse> => {
    const response = await axiosInstance.post<LoginResponse>('/auth/google', { token });
    return response.data;
  },

  register: async (userData: RegisterRequest): Promise<LoginResponse> => {
    const response = await axiosInstance.post<LoginResponse>('/auth/register', userData);
    return response.data;
  },

  verifyEmail: async (data: VerifyEmailRequest): Promise<VerifyEmailResponse> => {
    const response = await axiosInstance.post<VerifyEmailResponse>('/auth/verify-email', data);
    return response.data;
  },

  resendVerificationOtp: async (data: ResendVerificationOtpRequest): Promise<void> => {
    await axiosInstance.post('/auth/resend-verification-otp', data);
  },

  requestPasswordReset: async (data: ForgotPasswordRequest): Promise<ForgotPasswordResponse> => {
    const response = await axiosInstance.post<ForgotPasswordResponse>('/auth/forgot-password/request', data);
    return response.data;
  },

  resetPassword: async (data: ResetPasswordRequest): Promise<ForgotPasswordResponse> => {
    const response = await axiosInstance.post<ForgotPasswordResponse>('/auth/forgot-password/reset', data);
    return response.data;
  },

  getMe: async (): Promise<User> => {
    const response = await axiosInstance.get<User>('/auth/me');
    return response.data;
  },

  updateProfile: async (data: UpdateProfileRequest): Promise<User> => {
    const response = await axiosInstance.put<User>('/auth/profile', data);
    return response.data;
  },

  getMyTickets: async (): Promise<any[]> => {
    const response = await axiosInstance.get<any[]>('/auth/my-tickets');
    return response.data;
  },

  logout: async (): Promise<void> => {
    await axiosInstance.post('/auth/logout');
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  },

  refreshToken: async (token: string): Promise<any> => {
    const response = await axiosInstance.post('/auth/refresh', { refreshToken: token });
    return response.data;
  },
};
