import { createElement, ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { DNSECredentialsSection } from "../components/DNSECredentialsSection.js";

const e = createElement;

interface UserProfile {
  username: string;
  email: string;
  display_name?: string;
  language?: string;
  theme?: string;
  whale_alert_threshold?: string;
  [key: string]: unknown;
}

interface UserSettingsForm {
  display_name: string;
  language: string;
  theme: string;
  whale_alert_threshold: string;
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
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [form, setForm] = useState<UserSettingsForm | null>(null);

  useEffect(() => {
    if (profile) {
      setForm({
        display_name: profile.display_name ?? "",
        language: profile.language ?? "vi",
        theme: profile.theme ?? "light",
        whale_alert_threshold: profile.whale_alert_threshold ?? "500000000",
      });
    }
  }, [profile]);

  function handleChange(ev: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = ev.target;
    setForm((f) => ({ ...f, [name]: value } as UserSettingsForm));
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
      setSaveError(err && typeof err === 'object' && 'message' in err ? (err as Error).message : "Không thể lưu cài đặt.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return e("div", { className: "core-user-settings-page " + className },
    e("p", { className: "core-loading" }, "Đang tải cài đặt tài khoản...")
  );

  if (error) return e("div", { className: "core-user-settings-page " + className },
    e("p", { className: "core-error" }, error)
  );

  if (!form) return null;

  return e("div", { className: "core-user-settings-page " + className },
    e("header", { className: "core-page-header" },
      e("h1", null, "Cài đặt tài khoản"),
      profile ? e("span", { className: "core-user-id" }, profile.username + " · " + profile.email) : null
    ),
    e("form", { className: "core-settings-form", onSubmit: handleSave },
      e("label", null, "Tên hiển thị:",
        e("input", { name: "display_name", type: "text", value: form.display_name, onChange: handleChange, maxLength: 100 })
      ),
      e("label", null, "Ngôn ngữ:",
        e("select", { name: "language", value: form.language, onChange: handleChange },
          e("option", { value: "vi" }, "Tiếng Việt"),
          e("option", { value: "en" }, "English")
        )
      ),
      e("label", null, "Giao diện:",
        e("select", { name: "theme", value: form.theme, onChange: handleChange },
          e("option", { value: "light" }, "Sáng"),
          e("option", { value: "dark" }, "Tối")
        )
      ),
      e("label", null, "Ngưỡng cảnh báo cá mập (VND):",
        e("input", { name: "whale_alert_threshold", type: "number", min: "0", step: "1000000", value: form.whale_alert_threshold, onChange: handleChange })
      ),
      e("button", { type: "submit", disabled: saving }, saving ? "Đang lưu..." : "Lưu cài đặt"),
      saveError ? e("p", { className: "core-error" }, saveError) : null,
      saveSuccess ? e("p", { className: "core-success" }, "Đã lưu cài đặt thành công.") : null
    ),
    e("hr", { className: "core-divider" }),
    e(DNSECredentialsSection, { className: "core-dnse-block" })
  );
}
