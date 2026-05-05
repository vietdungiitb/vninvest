"""Rewrite SM-P4 pages to remove JSX."""
import pathlib

root = pathlib.Path("packages/web/src/pages")

STOCK_DETAIL = """\
/**
 * SM-P4.5 — StockDetailPage
 * Trang chi tiet co phieu: thong tin, lich su gia, order-flow events, advisory.
 * Khong dung JSX — tuan theo convention packages/web (createElement).
 */
import { createElement, useEffect, useRef, useState } from "react";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

const DEFAULT_ENV = {};
const e = createElement;

function useStockDetail({ env = DEFAULT_ENV, symbol } = {}) {
  const [state, setState] = useState({
    loading: true, error: null, profile: null, prices: [], orderFlow: [], advisory: null,
  });
  const mountedRef = useRef(true);

  useEffect(() => {
    if (!symbol) return;
    mountedRef.current = true;
    async function load() {
      try {
        const adapter = coreApiAdapter({ env });
        const [profileRes, pricesRes, orderFlowRes, advisoryRes] = await Promise.allSettled([
          adapter.getStockProfile(symbol),
          adapter.getDailyPrices(symbol),
          adapter.getOrderFlowEvents(symbol),
          adapter.getAdvisoryLatest(symbol),
        ]);
        if (!mountedRef.current) return;
        setState({
          loading: false, error: null,
          profile: profileRes.status === "fulfilled" ? profileRes.value : null,
          prices: pricesRes.status === "fulfilled" ? (pricesRes.value?.results ?? []) : [],
          orderFlow: orderFlowRes.status === "fulfilled" ? (orderFlowRes.value?.results ?? orderFlowRes.value ?? []) : [],
          advisory: advisoryRes.status === "fulfilled" ? advisoryRes.value : null,
        });
      } catch (err) {
        if (!mountedRef.current) return;
        setState((s) => ({ ...s, loading: false, error: err?.message || "Khong the tai chi tiet co phieu." }));
      }
    }
    load();
    return () => { mountedRef.current = false; };
  }, [env, symbol]);

  return state;
}

export function StockDetailPage({ env = DEFAULT_ENV, symbol, className = "" }) {
  const { loading, error, profile, prices, orderFlow, advisory } = useStockDetail({ env, symbol });

  if (!symbol) return e("div", { className: "core-stock-detail-page " + className },
    e("p", { className: "core-empty" }, "Vui long chon ma co phieu.")
  );

  if (loading) return e("div", { className: "core-stock-detail-page " + className },
    e("p", { className: "core-loading" }, "Dang tai du lieu " + symbol + "...")
  );

  if (error) return e("div", { className: "core-stock-detail-page " + className },
    e("p", { className: "core-error" }, error)
  );

  return e("div", { className: "core-stock-detail-page " + className },
    e("header", { className: "core-page-header" },
      e("h1", null, symbol),
      profile ? e("span", { className: "core-stock-meta" },
        [profile.company_name, profile.exchange, profile.industry].filter(Boolean).join(" — ")
      ) : null
    ),
    advisory ? e("section", { className: "core-advisory-panel" },
      e("h2", null, "Khuyen nghi AI"),
      e("div", { className: "core-advisory-signal core-signal-" + (advisory.signal || "").toLowerCase() }, advisory.signal || ""),
      advisory.summary ? e("p", { className: "core-advisory-summary" }, advisory.summary) : null,
      advisory.generated_at
        ? e("small", { className: "core-advisory-timestamp" },
            "Cap nhat: " + new Date(advisory.generated_at).toLocaleString("vi-VN"))
        : null
    ) : null,
    e("section", { className: "core-orderflow-section" },
      e("h2", null, "Tin hieu dong tien (" + orderFlow.length + ")"),
      orderFlow.length === 0
        ? e("p", { className: "core-empty" }, "Khong co tin hieu dong tien nao.")
        : e("table", { className: "core-orderflow-table" },
            e("thead", null, e("tr", null,
              e("th", null, "Loai tin hieu"), e("th", null, "Chieu"), e("th", null, "Suc manh"),
              e("th", null, "Ca map"), e("th", null, "CVD"), e("th", null, "Gia"),
              e("th", null, "KL"), e("th", null, "Thoi diem")
            )),
            e("tbody", null, orderFlow.map((ev) =>
              e("tr", { key: ev.event_id, className: "core-event-row core-side-" + ev.side },
                e("td", null, ev.signal_type),
                e("td", null, ev.side),
                e("td", null, ev.strength != null ? Number(ev.strength).toFixed(2) : "—"),
                e("td", null, ev.whale_intensity != null ? Number(ev.whale_intensity).toFixed(2) : "—"),
                e("td", null, ev.cvd_at_signal != null ? Number(ev.cvd_at_signal).toLocaleString("vi-VN") : "—"),
                e("td", null, ev.price_at_signal != null ? Number(ev.price_at_signal).toLocaleString("vi-VN") : "—"),
                e("td", null, ev.volume_at_signal != null ? Number(ev.volume_at_signal).toLocaleString("vi-VN") : "—"),
                e("td", null, ev.triggered_at ? new Date(ev.triggered_at).toLocaleString("vi-VN") : "—")
              )
            ))
          )
    ),
    e("section", { className: "core-prices-section" },
      e("h2", null, "Lich su gia (" + prices.length + " phien)"),
      prices.length === 0
        ? e("p", { className: "core-empty" }, "Chua co du lieu gia.")
        : e("table", { className: "core-prices-table" },
            e("thead", null, e("tr", null,
              e("th", null, "Ngay"), e("th", null, "Mo cua"), e("th", null, "Cao nhat"),
              e("th", null, "Thap nhat"), e("th", null, "Dong cua"), e("th", null, "Khoi luong")
            )),
            e("tbody", null, prices.slice(0, 30).map((p) =>
              e("tr", { key: p.date },
                e("td", null, p.date),
                e("td", null, Number(p.open).toLocaleString("vi-VN")),
                e("td", null, Number(p.high).toLocaleString("vi-VN")),
                e("td", null, Number(p.low).toLocaleString("vi-VN")),
                e("td", null, Number(p.close).toLocaleString("vi-VN")),
                e("td", null, Number(p.volume).toLocaleString("vi-VN"))
              )
            ))
          )
    )
  );
}
"""

