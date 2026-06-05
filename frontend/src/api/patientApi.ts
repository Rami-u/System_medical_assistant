import axiosClient from './axiosClient';

export const patientApi = {
  getProfile: async () => {
    const res = await axiosClient.get('/patient/profile');
    return res.data;
  },
  getDashboard: async () => {
    const res = await axiosClient.get('/patient/dashboard');
    return res.data;
  },
  getStats: async () => {
    const res = await axiosClient.get('/patient/stats');
    return res.data;
  }
};
