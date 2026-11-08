import { useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { coreApiAdapter } from "../../adapters/coreApiAdapter.js";
import { useI18n } from "../../context/LangContext.js";
import { PASSWORD_MIN_LENGTH, scorePassword } from "./authPolicy.js";
import { fieldFallbackKey, parseAuthError } from "./authErrors.js";
import { resetRequestSchema, resetConfirmSchema, type ResetValues } from "./authResetSchema.js";
import { FormField } from "../../components/ui/FormField.js";
import "./AuthRegisterPage.css";

type FieldErrors = Record<string, string[]>;

const RESET_FIELD_MAP: Record<string, string> = {
  new_password: "new_password",
  password: "new_password",
  new_password_confirm: "new_password_confirm",
  password_confirm: "new_password_confirm",
  email: "email",
  token: "token",
};

export function AuthResetPasswordPage() {
  const { t, locale } = useI18n();
  const [searchParams] = useSearchParams();
  const token = useMemo(() => String(searchParams.get("token") || "").trim(), [searchParams]);
  const isConfirmMode = Boolean(token);
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
    watch,
    setError,
    reset,
  } = useForm<ResetValues>({
    resolver: zodResolver(isConfirmMode ? resetConfirmSchema : resetRequestSchema),
    mode: "onSubmit",
    defaultValues: { email: "", newPassword: "", newPasswordConfirm: "" },
  });
  const newPassword = watch("newPassword") ?? "";
  const [message, setMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [serverFieldErrors, setServerFieldErrors] = useState<FieldErrors>({});

  const strength = scorePassword(newPassword);

  function handleFailure(error: unknown) {
    const parsed = parseAuthError(error as any, t, {
      fieldMap: RESET_FIELD_MAP,
      fallbackKey: isConfirmMode ? "auth.resetConfirmFailed" : "auth.resetFailed",
      locale,
    });
    setServerFieldErrors(parsed.fieldErrors as FieldErrors);
    setErrorMessage(parsed.globalMessage);
    if (parsed.fieldErrors) {
      Object.entries(parsed.fieldErrors as Record<string, string[]>).forEach(([k, msgs]) => {
        if (k === "email" || k === "new_password" || k === "new_password_confirm") {
          const name = k === "new_password" ? "newPassword" : k === "new_password_confirm" ? "newPasswordConfirm" : "email";
          setError(name as keyof ResetValues, { message: Array.isArray(msgs) ? msgs.join(" ") : String(msgs) });
        }
      });
    }
  }

  const serverMsg = (control: string) => {
    const messages = serverFieldErrors[control];
    if (!messages?.length) return null;
    const visible = locale === "vi" ? messages : messages.map(() => t(fieldFallbackKey(control)));
    return visible.join(" ");
  };
  const clientErr = (name: keyof ResetValues, serverKeys: string[]) =>
    (errors as Record<string, { message?: string } | undefined>)[name]?.message ?? serverKeys.map(serverMsg).find(Boolean);

  const inputClass = (hasErr: boolean) =>
    `w-full bg-gray-800 border rounded-md px-3 py-2 text-sm text-gray-100 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-brand-500 ${
      hasErr ? "border-red-500" : "border-gray-700"
    }`;

  const onSubmit = handleSubmit(async (values) => {
    setMessage("");
    setErrorMessage("");
    setServerFieldErrors({});
    if (isConfirmMode) {
      if (values.newPassword !== values.newPasswordConfirm) {
        const mismatch = t("auth.resetConfirmMismatch");
        setErrorMessage(mismatch);
        setServerFieldErrors({ new_password_confirm: [mismatch] });
        setError("newPasswordConfirm", { message: mismatch });
        return;
      }
      try {
        const payload = (await coreApiAdapter.confirmPasswordReset(
          token,
          values.newPassword,
          values.newPasswordConfirm,
        )) as Record<string, unknown>;
        const serverMessage = String(payload?.detail ?? payload?.message ?? "");
        setMessage(
          locale === "vi" && serverMessage.trim() ? serverMessage.trim() : t("auth.resetConfirmSuccess"),
        );
        reset({ email: "", newPassword: "", newPasswordConfirm: "" });
      } catch (error) {
        handleFailure(error);
      }
    } else {
      try {
        const payload = (await coreApiAdapter.requestPasswordReset(values.email.trim())) as Record<string, unknown>;
        const serverMessage = String(payload?.detail ?? payload?.message ?? "");
        setMessage(
          locale === "vi" && serverMessage.trim() ? serverMessage.trim() : t("auth.resetSuccess"),
        );
      } catch (error) {
        handleFailure(error);
      }
    }
  });

  return (
    <main className="min-h-screen bg-gray-950 flex items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-xl border border-gray-800 bg-gray-900 p-8">
        <h1 className="text-2xl font-bold text-brand-500">{t("auth.resetTitle")}</h1>
        <p className="mt-2 text-sm text-gray-400">
          {isConfirmMode ? t("auth.resetConfirmSubtitle") : t("auth.resetSubtitle")}
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit} noValidate>
          {isConfirmMode ? (
            <div className="space-y-4">
              <FormField
                label={t("auth.resetNewPasswordLabel")}
                htmlFor="auth-reset-new-password"
                error={clientErr("newPassword", ["new_password"])}
                hint={t("auth.registerPasswordHint", { min: PASSWORD_MIN_LENGTH })}
                required
              >
                <input
                  id="auth-reset-new-password"
                  type="password"
                  autoComplete="new-password"
                  className={inputClass(!!clientErr("newPassword", ["new_password"]))}
                  placeholder={t("auth.resetNewPasswordPlaceholder")}
                  aria-invalid={!!clientErr("newPassword", ["new_password"])}
                  minLength={PASSWORD_MIN_LENGTH}
                  {...register("newPassword")}
                />
              </FormField>
              {newPassword && strength < 2 ? (
                <p className="mt-1 text-amber-400 text-xs" data-testid="reset-password-weak">
                  {t("auth.registerPasswordHint", { min: PASSWORD_MIN_LENGTH })}
                </p>
              ) : null}
              <FormField
                label={t("auth.resetConfirmPasswordLabel")}
                htmlFor="auth-reset-new-password-confirm"
                error={clientErr("newPasswordConfirm", ["new_password_confirm"])}
                required
              >
                <input
                  id="auth-reset-new-password-confirm"
                  type="password"
                  autoComplete="new-password"
                  className={inputClass(!!clientErr("newPasswordConfirm", ["new_password_confirm"]))}
                  placeholder={t("auth.resetConfirmPasswordPlaceholder")}
                  aria-invalid={!!clientErr("newPasswordConfirm", ["new_password_confirm"])}
                  minLength={PASSWORD_MIN_LENGTH}
                  {...register("newPasswordConfirm")}
                />
              </FormField>
            </div>
          ) : (
            <FormField
              label={t("auth.resetEmailLabel")}
              htmlFor="auth-reset-email"
              error={clientErr("email", ["email"])}
              required
            >
              <input
                id="auth-reset-email"
                type="email"
                autoComplete="email"
                className={inputClass(!!clientErr("email", ["email"]))}
                placeholder={t("auth.resetEmailPlaceholder")}
                aria-invalid={!!clientErr("email", ["email"])}
                {...register("email")}
              />
            </FormField>
          )}
          {message ? (
            <p className="text-emerald-400 text-xs leading-5" role="status" aria-live="polite">
              {message}
            </p>
          ) : null}
          {errorMessage ? (
            <p className="text-red-400 text-xs leading-5" role="alert" aria-live="assertive" data-testid="reset-error">
              {errorMessage}
            </p>
          ) : null}
          <button
            type="submit"
            className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-50 text-white font-semibold py-2 rounded-md text-sm transition-colors"
            disabled={isSubmitting}
          >
            {isSubmitting
              ? isConfirmMode
                ? t("auth.resetConfirmSubmitting")
                : t("auth.resetSubmitting")
              : isConfirmMode
                ? t("auth.resetConfirmSubmit")
                : t("auth.resetSubmit")}
          </button>
        </form>
        <div className="mt-6">
          <Link to="/login" className="text-sm text-brand-400 hover:text-brand-300 transition-colors">
            {t("auth.resetBackToLogin")}
          </Link>
        </div>
      </section>
    </main>
  );
}

export default AuthResetPasswordPage;
