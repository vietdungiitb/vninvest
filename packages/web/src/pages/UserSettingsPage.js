/**
 * SM-P4.7 — UserSettingsPage
 * Trang cai dat tai khoan nguoi dung: cap nhat tu core API.
 * Khong dung JSX — tuan theo convention packages/web (createElement).
 */
import { createElement, useCallback, useEffect, useRef, useState } from "react";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

const DEFAULT_ENV = {};
const e = createElement;

function useUserProfile({ env = DEFAULT_ENV } = {}) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const adapter = coreApiAdapter({ env });
      const res = await adapter.getUserProfile();
      if (!mountedRef.current) return;
      setProfile(res);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err?.message || "Khong the tai thong tin tai khoan.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [env]);

  useEffect(() => {
    mountedRef.current = true;
    reload();
    return () => { mountedRef.current = false; };
  }, [reload]);

  return { profile, loading, error, reload };
}

export function UserSettingsPage({ env = DEFAULT_ENV, className = "" }) {
  const { profile, loading, error, reload } = useUserProfile({ env });
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [form, setForm] = useState(null);

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

  function handleChange(ev) {
    const { name, value } = ev.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleSave(ev) {
    ev.preventDefault();
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      const adapter = coreApiAdapter({ env });
      await adapter.updateUserProfile(form);
      setSaveSuccess(true);
      await reload();
    } catch (err) {
      setSaveError(err?.message || "Khong the luu cai dat.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return e("div", { className: "core-user-settings-page " + className },
    e("p", { className: "core-loading" }, "Dang tai cai dat tai khoan...")
  );

  if (error) return e("div", { className: "core-user-settings-page " + className },
    e("p", { className: "core-error" }, error)
  );

  if (!form) return null;

  return e("div", { className: "core-user-settings-page " + className },
    e("header", { className: "core-page-header" },
      e("h1", null, "Cai dat tai khoan"),
      profile ? e("span", { className: "core-user-id" }, profile.username + " · " + profile.email) : null
    ),
    e("form", { className: "core-settings-form", onSubmit: handleSave },
      e("label", null, "Ten hien thi:",
        e("input", { name: "display_name", type: "text", value: form.display_name, onChange: handleChange, maxLength: 100 })
      ),
      e("label", null, "Ngon ngu:",
        e("select", { name: "language", value: form.language, onChange: handleChange },
          e("option", { value: "vi" }, "Tieng Viet"),
          e("option", { value: "en" }, "English")
        )
      ),
      e("label", null, "Giao dien:",
        e("select", { name: "theme", value: form.theme, onChange: handleChange },
          e("option", { value: "light" }, "Sang"),
          e("option", { value: "dark" }, "Toi")
        )
      ),
      e("label", null, "Nguong canh bao ca map (VND):",
        e("input", { name: "whale_alert_threshold", type: "number", min: "0", step: "1000000", value: form.whale_alert_threshold, onChange: handleChange })
      ),
      e("button", { type: "submit", disabled: saving }, saving ? "Dang luu..." : "Luu cai dat"),
      saveError ? e("p", { className: "core-error" }, saveError) : null,
      saveSuccess ? e("p", { className: "core-success" }, "Da luu cai dat thanh cong.") : null
    )
  );
}
