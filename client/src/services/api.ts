import axios, { AxiosInstance, InternalAxiosRequestConfig, AxiosError } from "axios";
import { API_URL } from "../config";

const api: AxiosInstance = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json"
  }
});

api.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = sessionStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error: AxiosError) => {
    return Promise.reject(error);
  }
);

api.interceptors.response.use(
  (response) => response,
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      sessionStorage.removeItem("token");
      window.location.href = "/auth?mode=signin";
    }
    return Promise.reject(error);
  }
);

export const getPlatformStats = async (): Promise<any> => {
  const response = await api.get("/stats/platform");
  return response.data.data;
};

export default api;