PORTFOLIOS_PAGE = """\
/**
 * SM-P4.6 — PortfoliosPage
 * Trang quan ly danh muc dau tu: tao, xem, xoa danh muc.
 * Khong dung JSX — tuan theo convention packages/web (createElement).
 */
import { createElement, useCallback, useEffect, useRef, useState } from "react";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

const DEFAULT_ENV = {};
const e = createElement;

function usePortfolios({ env = DEFAULT_ENV } = {}) {
  const [portfolios, setPortfolios] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const adapter = coreApiAdapter({ env });
      const res = await adapter.getPortfolios();
      if (!mountedRef.current) return;
      setPortfolios(res?.results ?? res ?? []);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err?.message || "Khong the tai danh muc.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [env]);

  useEffect(() => {
    mountedRef.current = true;
    reload();
    return () => { mountedRef.current = false; };
  }, [reload]);

  return { portfolios, loading, error, reload };
}

export function PortfoliosPage({ env = DEFAULT_ENV, className = "" }) {
  const { portfolios, loading, error, reload } = usePortfolios({ env });
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCurrency, setNewCurrency] = useState("VND");
  const [createError, setCreateError] = useState(null);

  async function handleCreate(ev) {
    ev.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setCreateError(null);
    try {
      const adapter = coreApiAdapter({ env });
      await adapter.createPortfolio({ name, currency: newCurrency });
      setNewName("");
      await reload();
    } catch (err) {
      setCreateError(err?.message || "Khong the tao danh muc.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm("Xoa danh muc nay?")) return;
    try {
      const adapter = coreApiAdapter({ env });
      await adapter.deletePortfolio(id);
      await reload();
    } catch (err) {
      window.alert(err?.message || "Khong the xoa danh muc.");
    }
  }

  return e("div", { className: "core-portfolios-page " + className },
    e("header", { className: "core-page-header" }, e("h1", null, "Danh muc dau tu")),
    e("form", { className: "core-create-form", onSubmit: handleCreate },
      e("h2", null, "Tao danh muc moi"),
      e("label", null, "Ten:",
        e("input", { type: "text", value: newName, onChange: (ev) => setNewName(ev.target.value), placeholder: "Ten danh muc", maxLength: 100, required: true })
      ),
      e("label", null, "Tien te:",
        e("select", { value: newCurrency, onChange: (ev) => setNewCurrency(ev.target.value) },
          e("option", { value: "VND" }, "VND"),
          e("option", { value: "USD" }, "USD")
        )
      ),
      e("button", { type: "submit", disabled: creating }, creating ? "Dang tao..." : "Tao danh muc"),
      createError ? e("p", { className: "core-error" }, createError) : null
    ),
    loading ? e("p", { className: "core-loading" }, "Dang tai danh muc...") : null,
    error ? e("p", { className: "core-error" }, error) : null,
    (!loading && !error && portfolios.length === 0) ? e("p", { className: "core-empty" }, "Chua co danh muc nao.") : null,
    (!loading && portfolios.length > 0) ? e("table", { className: "core-portfolios-table" },
      e("thead", null, e("tr", null,
        e("th", null, "Ten"), e("th", null, "Tien te"), e("th", null, "Trang thai"),
        e("th", null, "Ngay tao"), e("th", null, "Thao tac")
      )),
      e("tbody", null, portfolios.map((p) =>
        e("tr", { key: p.id },
          e("td", null, p.name),
          e("td", null, p.currency),
          e("td", null, p.status),
          e("td", null, p.created_at ? new Date(p.created_at).toLocaleDateString("vi-VN") : "—"),
          e("td", null,
            e("button", { className: "core-btn-danger", onClick: () => handleDelete(p.id) }, "Xoa")
          )
        )
      ))
    ) : null
  );
}
"""

