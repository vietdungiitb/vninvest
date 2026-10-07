import { createElement, ChangeEvent, FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";

const e = createElement;

/**
 * Backend field names, from `TransactionSerializer.Meta.fields`.
 *
 * `side` / `trade_date` were used here before and the POST answered 400 on every
 * attempt: the serializer reads `transaction_type` (choices BUY/SELL/DIVIDEND) and
 * `date`. `field-contract.test.js` now derives the allowed set from
 * `serializers.py` at run time so the two cannot drift apart again.
 */
interface Transaction {
  id: string | number;
  symbol: string;
  transaction_type: string;
  quantity: number;
  price: number;
  fee: number;
  tax?: number;
  date: string;
  external_id?: string | null;
  note?: string | null;
  [key: string]: unknown;
}

interface TransactionsResponse {
  results?: Transaction[];
  [key: string]: unknown;
}

interface PortfoliosResponse {
  results?: { id: string | number; name: string }[];
  [key: string]: unknown;
}

interface TransactionsPageProps {
  portfolioId?: string | number;
  className?: string;
}

interface TransactionForm {
  symbol: string;
  transaction_type: string;
  quantity: string;
  price: string;
  fee: string;
  tax: string;
  date: string;
  note: string;
}

function usePortfolios() {
  const [portfolios, setPortfolios] = useState<{ id: string | number; name: string }[]>([]);
  const [loading, setLoading] = useState(false);
  // Same reason as `useTransactions`: setState after unmount leaks, and a
  // late response would overwrite fresher state.
  const mountedRef = useRef(true);
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    const requestId = ++requestIdRef.current;
    setLoading(true);
    try {
      const res = (await (coreApiAdapter as any).getPortfolios()) as PortfoliosResponse;
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setPortfolios(res?.results ?? []);
    } catch {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setPortfolios([]);
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    void reload();
    return () => { mountedRef.current = false; };
  }, [reload]);

  return { portfolios, loading };
}

function useTransactions({ portfolioId }: { portfolioId?: string | number } = {}) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);
  // Một ref `mountedRef` không đủ: nó theo dõi mount/unmount, không theo dõi
  // **danh tính request**. Đổi `portfolioId` thì request cũ còn bay sẽ thấy
  // `mountedRef.current === true` và ghi đè danh sách của portfolio mới.
  // `requestIdRef` đánh số từng lần tải; chỉ lần tải mới nhất được ghi state.
  const requestIdRef = useRef(0);

  const reload = useCallback(async () => {
    if (!portfolioId) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    setError(null);
    try {
      const res = await (coreApiAdapter as any).getTransactions(portfolioId) as TransactionsResponse;
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setTransactions((res?.results ?? []) as Transaction[]);
    } catch (err: unknown) {
      if (!mountedRef.current || requestId !== requestIdRef.current) return;
      setError(err && typeof err === 'object' && 'message' in err ? (err as Error).message : "Không thể tải giao dịch.");
    } finally {
      if (mountedRef.current && requestId === requestIdRef.current) setLoading(false);
    }
  }, [portfolioId]);

  useEffect(() => {
    mountedRef.current = true;
    reload();
    return () => { mountedRef.current = false; };
  }, [reload]);

  return { transactions, loading, error, reload };
}

