import axiosClient from './axiosClient';

export const doctorApi = {
  getDashboard: async () => {
    const res = await axiosClient.get('/doctor/dashboard');
    return res.data;
  },
  getPatients: async (risk?: string, search?: string) => {
    const params = new URLSearchParams();
    if (risk) params.append('risk', risk);
    if (search) params.append('search', search);
    const res = await axiosClient.get(`/doctor/patients?${params.toString()}`);
    console.log("Patients response:", res.data);
    return res.data;
  },
  getPatientProfile: async (id: number) => {
    const res = await axiosClient.get(`/doctor/patients/${id}/profile`);
    return res.data;
  },
  getPatientGlucose: async (id: number, days: number = 30) => {
    const res = await axiosClient.get(`/doctor/patients/${id}/glucose?days=${days}`);
    return res.data;
  },
  getAlerts: async () => {
    const res = await axiosClient.get('/doctor/alerts');
    return res.data;
  },
  markAlertRead: async (id: number) => {
    const res = await axiosClient.put(`/doctor/alerts/${id}/read`);
    return res.data;
  },
  createNote: async (patientId: number, noteText: string, priority: string = "routine") => {
    const res = await axiosClient.post('/doctor/notes', {
      patient_id: patientId,
      note_text: noteText,
      priority: priority
    });
    return res.data;
  }
};
