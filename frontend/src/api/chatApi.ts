import axiosClient from './axiosClient';

export const chatApi = {
  startConversation: async (title?: string) => {
    const res = await axiosClient.post('/ai/conversations', { title });
    return res.data;
  },
  sendMessage: async (conversationId: number, message: string) => {
    const res = await axiosClient.post(`/ai/conversations/${conversationId}/messages`, { message });
    return res.data;
  },
  getConversations: async () => {
    const res = await axiosClient.get('/ai/conversations');
    return res.data;
  },
  getConversationDetail: async (conversationId: number) => {
    const res = await axiosClient.get(`/ai/conversations/${conversationId}`);
    return res.data;
  }
};
