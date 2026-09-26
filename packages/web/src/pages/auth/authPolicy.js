/**
 * tenantreg-d (slice D) — single source of truth for client-side auth rules.
 *
 * WHY THIS FILE EXISTS
 * The register and reset screens used to hardcode `minLength: 8` in four
 * places while the server enforced something stricter. That is not a cosmetic
 * mismatch: a user who typed 9 characters got a green form and a server 400.
 *
 * The server rule lives in
 * packages/core/backend/src/vninvest_core/settings.py:63-67:
 *   AUTH_PASSWORD_VALIDATORS = [
 *     UserAttributeSimilarityValidator,
 *     MinimumLengthValidator  { min_length: 10 },
 *     CommonPasswordValidator,
 *     NumericPasswordValidator,
 *   ]
 * and `validate_password()` is called on register
 * (identity_access/serializers.py:409).
 *
 * Only the LENGTH is enforced client-side. The other three validators
 * (similarity to the username/email, common-password list, all-numeric) are not
 * reimplemented here on purpose: duplicating Django's word list in the browser
 * would be a second source of truth that drifts, and it would leak the list.
 * Those surface as a server 400 with `code: "weak_password"` and are rendered
 * through authErrors.js.
 *
 * The number lives in exactly one place in this file. UI copy interpolates it
 * via the `{min}` placeholder in the i18n dictionaries, so no locale file
 * hardcodes 8 or 10 either.
 */

/**
 * Mirrors MinimumLengthValidator(min_length=10) in settings.py:64.
 * MUST stay in sync with packages/core/backend/src/vninvest_core/settings.py.
 */
export const PASSWORD_MIN_LENGTH = 10;

/** Mirrors the username regex in identity_access/serializers.py:384. */
export const USERNAME_PATTERN = /^[A-Za-z0-9_]{3,30}$/;
export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 30;

/**
 * The backend lowercases the username before storing it
 * (identity_access/serializers.py:388 `return val_clean.lower()`), but the
 * login view then calls `authenticate(username=<original casing>)` and Django's
 * ModelBackend does an EXACT `User.objects.get(username=...)` lookup. So a user
 * who registered as `VietDung` and signs in as `VietDung` gets
 * "invalid credentials" even though the password is right.
 * Normalizing on the client closes the gap without requiring a backend change.
 */
export function normalizeUsername(value) {
  return String(value || "").trim().toLowerCase();
}

export function isValidUsername(value) {
  return USERNAME_PATTERN.test(String(value || "").trim());
}

/**
 * A cheap client-side strength signal. NOT a password policy: it never blocks
 * submission and never duplicates a server rule. It exists so the user gets
 * feedback while typing instead of only after a round trip.
 */
export function scorePassword(value) {
  const password = String(value || "");
  if (!password) return 0;
  let score = 0;
  if (password.length >= PASSWORD_MIN_LENGTH) score += 1;
  if (password.length >= PASSWORD_MIN_LENGTH + 6) score += 1;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score += 1;
  if (/\d/.test(password)) score += 1;
  if (/[^\w\s]/.test(password)) score += 1;
  if (/^\d+$/.test(password)) return 0; // NumericPasswordValidator rejects this
  return Math.min(score, 4);
}
