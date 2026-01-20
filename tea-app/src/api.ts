import axios from 'axios';
import { z } from 'zod';

import { TeaSchema, CreateTeaSchema } from './types';
import type { Tea, CreateTea } from './types';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

export const getTeas = async (): Promise<Tea[]> => {
  const response = await axios.get(`${API_URL}/teas`);
  return z.array(TeaSchema).parse(response.data);
};

export const createTea = async (tea: CreateTea): Promise<Tea> => {
  const response = await axios.post(`${API_URL}/teas`, tea);
  return TeaSchema.parse(response.data);
};

export const importTeaFromUrl = async (url: string): Promise<CreateTea> => {
  const response = await axios.post(`${API_URL}/teas/import`, { url });
  return CreateTeaSchema.parse(response.data);
};

export const deleteTea = async (id: string): Promise<void> => {
  await axios.delete(`${API_URL}/teas/${id}`);
};

export const updateTea = async (id: string, updates: Partial<Tea>): Promise<Tea> => {
  const url = `${API_URL}/teas/${id}`;
  console.log('[DEBUG] updateTea called');
  console.log(`  URL: ${url}`);
  console.log(`  ID: ${id}`);
  console.log(`  Updates: ${JSON.stringify(updates)}`);
  const response = await axios.patch(url, updates);
  console.log(`  Response status: ${response.status}`);
  console.log(`  Response data: ${JSON.stringify(response.data)}`);
  return TeaSchema.parse(response.data);
};
