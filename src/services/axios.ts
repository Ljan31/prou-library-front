import axios, { type AxiosError, type InternalAxiosRequestConfig } from "axios";

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8098";

const api = axios.create({
  baseURL: `${BASE_URL}/api`,
  timeout: 15_000,
  // headers: { "Content-Type": "application/json" },
});

// ─── Request interceptor: attach JWT ──────────────────────────────────────
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = localStorage.getItem("sigeb_token");
  if (token && config.headers) {
    config.headers["Authorization"] = `Bearer ${token}`;
  }
  // 👇 SOLO si no es FormData
  if (!(config.data instanceof FormData)) {
    config.headers["Content-Type"] = "application/json";
  } else {
    delete config.headers["Content-Type"]; // deja que Axios lo maneje
  }
  return config;
});

// ─── Response interceptor: handle 401 globally ────────────────────────────
api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      // Token expired / invalid → clear session and redirect
      localStorage.removeItem("sigeb_token");
      // Avoid circular import by using window.location directly
      if (window.location.pathname !== "/login") {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  },
);

export default api;
