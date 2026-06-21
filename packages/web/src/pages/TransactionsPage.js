/**
 * SM-P4.6 — TransactionsPage
 * Trang quan ly giao dich: xem va them giao dich theo danh muc.
 * Khong dung JSX — tuan theo convention packages/web (createElement).
 */
import { createElement, useCallback, useEffect, useRef, useState } from "react";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

const e = createElement;

function useTransactions({ portfolioId } = {}) {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const mountedRef = useRef(true);

  const reload = useCallback(async () => {
    if (!portfolioId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await coreApiAdapter.getTransactions(portfolioId);
      if (!mountedRef.current) return;
      setTransactions(res?.results ?? res ?? []);
    } catch (err) {
      if (!mountedRef.current) return;
      setError(err?.message || "Khong the tai giao dich.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    mountedRef.current = true;
    reload();
    return () => { mountedRef.current = false; };
  }, [reload]);

  return { transactions, loading, error, reload };
}

export function TransactionsPage({ portfolioId, className = "" }) {
  const { transactions, loading, error, reload } = useTransactions({ portfolioId });
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
      await coreApiAdapter.createTransaction(portfolioId, {
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
