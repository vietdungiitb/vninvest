import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "./authPolicy.js";

/** B6: request mode needs email; confirm mode needs passwords (min 10). */
export const resetRequestSchema = z.object({
  email: z.string().trim().email(),
  newPassword: z.string(),
  newPasswordConfirm: z.string(),
});

export const resetConfirmSchema = z.object({
  email: z.string(),
  newPassword: z.string().min(PASSWORD_MIN_LENGTH),
  newPasswordConfirm: z.string().min(PASSWORD_MIN_LENGTH),
});

export type ResetValues = z.infer<typeof resetConfirmSchema>;
