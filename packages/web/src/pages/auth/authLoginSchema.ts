import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "./authPolicy.js";

/**
 * B6: login schema mirrors the old `useState` guard
 * (`if (!username.trim() || !password) return;`) — required only.
 * No min-length for login (server enforces policy; register enforces 10).
 */
export const loginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

export type LoginValues = z.infer<typeof loginSchema>;

/** Keep previous payload shape: trimmed username (case preserved, D10), password untouched. */
export function toLoginPayload(values: LoginValues): { username: string; password: string } {
  return {
    username: values.username.trim(),
    password: values.password,
  };
}

export const loginPasswordMinLength = PASSWORD_MIN_LENGTH;
