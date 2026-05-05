import axiosClient from './axiosClient';

export const glucoseApi = {
  getLogs: async (days: number = 7) => {
    const res = await axiosClient.get(`/glucose/logs?days=${days}`);
    return res.data;
  },
  getStats: async (days: number = 7) => {
    const res = await axiosClient.get(`/glucose/stats?days=${days}`);
    return res.data;
  },
  addLog: async (data: any) => {
    const res = await axiosClient.post('/glucose/log', data);
    return res.data;
  }
};
