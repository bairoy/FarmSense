import axios from "axios";
import { useAuthStore } from "../store/authStore";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5050/api";

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: false,
});

// Attach access token automatically
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/**
 * Single-flight token refresh.
 *
 * Without this, multiple concurrent 401s each fire their own refresh request.
 * With refresh-token rotation enabled, the later responses invalidate the
 * token the first one returned, logging the user out mid-session. Holding one
 * promise and having all waiters await it means exactly one refresh happens.
 */
let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null;

const doRefresh = async (refreshToken: string) => {
  const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
  return {
    accessToken: res.data.accessToken as string,
    refreshToken: res.data.refreshToken as string,
  };
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      const { refreshToken, user } = useAuthStore.getState();

      if (!refreshToken) {
        useAuthStore.getState().logout();
        window.location.href = "/login";
        return Promise.reject(error);
      }

      try {
        // Single-flight: reuse in-flight refresh or start one
        if (!refreshPromise) {
          refreshPromise = doRefresh(refreshToken);
        }

        const tokens = await refreshPromise;
        refreshPromise = null;

        useAuthStore.getState().login(user!, tokens.accessToken, tokens.refreshToken);

        originalRequest.headers.Authorization = `Bearer ${tokens.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        refreshPromise = null;
        useAuthStore.getState().logout();
        window.location.href = "/login";
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
