import axiosClient from './axiosClient';

export const glucoseApi = {
  // Backend uses skip/limit, NOT days — filter by date client-side
  getLogs: async (limit: number = 100) => {
    const res = await axiosClient.get(`/glucose/logs?skip=0&limit=${limit}`);
    return res.data; // GlucoseLogResponse[]
  },
  // Backend stats endpoint DOES support ?days=
  getStats: async (days: number = 7) => {
    const res = await axiosClient.get(`/glucose/stats?days=${days}`);
    return res.data;
  },
  addLog: async (data: any) => {
    const res = await axiosClient.post('/glucose/logs', data);
    return res.data;
  }
};