export function TransactionsPage({ portfolioId: portfolioIdProp, className = "" }: TransactionsPageProps) {
  const { portfolios, loading: portfoliosLoading } = usePortfolios();
  const [portfolioId, setPortfolioId] = useState<string | number | undefined>(portfolioIdProp);

  // `main.tsx` renders this route without any prop, so before this change the
  // page stopped at "Vui lòng chọn danh mục." and never rendered a form.
  // Default to the first portfolio so the page works from the menu.
  useEffect(() => {
    if (portfolioIdProp !== undefined) {
      setPortfolioId(portfolioIdProp);
      return;
    }
    if (portfolioId === undefined && portfolios.length > 0) setPortfolioId(portfolios[0].id);
  }, [portfolioIdProp, portfolios, portfolioId]);

  const { transactions, loading, error, reload } = useTransactions({ portfolioId });
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState<TransactionForm>({
    symbol: "", transaction_type: "BUY", quantity: "", price: "", fee: "0", tax: "0",
    date: new Date().toISOString().slice(0, 10), note: "",
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
      // Explicit literal, never `...form`: the field-contract gate must be able
      // to read every field this page sends.
      await (coreApiAdapter as any).createTransaction(portfolioId, {
        symbol: form.symbol.trim().toUpperCase(),
        transaction_type: form.transaction_type,
        quantity: Number(form.quantity),
        price: Number(form.price),
        fee: Number(form.fee),
        tax: Number(form.tax),
        date: form.date,
        note: form.note.trim() || null,
      });
      setForm((f) => ({ ...f, symbol: "", quantity: "", price: "", fee: "0", tax: "0", note: "" }));
      await reload();
    } catch (err: unknown) {
      setCreateError(err && typeof err === 'object' && 'message' in err ? (err as Error).message : "Không thể tạo giao dịch.");
    } finally {
      setCreating(false);
    }
  }

  const pageProps = { className: "core-transactions-page " + className };

  if (portfoliosLoading) {
    return e("div", pageProps, e("p", { className: "core-loading" }, "Đang tải danh mục..."));
  }

  if (!portfolioId && portfolios.length === 0) {
    return e("div", pageProps,
      e("p", { className: "core-empty" }, "Chưa có danh mục nào. Hãy tạo danh mục trước."),
      e("a", { href: "/portfolios", className: "core-link" }, "Đi tới Danh mục")
    );
  }

  return e("div", pageProps,
    e("header", { className: "core-page-header" },
      e("h1", null, "Giao dịch"),
      portfolios.length > 1
        ? e("label", null, "Danh mục: ",
            e("select", {
              name: "portfolioId",
              value: String(portfolioId ?? ""),
              onChange: (ev: ChangeEvent<HTMLSelectElement>) => setPortfolioId(ev.target.value),
            }, portfolios.map((p) => e("option", { key: p.id, value: String(p.id) }, p.name)))
          )
        : null
    ),
    !portfolioId
      ? e("p", { className: "core-empty" }, "Vui lòng chọn danh mục.")
      : e("form", { className: "core-create-form", onSubmit: handleCreate },
          e("h2", null, "Thêm giao dịch mới"),
          e("label", null, "Mã CP:", e("input", { name: "symbol", type: "text", value: form.symbol, onChange: handleFormChange, maxLength: 10, required: true })),
          e("label", null, "Chiều:",
            e("select", { name: "transaction_type", value: form.transaction_type, onChange: handleFormChange },
              e("option", { value: "BUY" }, "Mua"),
              e("option", { value: "SELL" }, "Bán"),
              e("option", { value: "DIVIDEND" }, "Cổ tức tiền mặt")
            )
          ),
          e("label", null, "Số lượng:", e("input", { name: "quantity", type: "number", min: "1", step: "1", value: form.quantity, onChange: handleFormChange, required: true })),
          e("label", null, "Giá:", e("input", { name: "price", type: "number", min: "0", step: "0.01", value: form.price, onChange: handleFormChange, required: true })),
          e("label", null, "Phí:", e("input", { name: "fee", type: "number", min: "0", step: "0.01", value: form.fee, onChange: handleFormChange })),
          e("label", null, "Thuế:", e("input", { name: "tax", type: "number", min: "0", step: "0.01", value: form.tax, onChange: handleFormChange })),
          e("label", null, "Ngày GD:", e("input", { name: "date", type: "date", value: form.date, onChange: handleFormChange, required: true })),
          e("label", null, "Ghi chú:", e("input", { name: "note", type: "text", value: form.note, onChange: handleFormChange, maxLength: 255 })),
          e("button", { type: "submit", disabled: creating }, creating ? "Đang lưu..." : "Thêm giao dịch"),
          createError ? e("p", { className: "core-error" }, createError) : null
        ),
    loading ? e("p", { className: "core-loading" }, "Đang tải giao dịch...") : null,
    error ? e("p", { className: "core-error" }, error) : null,
    (!loading && !error && transactions.length === 0 && portfolioId) ? e("p", { className: "core-empty" }, "Chưa có giao dịch nào.") : null,
    (!loading && transactions.length > 0) ? e("table", { className: "core-transactions-table" },
      e("thead", null, e("tr", null,
        e("th", null, "Mã CP"), e("th", null, "Chiều"), e("th", null, "Số lượng"),
        e("th", null, "Giá"), e("th", null, "Phí"), e("th", null, "Thuế"),
        e("th", null, "Ngày GD"), e("th", null, "Ghi chú")
      )),
      e("tbody", null, transactions.map((t: Transaction) =>
        e("tr", { key: t.id, className: "core-tx-row core-side-" + t.transaction_type },
          e("td", null, t.symbol),
          e("td", null, t.transaction_type === "BUY" ? "Mua" : t.transaction_type === "SELL" ? "Bán" : "Cổ tức"),
          e("td", null, Number(t.quantity).toLocaleString("vi-VN")),
          e("td", null, Number(t.price).toLocaleString("vi-VN")),
          e("td", null, Number(t.fee ?? 0).toLocaleString("vi-VN")),
          e("td", null, Number(t.tax ?? 0).toLocaleString("vi-VN")),
          e("td", null, t.date),
          e("td", null, t.note || "—")
        )
      ))
    ) : null
  );
}