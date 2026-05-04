import axios from 'axios';

const API_BASE = (import.meta.env.VITE_API_URL || 'https://task-manager-web-7q9e.onrender.com').replace(/\/$/, '');

const api = axios.create({
  baseURL: `${API_BASE}/api`,
  headers: {
    'Content-Type': 'application/json',
  },
  timeout: 15000,
});

// ── Request interceptor: attach auth token + debug logging ──────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const fullUrl = `${config.baseURL}${config.url}`;
    console.log(
      `[API REQUEST] ${config.method?.toUpperCase()} ${fullUrl}`,
      config.data ? { body: config.data } : ''
    );

    return config;
  },
  (error) => {
    console.error('[API REQUEST ERROR]', error.message);
    return Promise.reject(error);
  }
);

// ── Response interceptor: log successes + meaningful 404 handling ────────────
api.interceptors.response.use(
  (response) => {
    console.log(
      `[API RESPONSE] ${response.status} ${response.config?.method?.toUpperCase()} ${response.config?.url}`
    );
    return response;
  },
  (error) => {
    const status = error.response?.status;
    const url = error.config?.url;
    const method = error.config?.method?.toUpperCase();
    const serverMessage = error.response?.data?.message;

    if (status === 404) {
      console.error(
        `[API 404] Route not found: ${method} ${url}\n` +
        `Full URL: ${error.config?.baseURL}${url}\n` +
        `Check that this endpoint exists on the backend.`
      );
    } else {
      console.error(
        `[API ERROR] ${status || 'NETWORK'} on ${method} ${url}:`,
        serverMessage || error.message
      );
    }

    return Promise.reject(error);
  }
);

export default api;
