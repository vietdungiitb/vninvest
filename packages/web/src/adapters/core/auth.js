/**
 * auth.js
 *
 * Auth and Identity access domain endpoints for coreApiAdapter.
 */

import { normalizeRefreshResponsePayload } from "./transport.js";

/**
 * The backend lowercases the username when creating an account
 * (identity_access/serializers.py:388 `return val_clean.lower()`), but the login
 * view then calls `authenticate(username=<the string the client sent>)`
 * (identity_access/views/login.py:124) and Django's ModelBackend performs an
 * EXACT `User.objects.get(username=...)` lookup. A user who registered as
 * `VietDung` is stored as `vietdung`, so signing in as `VietDung` fails with
 * `invalid_credentials` on a correct password — `login.py:113` finds the row
 * with `username__iexact` for the active check, then `:124` throws it away.
 *
 * Normalizing here rather than in the page means every caller is protected,
 * including PortfolioContext's own `login`.
 */
function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

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
     * The username is lowercased: the backend stores usernames lowercased and
     * authenticates with an exact match, so a mixed-case sign-in would otherwise
     * fail on a correct password.
     * @param {{username: string, password: string}} payload
     * @returns {Promise<object>}
     */
    async loginUser(payload) {
      const responsePayload = await corePost("/auth/token/", {
        username: normalizeUsername(payload?.username),
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
     * The username is lowercased to match the server's own normalisation
     * (identity_access/serializers.py:388) so the value shown after
     * registration is the value that will be stored.
     * @param {{username: string, email: string, password: string, password_confirm?: string, website?: string, turnstile_token?: string, first_name?: string, last_name?: string}} payload
     * @returns {Promise<object>}
     */
    registerUser(payload) {
      return corePost("/auth/register/", {
        username: normalizeUsername(payload?.username),
        email: String(payload?.email || "").trim().toLowerCase(),
        password: String(payload?.password || ""),
        password_confirm: String(payload?.password_confirm || payload?.password || ""),
        website: String(payload?.website || ""),
        turnstile_token: String(payload?.turnstile_token || ""),
        ...(payload?.first_name ? { first_name: String(payload.first_name) } : {}),
        ...(payload?.last_name ? { last_name: String(payload.last_name) } : {}),
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
     *
     * The canonical field is `new_password`, and that is all this sends. A
     * temporary shim that also sent the legacy `password` name was tried and
     * reverted: the backend gap belongs to slice A, not to the client, and
     * duplicating a secret field on a credential endpoint is not something to
     * leave behind "just in case".
     *
     * KNOWN BACKEND GAP (not a client defect, reported to slice A):
     * identity_access/views/password_reset.py:77 still reads the legacy name
     *   new_password = str(request.data.get('password', '') or '')
     * so `new_password` arrives as '' and line :79 rejects the request with
     * "token and password are required." Password reset is therefore 100%
     * broken on the current backend for every user, regardless of password.
     * It is pinned by a test in src/pages/auth/tenantreg-auth-errors.component.test.ts
     * that reads the real Python source, so the shim decision cannot silently rot.
     *
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