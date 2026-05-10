/**
 * SM-P4.6 — PortfoliosPage
 * Trang quan ly danh muc dau tu: tao, xem, xoa danh muc.
 * Khong dung JSX — tuan theo convention packages/web (createElement).
 */
import { createElement, useCallback, useEffect, useRef, useState } from "react";

import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import DNSEConnectionPanel from "../components/DNSEConnectionPanel.js";

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
    e("section", { className: "core-dnse-panel-wrap" },
      e(DNSEConnectionPanel, null)
    ),
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
