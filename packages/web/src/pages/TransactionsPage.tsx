import { createElement, ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

const e = createElement;

interface Transaction {
  id: string | number;
  symbol: string;
  side: string;
  quantity: number;
  price: number;
  fee: number;
  trade_date: string;
  note?: string | null;
  [key: string]: unknown;
}

interface TransactionsResponse {
  results?: Transaction[];
  [key: string]: unknown;
}

interface TransactionsPageProps {
  portfolioId?: string | number;
  className?: string;
}

interface TransactionForm {
  symbol: string;
  side: string;
  quantity: string;
  price: string;
  fee: string;
  trade_date: string;
  note: string;
}

function useTransactions({ portfolioId }: { portfolioId?: string | number } = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const reload = useCallback(async () => {
    if (!portfolioId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await (coreApiAdapter as any).getTransactions(portfolioId) as TransactionsResponse;
      if (!mountedRef.current) return;
      setTransactions((res?.results ?? []) as Transaction[]);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setError(err && typeof err === 'object' && 'message' in err ? (err as Error).message : "Không thể tải giao dịch.");
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

export function TransactionsPage({ portfolioId, className = "" }: TransactionsPageProps) {
  const { transactions, loading, error, reload } = useTransactions({ portfolioId });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<TransactionForm>({
    symbol: "", side: "buy", quantity: "", price: "", fee: "0",
    trade_date: new Date().toISOString().slice(0, 10), note: "",
  });

  function handleFormChange(ev: ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    const { name, value } = ev.target;
    setForm((f) => ({ ...f, [name]: value }));
  }

  async function handleCreate(ev: FormEvent) {
    ev.preventDefault();
    if (!portfolioId) return;
    setCreating(true);
    setCreateError(null);
    try {
      await (coreApiAdapter as any).createTransaction(portfolioId, {
        ...form, symbol: form.symbol.trim().toUpperCase(),
        quantity: Number(form.quantity), price: Number(form.price), fee: Number(form.fee),
      });
      setForm((f) => ({ ...f, symbol: "", quantity: "", price: "", fee: "0", note: "" }));
      await reload();
    } catch (err: unknown) {
      setCreateError(err && typeof err === 'object' && 'message' in err ? (err as Error).message : "Không thể tạo giao dịch.");
    } finally {
      setCreating(false);
    }
  }

  if (!portfolioId) return e("div", { className: "core-transactions-page " + className },
    e("p", { className: "core-empty" }, "Vui lòng chọn danh mục.")
  );

  return e("div", { className: "core-transactions-page " + className },
    e("header", { className: "core-page-header" }, e("h1", null, "Giao dịch")),
    e("form", { className: "core-create-form", onSubmit: handleCreate },
      e("h2", null, "Thêm giao dịch mới"),
      e("label", null, "Mã CP:", e("input", { name: "symbol", type: "text", value: form.symbol, onChange: handleFormChange, maxLength: 10, required: true })),
      e("label", null, "Chiều:",
        e("select", { name: "side", value: form.side, onChange: handleFormChange },
          e("option", { value: "buy" }, "Mua"), e("option", { value: "sell" }, "Bán")
        )
      ),
      e("label", null, "Số lượng:", e("input", { name: "quantity", type: "number", min: "1", step: "1", value: form.quantity, onChange: handleFormChange, required: true })),
      e("label", null, "Giá:", e("input", { name: "price", type: "number", min: "0", step: "0.01", value: form.price, onChange: handleFormChange, required: true })),
      e("label", null, "Phí:", e("input", { name: "fee", type: "number", min: "0", step: "0.01", value: form.fee, onChange: handleFormChange })),
      e("label", null, "Ngày GD:", e("input", { name: "trade_date", type: "date", value: form.trade_date, onChange: handleFormChange, required: true })),
      e("label", null, "Ghi chú:", e("input", { name: "note", type: "text", value: form.note, onChange: handleFormChange, maxLength: 255 })),
      e("button", { type: "submit", disabled: creating }, creating ? "Đang lưu..." : "Thêm giao dịch"),
      createError ? e("p", { className: "core-error" }, createError) : null
    ),
    loading ? e("p", { className: "core-loading" }, "Đang tải giao dịch...") : null,
    error ? e("p", { className: "core-error" }, error) : null,
    (!loading && !error && transactions.length === 0) ? e("p", { className: "core-empty" }, "Chưa có giao dịch nào.") : null,
    (!loading && transactions.length > 0) ? e("table", { className: "core-transactions-table" },
      e("thead", null, e("tr", null,
        e("th", null, "Mã CP"), e("th", null, "Chiều"), e("th", null, "Số lượng"),
        e("th", null, "Giá"), e("th", null, "Phí"), e("th", null, "Ngày GD"), e("th", null, "Ghi chú")
      )),
      e("tbody", null, transactions.map((t: Transaction) =>
        e("tr", { key: t.id, className: "core-tx-row core-side-" + t.side },
          e("td", null, t.symbol),
          e("td", null, t.side === "buy" ? "Mua" : "Bán"),
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
