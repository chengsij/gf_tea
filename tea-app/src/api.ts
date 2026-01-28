import axios from 'axios';
import { z } from 'zod';

import { TeaSchema, CreateTeaSchema } from './types';
import type { Tea, CreateTea } from './types';
import { getAuthToken } from './AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

// Create axios instance with auth interceptor
const api = axios.create({
  baseURL: API_URL,
});

// Add auth token to all requests
api.interceptors.request.use((config) => {
  const token = getAuthToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle 401 responses
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Clear token and reload to show login page
      localStorage.removeItem('auth_token');
      window.location.reload();
    }
    return Promise.reject(error);
  }
);

export const getTeas = async (): Promise<Tea[]> => {
  const response = await api.get('/teas');
  return z.array(TeaSchema).parse(response.data);
};

export const createTea = async (tea: CreateTea): Promise<Tea> => {
  const response = await api.post('/teas', tea);
  return TeaSchema.parse(response.data);
};

export const importTeaFromUrl = async (url: string): Promise<CreateTea> => {
  const response = await api.post('/teas/import', { url });
  console.log(`response: ${response}`)
  console.log(`response.status: ${response.status}`)
  return CreateTeaSchema.parse(response.data);
};

export const deleteTea = async (id: string): Promise<void> => {
  await api.delete(`/teas/${id}`);
};

export const updateTea = async (id: string, updates: Partial<Tea>): Promise<Tea> => {
  const response = await api.patch(`/teas/${id}`, updates);
  return TeaSchema.parse(response.data);
};

export const markTeaConsumed = async (id: string): Promise<Tea> => {
  const response = await api.put(`/teas/${id}/lastConsumed`);
  return TeaSchema.parse(response.data);
};

export const downloadTeasYaml = async (): Promise<void> => {
  const response = await api.get('/teas/export', { responseType: 'blob' });
  const url = window.URL.createObjectURL(new Blob([response.data]));
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', 'teas.yaml');
  document.body.appendChild(link);
  link.click();
  link.remove();
};
