import { useState, useEffect, createElement, useCallback, useRef, forwardRef, useImperativeHandle } from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";
import styles from "./aiSettings.module.css";
import { useUrlState, intCodec, stringCodec, type UrlStateCodec, type UrlStateOptions } from "../hooks/useUrlState";

const e = createElement;

const AUDIT_PAGE_SIZE = 10;
const AUDIT_EXPORT_MAX_ROWS = 5000;
const AUDIT_FILTER_DEBOUNCE_MS = 300;

type AuditUrlState = {
  action: string; actor: string; dateFrom: string; dateTo: string; page: number;
};

/**
 * Trang 1 la MAC DINH ⇒ `serialize` tra `undefined` cho 1 ⇒ `?page=1` KHONG duoc
 * ghi ra URL (link copy ra khong dinh tham so thua).
 *
 * ⚠ `parse` cung phai tra `undefined` cho 1, khong tra 1 — cung nguyen tac voi
 * `boolCodec` (`useUrlState.ts:80-90`): `parse` tra gia tri ≠ `undefined` thi
 * hook dung gia tri do THAY cho `fallback`.
 *
 * Vì sao khong dung `intCodec` thang: `intCodec.serialize(1)` = `"1"` ⇒ bam
 * "Xoa bo loc" se de lai `?page=1` trong khi filter da sach.
 */
const pageCodec: UrlStateCodec<number> = {
  parse: (raw) => {
    const n = intCodec.parse(raw);
    return n === undefined || n < 1 ? undefined : n;
  },
  serialize: (v) => (v === 1 ? undefined : intCodec.serialize(v)),
};

// WAVE 10 / NAV-1 — `spec` + `defaults` khai o CAP MODULE de identity on dinh
// giua cac lan render. Truoc day truyen object literal trong render lam
// `useMemo([params, spec, defaults])` (useUrlState.ts:150) luon tinh lai.
const AUDIT_URL_SPEC: { [K in keyof AuditUrlState]: UrlStateCodec<AuditUrlState[K]> } = {
  action: stringCodec,
  actor: stringCodec,
  dateFrom: stringCodec,
  dateTo: stringCodec,
  page: pageCodec,
};
const AUDIT_URL_DEFAULTS: AuditUrlState = {
  action: '', actor: '', dateFrom: '', dateTo: '', page: 1,
};
// ⚠ `options` cung phai o CAP MODULE. `useUrlState` memo hoa `setValue` theo
// `replaceKeys` (`useUrlState.ts:187`) ⇒ object literal trong render tao mang
// moi moi lan ⇒ `setValue` doi identity ⇒ moi `useCallback` booc no lai doi
// identity ⇒ `useEffect([..., setPage])` chay LAI moi lan render ⇒ loop.
const AUDIT_URL_OPTIONS: UrlStateOptions = { replaceKeys: ["actor"] };

export interface AuditLogEntry {
  id: number;
  action: string;
  actor: string;
  reason: string;
  before_json: Record<string, unknown>;
  after_json: Record<string, unknown>;
  diff_summary: string;
  created_at: string;
}

/** R1.2 AC8: ngày hỏng/ rỗng ⇒ "—", không bao giờ ném. */
export function formatAuditDate(dateStr: string, localeTag: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "—";
  try {
    return d.toLocaleString(localeTag);
  } catch {
    return "—";
  }
}

const AUDIT_CSV_COLUMNS = ["id", "action", "actor", "reason", "created_at", "diff_summary"] as const;

function aiAuditCsvEscape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const text = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export interface AiAuditCsvOut {
  header: string;
  body: string;
  count: number;
  truncated: boolean;
}

/** R1.2 AC4: CSV có BOM ở khâu download, escape, cap 5000 + cờ truncated. */
export function buildAiAuditCsv(logs: AuditLogEntry[]): AiAuditCsvOut {
  const items = Array.isArray(logs) ? logs : [];
  const rows = items.slice(0, AUDIT_EXPORT_MAX_ROWS).map((log) => ({
    id: log.id ?? '',
    action: log.action || '',
    actor: log.actor || '',
    reason: log.reason || '',
    created_at: log.created_at || '',
    diff_summary: log.diff_summary || '',
  }));
  const header = [...AUDIT_CSV_COLUMNS].join(',');
  const body = rows
    .map((row) => AUDIT_CSV_COLUMNS.map((col) => aiAuditCsvEscape(row[col])).join(','))
    .join('\n');
  return { header, body, count: rows.length, truncated: items.length > AUDIT_EXPORT_MAX_ROWS };
}

