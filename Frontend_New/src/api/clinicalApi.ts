import axiosClient from './axiosClient';

export const clinicalApi = {
  getNotes: async (patientId: number) => {
    const res = await axiosClient.get(`/doctor/notes/${patientId}`);
    return res.data;
  },
  createNote: async (data: any) => {
    const res = await axiosClient.post('/doctor/notes', data);
    return res.data;
  }
};
