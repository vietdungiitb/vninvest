import { createElement, ChangeEvent, FormEvent, SyntheticEvent, useCallback, useEffect, useRef, useState } from "react";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";
import { BrokerSettingsSection } from "../components/BrokerSettingsSection.js";
import "./UserSettingsPage.css";

const e = createElement;

export const USER_THEME_STORAGE_KEY = "vninvest-theme";

/** Áp theme light/dark thật lên document (trước đây select theme chỉ ghi DB, không đổi pixel nào). */
export function applyUserTheme(theme: string | null | undefined) {
  if (typeof document === "undefined") return;
  if (theme === "light") {
    document.documentElement.setAttribute("data-theme", "light");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
  try {
    if (theme === "light" || theme === "dark") {
      window.localStorage.setItem(USER_THEME_STORAGE_KEY, theme);
    }
  } catch {
    // private mode — bỏ qua persist
  }
}

interface UserProfile {
  username: string;
  email: string;
  display_name?: string;
  avatar_url?: string;
  language?: string;
  theme?: string;
  whale_alert_threshold?: string;
  [key: string]: unknown;
}

interface UserSettingsForm {
  display_name: string;
  avatar_url: string;
  language: string;
  theme: string;
  whale_alert_threshold: string;
}

interface PasswordForm {
  current_password: string;
  new_password: string;
  new_password_confirm: string;
}

interface UserSettingsPageProps {
  className?: string;
}

function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res: UserProfile = await coreApiAdapter.getUserProfile();
      if (!mountedRef.current) return;
      setProfile(res);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setError(err && typeof err === 'object' && 'message' in err ? (err as Error).message : "Không thể tải thông tin tài khoản.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    reload();
    return () => { mountedRef.current = false; };
  }, [reload]);

  return { profile, loading, error, reload };
}

