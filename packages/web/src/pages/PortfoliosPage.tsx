import { createElement, FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useToast } from "../components/ShellToast.js";
import { useConfirm } from "../components/ConfirmModal.js";
import DNSEConnectionPanel from "../components/DNSEConnectionPanel.js";
import { ShellPageChrome } from "../components/ShellPageTemplate.js";
import "./PortfoliosPage.css";

const e = createElement;

/** `opening_balance` is a decimal string on the wire; show it or "—" when unset. */
function formatVnd(value?: string | null): string {
  if (value === undefined || value === null || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString("vi-VN") : String(value);
}

/**
 * Fields mirror `PortfolioSerializer.Meta.fields`.
 *
 * `currency` and `status` were declared as required strings, but the serializer
 * never accepted them and the model has no such columns: the currency picker
 * silently did nothing and two table columns stayed blank forever. Declaring
 * them non-optional is why type-check never flagged it. `field-contract.test.js`
 * now derives the allowed set from `serializers.py`.
 */
interface Portfolio {
  id: string | number;
  name: string;
  description?: string | null;
  is_default?: boolean;
  opening_balance?: string | null;
  opening_balance_source?: string | null;
  created_at: string;
  [key: string]: unknown;
}

interface PortfoliosResponse {
  results?: Portfolio[];
  [key: string]: unknown;
}

interface PortfoliosPageProps {
  className?: string;
}

function usePortfolios() {
  const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const mountedRef = useRef(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await (coreApiAdapter as any).getPortfolios() as PortfoliosResponse;
      if (!mountedRef.current) return;
      setPortfolios((res?.results ?? []) as Portfolio[]);
    } catch (err: unknown) {
      if (!mountedRef.current) return;
      setError(err && typeof err === 'object' && 'message' in err ? (err as Error).message : "Không thể tải danh mục.");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    reload();
    return () => { mountedRef.current = false; };
  }, [reload]);

  return { portfolios, loading, error, reload };
}

export function PortfoliosPage({ className = "" }: PortfoliosPageProps) {
  const { portfolios, loading, error, reload } = usePortfolios();
  const toast = useToast();
  const confirm = useConfirm();
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newOpeningBalance, setNewOpeningBalance] = useState("");
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(ev: FormEvent) {
    ev.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setCreateError(null);
    try {
      await (coreApiAdapter as any).createPortfolio({ name, opening_balance: newOpeningBalance || "0", opening_balance_source: newOpeningBalance ? "user_input" : "not_set" });
      setNewName("");
      await reload();
    } catch (err: unknown) {
      setCreateError(err && typeof err === 'object' && 'message' in err ? (err as Error).message : "Không thể tạo danh mục.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string | number) {
    const ok = await confirm({
      title: 'Xóa danh mục',
      message: 'Xóa danh mục này?',
      variant: 'destructive',
    });
    if (!ok) return;
    try {
      await (coreApiAdapter as any).deletePortfolio(id);
      await reload();
    } catch (err: unknown) {
      toast.error(err && typeof err === 'object' && 'message' in err ? (err as Error).message : "Không thể xóa danh mục.");
    }
  }

  return e(ShellPageChrome, { eyebrow: "Portfolio", title: "Danh mục đầu tư", className },
    e("div", { className: "core-portfolios-page" },
    e("section", { className: "core-dnse-panel-wrap" },
      e(DNSEConnectionPanel, null)
    ),
    e("form", { className: "core-create-form", onSubmit: handleCreate },
      e("h2", null, "Tạo danh mục mới"),
      e("label", null, "Tên:",
        e("input", { type: "text", value: newName, onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setNewName(ev.target.value), placeholder: "Tên danh mục", maxLength: 100, required: true })
      ),
      e("label", null, "Số dư mở đầu (VND):",
        e("input", { type: "number", min: "0", step: "1", value: newOpeningBalance, onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setNewOpeningBalance(ev.target.value), placeholder: "0" })
      ),
      e("button", { type: "submit", disabled: creating }, creating ? "Đang tạo..." : "Tạo danh mục"),
      createError ? e("p", { className: "core-error" }, createError) : null
    ),
    loading ? e("p", { className: "core-loading" }, "Đang tải danh mục...") : null,
    error ? e("p", { className: "core-error" }, error) : null,
    (!loading && !error && portfolios.length === 0) ? e("p", { className: "core-empty" }, "Chưa có danh mục nào.") : null,
    (!loading && portfolios.length > 0) ? e("table", { className: "core-portfolios-table" },
      e("thead", null, e("tr", null,
        e("th", null, "Tên"), e("th", null, "Số dư mở đầu"),
        e("th", null, "Ngày tạo"), e("th", null, "Thao tác")
      )),
      e("tbody", null, portfolios.map((p: Portfolio) =>
        e("tr", { key: p.id },
          e("td", null, p.name),
          e("td", null, formatVnd(p.opening_balance)),
          e("td", null, p.created_at ? new Date(p.created_at).toLocaleDateString("vi-VN") : "—"),
          e("td", null,
            e("a", { href: "/transactions", className: "core-link" }, "Giao dịch"),
            " ",
            e("button", { className: "core-btn-danger", onClick: () => handleDelete(p.id) }, "Xóa")
          )
        )
      ))
    ) : null
    )
  );
}
