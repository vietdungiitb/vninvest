import { createElement, FormEvent, useCallback, useEffect, useRef, useState } from "react";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import DNSEConnectionPanel from "../components/DNSEConnectionPanel.js";
import { ShellPageChrome } from "../components/ShellPageTemplate.js";
import "./PortfoliosPage.css";

const e = createElement;

interface Portfolio {
  id: string | number;
  name: string;
  currency: string;
  status: string;
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
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCurrency, setNewCurrency] = useState("VND");
  const [createError, setCreateError] = useState<string | null>(null);

  async function handleCreate(ev: FormEvent) {
    ev.preventDefault();
    const name = newName.trim();
    if (!name) return;
    setCreating(true);
    setCreateError(null);
    try {
      await (coreApiAdapter as any).createPortfolio({ name, currency: newCurrency });
      setNewName("");
      await reload();
    } catch (err: unknown) {
      setCreateError(err && typeof err === 'object' && 'message' in err ? (err as Error).message : "Không thể tạo danh mục.");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete(id: string | number) {
    if (!window.confirm("Xóa danh mục này?")) return;
    try {
      await (coreApiAdapter as any).deletePortfolio(id);
      await reload();
    } catch (err: unknown) {
      window.alert(err && typeof err === 'object' && 'message' in err ? (err as Error).message : "Không thể xóa danh mục.");
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
      e("label", null, "Tiền tệ:",
        e("select", { value: newCurrency, onChange: (ev: React.ChangeEvent<HTMLSelectElement>) => setNewCurrency(ev.target.value) },
          e("option", { value: "VND" }, "VND"),
          e("option", { value: "USD" }, "USD")
        )
      ),
      e("button", { type: "submit", disabled: creating }, creating ? "Đang tạo..." : "Tạo danh mục"),
      createError ? e("p", { className: "core-error" }, createError) : null
    ),
    loading ? e("p", { className: "core-loading" }, "Đang tải danh mục...") : null,
    error ? e("p", { className: "core-error" }, error) : null,
    (!loading && !error && portfolios.length === 0) ? e("p", { className: "core-empty" }, "Chưa có danh mục nào.") : null,
    (!loading && portfolios.length > 0) ? e("table", { className: "core-portfolios-table" },
      e("thead", null, e("tr", null,
        e("th", null, "Tên"), e("th", null, "Tiền tệ"), e("th", null, "Trạng thái"),
        e("th", null, "Ngày tạo"), e("th", null, "Thao tác")
      )),
      e("tbody", null, portfolios.map((p: Portfolio) =>
        e("tr", { key: p.id },
          e("td", null, p.name),
          e("td", null, p.currency),
          e("td", null, p.status),
          e("td", null, p.created_at ? new Date(p.created_at).toLocaleDateString("vi-VN") : "—"),
          e("td", null,
            e("button", { className: "core-btn-danger", onClick: () => handleDelete(p.id) }, "Xóa")
          )
        )
      ))
    ) : null
    )
  );
}
