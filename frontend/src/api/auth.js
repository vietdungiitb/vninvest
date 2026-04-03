import apiClient from './client';

/**
 * Auth API functions for JWT.
 */
export const login = (username, password) => apiClient.post('/auth/token/', { username, password });

export const register = (payload) => apiClient.post('/auth/register/', payload);

export const verifyEmail = (token) => apiClient.post('/auth/verify-email/', { token });

export const resendVerification = (identifier) => apiClient.post('/auth/resend-verification/', { identifier });

export const refreshToken = (refresh) => apiClient.post('/auth/token/refresh/', { refresh });

export const getUserConfig = () => apiClient.get('/portfolio/userconfig/');

export const updateUserConfig = (data) => apiClient.put('/portfolio/userconfig/', data);
