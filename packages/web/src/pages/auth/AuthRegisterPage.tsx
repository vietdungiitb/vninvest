import { useState } from "react";
import { Link } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { TurnstileWidget } from "../../components/auth/TurnstileWidget.js";
import { PASSWORD_MIN_LENGTH, scorePassword } from "./authPolicy.js";
import { fieldFallbackKey, parseAuthError, REGISTER_FIELD_MAP } from "./authErrors.js";
import { registerSchema, toRegisterPayload, type RegisterValues } from "./authRegisterSchema.js";
import { FormField } from "../../components/ui/FormField.js";
import "./AuthRegisterPage.css";

type FieldErrors = Record<string, string[]>;

/**
 * tenantreg-d (slice D) — D9.
 * B6: RHF + zod (authRegisterSchema) instead of hand-rolled useState.
 * Validation rules stay in authPolicy.js (SSOT); parseAuthError still owns server errors.
 * VI is the dictionary source of truth instead: nothing is inlined here.
 */
export function AuthRegisterPage() {
  const { t, locale } = useI18n();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setError,
    reset,
    setValue,
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: "onSubmit",
    defaultValues: { username: "", email: "", password: "", passwordConfirm: "", website: "" },
  });
  const password = watch("password") ?? "";
  const [turnstileToken, setTurnstileToken] = useState("");
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [registeredEmail, setRegisteredEmail] = useState("");
  const [turnstileUnavailable, setTurnstileUnavailable] = useState(false);
  const [serverFieldErrors, setServerFieldErrors] = useState<FieldErrors>({});

  const strength = scorePassword(password);
  const strengthKey = ["passwordStrengthWeak", "passwordStrengthFair", "passwordStrengthGood", "passwordStrengthStrong"][
    Math.max(0, strength - 1)
  ];
  const strengthTone = ["bg-red-500", "bg-amber-500", "bg-emerald-500", "bg-emerald-400"][Math.max(0, strength - 1)];

  const serverMsg = (control: string) => {
    const messages = serverFieldErrors[control];
    if (!messages?.length) return null;
    const visible = locale === "vi" ? messages : messages.map(() => t(fieldFallbackKey(control)));
    return visible.join(" ");
  };
  const fieldErr = (control: keyof RegisterValues | "password_confirm" | "turnstile_token") =>
    (errors as Record<string, { message?: string } | undefined>)[control]?.message ?? serverMsg(control as string);

  const inputClass = (control: string) =>
    `w-full bg-gray-800 border rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500 ${
      fieldErr(control as never) ? "border-red-500" : "border-gray-700"
    }`;

  const onSubmit = handleSubmit(async (values) => {
    if (values.password !== values.passwordConfirm) {
      const mismatch = t("auth.registerPasswordMismatch");
      setErrorMessage(mismatch);
      setMessage("");
      setServerFieldErrors({ password_confirm: [mismatch] });
      return;
    }
    if (!turnstileToken.trim()) {
      setErrorMessage(t("auth.registerTurnstileRequired"));
      setMessage("");
      setServerFieldErrors({ turnstile_token: [t("auth.registerTurnstileNotRobot")] });
      return;
    }

    setMessage("");
    setErrorMessage("");
    setServerFieldErrors({});

    try {
      const payload = await coreApiAdapter.registerUser(toRegisterPayload(values, turnstileToken));

      const payloadData = (payload ?? {}) as Record<string, unknown>;
      const nested = (payloadData.data ?? null) as Record<string, unknown> | null;
      const serverMessage = String(nested?.message ?? payloadData.message ?? "");
      setMessage(
        locale === "vi" && serverMessage.trim() ? serverMessage.trim() : t("auth.registerSuccess"),
      );
      const serverUsername = String(nested?.username ?? payloadData.username ?? "");
      reset();
      if (serverUsername) setValue("username", serverUsername);
      setRegisteredEmail(String(nested?.email ?? payloadData.email ?? values.email).trim());
      setTurnstileToken("");
      setServerFieldErrors({});
    } catch (error) {
      const parsed = parseAuthError(error as any, t, { fieldMap: REGISTER_FIELD_MAP, locale });
      setServerFieldErrors(parsed.fieldErrors as FieldErrors);
      setErrorMessage(parsed.globalMessage);
      setTurnstileToken("");
      if (parsed.fieldErrors) {
        Object.entries(parsed.fieldErrors as Record<string, string[]>).forEach(([k, msgs]) => {
          if (k in registerSchema.shape) {
            setError(k as keyof RegisterValues, { message: Array.isArray(msgs) ? msgs.join(" ") : String(msgs) });
          }
        });
      }
    }
  });

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8">
        <h1 className="text-2xl font-bold text-brand-500">{t("auth.loginTitle")}</h1>
        <p className="mt-2 text-sm text-gray-400">{t("auth.registerSubtitle")}</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          <FormField
            label={t("auth.registerUsernameLabel")}
            htmlFor="auth-register-username"
            error={fieldErr("username")}
            hint={t("auth.registerUsernameHint")}
            required
          >
            <input
              id="auth-register-username"
              autoComplete="username"
              className={inputClass("username")}
              placeholder={t("auth.registerUsernamePlaceholder")}
              aria-invalid={!!fieldErr("username")}
              {...register("username")}
            />
          </FormField>
          <FormField
            label={t("auth.registerEmailLabel")}
            htmlFor="auth-register-email"
            error={fieldErr("email")}
            required
          >
            <input
              id="auth-register-email"
              type="email"
              autoComplete="email"
              className={inputClass("email")}
              placeholder={t("auth.registerEmailPlaceholder")}
              aria-invalid={!!fieldErr("email")}
              {...register("email")}
            />
          </FormField>
          <FormField
            label={t("auth.registerPasswordLabel")}
            htmlFor="auth-register-password"
            error={fieldErr("password")}
            hint={t("auth.registerPasswordHint", { min: PASSWORD_MIN_LENGTH })}
            required
          >
            <input
              id="auth-register-password"
              type="password"
              autoComplete="new-password"
              className={inputClass("password")}
              placeholder={t("auth.registerPasswordPlaceholder")}
              aria-invalid={!!fieldErr("password")}
              minLength={PASSWORD_MIN_LENGTH}
              {...register("password")}
            />
          </FormField>
          {password ? (
            <div className="mt-1.5 flex items-center gap-2">
              <div className="h-1 flex-1 rounded bg-gray-700">
                <div className={`h-1 rounded ${strengthTone}`} style={{ width: `${(strength / 4) * 100}%` }} />
              </div>
              <span className="text-gray-400 text-xs" data-testid="register-password-strength">
                {t("auth.registerPasswordStrength", { level: t(strengthKey), min: PASSWORD_MIN_LENGTH })}
              </span>
            </div>
          ) : null}
          <FormField
            label={t("auth.registerPasswordConfirmLabel")}
            htmlFor="auth-register-password-confirm"
            error={fieldErr("password_confirm") ?? fieldErr("passwordConfirm")}
            required
          >
            <input
              id="auth-register-password-confirm"
              type="password"
              autoComplete="new-password"
              className={inputClass("password_confirm")}
              placeholder={t("auth.registerPasswordConfirmPlaceholder")}
              aria-invalid={!!fieldErr("password_confirm")}
              minLength={PASSWORD_MIN_LENGTH}
              {...register("passwordConfirm")}
            />
          </FormField>
          <input
            type="text"
            className="invisible-honeypot"
            tabIndex={-1}
            autoComplete="off"
            aria-hidden
            {...register("website")}
          />
          <TurnstileWidget
            onVerify={(token: string) => {
              setTurnstileToken(token);
              setServerFieldErrors((prev) => ({ ...prev, turnstile_token: [] }));
            }}
            onError={() => {
              setErrorMessage(t("auth.registerTurnstileLoadFailed"));
              setTurnstileUnavailable(true);
            }}
            onExpire={() => setTurnstileToken("")}
            unavailableMessage={t("auth.registerTurnstileUnavailable")}
          />
          {serverFieldErrors.turnstile_token?.length ? (
            <div className="text-red-400 text-xs text-center" role="alert" aria-live="assertive">
              {locale === "vi" ? serverFieldErrors.turnstile_token.join(" ") : t("auth.registerTurnstileNotRobot")}
            </div>
          ) : null}
          {message ? (
            <p className="text-emerald-400 text-xs leading-5" role="status" aria-live="polite" data-testid="register-success">
              {message}
            </p>
          ) : null}
          {errorMessage ? (
            <p className="text-red-400 text-xs leading-5" role="alert" aria-live="assertive" data-testid="register-error">
              {errorMessage}
            </p>
          ) : null}
          {message && registeredEmail ? (
            <p className="text-xs text-gray-400" data-testid="register-resend-link">
              <Link
                to={`/verify-email?email=${encodeURIComponent(registeredEmail)}`}
                className="text-brand-400 hover:text-brand-300 underline"
              >
                {t("auth.registerResendVerificationCta")}
              </Link>
            </p>
          ) : null}
          {turnstileUnavailable ? (
            <p className="text-amber-400 text-xs leading-5" role="alert">
              {t("auth.registerTurnstileUnavailable")}
            </p>
          ) : null}
          <button
            type="submit"
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-2 rounded-md text-sm transition-colors"
            disabled={isSubmitting || !turnstileToken}
          >
            {isSubmitting ? t("auth.registerSubmitting") : t("auth.registerSubmit")}
          </button>
        </form>
        <div className="mt-6 text-sm">
          <Link to="/login" className="text-brand-400 hover:text-brand-300 transition-colors">
            {t("auth.registerBackToLogin")}
          </Link>
        </div>
      </section>
    </main>
  );
}

export default AuthRegisterPage;
