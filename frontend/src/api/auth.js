import apiClient from './client';

/**
 * Auth API functions for JWT.
 */
export const login = (username, password) => apiClient.post('/auth/token/', { username, password });

export const refreshToken = (refresh) => apiClient.post('/auth/token/refresh/', { refresh });

export const getUserConfig = () => apiClient.get('/portfolio/userconfig/');

export const updateUserConfig = (data) => apiClient.put('/portfolio/userconfig/', data);
