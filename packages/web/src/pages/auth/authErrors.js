/**
 * tenantreg-d (slice D) — D4 + D5: one parser for every auth error shape.
 *
 * Two defects are fixed here.
 *
 * D4 — silently dropped 4xx field errors.
 * `AuthRegisterPage` whitelisted exactly four keys
 * (`username, email, password_confirm, turnstile_token`) and took only the FIRST
 * value of `Object.values(detail)`. The backend can also return `password`,
 * `non_field_errors`, `website`, `first_name` — all lost. A user with a weak
 * password therefore saw an unmapped red line with no field highlighted, and a
 * user with several problems saw exactly one of them.
 *
 * D5 — no 429 handling, and Vietnamese leaking into the EN locale.
 * The register endpoint is limited to 3/min per IP and 2/min per email
 * (identity_access/views/register.py:41-80), so users WILL hit 429, and a typo
 * costs budget. The previous code dropped the backend's raw `detail` prose into
 * the banner, so an EN user read Vietnamese. The backend already sends a
 * machine-readable `code` in every error envelope
 * (vninvest_core/exceptions.py:21-30) and nothing read it.
 *
 * Error envelope shape (exceptions.py:16-74):
 *   { detail, code, timestamp, request_id, field_errors?: { field: [msg, ...] } }
 * `CoreApiRequestError` (adapters/core/transport.js:187-198, 229-257) surfaces
 * `.status`, `.code`, `.payload` and `.fieldErrors`
 * (= `payload.field_errors || payload.errors`).
 *
 * Legacy shape still supported: `{ detail: { field: [msg] } }` from a bare DRF
 * ValidationError, which several views still raise.
 */
import { PASSWORD_MIN_LENGTH } from "./authPolicy.js";

/**
 * Backend `code` -> i18n key.
 *
 * Registration collisions deliberately all collapse onto ONE key. Slice A
 * replaced the distinguishable `username_already_exists` / `email_already_exists`
 * pair with a single opaque `registration_unavailable`; the two legacy codes are
 * still live until that merges, and mapping them to the same neutral message
 * means no field is highlighted either way and nothing leaks about which of the
 * two collided.
 */
const CODE_TO_I18N_KEY = {
  // registration (slice A opaque + the two legacy codes it replaces)
  registration_unavailable: "auth.codeRegistrationUnavailable",
  username_already_exists: "auth.codeRegistrationUnavailable",
  email_already_exists: "auth.codeRegistrationUnavailable",
  // password policy
  weak_password: "auth.codeWeakPassword",
  password_too_short: "auth.codeWeakPassword",
  password_too_common: "auth.codeWeakPassword",
  password_entirely_numeric: "auth.codeWeakPassword",
  password_similar_to_username: "auth.codeWeakPassword",
  // login
  invalid_credentials: "auth.codeInvalidCredentials",
  authentication_error: "auth.codeInvalidCredentials",
  user_inactive: "auth.codeUserInactive",
  // tokens
  invalid_token: "auth.codeInvalidToken",
  invalid_refresh_token: "auth.codeInvalidToken",
  // rate limits
  register_rate_limit_exceeded: "auth.codeRegisterRateLimitExceeded",
  login_rate_limit_exceeded: "auth.codeLoginRateLimitExceeded",
  rate_limit_exceeded: "auth.codeRateLimitExceeded",
  password_reset_rate_limit_exceeded: "auth.codePasswordResetRateLimitExceeded",
  resend_cooldown_active: "auth.codeResendCooldownActive",
  verification_locked_out: "auth.codeRateLimitExceeded",
  // generic
  server_error: "auth.codeServerError",
  internal_error: "auth.codeServerError",
  activation_failed: "auth.codeServerError",
  resend_failed: "auth.codeServerError",
  validation_error: "auth.codeValidationError",
};

/** Keys the UI has no control for, so their text becomes a global message. */
const GLOBAL_FIELD_KEYS = new Set([
  "non_field_errors",
  "detail",
  // The honeypot. The backend deliberately answers a filled honeypot with a
  // fake "server error" so a bot cannot detect the trap
  // (serializers.py:412-415). Never render it next to a real field, and never
  // name it.
  "website",
]);

/** Backend field name -> the control that owns it on the register form. */
const REGISTER_FIELD_MAP = {
  username: "username",
  email: "email",
  password: "password",
  new_password: "password",
  password_confirm: "password_confirm",
  new_password_confirm: "password_confirm",
  turnstile_token: "turnstile_token",
};

export const DEFAULT_RATE_LIMIT_SECONDS = 60;

/** Normalise one field's value(s) into a clean list of non-empty strings. */
function toMessageList(value) {
  if (Array.isArray(value)) {
    return value
      .map((entry) => (typeof entry === "string" ? entry.trim() : String(entry ?? "").trim()))
      .filter(Boolean);
  }
  if (typeof value === "string" && value.trim()) return [value.trim()];
  if (value && typeof value === "object" && value.message) return [String(value.message).trim()];
  return [];
}

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

/**
 * Merge both error containers into one `{ field: string[] }` map.
 *
 * The standard envelope is preferred over the legacy `detail` object, but both
 * are read because a DRF `ValidationError` may be converted into
 * `field_errors` while `detail` still carries the original. Identical messages
 * are de-duplicated: showing "Password is too short" twice, once from each
 * container, is noise the user cannot act on.
 */
