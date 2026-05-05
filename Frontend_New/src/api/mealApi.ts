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
  getLogs: async (days: number = 7) => {
    const res = await axiosClient.get(`/meal/logs?days=${days}`);
    return res.data;
  }
};
