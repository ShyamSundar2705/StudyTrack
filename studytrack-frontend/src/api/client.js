import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import { navigationRef } from '../navigation/navigationRef';
import useUserStore from '../store/useUserStore';

export const TOKEN_KEY = 'studytrack_token';

const client = axios.create({
  baseURL: process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000/api',
  timeout: 10_000,
  headers: { 'Content-Type': 'application/json' },
});

client.interceptors.request.use(async (config) => {
  const token = await SecureStore.getItemAsync(TOKEN_KEY);
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  async (error) => {
    if (error.response?.status === 401) {
      await SecureStore.deleteItemAsync(TOKEN_KEY);
      useUserStore.getState().reset();
      navigationRef.current?.reset({ index: 0, routes: [{ name: 'Auth' }] });
    }
    return Promise.reject(error);
  }
);

export default client;