export function UserSettingsPage({ className = "" }: UserSettingsPageProps) {
  const { profile, loading, error, reload } = useUserProfile();
  const { t, setLanguage } = useI18n() as unknown as {
    t: (key: string, opts?: Record<string, unknown>) => string;
    setLanguage: (lang: string) => void;
  };
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [form, setForm] = useState<UserSettingsForm | null>(null);
  const [pwForm, setPwForm] = useState<PasswordForm>({ current_password: "", new_password: "", new_password_confirm: "" });
  const [pwSaving, setPwSaving] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState(false);

  useEffect(() => {
    if (profile) {
      const nextForm = {
        display_name: String(profile.display_name ?? ""),
        avatar_url: String(profile.avatar_url ?? ""),
        language: String(profile.language ?? "vi"),
        theme: String(profile.theme ?? "light"),
        whale_alert_threshold: String(profile.whale_alert_threshold ?? "500"),
      };
      setForm(nextForm);
      applyUserTheme(nextForm.theme);
    }
  }, [profile]);

  function handleChange(ev: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = ev.target;
    setForm((f) => ({ ...f, [name]: value } as UserSettingsForm));
    // Apply tức thì để user thấy ngay, không chờ reload
    if (name === "language") setLanguage(value);
    if (name === "theme") applyUserTheme(value);
  }

  async function handleSave(ev: FormEvent) {
    ev.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await coreApiAdapter.updateUserProfile(form);
      setSaveSuccess(true);
      await reload();
    } catch (err: unknown) {
      setSaveError(err && typeof err === 'object' && 'message' in err
        ? (err as Error).message
        : t("userSettings.saveError", { defaultValue: "Không thể lưu cài đặt." }));
    } finally {
      setSaving(false);
    }
  }

  function handlePwChange(ev: ChangeEvent<HTMLInputElement>) {
    const { name, value } = ev.target;
    setPwForm((f) => ({ ...f, [name]: value }));
  }

  async function handlePasswordSave(ev: FormEvent) {
    ev.preventDefault();
    setPwError(null);
    setPwSuccess(false);
    if (pwForm.new_password !== pwForm.new_password_confirm) {
      setPwError(t("userSettings.passwordMismatch", { defaultValue: "Mật khẩu mới nhập lại không khớp." }));
      return;
    }
    setPwSaving(true);
    try {
      await coreApiAdapter.changeUserPassword(pwForm);
      setPwSuccess(true);
      setPwForm({ current_password: "", new_password: "", new_password_confirm: "" });
    } catch (err: unknown) {
      setPwError(err && typeof err === 'object' && 'message' in err
        ? (err as Error).message
        : t("userSettings.saveError", { defaultValue: "Không thể lưu cài đặt." }));
    } finally {
      setPwSaving(false);
    }
  }

  if (loading) return e("div", { className: "core-user-settings-page " + className },
    e("p", { className: "core-loading" }, t("userSettings.loading", { defaultValue: "Đang tải cài đặt tài khoản..." }))
  );

  if (error) return e("div", { className: "core-user-settings-page " + className },
    e("p", { className: "core-error" }, error)
  );

  if (!form) return null;

  return e("div", { className: "core-user-settings-page " + className },
    e("header", { className: "core-page-header" },
      e("h1", null, t("userSettings.title", { defaultValue: "Cài đặt tài khoản" })),
      profile ? e("span", { className: "core-user-id" }, profile.username + " · " + profile.email) : null
    ),
    e("form", { className: "core-settings-form", onSubmit: handleSave },
      e("label", null, t("userSettings.displayName", { defaultValue: "Tên hiển thị:" }),
        e("input", { name: "display_name", type: "text", value: form.display_name, onChange: handleChange, maxLength: 100 })
      ),
      e("label", null, t("userSettings.avatarUrl", { defaultValue: "Ảnh đại diện (URL):" }),
        e("input", {
          name: "avatar_url", type: "url", value: form.avatar_url, onChange: handleChange, maxLength: 500,
          placeholder: "https://...", title: t("userSettings.avatarHint", { defaultValue: "Dán link ảnh https://..." }),
        })
      ),
      form.avatar_url ? e("img", {
        src: form.avatar_url, alt: form.display_name || "avatar",
        style: { width: 48, height: 48, borderRadius: "50%", objectFit: "cover" as const },
        onError: (ev: SyntheticEvent<HTMLImageElement>) => { (ev.target as HTMLImageElement).style.display = "none"; },
      }) : null,
      e("label", null, t("userSettings.language", { defaultValue: "Ngôn ngữ:" }),
        e("select", { name: "language", value: form.language, onChange: handleChange },
          e("option", { value: "vi" }, "Tiếng Việt"),
          e("option", { value: "en" }, "English")
        )
      ),
      e("label", null, t("userSettings.theme", { defaultValue: "Giao diện:" }),
        e("select", { name: "theme", value: form.theme, onChange: handleChange },
          e("option", { value: "light" }, t("userSettings.themeLight", { defaultValue: "Sáng" })),
          e("option", { value: "dark" }, t("userSettings.themeDark", { defaultValue: "Tối" }))
        )
      ),
      e("label", null, t("userSettings.whaleThreshold", { defaultValue: "Ngưỡng cảnh báo cá mập (VND):" }),
        e("input", { name: "whale_alert_threshold", type: "number", min: "0", step: "10", value: form.whale_alert_threshold, onChange: handleChange })
      ),
      e("button", { type: "submit", disabled: saving },
        saving
          ? t("userSettings.saving", { defaultValue: "Đang lưu..." })
          : t("userSettings.save", { defaultValue: "Lưu cài đặt" })),
      saveError ? e("p", { className: "core-error" }, saveError) : null,
      saveSuccess ? e("p", { className: "core-success" }, t("userSettings.saveSuccess", { defaultValue: "Đã lưu cài đặt thành công." })) : null
    ),
    e("hr", { className: "core-divider" }),
    e("section", { className: "core-settings-password" },
      e("h2", null, t("userSettings.passwordTitle", { defaultValue: "Đổi mật khẩu" })),
      e("form", { className: "core-settings-form", onSubmit: handlePasswordSave },
        e("label", null, t("userSettings.currentPassword", { defaultValue: "Mật khẩu hiện tại:" }),
          e("input", {
            name: "current_password", type: "password", value: pwForm.current_password,
            onChange: handlePwChange, autoComplete: "current-password",
          })
        ),
        e("label", null, t("userSettings.newPassword", { defaultValue: "Mật khẩu mới (≥10 ký tự):" }),
          e("input", {
            name: "new_password", type: "password", value: pwForm.new_password,
            onChange: handlePwChange, minLength: 10, autoComplete: "new-password",
          })
        ),
        e("label", null, t("userSettings.newPasswordConfirm", { defaultValue: "Nhập lại mật khẩu mới:" }),
          e("input", {
            name: "new_password_confirm", type: "password", value: pwForm.new_password_confirm,
            onChange: handlePwChange, minLength: 10, autoComplete: "new-password",
          })
        ),
        e("button", { type: "submit", disabled: pwSaving },
          pwSaving
            ? t("userSettings.passwordSaving", { defaultValue: "Đang đổi..." })
            : t("userSettings.passwordSave", { defaultValue: "Đổi mật khẩu" })),
        pwError ? e("p", { className: "core-error" }, pwError) : null,
        pwSuccess ? e("p", { className: "core-success" }, t("userSettings.passwordSuccess", { defaultValue: "Đã đổi mật khẩu thành công." })) : null
      )
    ),
    e("hr", { className: "core-divider" }),
    e(BrokerSettingsSection, { className: "core-dnse-block" })
  );
}
