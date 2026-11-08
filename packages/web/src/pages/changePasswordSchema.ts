import { z } from "zod";
import { PASSWORD_MIN_LENGTH } from "./auth/authPolicy.js";

/** B6 4/4: change-password schema (min 10 mirrors authPolicy SSOT). */
export const changePasswordSchema = z.object({
  current_password: z.string().min(1),
  new_password: z.string().min(PASSWORD_MIN_LENGTH),
  new_password_confirm: z.string().min(PASSWORD_MIN_LENGTH),
});

export type ChangePasswordValues = z.infer<typeof changePasswordSchema>;
