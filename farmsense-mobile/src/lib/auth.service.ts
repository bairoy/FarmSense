import { api } from "@/lib/api";

interface User {
  id: string;
  name: string;
  email: string;
}

interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export const login = async (email: string, password: string) => {
  const { data } = await api.post<LoginResponse>("/auth/login", { email, password });
  return data;
};

export const signup = async (name: string, email: string, password: string) => {
  const { data } = await api.post<{ message: string; user: User }>("/auth/signup", {
    name,
    email,
    password,
  });
  return data;
};
