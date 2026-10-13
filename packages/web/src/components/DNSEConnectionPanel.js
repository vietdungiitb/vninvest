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
 *
 * ── i18n (2026-10-13, claim `pf-manage-rebuild`) ──────────────────────────
 * Trước đây file này **không import `LangContext`** ⇒ ~28 chuỗi tiếng Việt
 * hardcode, đổi ngôn ngữ là vô hiệu với toàn bộ panel. Nay mọi chuỗi đi qua
 * `t()`. Hai điểm cần chú ý:
 *
 * 1. `t` PHẢI nằm trong deps của mọi `useCallback` sinh thông điệp. `t` được
 *    `useMemo` hoá theo `locale` (`LangContext.js:70`) nên identity ổn định
 *    trong một phiên — thêm vào deps không gây render lặp (L-F10).
 * 2. Thông điệp lỗi KHÔNG dùng thẳng `err.message`: `CoreApiRequestError`
 *    (`transport.js:305`) có dạng
 *    `"Core API request error 404 Not Found - /broker/...: <detail>"` ⇒ lộ
 *    đường dẫn nội bộ cho người dùng cuối. `readApiError` bóc `payload.detail`
 *    trước, chỉ fallback sang `message` khi không có detail.
 */
import { createElement, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";
import "./DNSEConnectionPanel.css";

const e = createElement;

/**
 * Bóc thông điệp lỗi cho người dùng.
 *
 * Ưu tiên `payload.detail` (tiếng Việt từ BE) vì `err.message` của
 * `CoreApiRequestError` là chuỗi kỹ thuật có đường dẫn endpoint.
 */
function readApiError(err, fallback) {
  const detail = err && typeof err === "object" ? err.payload?.detail : null;
  if (typeof detail === "string" && detail.trim()) return detail;
  const msg = err && typeof err === "object" ? err.message : null;
  if (typeof msg === "string" && msg.trim() && !msg.startsWith("Core API request error")) {
    return msg;
  }
  return fallback;
}

function useDNSEStatus(t) {
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
      setError(
        readApiError(err, t("dnsePanel.errors.loadStatus", { defaultValue: "Không thể tải trạng thái kết nối DNSE." })),
      );
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [t]);

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
  const { t, formatDateTime } = useI18n();
  const { status, loading, error, reload } = useDNSEStatus(t);
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
  const [passcode, setPasscode] = useState("");
  const [tradingToken, setTradingToken] = useState("");
  // Token giao dịch là BÍ MẬT. Mặc định `type="password"`; người dùng chủ động
  // bật hiển thị khi cần copy. Trước đây `type="text"` ⇒ secret hiện ngang
  // trên màn hình (và vào video họp / ảnh chụp màn hình).
  const [showToken, setShowToken] = useState(false);
  const [orderAccountNo, setOrderAccountNo] = useState("");
  const [orderSymbol, setOrderSymbol] = useState("");
  const [orderSide, setOrderSide] = useState("BUY");
  const [orderPrice, setOrderPrice] = useState("");
  const [orderQuantity, setOrderQuantity] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [creatingToken, setCreatingToken] = useState(false);
  const [placingOrder, setPlacingOrder] = useState(false);
  const [otpResult, setOtpResult] = useState(null);
  const [tokenResult, setTokenResult] = useState(null);
  const [orderResult, setOrderResult] = useState(null);

  const handleSave = useCallback(async (evt) => {
    evt.preventDefault();
    if (!clientId.trim() || !clientSecret.trim()) {
      setSaveError(t("dnsePanel.errors.needCredentials", {
        defaultValue: "Vui lòng nhập đầy đủ Client ID và Client Secret.",
      }));
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
      setSaveError(readApiError(err, t("dnsePanel.errors.saveCredential", {
        defaultValue: "Lưu credential thất bại.",
      })));
    } finally {
      setSaving(false);
    }
  }, [clientId, clientSecret, reload, t]);

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
      setSyncResult({ ok: false, error: readApiError(err, t("dnsePanel.errors.syncAccounts", {
        defaultValue: "Đồng bộ tiểu khoản thất bại.",
      })) });
    } finally {
      setSyncing(false);
    }
  }, [onConnected, reload, t]);

  const handleSyncBalances = useCallback(async () => {
    setSyncingBalances(true);
    setBalanceResult(null);
    try {
      const res = await coreApiAdapter.syncDNSEBalances();
      setBalanceResult({ ok: true, count: res?.synced_count ?? 0, date: res?.date || null });
    } catch (err) {
      setBalanceResult({ ok: false, error: readApiError(err, t("dnsePanel.errors.syncBalances", {
        defaultValue: "Đồng bộ số dư thất bại.",
      })) });
    } finally {
      setSyncingBalances(false);
    }
  }, [t]);

  const handleReconcileTransactions = useCallback(async () => {
    setSyncingTransactions(true);
    setTxResult(null);
    try {
      const res = await coreApiAdapter.reconcileDNSETransactions({ days_back: 30 });
      setTxResult({ ok: true, count: res?.synced_count ?? 0 });
    } catch (err) {
      setTxResult({ ok: false, error: readApiError(err, t("dnsePanel.errors.reconcile", {
        defaultValue: "Đối soát giao dịch thất bại.",
      })) });
    } finally {
      setSyncingTransactions(false);
    }
  }, [t]);

  const handleSendOtp = useCallback(async () => {
    setSendingOtp(true);
    setOtpResult(null);
    try {
      const res = await coreApiAdapter.sendDNSEEmailOtp({ mode: "paper" });
      setOtpResult({
        ok: true,
        message: res?.message || t("dnsePanel.status.otpSent", { defaultValue: "Đã gửi OTP qua email DNSE." }),
      });
    } catch (err) {
      setOtpResult({ ok: false, error: readApiError(err, t("dnsePanel.errors.sendOtp", {
        defaultValue: "Gửi OTP DNSE thất bại.",
      })) });
    } finally {
      setSendingOtp(false);
    }
  }, [t]);

  const handleCreateTradingToken = useCallback(async () => {
    if (!passcode.trim()) {
      setTokenResult({ ok: false, error: t("dnsePanel.errors.needPasscode", {
        defaultValue: "Vui lòng nhập passcode OTP từ email DNSE.",
      }) });
      return;
    }
    setCreatingToken(true);
    setTokenResult(null);
    try {
      const res = await coreApiAdapter.createDNSETradingToken({ otp_type: "EMAIL", passcode: passcode.trim(), mode: "paper" });
      const token = res?.trading_token || res?.token || res?.result?.trading_token || res?.result?.token || "";
      if (token) {
        setTradingToken(String(token));
      }
      setTokenResult({ ok: true, hasToken: Boolean(token) });
    } catch (err) {
      setTokenResult({ ok: false, error: readApiError(err, t("dnsePanel.errors.createToken", {
        defaultValue: "Tạo trading token thất bại.",
      })) });
    } finally {
      setCreatingToken(false);
    }
  }, [passcode, t]);

  const handlePlaceOrder = useCallback(async () => {
    const normalizedSymbol = orderSymbol.trim().toUpperCase();
    const price = Number(orderPrice);
    const quantity = Number(orderQuantity);

    if (!orderAccountNo.trim() || !normalizedSymbol || !tradingToken.trim()) {
      setOrderResult({ ok: false, error: t("dnsePanel.errors.missingOrderFields", {
        defaultValue: "Thiếu account number, symbol hoặc trading token.",
      }) });
      return;
    }
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(quantity) || quantity <= 0) {
      setOrderResult({ ok: false, error: t("dnsePanel.errors.badPriceQty", {
        defaultValue: "Giá và khối lượng phải lớn hơn 0.",
      }) });
      return;
    }

    setPlacingOrder(true);
    setOrderResult(null);
    try {
      // PA-5: BE fail-closed (SAFE-01) — `mode` bắt buộc trong body và
      // `Idempotency-Key` bắt buộc là header. Thiếu `mode` ⇒ 400
      // `order_mode_required`; thiếu key ⇒ 400 `idempotency_key_required`.
      // Chỉ gửi `paper`: `live` bị từ chối (`live_ordering_disabled`) cho tới khi
      // có policy + OTP + risk limit + commercial license vnbroker.
      const res = await coreApiAdapter.placeDNSEOrder({
        mode: "paper",
        market_type: "STOCK",
        order_category: "NORMAL",
        trading_token: tradingToken.trim(),
        payload: {
          account_no: orderAccountNo.trim(),
          symbol: normalizedSymbol,
          side: orderSide,
          price,
          quantity,
        },
      });
      // SAFE-01 R4 — hiển thị `mode` mà SERVER quyết định, không phải giá trị
      // client vừa gửi. Client gửi `paper` không có nghĩa server đã chạy paper:
      // server có thể từ chối live và hạ về paper (hoặc ngược lại).
      // `res?.mode || "paper"` — mặc định là `paper`, KHÔNG phải giá trị đã
      // gửi: nếu server không trả `mode` (bản cũ, response bị cắt qua proxy)
      // thì hiển thị "Live" là nói dối người dùng về việc tiền có ra khỏi tài
      // khoản thật không. Lùi về phía an toàn.
      setOrderResult({
        ok: true,
        result: res?.result || res || null,
        mode: res?.mode || "paper",
        dryRun: res?.dry_run ?? true,
      });
    } catch (err) {
      setOrderResult({ ok: false, error: readApiError(err, t("dnsePanel.errors.placeOrder", {
        defaultValue: "Đặt lệnh DNSE thất bại.",
      })) });
    } finally {
      setPlacingOrder(false);
    }
  }, [orderAccountNo, orderPrice, orderQuantity, orderSide, orderSymbol, tradingToken, t]);

  /** Ngày giờ đồng bộ: format theo locale thay vì in chuỗi thô của API. */
  const lastVerifiedLabel = useMemo(() => {
    const raw = status?.last_verified_at;
    if (!raw) return null;
    const formatted = formatDateTime ? formatDateTime(raw) : null;
    return formatted && formatted !== raw ? formatted : String(raw);
  }, [status?.last_verified_at, formatDateTime]);

  if (loading) {
    return e("div", { className: `dnse-panel ${className}` },
      t("dnsePanel.loading", { defaultValue: "Đang tải trạng thái DNSE..." }));
  }

  const isConfigured = status?.is_configured === true;

  return e(
    "div",
    { className: `dnse-panel ${className}` },

    e("h3", { className: "dnse-panel__title" },
      t("dnsePanel.title", { defaultValue: "Kết nối DNSE LightSpeed API" })),

    e(
      "p",
      { className: "dnse-panel__hint" },
      t("dnsePanel.hint.before", { defaultValue: "Nhập Client ID và Client Secret từ trang quản lý " }),
      e("a", { href: "https://entradex.dnse.com.vn/thong-tin-ca-nhan/light-speed", target: "_blank", rel: "noreferrer" },
        t("dnsePanel.hint.link", { defaultValue: "EntradeX → LightSpeed API" })),
      t("dnsePanel.hint.after", { defaultValue: ". Không nhập username/mật khẩu tài khoản DNSE." })
    ),

    // Trạng thái hiện tại
    isConfigured
      ? e(
          "div",
          { className: "dnse-panel__status dnse-panel__status--connected" },
          e("span", { className: "dnse-panel__status-dot" }),
          t("dnsePanel.status.connected", {
            defaultValue: "Đã kết nối — Client ID: {clientId}",
            clientId: status?.preview?.client_id ?? "****",
          }),
          lastVerifiedLabel
            ? e("span", { className: "dnse-panel__sync-time" },
                t("dnsePanel.status.lastSync", {
                  defaultValue: " | Đồng bộ lần cuối: {when}",
                  when: lastVerifiedLabel,
                }))
            : null
        )
      : e(
          "div",
          { className: "dnse-panel__status dnse-panel__status--disconnected" },
          e("span", { className: "dnse-panel__status-dot" }),
          t("dnsePanel.status.disconnected", { defaultValue: "Chưa kết nối" })
        ),

    // Form nhập credential
    e(
      "form",
      { className: "dnse-panel__form", onSubmit: handleSave },
      e(
        "div",
        { className: "dnse-panel__field" },
        e("label", { htmlFor: "dnse-client-id" },
          t("dnsePanel.field.clientId", { defaultValue: "Client ID" })),
        e("input", {
          id: "dnse-client-id",
          type: "text",
          value: clientId,
          onChange: (ev) => setClientId(ev.target.value),
          placeholder: t("dnsePanel.field.clientIdPlaceholder", {
            defaultValue: "Nhập Client ID từ LightSpeed API",
          }),
          autoComplete: "off",
          disabled: saving,
          className: "dnse-panel__input",
        })
      ),
      e(
        "div",
        { className: "dnse-panel__field" },
        e("label", { htmlFor: "dnse-client-secret" },
          t("dnsePanel.field.clientSecret", { defaultValue: "Client Secret" })),
        e("input", {
          id: "dnse-client-secret",
          type: "password",
          value: clientSecret,
          onChange: (ev) => setClientSecret(ev.target.value),
          placeholder: t("dnsePanel.field.clientSecretPlaceholder", {
            defaultValue: "Nhập Client Secret từ LightSpeed API",
          }),
          autoComplete: "new-password",
          disabled: saving,
          className: "dnse-panel__input",
        })
      ),
      saveError ? e("p", { className: "dnse-panel__error" }, saveError) : null,
      saveSuccess ? e("p", { className: "dnse-panel__success" },
        t("dnsePanel.status.credentialSaved", { defaultValue: "Đã lưu credential thành công." })) : null,
      e(
        "button",
        { type: "submit", disabled: saving, className: "dnse-panel__btn dnse-panel__btn--primary" },
        saving
          ? t("dnsePanel.action.saving", { defaultValue: "Đang lưu..." })
          : t("dnsePanel.action.saveCredential", { defaultValue: "Lưu credential" })
      )
    ),

    // Đồng bộ dữ liệu + giao dịch thử nghiệm
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
              syncing
                ? t("dnsePanel.action.syncing", { defaultValue: "Đang đồng bộ..." })
                : t("dnsePanel.action.syncAccounts", { defaultValue: "Đồng bộ tiểu khoản" })
            ),
            e(
              "button",
              {
                type: "button",
                disabled: syncingBalances,
                onClick: handleSyncBalances,
                className: "dnse-panel__btn dnse-panel__btn--secondary",
              },
              syncingBalances
                ? t("dnsePanel.action.syncingBalances", { defaultValue: "Đang đồng bộ số dư..." })
                : t("dnsePanel.action.syncBalances", { defaultValue: "Đồng bộ số dư" })
            ),
            e(
              "button",
              {
                type: "button",
                disabled: syncingTransactions,
                onClick: handleReconcileTransactions,
                className: "dnse-panel__btn dnse-panel__btn--secondary",
              },
              syncingTransactions
                ? t("dnsePanel.action.reconciling", { defaultValue: "Đang đối soát..." })
                : t("dnsePanel.action.reconcile", { defaultValue: "Đối soát giao dịch" })
            )
          ),
          syncResult?.ok === true
            ? e("p", { className: "dnse-panel__success" },
                t("dnsePanel.status.syncOk", {
                  defaultValue: "Đồng bộ thành công: {count} tiểu khoản.",
                  count: syncResult.count,
                }))
            : null,
          syncResult?.ok === false
            ? e("p", { className: "dnse-panel__error" }, syncResult.error)
            : null,
          balanceResult?.ok === true
            ? e("p", { className: "dnse-panel__info" },
                balanceResult.date
                  ? t("dnsePanel.status.balanceOkDated", {
                      defaultValue: "Đồng bộ số dư thành công: {count} tiểu khoản (ngày {date}).",
                      count: balanceResult.count,
                      date: balanceResult.date,
                    })
                  : t("dnsePanel.status.balanceOk", {
                      defaultValue: "Đồng bộ số dư thành công: {count} tiểu khoản.",
                      count: balanceResult.count,
                    }))
            : null,
          balanceResult?.ok === false
            ? e("p", { className: "dnse-panel__error" }, balanceResult.error)
            : null,
          txResult?.ok === true
            ? e("p", { className: "dnse-panel__info" },
                t("dnsePanel.status.reconcileOk", {
                  defaultValue: "Đối soát giao dịch thành công: {count} giao dịch.",
                  count: txResult.count,
                }))
            : null,
          txResult?.ok === false
            ? e("p", { className: "dnse-panel__error" }, txResult.error)
            : null,
          syncedAccounts.length > 0
            ? e("div", { className: "dnse-panel__accounts" },
              e("p", { className: "dnse-panel__accounts-title" },
                t("dnsePanel.accounts.title", { defaultValue: "Tiểu khoản đã liên kết" })),
              e("table", { className: "dnse-panel__accounts-table" },
                e("thead", null,
                  e("tr", null,
                    e("th", { scope: "col" },
                      t("dnsePanel.accounts.number", { defaultValue: "Số tài khoản" })),
                    e("th", { scope: "col" }, t("dnsePanel.accounts.type", { defaultValue: "Loại" })),
                    e("th", { scope: "col" },
                      t("dnsePanel.accounts.displayName", { defaultValue: "Tên hiển thị" }))
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
            : null,

          e("div", { className: "dnse-panel__order" },
            e("p", { className: "dnse-panel__accounts-title" },
              t("dnsePanel.order.title", { defaultValue: "Giao dịch DNSE (thử nghiệm)" })),
            e("div", { className: "dnse-panel__order-grid" },
              e("div", { className: "dnse-panel__field" },
                e("label", { htmlFor: "dnse-passcode" },
                  t("dnsePanel.field.passcode", { defaultValue: "Passcode OTP" })),
                e("input", {
                  id: "dnse-passcode",
                  type: "text",
                  value: passcode,
                  onChange: (ev) => setPasscode(ev.target.value),
                  placeholder: t("dnsePanel.field.passcodePlaceholder", {
                    defaultValue: "Nhập OTP từ email DNSE",
                  }),
                  disabled: sendingOtp || creatingToken,
                })
              ),
              e("div", { className: "dnse-panel__field" },
                e("label", { htmlFor: "dnse-trading-token" },
                  t("dnsePanel.field.tradingToken", { defaultValue: "Trading token" })),
                e("div", { className: "dnse-panel__token-row" },
                  e("input", {
                    id: "dnse-trading-token",
                    // BÍ MẬT — mặc định che. Trước đây `type="text"` hiện token
                    // ngang trên màn hình (lộ vào ảnh chụp / chia sẻ màn hình).
                    type: showToken ? "text" : "password",
                    value: tradingToken,
                    onChange: (ev) => setTradingToken(ev.target.value),
                    placeholder: t("dnsePanel.field.tokenPlaceholder", {
                      defaultValue: "Token tạo sau khi xác thực OTP",
                    }),
                    autoComplete: "off",
                  }),
                  e("button", {
                    type: "button",
                    className: "dnse-panel__btn dnse-panel__btn--ghost",
                    "aria-pressed": showToken,
                    onClick: () => setShowToken((v) => !v),
                  }, showToken
                    ? t("dnsePanel.action.hideToken", { defaultValue: "Ẩn" })
                    : t("dnsePanel.action.showToken", { defaultValue: "Hiện" }))
                )
              )
            ),
            e("div", { className: "dnse-panel__sync-actions" },
              e("button", {
                type: "button",
                disabled: sendingOtp,
                onClick: handleSendOtp,
                className: "dnse-panel__btn dnse-panel__btn--secondary",
              }, sendingOtp
                ? t("dnsePanel.action.sendingOtp", { defaultValue: "Đang gửi OTP..." })
                : t("dnsePanel.action.sendOtp", { defaultValue: "Gửi OTP email" })),
              e("button", {
                type: "button",
                disabled: creatingToken,
                onClick: handleCreateTradingToken,
                className: "dnse-panel__btn dnse-panel__btn--secondary",
              }, creatingToken
                ? t("dnsePanel.action.creatingToken", { defaultValue: "Đang tạo token..." })
                : t("dnsePanel.action.createToken", { defaultValue: "Tạo trading token" }))
            ),
            otpResult?.ok === true ? e("p", { className: "dnse-panel__info" }, otpResult.message) : null,
            otpResult?.ok === false ? e("p", { className: "dnse-panel__error" }, otpResult.error) : null,
            tokenResult?.ok === true
              ? e("p", { className: "dnse-panel__success" }, tokenResult.hasToken
                  ? t("dnsePanel.status.tokenOk", { defaultValue: "Đã tạo trading token thành công." })
                  : t("dnsePanel.status.tokenMissing", {
                      defaultValue: "Đã gọi tạo token, nhưng chưa nhận token từ phản hồi.",
                    }))
              : null,
            tokenResult?.ok === false ? e("p", { className: "dnse-panel__error" }, tokenResult.error) : null,

            e("div", { className: "dnse-panel__order-grid" },
              e("div", { className: "dnse-panel__field" },
                e("label", { htmlFor: "dnse-order-account" },
                  t("dnsePanel.field.accountNo", { defaultValue: "Số tài khoản" })),
                e("input", {
                  id: "dnse-order-account",
                  type: "text",
                  value: orderAccountNo,
                  onChange: (ev) => setOrderAccountNo(ev.target.value),
                  placeholder: t("dnsePanel.field.accountNoPlaceholder", { defaultValue: "Ví dụ: 0003724720" }),
                  disabled: placingOrder,
                })
              ),
              e("div", { className: "dnse-panel__field" },
                e("label", { htmlFor: "dnse-order-symbol" },
                  t("dnsePanel.field.symbol", { defaultValue: "Mã cổ phiếu" })),
                e("input", {
                  id: "dnse-order-symbol",
                  type: "text",
                  value: orderSymbol,
                  onChange: (ev) => setOrderSymbol(ev.target.value),
                  placeholder: t("dnsePanel.field.symbolPlaceholder", { defaultValue: "Ví dụ: FPT" }),
                  disabled: placingOrder,
                })
              ),
              e("div", { className: "dnse-panel__field" },
                e("label", { htmlFor: "dnse-order-side" },
                  t("dnsePanel.field.side", { defaultValue: "Chiều lệnh" })),
                e("input", {
                  id: "dnse-order-side",
                  type: "text",
                  value: orderSide,
                  onChange: (ev) => setOrderSide(ev.target.value.trim().toUpperCase() || "BUY"),
                  placeholder: t("dnsePanel.field.sidePlaceholder", { defaultValue: "BUY hoặc SELL" }),
                  disabled: placingOrder,
                })
              ),
              e("div", { className: "dnse-panel__field" },
                e("label", { htmlFor: "dnse-order-price" },
                  t("dnsePanel.field.price", { defaultValue: "Giá" })),
                e("input", {
                  id: "dnse-order-price",
                  type: "number",
                  min: "0",
                  step: "0.01",
                  value: orderPrice,
                  onChange: (ev) => setOrderPrice(ev.target.value),
                  placeholder: t("dnsePanel.field.pricePlaceholder", { defaultValue: "Ví dụ: 121.5" }),
                  disabled: placingOrder,
                })
              ),
              e("div", { className: "dnse-panel__field" },
                e("label", { htmlFor: "dnse-order-quantity" },
                  t("dnsePanel.field.quantity", { defaultValue: "Khối lượng" })),
                e("input", {
                  id: "dnse-order-quantity",
                  type: "number",
                  min: "1",
                  step: "1",
                  value: orderQuantity,
                  onChange: (ev) => setOrderQuantity(ev.target.value),
                  placeholder: t("dnsePanel.field.quantityPlaceholder", { defaultValue: "Ví dụ: 100" }),
                  disabled: placingOrder,
                })
              )
            ),
            e("div", { className: "dnse-panel__sync-actions" },
              e("button", {
                type: "button",
                disabled: placingOrder,
                onClick: handlePlaceOrder,
                className: "dnse-panel__btn dnse-panel__btn--primary",
              }, placingOrder
                ? t("dnsePanel.action.placingOrder", { defaultValue: "Đang đặt lệnh..." })
                : t("dnsePanel.action.placeOrder", { defaultValue: "Đặt lệnh thử nghiệm" }))
            ),
            orderResult?.ok === true
              ? e("p", { className: "dnse-panel__success" },
                // SAFE-01 R4 — badge nói rõ lệnh này chạy thật hay thử nghiệm.
                // Không có nó thì người dùng dễ tưởng mình vừa đặt lệnh thật.
                e("span", {
                  className: `dnse-panel__badge dnse-panel__badge--${orderResult.mode === "live" ? "live" : "paper"}`,
                  "data-testid": "dnse-order-mode-badge",
                }, orderResult.mode === "live" ? "LIVE" : "PAPER"),
                " ",
                t("dnsePanel.status.orderOk", { defaultValue: "Đặt lệnh DNSE thành công." }))
              : null,
            orderResult?.ok === false ? e("p", { className: "dnse-panel__error" }, orderResult.error) : null
          )
        )
      : null,

    // Lỗi load
    error ? e("p", { className: "dnse-panel__error" }, error) : null
  );
}

export default DNSEConnectionPanel;