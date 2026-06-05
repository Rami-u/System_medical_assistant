import axiosClient from './axiosClient';

export interface MealUploadItem {
  food_name: string;
  quantity_desc: string;
  confidence_pct: number;
  carbs_g: number;
  calories: number;
  protein_g: number;
  fat_g: number;
}

export interface MealUploadResult {
  meal_name: string;
  items: MealUploadItem[];
  detected_items?: MealUploadItem[];
  task_id: string | null;
  enriched: boolean;
}

export const mealApi = {
  uploadMeal: async (file: File): Promise<MealUploadResult> => {
    const formData = new FormData();
    formData.append('file', file);
    const res = await axiosClient.post('/meal/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
    return res.data;
  },
  confirmMeal: async (data: Record<string, unknown>) => {
    const res = await axiosClient.post('/meal/confirm', data);
    return res.data;
  },
  getMealLogs: async (limit: number = 50) => {
    const cappedLimit = Math.min(limit, 100);
    const res = await axiosClient.get(`/meal/?skip=0&limit=${cappedLimit}`);
    return res.data;
  },
  getLogs: async (days: number = 7) => {
    const res = await axiosClient.get(`/meal/?skip=0&limit=100`);
    return res.data;
  },
  addLog: async (data: Record<string, unknown>) => {
    const res = await axiosClient.post('/meal/confirm', data);
    return res.data;
  }
};