export function collectFieldErrors(error) {
  const merged = {};
  const add = (source) => {
    if (!isPlainObject(source)) return;
    Object.entries(source).forEach(([field, value]) => {
      toMessageList(value).forEach((message) => {
        const existing = merged[field];
        if (!existing) {
          merged[field] = [message];
        } else if (!existing.includes(message)) {
          existing.push(message);
        }
      });
    });
  };

  // Legacy first, so the standard envelope can be appended after it.
  const detail = error?.payload?.detail;
  if (isPlainObject(detail)) add(detail);
  // `error.fieldErrors` is already `payload.field_errors || payload.errors`.
  if (isPlainObject(error?.fieldErrors)) add(error.fieldErrors);
  if (isPlainObject(error?.payload?.field_errors)) add(error.payload.field_errors);

  return merged;
}

/**
 * `Retry-After` is not sent by the backend for these endpoints, and
 * `transport.js:360-368` only fires `onRateLimit` for `X-RateLimit-*` headers
 * that are also absent. So the countdown cannot be read off the response; the
 * honest fallback is the documented cooldown, stated in the copy.
 */
export function resolveRetryAfterSeconds(error) {
  const payload = error?.payload;
  const headerValue =
    payload?.retry_after ?? payload?.retryAfter ?? error?.retryAfterSeconds ?? null;
  const numeric = Number(headerValue);
  if (Number.isFinite(numeric) && numeric > 0) return Math.ceil(numeric);
  return DEFAULT_RATE_LIMIT_SECONDS;
}

/**
 * The `code` to act on.
 *
 * `transport.js:243-255` copies `payload.code` onto the error, but that is only
 * true for errors that came through the transport. Read the payload as well so
 * a hand-built `CoreApiRequestError`, a mocked adapter, or a future call site
 * cannot silently lose the machine-readable code and fall back to raw prose.
 */
export function resolveErrorCode(error) {
  const direct = typeof error?.code === "string" ? error.code.trim() : "";
  if (direct) return direct;
  const fromPayload = typeof error?.payload?.code === "string" ? error.payload.code.trim() : "";
  return fromPayload;
}

/**
 * Build the user-visible banner text.
 *
 * Priority, in order:
 *   1. a recognised `code`  -> our own localized wording
 *   2. any 429              -> localized rate-limit message with a countdown
 *   3. an UNRECOGNISED `code` -> localized fallback that still shows the code
 *   4. the backend `detail` -> only when there is no code AND the UI locale
 *                             matches the backend's language
 *   5. the caller's fallback key
 *
 * Rule 3 is what stops a new backend code from dumping untranslated prose into
 * the UI: an unknown code must never widen the blast radius to raw text.
 */
export function resolveGlobalMessage(error, t, options = {}) {
  const { fallbackKey, locale } = options;
  const code = resolveErrorCode(error);
  const status = Number(error?.status ?? 0);
  const seconds = resolveRetryAfterSeconds(error);
  const vars = { min: PASSWORD_MIN_LENGTH, seconds, code };

  const mappedKey = CODE_TO_I18N_KEY[code];
  if (mappedKey) {
    return t(mappedKey, vars);
  }

  if (status === 429) {
    return t("auth.rateLimited", vars);
  }

  if (code) {
    return t("auth.errorCodeUnknown", vars);
  }

  // The backend writes its prose in Vietnamese. Showing it verbatim is helpful
  // to a VI reader and wrong for everyone else, so it is only used when there is
  // no code to translate and the UI locale is VI.
  const detail = error?.payload?.detail;
  if (typeof detail === "string" && detail.trim()) {
    if (locale === "vi") return detail.trim();
    return t("auth.codeValidationError", vars);
  }

  if (typeof error?.message === "string" && error.message.trim() && locale === "vi") {
    return error.message.trim();
  }

  return t(fallbackKey ?? "auth.registerGlobalFailed", vars);
}

/** Localized generic text for a field the backend rejected. */
const FIELD_FALLBACK_KEY = {
  username: "auth.fieldInvalidUsername",
  email: "auth.fieldInvalidEmail",
  password: "auth.fieldInvalidPassword",
  password_confirm: "auth.fieldInvalidPasswordConfirm",
  turnstile_token: "auth.fieldInvalidTurnstile",
  token: "auth.fieldInvalidToken",
};

export function fieldFallbackKey(control) {
  return FIELD_FALLBACK_KEY[control] ?? "auth.fieldInvalidGeneric";
}

/**
 * Turn a raw error into everything a form needs.
 *
 * `fieldMap` maps backend field names onto control keys; anything unmapped
 * becomes a global message rather than disappearing (that was defect D4).
 * `showRawMessages` keeps the backend prose visible, which is correct for VI.
 */
export function parseAuthError(error, t, options = {}) {
  const { fieldMap = REGISTER_FIELD_MAP, fallbackKey, locale = "vi" } = options;
  const raw = collectFieldErrors(error);
  const showRawMessages = locale === "vi";

  const fieldErrors = {};
  const unmapped = [];

  Object.entries(raw).forEach(([field, messages]) => {
    const control = GLOBAL_FIELD_KEYS.has(field) ? null : fieldMap[field];
    if (!control) {
      unmapped.push(...messages);
      return;
    }
    fieldErrors[control] = [...(fieldErrors[control] ?? []), ...messages];
  });

  const globalMessage = resolveGlobalMessage(error, t, { fallbackKey, locale });
  const status = Number(error?.status ?? 0);
  const code = resolveErrorCode(error);

  return {
    // Every message is kept, not just the first one.
    fieldErrors,
    unmappedMessages: unmapped,
    globalMessage,
    status,
    code,
    isRateLimited: status === 429,
    retryAfterSeconds: status === 429 ? resolveRetryAfterSeconds(error) : 0,
    showRawMessages,
  };
}

export { CODE_TO_I18N_KEY, REGISTER_FIELD_MAP, GLOBAL_FIELD_KEYS };
