/**
 * auth.js
 *
 * Auth and Identity access domain endpoints for coreApiAdapter.
 */

import { normalizeRefreshResponsePayload } from "./transport.js";

export function createAuthClient({ coreGet, corePost, corePatch, persistTokens, getRefreshToken }) {
  return {
    /**
     * Get tenant lifecycle/subscription status (requires authentication).
     * @returns {Promise<object>}
     */
    getTenantLifecycle() {
      return coreGet("/tenant/lifecycle/");
    },

    /**
     * Login user via native public token endpoint.
     * On success, persists access/refresh tokens through configured token storage callback.
     * @param {{username: string, password: string}} payload
     * @returns {Promise<object>}
     */
    async loginUser(payload) {
      const responsePayload = await corePost("/auth/token/", {
        username: String(payload?.username || "").trim(),
        password: String(payload?.password || ""),
      });
      const tokenPayload = normalizeRefreshResponsePayload(responsePayload);
      if (tokenPayload?.access) {
        persistTokens(tokenPayload);
      }
      return responsePayload;
    },

    /**
     * Refresh access token via public refresh endpoint and persist latest tokens.
     * @param {string} [refresh]
     * @returns {Promise<object>}
     */
    async refreshAuthToken(refresh) {
      const refreshValue = String(refresh || getRefreshToken?.() || "").trim();
      const responsePayload = await corePost("/auth/token/refresh/", {
        refresh: refreshValue,
      });
      const tokenPayload = normalizeRefreshResponsePayload(responsePayload);
      if (tokenPayload?.access) {
        persistTokens(tokenPayload);
      }
      return responsePayload;
    },

    /**
     * Register a new user through native public auth endpoint.
     * Web anti-spam fields `website` (honeypot) and `turnstile_token` are forwarded as-is.
     * @param {{username: string, email: string, password: string, password_confirm?: string, website?: string, turnstile_token?: string}} payload
     * @returns {Promise<object>}
     */
    registerUser(payload) {
      return corePost("/auth/register/", {
        username: String(payload?.username || "").trim(),
        email: String(payload?.email || "").trim().toLowerCase(),
        password: String(payload?.password || ""),
        password_confirm: String(payload?.password_confirm || payload?.password || ""),
        website: String(payload?.website || ""),
        turnstile_token: String(payload?.turnstile_token || ""),
      });
    },

    /**
     * Request to resend email verification link.
     * @param {string} email
     * @returns {Promise<object>}
     */
    resendVerificationEmail(email) {
      return corePost("/auth/resend-verification/", {
        email: String(email || "").trim().toLowerCase(),
      });
    },

    /**
     * Verify email by one-time token.
     * @param {string} token
     * @returns {Promise<object>}
     */
    verifyEmailToken(token) {
      return corePost("/auth/verify-email/", {
        token: String(token || "").trim(),
      });
    },

    /**
     * Request password reset email.
     * @param {string} email
     * @returns {Promise<object>}
     */
    requestPasswordReset(email) {
      return corePost("/auth/password-reset/", {
        email: String(email || "").trim().toLowerCase(),
      });
    },

    /**
     * Confirm password reset by token.
     * @param {string} token
     * @param {string} newPassword
     * @param {string} newPasswordConfirm
     * @returns {Promise<object>}
     */
    confirmPasswordReset(token, newPassword, newPasswordConfirm) {
      return corePost("/auth/password-reset/confirm/", {
        token: String(token || "").trim(),
        new_password: String(newPassword || ""),
        new_password_confirm: String(newPasswordConfirm || ""),
      });
    },

    /**
     * Get the profile for the currently authenticated user.
     * @returns {Promise<object>}
     */
    getUserProfile() {
      return coreGet("/identity/profile/");
    },

    /**
     * Update the authenticated user's profile.
     * @param {{ display_name?: string, avatar_url?: string, language?: string, theme?: string, whale_alert_threshold?: number }} data
     * @returns {Promise<object>}
     */
    updateUserProfile(data) {
      return corePatch("/identity/profile/", data);
    },

    /**
     * Change the authenticated user's password (verifies current password).
     * @param {{ current_password: string, new_password: string, new_password_confirm: string }} data
     * @returns {Promise<object>}
     */
    changeUserPassword(data) {
      return corePost("/auth/password-change/", {
        current_password: String(data?.current_password || ""),
        new_password: String(data?.new_password || ""),
        new_password_confirm: String(data?.new_password_confirm || ""),
      });
    },
  };
}