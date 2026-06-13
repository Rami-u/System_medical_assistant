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
  },

  // ── SSE Streaming ──
  sendMessageStream: (conversationId: number, message: string): EventSource => {
    const token = localStorage.getItem('access_token');
    const url = `http://localhost:8005/ai/conversations/${conversationId}/messages/stream`;
    // Use fetch-based SSE since EventSource doesn't support POST
    return { url, token, message } as any;
  },

  // ── Image Upload ──
  sendMessageWithImage: async (
    conversationId: number,
    message: string,
    file?: File | null,
  ) => {
    const formData = new FormData();
    formData.append('message', message);
    if (file) formData.append('file', file);
    const res = await axiosClient.post(
      `/ai/conversations/${conversationId}/messages-with-image`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return res.data;
  },

  // ── Feedback ──
  submitFeedback: async (messageId: number, feedback: 'positive' | 'negative') => {
    const res = await axiosClient.post(`/ai/messages/${messageId}/feedback`, { feedback });
    return res.data;
  },

  // ── Search ──
  searchConversations: async (query: string) => {
    const res = await axiosClient.post('/ai/search', { query });
    return res.data;
  },

  // ── Export ──
  exportConversation: async (conversationId: number, format: 'markdown' | 'text' = 'markdown') => {
    const res = await axiosClient.post(
      `/ai/conversations/${conversationId}/export`,
      { format },
      { responseType: 'blob' },
    );
    return res.data;
  },

  // ── Delete ──
  deleteConversation: async (conversationId: number) => {
    const res = await axiosClient.delete(`/ai/conversations/${conversationId}`);
    return res.data;
  },

  // ── Doctor endpoints ──
  getPatientConversations: async (patientId: number) => {
    const res = await axiosClient.get(`/ai/doctor/patients/${patientId}/conversations`);
    return res.data;
  },
};

// ── SSE Stream helper ──
export async function fetchSSEStream(
  conversationId: number,
  message: string,
  onToken: (token: string) => void,
  onDone: () => void,
  onEvent?: (event: any) => void,
  onError?: (error: string) => void,
): Promise<AbortController> {
  const controller = new AbortController();
  const token = localStorage.getItem('access_token');

  try {
    const response = await fetch(
      `http://localhost:8005/ai/conversations/${conversationId}/messages/stream`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ message }),
        signal: controller.signal,
      },
    );

    if (!response.ok) {
      onError?.(`HTTP ${response.status}`);
      return controller;
    }

    const reader = response.body?.getReader();
    if (!reader) {
      onError?.('No response body');
      return controller;
    }

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') {
          onDone();
          continue;
        }
        try {
          const data = JSON.parse(payload);
          if (data.token) {
            onToken(data.token);
          } else if (data.type === 'user_message' && onEvent) {
            onEvent(data);
          } else if (data.type === 'ai_message' && onEvent) {
            onEvent(data);
          } else if (data.type === 'alerts' && onEvent) {
            onEvent(data);
          } else if (data.type === 'error' && onError) {
            onError(data.detail);
          }
        } catch {
          // ignore JSON parse errors
        }
      }
    }
  } catch (err: any) {
    if (err.name !== 'AbortError') {
      onError?.(err.message || 'Stream error');
    }
  }

  return controller;
}
