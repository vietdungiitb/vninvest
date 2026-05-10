/**
 * DNSEConnectionPanel.js
 *
 * Panel kết nối DNSE LightSpeed API cho người dùng.
 *
 * Auth flow chuẩn: client_id + client_secret (LightSpeed OAuth2).
 * KHÔNG yêu cầu username/password tài khoản cá nhân DNSE.
 *
 * Tất cả calls qua coreApiAdapter — KHÔNG dùng legacy apiClient.
 *
 * Không dùng JSX — tuân theo convention packages/web (createElement).
 */
import { createElement, useCallback, useEffect, useRef, useState } from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import "./DNSEConnectionPanel.css";

const e = createElement;

function useDNSEStatus() {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await coreApiAdapter.getDNSEConfig();
      if (!mountedRef.current) return;
      setStatus(res);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err?.message || "Không thể tải trạng thái kết nối DNSE.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    reload();
    return () => {
      mountedRef.current = false;
    };
  }, [reload]);

  return { status, loading, error, reload };
}

/**
 * DNSEConnectionPanel
 *
 * Props:
 *   onConnected?: (accounts: object[]) => void — callback sau khi sync thành công
 *   className?: string
 */
export function DNSEConnectionPanel({ onConnected, className = "" }) {
  const { status, loading, error, reload } = useDNSEStatus();
  const [clientId, setClientId] = useState("");
  const [clientSecret, setClientSecret] = useState("");
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncingBalances, setSyncingBalances] = useState(false);
  const [syncingTransactions, setSyncingTransactions] = useState(false);
  const [saveError, setSaveError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [syncResult, setSyncResult] = useState(null);
  const [balanceResult, setBalanceResult] = useState(null);
  const [txResult, setTxResult] = useState(null);
  const [syncedAccounts, setSyncedAccounts] = useState([]);

  const handleSave = useCallback(async (evt) => {
    evt.preventDefault();
    if (!clientId.trim() || !clientSecret.trim()) {
      setSaveError("Vui lòng nhập đầy đủ Client ID và Client Secret.");
      return;
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(false);
    try {
      await coreApiAdapter.updateDNSEConfig({
        client_id: clientId.trim(),
        client_secret: clientSecret.trim(),
        is_active: true,
      });
      setSaveSuccess(true);
      setClientId("");
      setClientSecret("");
      await reload();
    } catch (err) {
      setSaveError(err?.message || "Lưu credential thất bại.");
    } finally {
      setSaving(false);
    }
  }, [clientId, clientSecret, reload]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setSyncResult(null);
    try {
      const res = await coreApiAdapter.syncDNSEAccounts();
      setSyncResult({ ok: true, count: res?.synced_count ?? 0 });
      setSyncedAccounts(Array.isArray(res?.accounts) ? res.accounts : []);
      if (typeof onConnected === "function") {
        onConnected(res?.accounts ?? []);
      }
      await reload();
    } catch (err) {
      setSyncResult({ ok: false, error: err?.message || "Đồng bộ tiểu khoản thất bại." });
    } finally {
      setSyncing(false);
    }
  }, [onConnected, reload]);

  const handleSyncBalances = useCallback(async () => {
    setSyncingBalances(true);
    setBalanceResult(null);
    try {
      const res = await coreApiAdapter.syncDNSEBalances();
      setBalanceResult({ ok: true, count: res?.synced_count ?? 0, date: res?.date || null });
    } catch (err) {
      setBalanceResult({ ok: false, error: err?.message || "Đồng bộ số dư thất bại." });
    } finally {
      setSyncingBalances(false);
    }
  }, []);

  const handleReconcileTransactions = useCallback(async () => {
    setSyncingTransactions(true);
    setTxResult(null);
    try {
      const res = await coreApiAdapter.reconcileDNSETransactions({ days_back: 30 });
      setTxResult({ ok: true, count: res?.synced_count ?? 0 });
    } catch (err) {
      setTxResult({ ok: false, error: err?.message || "Đối soát giao dịch thất bại." });
    } finally {
      setSyncingTransactions(false);
    }
  }, []);

  if (loading) {
    return e("div", { className: `dnse-panel ${className}` }, "Đang tải trạng thái DNSE...");
  }

  const isConfigured = status?.is_configured === true;

  return e(
    "div",
    { className: `dnse-panel ${className}` },

    e("h3", { className: "dnse-panel__title" }, "Kết nối DNSE LightSpeed API"),

    e(
      "p",
      { className: "dnse-panel__hint" },
      "Nhập Client ID và Client Secret từ trang quản lý ",
      e("a", { href: "https://entradex.dnse.com.vn/thong-tin-ca-nhan/light-speed", target: "_blank", rel: "noreferrer" }, "EntradeX → LightSpeed API"),
      ". Không nhập username/mật khẩu tài khoản DNSE."
    ),

    // Trạng thái hiện tại
    isConfigured
      ? e(
          "div",
          { className: "dnse-panel__status dnse-panel__status--connected" },
          e("span", { className: "dnse-panel__status-dot" }),
          `Đã kết nối — Client ID: ${status?.data?.client_id_preview ?? "****"}`,
          status?.data?.last_sync_at
            ? e("span", { className: "dnse-panel__sync-time" }, ` | Đồng bộ lần cuối: ${status.data.last_sync_at}`)
            : null
        )
      : e(
          "div",
          { className: "dnse-panel__status dnse-panel__status--disconnected" },
          e("span", { className: "dnse-panel__status-dot" }),
          "Chưa kết nối"
        ),

    // Form nhập credential
    e(
      "form",
      { className: "dnse-panel__form", onSubmit: handleSave },
      e(
        "div",
        { className: "dnse-panel__field" },
        e("label", { htmlFor: "dnse-client-id" }, "Client ID"),
        e("input", {
          id: "dnse-client-id",
          type: "text",
          value: clientId,
          onChange: (ev) => setClientId(ev.target.value),
          placeholder: "Nhập Client ID từ LightSpeed API",
          autoComplete: "off",
          disabled: saving,
          className: "dnse-panel__input",
        })
      ),
      e(
        "div",
        { className: "dnse-panel__field" },
        e("label", { htmlFor: "dnse-client-secret" }, "Client Secret"),
        e("input", {
          id: "dnse-client-secret",
          type: "password",
          value: clientSecret,
          onChange: (ev) => setClientSecret(ev.target.value),
          placeholder: "Nhập Client Secret từ LightSpeed API",
          autoComplete: "new-password",
          disabled: saving,
          className: "dnse-panel__input",
        })
      ),
      saveError ? e("p", { className: "dnse-panel__error" }, saveError) : null,
      saveSuccess ? e("p", { className: "dnse-panel__success" }, "Đã lưu credential thành công.") : null,
      e(
        "button",
        { type: "submit", disabled: saving, className: "dnse-panel__btn dnse-panel__btn--primary" },
        saving ? "Đang lưu..." : "Lưu credential"
      )
    ),

    // Đồng bộ tiểu khoản
    isConfigured
      ? e(
          "div",
          { className: "dnse-panel__sync" },
          e("div", { className: "dnse-panel__sync-actions" },
            e(
              "button",
              {
                type: "button",
                disabled: syncing,
                onClick: handleSync,
                className: "dnse-panel__btn dnse-panel__btn--secondary",
              },
              syncing ? "Đang đồng bộ..." : "Đồng bộ tiểu khoản"
            ),
            e(
              "button",
              {
                type: "button",
                disabled: syncingBalances,
                onClick: handleSyncBalances,
                className: "dnse-panel__btn dnse-panel__btn--secondary",
              },
              syncingBalances ? "Đang đồng bộ số dư..." : "Đồng bộ số dư"
            ),
            e(
              "button",
              {
                type: "button",
                disabled: syncingTransactions,
                onClick: handleReconcileTransactions,
                className: "dnse-panel__btn dnse-panel__btn--secondary",
              },
              syncingTransactions ? "Đang đối soát..." : "Đối soát giao dịch"
            )
          ),
          syncResult?.ok === true
            ? e("p", { className: "dnse-panel__success" }, `Đồng bộ thành công: ${syncResult.count} tiểu khoản.`)
            : null,
          syncResult?.ok === false
            ? e("p", { className: "dnse-panel__error" }, syncResult.error)
            : null,
          balanceResult?.ok === true
            ? e("p", { className: "dnse-panel__info" }, `Đồng bộ số dư thành công: ${balanceResult.count} tiểu khoản${balanceResult.date ? ` (ngày ${balanceResult.date})` : ""}.`)
            : null,
          balanceResult?.ok === false
            ? e("p", { className: "dnse-panel__error" }, balanceResult.error)
            : null,
          txResult?.ok === true
            ? e("p", { className: "dnse-panel__info" }, `Đối soát giao dịch thành công: ${txResult.count} giao dịch.`)
            : null,
          txResult?.ok === false
            ? e("p", { className: "dnse-panel__error" }, txResult.error)
            : null,
          syncedAccounts.length > 0
            ? e("div", { className: "dnse-panel__accounts" },
              e("p", { className: "dnse-panel__accounts-title" }, "Tiểu khoản đã liên kết"),
              e("table", { className: "dnse-panel__accounts-table" },
                e("thead", null,
                  e("tr", null,
                    e("th", null, "Số tài khoản"),
                    e("th", null, "Loại"),
                    e("th", null, "Tên hiển thị")
                  )
                ),
                e("tbody", null,
                  syncedAccounts.map((account) =>
                    e("tr", { key: account.id || account.external_id || account.account_number },
                      e("td", null, account.external_id || account.account_number || "—"),
                      e("td", null, account.type || "—"),
                      e("td", null, account.display_name || account.name || "—")
                    )
                  )
                )
              )
            )
            : null
        )
      : null,

    // Lỗi load
    error ? e("p", { className: "dnse-panel__error" }, error) : null
  );
}

export default DNSEConnectionPanel;