/** R1.2 AC4: tải CSV (BOM \uFEFF). Trả số dòng đã xuất; 0 khi môi trường không hỗ trợ. */
export function downloadAiAuditCsv(out: AiAuditCsvOut, filename: string): number {
  try {
    if (typeof document === "undefined") return 0;
    if (typeof URL === "undefined" || typeof (URL as unknown as { createObjectURL?: unknown }).createObjectURL !== "function") return 0;
    const blob = new Blob(["\uFEFF" + out.header + "\n" + out.body], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
    return out.count;
  } catch {
    return 0;
  }
}

interface AIAuditLogsPanelProps {
  refreshKey?: number;
}

/** R1.4 AC5: cha gọi refresh() imperative — panel tải lại mà KHÔNG reset page/filter. */
export interface AIAuditLogsPanelHandle {
  refresh: () => void;
}

export const AIAuditLogsPanel = forwardRef<AIAuditLogsPanelHandle, AIAuditLogsPanelProps>(
  function AIAuditLogsPanel({ refreshKey = 0 }, ref) {
  const { t, localeTag } = useI18n();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [exportNotice, setExportNotice] = useState('');

  // WAVE 10 / NAV-1: 4 bo loc + phan trang nam trong RAM nen gui link cho
  // nguoi khac thi ho thay man hinh CHUA loc. `useUrlState` (patch) thay 5
  // `useState` de MOT lan bam chi tao MOT history entry.
  //
  // Major 2: `actor` la O NHAP VAN BAN gan thang `onChange` (L~155) ⇒ `push`
  // se tao 1 history entry cho MOI KY TU. Key do `replace`. Cac key con lai
  // (page/action/dateFrom/dateTo) giu `push` de nut Back van quay lai duoc
  // bo loc truoc do.
  const [{ action, actor, dateFrom, dateTo, page }, setUrlState] = useUrlState(
    AUDIT_URL_SPEC,
    AUDIT_URL_DEFAULTS,
    AUDIT_URL_OPTIONS,
  );
  const setFilterAction = useCallback((v: string) => setUrlState({ action: v, page: 1 }), [setUrlState]);
  const setFilterActor = useCallback((v: string) => setUrlState({ actor: v, page: 1 }), [setUrlState]);
  const setFilterDateFrom = useCallback((v: string) => setUrlState({ dateFrom: v, page: 1 }), [setUrlState]);
  const setFilterDateTo = useCallback((v: string) => setUrlState({ dateTo: v, page: 1 }), [setUrlState]);
  const setPage = useCallback((v: number) => setUrlState({ page: v }), [setUrlState]);
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const loadLogs = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      // R1.2 AC5: refreshKey chỉ reset page, không đính kèm cache-buster vào params.
      const params: Record<string, string | number> = {
        limit: AUDIT_PAGE_SIZE,
        offset: (page - 1) * AUDIT_PAGE_SIZE,
      };
      if (action) params.action = action;
      if (actor) params.actor = actor;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;

      const data = await (coreApiAdapter as any).getAIAuditLogs(params);
      setLogs(data.results || []);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      setError((err && typeof err === 'object' && 'message' in err ? (err as Error).message : '') || t('aiCommandCenter.loadError'));
    } finally {
      setLoading(false);
    }
  // `refreshKey` trong deps là CHỦ Ý (không phải thừa): khi cha lưu settings,
  // refreshKey đổi nhưng page có thể vẫn 1 ⇒ không có state nào đổi ⇒ effect
  // debounce không chạy lại ⇒ phải refetch trực tiếp ở đây. Giữ nguyên ngữ
  // nghĩa bản cũ (loadLogs cũ cũng deps refreshKey).
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, action, actor, dateFrom, dateTo, refreshKey, t]);

  // R1.4 AC5: refresh imperative — cha (page) gọi sau khi lưu, giữ nguyên page/filter.
  const loadLogsRef = useRef(loadLogs);
  loadLogsRef.current = loadLogs;
  useImperativeHandle(ref, () => ({ refresh: () => { loadLogsRef.current(); } }), []);

  // R1.2 AC3: mount goi ngay; doi filter debounce 300ms (doi select 1 lan chi 1 request).
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      loadLogs();
      return;
    }
    const h = setTimeout(loadLogs, AUDIT_FILTER_DEBOUNCE_MS);
    return () => clearTimeout(h);
  }, [loadLogs]);

  // WAVE 10 / NAV-1: bo loc doi da ve trang 1 TRONG CUNG mot patch voi gia tri
  // bo loc (xem `setFilterAction`…), nen effect nay chi con 1 viec: ve trang 1
  // khi cha doi `refreshKey`.
  //
  // ⚡ Phai khoa bang `ref` chu khong chi `if (refreshKey)`: effect chay 1 lan
  // luc MOUNT, ma `refreshKey` co the da > 0 ⇒ se ghi `?page=1` thua vao URL
  // ngay khi user chua cham gi (pham AC-A). So voi `refreshKey` truoc do moi
  // la doi chu thay, va do la thoi diem reset duy nhat con lai.
  const prevRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (refreshKey !== prevRefreshKey.current) {
      prevRefreshKey.current = refreshKey;
      setPage(1);
    }
  }, [refreshKey, setPage]);

  // R1.2 AC3: nút Áp dụng chỉ chốt page (effect debounce lo fetch) — không double-fetch.
  const applyFilters = () => { setPage(1); };
  const handleRefresh = () => { loadLogs(); };

  const handleExport = () => {
    const out = buildAiAuditCsv(logs);
    const n = downloadAiAuditCsv(out, "ai-audit-logs.csv");
    void n;
    setExportNotice(out.truncated ? t("aiCommandCenter.exportTruncated") : t("aiCommandCenter.exportedCount", { count: out.count }));
  };

  const resetFilters = () => {
    // MOT patch cho ca 5 key: `setUrlState` chi ghi key duoc NAM trong patch
    // (`useUrlState.ts:177-181`). Neu goi 5 lan, tham so cu se CON LAI tren URL
    // ⇒ link da "xoa bo loc" van chua loc.
    setUrlState({ action: '', actor: '', dateFrom: '', dateTo: '', page: 1 });
  };

  const toggleExpand = (id: number) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalPages = Math.max(1, Math.ceil(total / AUDIT_PAGE_SIZE));

  const actionBadgeClass = (action: string) => {
    if (action === 'update_settings') return `${styles.auditBadge} ${styles.auditBadgeUpdate}`;
    if (action === 'test_connection_success') return `${styles.auditBadge} ${styles.auditBadgeSuccess}`;
    if (action === 'test_connection_failed') return `${styles.auditBadge} ${styles.auditBadgeFail}`;
    return `${styles.auditBadge} ${styles.auditBadgeDefault}`;
  };

  const actionOptions = [
    { value: '', label: t('aiCommandCenter.actionAll') },
    { value: 'update_settings', label: t('aiCommandCenter.actionUpdateSettings') },
    { value: 'test_connection_success', label: t('aiCommandCenter.actionTestSuccess') },
    { value: 'test_connection_failed', label: t('aiCommandCenter.actionTestFailed') },
  ];

  const actionLabel = (action: string) => {
    const opt = actionOptions.find(o => o.value === action);
    return opt ? opt.label : action;
  };

  return e("div", { className: styles.auditWrap }, [
    // Filters
    e("div", { key: "filters", className: styles.auditFilters }, [
      // Action filter
      e("div", { key: "filter-action" },
        e("label", { className: styles.auditFieldLabel }, t("aiCommandCenter.action")),
        e("select", {
          value: action,
          onChange: (ev: any) => setFilterAction(ev.target.value),
          className: styles.select
        }, actionOptions.map(opt =>
          e("option", { key: opt.value, value: opt.value }, opt.label)
        ))
      ),
      // Actor filter
      e("div", { key: "filter-actor" },
        e("label", { className: styles.auditFieldLabel }, t("aiCommandCenter.actor")),
        e("input", {
          type: "text",
          value: actor,
          onChange: (ev: any) => setFilterActor(ev.target.value),
          className: styles.input,
          placeholder: t("aiCommandCenter.actorPlaceholder")
        })
      ),
      // Date from
      e("div", { key: "filter-date-from" },
        e("label", { className: styles.auditFieldLabel }, t("aiCommandCenter.fromDate")),
        e("input", {
          type: "date",
          value: dateFrom,
          onChange: (ev: any) => setFilterDateFrom(ev.target.value),
          className: styles.input
        })
      ),
      // Date to
      e("div", { key: "filter-date-to" },
        e("label", { className: styles.auditFieldLabel }, t("aiCommandCenter.toDate")),
        e("input", {
          type: "date",
          value: dateTo,
          onChange: (ev: any) => setFilterDateTo(ev.target.value),
          className: styles.input
        })
      ),
      // Action buttons
      e("div", { key: "filter-actions", className: styles.auditActions }, [
        e("button", {
          key: "apply",
          type: "button",
          onClick: applyFilters,
          disabled: loading,
          className: `${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`
        }, t("aiCommandCenter.applyFilter")),
        e("button", {
          key: "refresh",
          type: "button",
          onClick: handleRefresh,
          disabled: loading,
          className: `${styles.btn} ${styles.btnGhost} ${styles.btnSm}`
        }, t("aiCommandCenter.refreshList")),
        e("button", {
          key: "reset",
          type: "button",
          onClick: resetFilters,
          className: `${styles.btn} ${styles.btnGhost} ${styles.btnSm}`
        }, t("aiCommandCenter.resetFilter")),
        e("button", {
          key: "export",
          type: "button",
          onClick: handleExport,
          disabled: loading || logs.length === 0,
          className: `${styles.btn} ${styles.btnGhost} ${styles.btnSm}`
        }, t("aiCommandCenter.exportCsv"))
      ])
    ]),

    // Export notice
    exportNotice
      ? e("div", { key: "export-notice", className: styles.auditNotice }, exportNotice)
      : null,

    // Loading
    loading
      ? e("div", { key: "loading", className: styles.loading }, t("aiCommandCenter.loading"))
      : null,

    // Error
    error
      ? e("div", { key: "error", className: `${styles.alert} ${styles.alertError}` }, error)
      : null,

    // Log list
    !loading && !error && logs.length === 0
      ? e("div", { key: "empty", className: styles.empty }, t("aiCommandCenter.noLogs"))
      : null,

    !loading
      ? e("div", { key: "log-list", className: styles.auditList },
          logs.map(log => {
            const expanded = expandedIds.has(log.id);
            return e("div", {
              key: log.id,
              className: styles.auditRow
            }, [
              // R1.2 AC2: header là <button> với aria-expanded + keyboard native.
              e("button", {
                key: "header",
                type: "button",
                className: styles.auditRowHeader,
                "aria-expanded": expanded,
                onClick: () => toggleExpand(log.id)
              }, [
                e("div", { key: "info", className: styles.auditRowInfo },
                  e("span", { className: actionBadgeClass(log.action) }, actionLabel(log.action)),
                  e("span", { className: styles.auditActor }, log.actor || 'system'),
                  e("span", { className: styles.auditDate }, formatAuditDate(log.created_at, localeTag))
                ),
                log.diff_summary
                  ? e("span", { className: styles.auditSummary }, log.diff_summary)
                  : null,
                e("span", { key: "caret", className: styles.auditCaret, "aria-hidden": true }, expanded ? '▲' : '▼')
              ]),

              // Expanded JSON diff
              expanded
                ? e("div", { key: "diff", className: styles.auditDiff },
                    e("div", { className: styles.auditDiffGrid }, [
                      // Before
                      e("div", { key: "before" },
                        e("h4", { className: styles.auditFieldLabel }, t("aiCommandCenter.before")),
                        e("pre", { className: styles.auditPre },
                          JSON.stringify(log.before_json, null, 2))
                      ),
                      // After
                      e("div", { key: "after" },
                        e("h4", { className: styles.auditFieldLabel }, t("aiCommandCenter.after")),
                        e("pre", { className: styles.auditPre },
                          JSON.stringify(log.after_json, null, 2))
                      )
                    ]),
                    log.reason
                      ? e("div", { key: "reason", className: styles.auditReason },
                          `${t("aiCommandCenter.reasonPrefix")} ${log.reason}`
                        )
                      : null
                  )
                : null
            ]);
          })
        )
      : null,

    // Pagination
    total > AUDIT_PAGE_SIZE
      ? e("div", { key: "pagination", className: styles.auditPager }, [
          e("span", null, t("aiCommandCenter.auditShowing")
            .replace("{total}", String(total))
            .replace("{page}", String(page))
            .replace("{totalPages}", String(totalPages))),
          e("div", { className: styles.auditActions },
            e("button", {
              type: "button",
              // WAVE 10 / NAV-1: setter cua `useUrlState` nhan **gia tri**, khong
              // phai updater lambda ⇒ doc `page` tu state thay vi `p`.
              onClick: () => setPage(Math.max(1, page - 1)),
              disabled: page <= 1,
              className: `${styles.btn} ${styles.btnGhost} ${styles.btnSm}`
            }, t("aiCommandCenter.previous")),
            e("button", {
              type: "button",
              onClick: () => setPage(Math.min(totalPages, page + 1)),
              disabled: page >= totalPages,
              className: `${styles.btn} ${styles.btnGhost} ${styles.btnSm}`
            }, t("aiCommandCenter.next"))
          )
        ])
      : null
  ]);
  }
);
