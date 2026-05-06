import axiosClient from './axiosClient';

export const mealApi = {
  uploadMeal: async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosClient.post('/meal/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },
  confirmMeal: async (data: any) => {
    const res = await axiosClient.post('/meal/confirm', data);
    return res.data;
  },
  // GET /meal/ — returns list of meal logs (most recent first)
  getMealLogs: async (limit: number = 50) => {
    const cappedLimit = Math.min(limit, 100);
    const res = await axiosClient.get(`/meal/?skip=0&limit=${cappedLimit}`);
    return res.data; // returns MealLogResponse[]
  },
  getLogs: async (days: number = 7) => {
    const res = await axiosClient.get(`/meal/?skip=0&limit=100`);
    return res.data;
  },
  addLog: async (data: any) => {
    const res = await axiosClient.post('/meal/confirm', data);
    return res.data;
  }
};
