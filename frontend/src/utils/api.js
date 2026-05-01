import axios from 'axios';

const API = import.meta.env.VITE_API_URL || 'https://task-manager-web-7q9e.onrender.com';

const api = axios.create({
  baseURL: `${API}/api`,
  headers: {
    "Content-Type": "application/json"
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default api;
