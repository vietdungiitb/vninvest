import { useState, useEffect, createElement, useCallback, useRef } from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";
import { useUrlState, intCodec, stringCodec, type UrlStateCodec, type UrlStateOptions } from "../hooks/useUrlState";

const e = createElement;

const AUDIT_PAGE_SIZE = 10;

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

interface AuditLogEntry {
  id: number;
  action: string;
  actor: string;
  reason: string;
  before_json: Record<string, unknown>;
  after_json: Record<string, unknown>;
  diff_summary: string;
  created_at: string;
}

interface AIAuditLogsPanelProps {
  refreshKey?: number;
}

export function AIAuditLogsPanel({ refreshKey = 0 }: AIAuditLogsPanelProps) {
  const { t, localeTag } = useI18n();
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
      const params: Record<string, string | number> = {
        limit: AUDIT_PAGE_SIZE,
        offset: (page - 1) * AUDIT_PAGE_SIZE,
      };
      if (action) params.action = action;
      if (actor) params.actor = actor;
      if (dateFrom) params.date_from = dateFrom;
      if (dateTo) params.date_to = dateTo;
      if (refreshKey) params._r = refreshKey;

      const data = await (coreApiAdapter as any).getAIAuditLogs(params);
      setLogs(data.results || []);
      setTotal(data.total || 0);
    } catch (err: unknown) {
      setError((err && typeof err === 'object' && 'message' in err ? (err as Error).message : '') || t('aiCommandCenter.loadError'));
    } finally {
      setLoading(false);
    }
  }, [page, action, actor, dateFrom, dateTo, refreshKey, t]);

  useEffect(() => {
    loadLogs();
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

  const applyFilters = () => { setPage(1); loadLogs(); };

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
    if (action === 'update_settings') return 'border-cyan-700/60 bg-cyan-950/30 text-cyan-300';
    if (action === 'test_connection_success') return 'border-emerald-700/60 bg-emerald-950/30 text-emerald-300';
    if (action === 'test_connection_failed') return 'border-rose-700/60 bg-rose-950/30 text-rose-300';
    return 'border-slate-700 bg-slate-800/40 text-slate-400';
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

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString(localeTag);
  };

  return e("div", { className: "space-y-4" }, [
    // Filters
    e("div", { key: "filters", className: "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 rounded-lg border border-slate-800 bg-slate-900/40 p-4" }, [
      // Action filter
      e("div", { key: "filter-action" },
        e("label", { className: "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500" }, t("aiCommandCenter.action")),
        e("select", {
          value: action,
          onChange: (ev: any) => setFilterAction(ev.target.value),
          className: "w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500"
        }, actionOptions.map(opt =>
          e("option", { key: opt.value, value: opt.value }, opt.label)
        ))
      ),
      // Actor filter
      e("div", { key: "filter-actor" },
        e("label", { className: "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500" }, t("aiCommandCenter.actor")),
        e("input", {
          type: "text",
          value: actor,
          onChange: (ev: any) => setFilterActor(ev.target.value),
          className: "w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500",
          placeholder: t("aiCommandCenter.actorPlaceholder")
        })
      ),
      // Date from
      e("div", { key: "filter-date-from" },
        e("label", { className: "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500" }, t("aiCommandCenter.fromDate")),
        e("input", {
          type: "date",
          value: dateFrom,
          onChange: (ev: any) => setFilterDateFrom(ev.target.value),
          className: "w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500"
        })
      ),
      // Date to
      e("div", { key: "filter-date-to" },
        e("label", { className: "mb-1 block text-[10px] font-semibold uppercase tracking-wide text-slate-500" }, t("aiCommandCenter.toDate")),
        e("input", {
          type: "date",
          value: dateTo,
          onChange: (ev: any) => setFilterDateTo(ev.target.value),
          className: "w-full rounded-md border border-slate-700 bg-slate-950 px-2 py-1.5 text-xs text-slate-200 outline-none focus:border-cyan-500"
        })
      ),
      // Action buttons
      e("div", { key: "filter-actions", className: "flex items-end gap-2" },
        e("button", {
          type: "button",
          onClick: applyFilters,
          disabled: loading,
          className: "rounded-md border border-cyan-700 bg-cyan-900/30 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-800/40 disabled:opacity-50"
        }, t("aiCommandCenter.applyFilter")),
        e("button", {
          type: "button",
          onClick: resetFilters,
          className: "rounded-md border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-slate-200"
        }, t("aiCommandCenter.resetFilter"))
      )
    ]),

    // Loading
    loading
      ? e("div", { key: "loading", className: "text-center py-6 text-sm text-slate-500" }, t("aiCommandCenter.loading"))
      : null,

    // Error
    error
      ? e("div", { key: "error", className: "rounded-lg border border-rose-700/60 bg-rose-900/20 px-3 py-2 text-sm text-rose-200" }, error)
      : null,

    // Log list
    !loading && !error && logs.length === 0
      ? e("div", { key: "empty", className: "text-center py-6 text-sm text-slate-500" }, t("aiCommandCenter.noLogs"))
      : null,

    !loading
      ? e("div", { key: "log-list", className: "space-y-2" },
          logs.map(log =>
            e("div", {
              key: log.id,
              className: "rounded-lg border border-slate-800 bg-slate-900/30 overflow-hidden"
            }, [
              // Log header row
              e("div", {
                key: "header",
                className: "flex items-center justify-between gap-2 px-3 py-2 cursor-pointer hover:bg-slate-800/30",
                onClick: () => toggleExpand(log.id)
              }, [
                e("div", { key: "info", className: "flex items-center gap-2 flex-1 min-w-0" },
                  e("span", {
                    className: `rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${actionBadgeClass(log.action)}`
                  }, actionLabel(log.action)),
                  e("span", { className: "text-xs text-slate-300 truncate" }, log.actor || 'system'),
                  e("span", { className: "text-[10px] text-slate-500 whitespace-nowrap" }, formatDate(log.created_at))
                ),
                log.diff_summary
                  ? e("span", { className: "text-[10px] text-slate-500 truncate max-w-[200px] hidden sm:block" }, log.diff_summary)
                  : null,
                e("span", { className: "text-xs text-slate-600" }, expandedIds.has(log.id) ? '▲' : '▼')
              ]),

              // Expanded JSON diff
              expandedIds.has(log.id)
                ? e("div", { key: "diff", className: "border-t border-slate-800" },
                    e("div", { className: "grid grid-cols-1 gap-2 p-3 sm:grid-cols-2" }, [
                      // Before
                      e("div", { key: "before" },
                        e("h4", { className: "mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500" }, t("aiCommandCenter.before")),
                        e("pre", {
                          className: "max-h-48 overflow-auto rounded bg-slate-950 p-2 text-[10px] leading-relaxed text-slate-300"
                        }, JSON.stringify(log.before_json, null, 2))
                      ),
                      // After
                      e("div", { key: "after" },
                        e("h4", { className: "mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500" }, t("aiCommandCenter.after")),
                        e("pre", {
                          className: "max-h-48 overflow-auto rounded bg-slate-950 p-2 text-[10px] leading-relaxed text-slate-300"
                        }, JSON.stringify(log.after_json, null, 2))
                      )
                    ]),
                    log.reason
                      ? e("div", { key: "reason", className: "border-t border-slate-800 px-3 py-2 text-xs text-slate-500" },
                          `${t("aiCommandCenter.reasonPrefix")} ${log.reason}`
                        )
                      : null
                  )
                : null
            ])
          )
        )
      : null,

    // Pagination
    total > AUDIT_PAGE_SIZE
      ? e("div", { key: "pagination", className: "flex items-center justify-between px-1 py-2 text-xs text-slate-400" }, [
          e("span", null, t("aiCommandCenter.auditShowing")
            .replace("{total}", String(total))
            .replace("{page}", String(page))
            .replace("{totalPages}", String(totalPages))),
          e("div", { className: "flex gap-2" },
            e("button", {
              type: "button",
              // WAVE 10 / NAV-1: setter cua `useUrlState` nhan **gia tri**, khong
              // phai updater lambda ⇒ doc `page` tu state thay vi `p`.
              onClick: () => setPage(Math.max(1, page - 1)),
              disabled: page <= 1,
              className: "rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800/50 disabled:opacity-30 disabled:cursor-not-allowed"
            }, t("aiCommandCenter.previous")),
            e("button", {
              type: "button",
              onClick: () => setPage(Math.min(totalPages, page + 1)),
              disabled: page >= totalPages,
              className: "rounded border border-slate-700 px-2 py-1 text-xs hover:bg-slate-800/50 disabled:opacity-30 disabled:cursor-not-allowed"
            }, t("aiCommandCenter.next"))
          )
        ])
      : null
  ]);
}
