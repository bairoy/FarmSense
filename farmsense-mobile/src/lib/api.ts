import axios, { create as createAxiosInstance } from "axios";

import { useAuthStore } from "@/store/authStore";

const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:5050/api";

export const api = createAxiosInstance({
  baseURL: API_BASE_URL,
  // Without a default, a wrong or unreachable API_BASE_URL (the common case:
  // EXPO_PUBLIC_API_URL still pointing at "localhost", which resolves to the
  // device itself, not the dev machine) hangs on login/signup until the OS's
  // own TCP timeout — a minute or more — and looks exactly like a frozen app
  // instead of a clear, fast error.
  timeout: 15_000,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

/**
 * Single-flight token refresh, ported from the web client. Without this,
 * multiple concurrent 401s each fire their own refresh request; with
 * refresh-token rotation, the later responses invalidate the token the first
 * one returned, logging the user out mid-session.
 */
let refreshPromise: Promise<{ accessToken: string; refreshToken: string }> | null = null;

const doRefresh = async (refreshToken: string) => {
  const res = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken }, { timeout: 15_000 });
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
        return Promise.reject(error);
      }

      try {
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
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
