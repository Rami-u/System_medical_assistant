import axiosClient from './axiosClient';

export interface UserResponse {
  id: number;
  email: string;
  full_name: string;
  role: string;
  role_id: number;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
  expires_in: number;
  user: UserResponse;
}

export const authApi = {
  login: async (credentials: any): Promise<TokenResponse> => {
    const response = await axiosClient.post('/auth/login', credentials);
    return response.data;
  },
  registerPatient: async (data: any) => {
    console.log('Registering as:', 'patient');
    console.log('Sending data:', JSON.stringify(data));
    try {
      const response = await axiosClient.post('/auth/register/patient', data);
      return response.data;
    } catch (error: any) {
      console.error('Full error:', error.response?.status, error.response?.data);
      throw error;
    }
  },
  registerDoctor: async (data: any) => {
    console.log('Registering as:', 'doctor');
    console.log('Sending data:', JSON.stringify(data));
    try {
      const response = await axiosClient.post('/auth/register/doctor', data);
      return response.data;
    } catch (error: any) {
      console.error('Full error:', error.response?.status, error.response?.data);
      throw error;
    }
  },
  me: async () => {
    const response = await axiosClient.get('/auth/me');
    return response.data;
  }
};
