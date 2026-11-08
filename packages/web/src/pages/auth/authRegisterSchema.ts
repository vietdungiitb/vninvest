import { z } from "zod";
import { PASSWORD_MIN_LENGTH, USERNAME_PATTERN, normalizeUsername } from "./authPolicy.js";

/**
 * B6: register schema mirrors client rules in authPolicy.js (SSOT).
 * Server still owns similarity/common/numeric checks (not duplicated here).
 */
export const registerSchema = z.object({
  username: z.string().trim().regex(USERNAME_PATTERN),
  email: z.string().trim().email(),
  password: z.string().min(PASSWORD_MIN_LENGTH),
  passwordConfirm: z.string().min(PASSWORD_MIN_LENGTH),
  website: z.string(),
});

export type RegisterValues = {
  username: string;
  email: string;
  password: string;
  passwordConfirm: string;
  website: string;
};

/** Keep previous payload shape: normalized username, trimmed email/website handling by caller. */
export function toRegisterPayload(values: RegisterValues, turnstileToken: string) {
  return {
    username: normalizeUsername(values.username),
    email: values.email.trim(),
    password: values.password,
    password_confirm: values.passwordConfirm,
    website: values.website,
    turnstile_token: turnstileToken,
  };
}
