const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001';

export const apiUrl = (path: string): string => `${API_BASE_URL}${path}`;
