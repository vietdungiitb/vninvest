/**
 * R4.5 — trang "Nhật ký kiểm toán" của AI hub (tab thứ 6, **chỉ staff**).
 *
 * Trang này **chỉ đọc** và **không sửa được gì** — đúng tinh thần AC1 của R4.3
 * (audit append-only). Nó cung cấp hai thứ:
 * 1. Danh sách log (dùng `getAIAuditLogs`, adapter đã có từ R0.7).
 * 2. Nút **export CSV** — endpoint R4.3 (`audit-logs/export/`), có BOM UTF-8.
 *
 * Vì sao export tải file chứ không `fetch` + tải thủ công: response là CSV kèm BOM,
 * cần `Content-Disposition`; dùng thẻ `<a download>` giữ nguyên đường ủy quyền
 * cookie của trình duyệt và **không** phải tự dựng lại header/cờ `truncated` mà FE
 * không đọc được (cờ nằm ở header HTTP, đọc bằng `fetch` sẽ phải expose header qua
 * CORS — thêm một rào cản chỉ để hiện một con số).
 *
 * Route được bọc `StaffRoute` trong `main.tsx`: đó là lớp guard **thật** cho AC3.
 * Ở đây chỉ kiểm lại để tránh hiển thị trang rỗng nếu ai đó render trực tiếp.
 */
import { useCallback, useEffect, useMemo, useState } from "react";
import { coreApiAdapter } from "../adapters/coreApiAdapter.js";
import { useI18n } from "../context/LangContext.js";
import { usePortfolio } from "../context/PortfolioContext.js";
import { useRetryableAsync } from "../hooks/useRetryableAsync.js";
import { AiHubNav } from "../components/AiHubNav.tsx";
import { Breadcrumb } from "../components/Breadcrumb.js";
import styles from "../components/aiSettings.module.css";

interface AuditRow {
  id: number;
  created_at: string;
  action: string;
  actor: string;
  reason: string;
  diff_summary: string;
}

const EXPORT_URL = "/api/core/v1/workspace/ai-command-center/audit-logs/export/";
const PAGE_SIZE = 20;

export function AIAuditPage() {
  const { t, formatDate } = useI18n();
  const { userIdentity } = usePortfolio() as { userIdentity?: { isStaff?: boolean; isSuperuser?: boolean } };
  const isStaff = Boolean(userIdentity?.isStaff || userIdentity?.isSuperuser);

  const [rows, setRows] = useState<AuditRow[]>([]);
  const [total, setTotal] = useState(0);
  const [legacyCount, setLegacyCount] = useState(0);
  const [page, setPage] = useState(0);
  const [action, setAction] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { execute, retry } = useRetryableAsync(
    useCallback(async () => {
      setLoading(true);
      setError(null);
      try {
        const payload: any = await coreApiAdapter.getAIAuditLogs({
          action,
          limit: PAGE_SIZE,
          offset: page * PAGE_SIZE,
        });
        setRows(Array.isArray(payload?.results) ? payload.results : []);
        setTotal(Number(payload?.total ?? 0));
        setLegacyCount(Number(payload?.legacy_unattributed_count ?? 0));
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setLoading(false);
      }
    }, [action, page]),
  );

  useEffect(() => {
    if (!isStaff) return;
    execute();
  }, [isStaff, execute]);

  const exportHref = useMemo(() => {
    const query = new URLSearchParams();
    if (action) query.set("action", action);
    const qs = query.toString();
    return qs ? `${EXPORT_URL}?${qs}` : EXPORT_URL;
  }, [action]);

  if (!isStaff) {
    // Route đã bọc `StaffRoute` (guard thật, AC3). Khối này chỉ để không render trang
    // rỗng khi ai đó dùng trang này ở chỗ khác — **không** phải lớp bảo vệ.
    return (
      <>
        <Breadcrumb />
        <p className={styles.alertError} role="alert" data-testid="audit-forbidden">
          {t("aiCommandCenter.auditStaffOnly")}
        </p>
      </>
    );
  }

  return (
    <div className={styles.page} data-testid="ai-audit-page">
      <Breadcrumb />
      <h1>{t("aiCommandCenter.titleAudit")}</h1>
      <p>{t("aiCommandCenter.descriptionAudit")}</p>
      <AiHubNav />

      <div className={styles.filterBar} role="group" aria-label={t("aiCommandCenter.auditFilter")}>
        <input
          data-testid="audit-action-filter"
          value={action}
          placeholder={t("aiCommandCenter.auditActionPlaceholder")}
          onChange={(e) => { setPage(0); setAction(e.target.value.trim()); }}
        />
        {/* R4.3: export CSV có BOM UTF-8 + cờ `truncated` trong header. */}
        <a data-testid="audit-export" href={exportHref} download>
          {t("aiCommandCenter.auditExport")}
        </a>
      </div>

      <p data-testid="audit-total">{t("aiCommandCenter.auditTotal", { total })}</p>
      {legacyCount > 0 ? (
        <p data-testid="audit-legacy-note">
          {t("aiCommandCenter.auditLegacy", { count: legacyCount })}
        </p>
      ) : null}

      {loading ? <p className={styles.loading} aria-busy="true">{t("aiCommandCenter.auditLoading")}</p> : null}
      {error ? (
        <p className={styles.alertError} role="alert" data-testid="audit-error">
          {error}
          <button type="button" onClick={() => retry()}>{t("common.retry")}</button>
        </p>
      ) : null}

      <table className={styles.auditTable} data-testid="audit-table">
        <thead>
          <tr>
            <th>{t("aiCommandCenter.auditColWhen")}</th>
            <th>{t("aiCommandCenter.auditColAction")}</th>
            <th>{t("aiCommandCenter.auditColActor")}</th>
            <th>{t("aiCommandCenter.auditColReason")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id} data-testid={`audit-row-${row.id}`}>
              <td>{row.created_at ? formatDate(new Date(row.created_at)) : "—"}</td>
              <td>{row.action}</td>
              <td>{row.actor || "—"}</td>
              <td>{row.reason || row.diff_summary || "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>

      {rows.length === 0 && !loading ? (
        <p data-testid="audit-empty">{t("aiCommandCenter.auditEmpty")}</p>
      ) : null}

      {total > PAGE_SIZE ? (
        <nav className={styles.auditPager} aria-label={t("aiCommandCenter.auditPager")}>
          <button type="button" disabled={page === 0} onClick={() => setPage((p) => Math.max(0, p - 1))}>
            {t("common.previous")}
          </button>
          <span>{page + 1}</span>
          <button
            type="button"
            disabled={(page + 1) * PAGE_SIZE >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            {t("common.next")}
          </button>
        </nav>
      ) : null}
    </div>
  );
}