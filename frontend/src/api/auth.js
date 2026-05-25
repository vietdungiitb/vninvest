import apiClient from './client';
import { coreApiAdapter } from '@vninvest/web';

/**
 * @deprecated Legacy auth API shim for rollback window only.
 * Production auth flows must use packages/web auth pages + coreApiAdapter.
 */

function wrapAdapterPayload(promise) {
	return promise.then((data) => ({ data }));
}

export const login = (username, password) => wrapAdapterPayload(
	coreApiAdapter.loginUser({ username, password }),
);

export const register = (payload) => wrapAdapterPayload(
	coreApiAdapter.registerUser(payload),
);

export const verifyEmail = (token) => wrapAdapterPayload(
	coreApiAdapter.verifyEmailToken(token),
);

export const resendVerification = (identifier) => wrapAdapterPayload(
	coreApiAdapter.resendVerificationEmail(identifier),
);

export const requestPasswordReset = (identifier) => wrapAdapterPayload(
	coreApiAdapter.requestPasswordReset(identifier),
);

export const confirmPasswordReset = (token, newPassword, newPasswordConfirm) => wrapAdapterPayload(
	coreApiAdapter.confirmPasswordReset(token, newPassword, newPasswordConfirm),
);

export const refreshToken = (refresh) => wrapAdapterPayload(
	coreApiAdapter.refreshAuthToken(refresh),
);

export const getCapabilitySnapshot = () => apiClient.get('/core/v1/access/capabilities/');

export const getUserConfig = () => apiClient.get('/portfolio/userconfig/');

export const updateUserConfig = (data) => apiClient.put('/portfolio/userconfig/', data);
