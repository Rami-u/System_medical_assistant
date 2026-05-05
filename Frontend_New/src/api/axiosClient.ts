import axios from 'axios'

const axiosClient = axios.create({
  baseURL: 'http://localhost:8005',
  headers: { 'Content-Type': 'application/json' }
})

axiosClient.interceptors.request.use(config => {
  const token = localStorage.getItem('access_token')
  if (token) config.headers.Authorization = `Bearer ${token}`
  return config
})

axiosClient.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.clear()
      window.location.href = '/auth'
    }
    return Promise.reject(error)
  }
)

export default axiosClient
