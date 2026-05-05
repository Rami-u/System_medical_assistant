import axiosClient from './axiosClient';

export const settingsApi = {
  getProfile: async () => {
    const res = await axiosClient.get('/settings/profile');
    return res.data;
  },
  updateProfile: async (data: any) => {
    const res = await axiosClient.put('/settings/profile', data);
    return res.data;
  },
  getPreferences: async () => {
    const res = await axiosClient.get('/settings/preferences');
    return res.data;
  },
  updatePreferences: async (data: any) => {
    const res = await axiosClient.put('/settings/preferences', data);
    return res.data;
  },
  updatePassword: async (data: any) => {
    const res = await axiosClient.put('/settings/password', data);
    return res.data;
  }
};
