import apiClient from './client';

/**
 * Auth API functions for JWT.
 */
export const login = (username, password) => apiClient.post('/auth/token/', { username, password });

export const register = (payload) => apiClient.post('/auth/register/', payload);

export const verifyEmail = (token) => apiClient.post('/auth/verify-email/', { token });

export const resendVerification = (identifier) => apiClient.post('/auth/resend-verification/', { identifier });

export const requestPasswordReset = (identifier) => apiClient.post('/auth/password-reset/request/', { identifier });

export const confirmPasswordReset = (token, newPassword, newPasswordConfirm) => apiClient.post('/auth/password-reset/confirm/', {
	token,
	new_password: newPassword,
	new_password_confirm: newPasswordConfirm,
});

export const refreshToken = (refresh) => apiClient.post('/auth/token/refresh/', { refresh });

export const getCapabilitySnapshot = () => apiClient.get('/core/v1/access/capabilities/');

export const getUserConfig = () => apiClient.get('/portfolio/userconfig/');

export const updateUserConfig = (data) => apiClient.put('/portfolio/userconfig/', data);
