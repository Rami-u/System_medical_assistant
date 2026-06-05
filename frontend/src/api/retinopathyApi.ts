import axiosClient from './axiosClient';

export interface RetinopathyResult {
  grade: number;
  label: string;
  confidence: number;
  raw_score: number;
  recommendation: string;
}

export const retinopathyApi = {
  predict: async (file: File): Promise<RetinopathyResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosClient.post('/retinopathy/predict', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
    return res.data;
  },
};
