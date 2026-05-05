import axiosClient from './axiosClient';

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  role: string;
}

export const authApi = {
  login: async (credentials: any): Promise<TokenResponse> => {
    const response = await axiosClient.post('/auth/login', credentials);
    return response.data;
  },
  registerPatient: async (data: any) => {
    const response = await axiosClient.post('/auth/register/patient', data);
    return response.data;
  },
  registerDoctor: async (data: any) => {
    const response = await axiosClient.post('/auth/register/doctor', data);
    return response.data;
  },
  me: async () => {
    const response = await axiosClient.get('/auth/me');
    return response.data;
  }
};