TRANSACTIONS_PAGE = """\
/**
 * SM-P4.6 — TransactionsPage
 * Trang quan ly giao dich: xem va them giao dich theo danh muc.
 * Khong dung JSX — tuan theo convention packages/web (createElement).
 */
import { createElement, useCallback, useEffect, useRef, useState } from "react";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

const DEFAULT_ENV = {};
const e = createElement;

function useTransactions({ env = DEFAULT_ENV, portfolioId } = {}) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const reload = useCallback(async () => {
    if (!portfolioId) return;
    setLoading(true);
    setError(null);
    try {
      const adapter = coreApiAdapter({ env });
      const res = await adapter.getTransactions(portfolioId);
      if (!mountedRef.current) return;
      setTransactions(res?.results ?? res ?? []);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err?.message || "Khong the tai giao dich.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [env, portfolioId]);

  useEffect(() => {
    mountedRef.current = true;
    reload();
    return () => { mountedRef.current = false; };
  }, [reload]);

  return { transactions, loading, error, reload };
}

export function TransactionsPage({ env = DEFAULT_ENV, portfolioId, className = "" }) {
  const { transactions, loading, error, reload } = useTransactions({ env, portfolioId });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState(null);
  const [form, setForm] = useState({
    symbol: "", side: "buy", quantity: "", price: "", fee: "0",
    trade_date: new Date().toISOString().slice(0, 10), note: "",
  });

  function handleFormChange(ev) {
    const { name, value } = ev.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleCreate(ev) {
    ev.preventDefault();
    if (!portfolioId) return;
    setCreating(true);
    setCreateError(null);
    try {
      const adapter = coreApiAdapter({ env });
      await adapter.createTransaction(portfolioId, {
        ...form, symbol: form.symbol.trim().toUpperCase(),
        quantity: Number(form.quantity), price: Number(form.price), fee: Number(form.fee),
      });
      setForm((f) => ({ ...f, symbol: "", quantity: "", price: "", fee: "0", note: "" }));
      await reload();
    } catch (err) {
      setCreateError(err?.message || "Khong the tao giao dich.");
    } finally {
      setCreating(false);
    }
  }

  if (!portfolioId) return e("div", { className: "core-transactions-page " + className },
    e("p", { className: "core-empty" }, "Vui long chon danh muc.")
  );

  return e("div", { className: "core-transactions-page " + className },
    e("header", { className: "core-page-header" }, e("h1", null, "Giao dich")),
    e("form", { className: "core-create-form", onSubmit: handleCreate },
      e("h2", null, "Them giao dich moi"),
      e("label", null, "Ma CP:", e("input", { name: "symbol", type: "text", value: form.symbol, onChange: handleFormChange, maxLength: 10, required: true })),
      e("label", null, "Chieu:",
        e("select", { name: "side", value: form.side, onChange: handleFormChange },
          e("option", { value: "buy" }, "Mua"), e("option", { value: "sell" }, "Ban")
        )
      ),
      e("label", null, "So luong:", e("input", { name: "quantity", type: "number", min: "1", step: "1", value: form.quantity, onChange: handleFormChange, required: true })),
      e("label", null, "Gia:", e("input", { name: "price", type: "number", min: "0", step: "0.01", value: form.price, onChange: handleFormChange, required: true })),
      e("label", null, "Phi:", e("input", { name: "fee", type: "number", min: "0", step: "0.01", value: form.fee, onChange: handleFormChange })),
      e("label", null, "Ngay GD:", e("input", { name: "trade_date", type: "date", value: form.trade_date, onChange: handleFormChange, required: true })),
      e("label", null, "Ghi chu:", e("input", { name: "note", type: "text", value: form.note, onChange: handleFormChange, maxLength: 255 })),
      e("button", { type: "submit", disabled: creating }, creating ? "Dang luu..." : "Them giao dich"),
      createError ? e("p", { className: "core-error" }, createError) : null
    ),
    loading ? e("p", { className: "core-loading" }, "Dang tai giao dich...") : null,
    error ? e("p", { className: "core-error" }, error) : null,
    (!loading && !error && transactions.length === 0) ? e("p", { className: "core-empty" }, "Chua co giao dich nao.") : null,
    (!loading && transactions.length > 0) ? e("table", { className: "core-transactions-table" },
      e("thead", null, e("tr", null,
        e("th", null, "Ma CP"), e("th", null, "Chieu"), e("th", null, "So luong"),
        e("th", null, "Gia"), e("th", null, "Phi"), e("th", null, "Ngay GD"), e("th", null, "Ghi chu")
      )),
      e("tbody", null, transactions.map((t) =>
        e("tr", { key: t.id, className: "core-tx-row core-side-" + t.side },
          e("td", null, t.symbol),
          e("td", null, t.side === "buy" ? "Mua" : "Ban"),
          e("td", null, Number(t.quantity).toLocaleString("vi-VN")),
          e("td", null, Number(t.price).toLocaleString("vi-VN")),
          e("td", null, Number(t.fee).toLocaleString("vi-VN")),
          e("td", null, t.trade_date),
          e("td", null, t.note || "—")
        )
      ))
    ) : null
  );
}
"""

USER_SETTINGS_PAGE = """\
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
"""

files = {
    "StockDetailPage.js": STOCK_DETAIL,
    "PortfoliosPage.js": PORTFOLIOS_PAGE,
    "TransactionsPage.js": TRANSACTIONS_PAGE,
    "UserSettingsPage.js": USER_SETTINGS_PAGE,
}

for name, content in files.items():
    p = root / name
    p.write_text(content, encoding="utf-8")
    print(f"OK {p}")
