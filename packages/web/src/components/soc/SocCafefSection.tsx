import { createElement as e, useCallback, useState } from "react";
import { useI18n } from "../../context/LangContext.js";
import { defaultCoreApiAdapter } from "../../adapters/coreApiAdapter.js";

type CafefAdapter = {
  previewCafefImport: (p: Record<string, unknown>) => Promise<{ data?: Record<string, unknown> }>;
  runCafefImport: (p: Record<string, unknown>) => Promise<{ data?: Record<string, unknown> }>;
  abortCafefImport: (id: string) => Promise<unknown>;
  getCafefImportStatus: (id: string) => Promise<{ data?: Record<string, unknown> }>;
};

const boxStyle = {
  padding: "1rem",
  borderRadius: "0.75rem",
  border: "1px solid var(--soc-border, rgba(148,163,184,.25))",
  background: "rgba(var(--soc-rgb-0f172a, 15 23 42) / .35)",
  display: "grid",
  gap: "0.75rem",
  maxWidth: "44rem",
} as const;

const rowStyle = { display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" } as const;
const btnStyle = {
  padding: "0.4rem 0.9rem",
  borderRadius: "0.5rem",
  border: "1px solid var(--soc-border, rgba(148,163,184,.3))",
  cursor: "pointer",
  background: "rgba(var(--soc-rgb-22d3ee, 34 211 238) / .14)",
  color: "var(--soc-text, inherit)",
} as const;

export function SocCafefSection() {
  const { t } = useI18n();
  const [exchange, setExchange] = useState("HOSE");
  const [year, setYear] = useState(2022);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<Record<string, unknown> | null>(null);
  const [runId, setRunId] = useState("");
  const [error, setError] = useState("");

  const adapter = () => defaultCoreApiAdapter as unknown as CafefAdapter;
  const payload = () => ({ exchange, year });
  const unwrap = (res: { data?: Record<string, unknown> }) =>
    (res && res.data ? res.data : res) as Record<string, unknown>;

  const call = useCallback(async (fn: "preview" | "dry" | "apply") => {
    setBusy(true);
    setError("");
    try {
      if (fn === "preview") {
        setResult(unwrap(await adapter().previewCafefImport(payload())));
        return;
      }
      const res = unwrap(await adapter().runCafefImport({ ...payload(), dry_run: fn === "dry" }));
      setResult(res);
      if (res.run_id) setRunId(String(res.run_id));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [exchange, year]);

  const abort = useCallback(async () => {
    if (!runId) return;
    setBusy(true);
    try {
      await adapter().abortCafefImport(runId);
      setResult(unwrap(await adapter().getCafefImportStatus(runId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [runId]);

  const status = useCallback(async () => {
    if (!runId) return;
    try {
      setResult(unwrap(await adapter().getCafefImportStatus(runId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [runId]);

  return e("div", { style: boxStyle },
    e("p", null, t("soc.dataops.cafef_desc", { defaultValue: "Nguồn OHLC CafeF dùng để đối chiếu. Không ghi đè dữ liệu giá hệ thống." })),
    e("div", { style: rowStyle },
      e("label", null,
        t("soc.dataops.cafef_exchange", { defaultValue: "Sàn" }),
        e("select", {
          value: exchange,
          onChange: (ev: React.ChangeEvent<HTMLSelectElement>) => setExchange(ev.target.value),
        }, ["HOSE", "HNX", "UPCOM"].map((x) => e("option", { key: x, value: x }, x))),
      ),
      e("label", null,
        t("soc.dataops.cafef_year", { defaultValue: "Năm" }),
        e("input", {
          type: "number", min: 2010, max: 2030, value: year,
          onChange: (ev: React.ChangeEvent<HTMLInputElement>) => setYear(Number(ev.target.value)),
        }),
      ),
    ),
    e("div", { style: rowStyle },
      e("button", { type: "button", style: btnStyle, disabled: busy, onClick: () => call("preview") },
        t("soc.dataops.cafef_preview", { defaultValue: "Xem trước" })),
      e("button", { type: "button", style: btnStyle, disabled: busy, onClick: () => call("dry") },
        t("soc.dataops.cafef_dryrun", { defaultValue: "Thử (không ghi)" })),
      e("button", { type: "button", style: btnStyle, disabled: busy, onClick: () => call("apply") },
        t("soc.dataops.cafef_apply", { defaultValue: "Áp dụng" })),
      runId ? e("button", { type: "button", style: btnStyle, disabled: busy, onClick: status },
        t("soc.dataops.cafef_status", { defaultValue: "Trạng thái" })) : null,
      runId ? e("button", { type: "button", style: btnStyle, disabled: busy, onClick: abort },
        t("soc.dataops.cafef_abort", { defaultValue: "Hủy" })) : null,
    ),
    error ? e("p", { role: "alert" }, error) : null,
    result ? e("pre", { style: { overflowX: "auto", fontSize: "0.8rem" } }, JSON.stringify(result, null, 2)) : null,
  );
}
