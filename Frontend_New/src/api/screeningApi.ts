import axiosClient from './axiosClient';

export const screeningApi = {
  getQuestions: async (type: string) => {
    const res = await axiosClient.get(`/screening/questions/${type}`);
    return res.data;
  },
  predict: async (data: any) => {
    const res = await axiosClient.post('/screening/predict', data);
    return res.data;
  },
  getHistory: async () => {
    const res = await axiosClient.get('/screening/history');
    return res.data;
  }
};
