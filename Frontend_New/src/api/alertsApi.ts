import axiosClient from './axiosClient';

export const alertsApi = {
  getPatientAlerts: async () => {
    const res = await axiosClient.get('/alerts');
    return res.data;
  },
  markPatientAlertRead: async (id: number) => {
    const res = await axiosClient.put(`/alerts/${id}/read`);
    return res.data;
  },
  getDoctorAlerts: async () => {
    const res = await axiosClient.get('/doctor/alerts');
    return res.data;
  },
  markDoctorAlertRead: async (id: number) => {
    const res = await axiosClient.put(`/doctor/alerts/${id}/read`);
    return res.data;
  }
};
