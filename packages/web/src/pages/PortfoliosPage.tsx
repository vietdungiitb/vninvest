/**
 * `/portfolios/manage` — trang quản lý danh mục đầu tư.
 *
 * XÂY LẠI từ đầu (Owner chốt 2026-10-13: Full rebuild CRUD + KPI + Holdings).
 * Bản cũ dính 11 lỗi đã ghi ở `docs/CLAIMS.md` claim `pf-manage-rebuild`; các lỗi
 * có ảnh hưởng người dùng nêu ngay dưới đây.
 *
 * Điều KHÔNG đổi: `pageRegistry.js:221-222` import `PortfoliosPage` từ đúng file
 * này, và `main.tsx:147` gắn nó choo `/portfolios/manage`. Đổi tên export sẽ làm
 * route trắng — không đổi.
 *
 * Phân tách trách nhiệm:
 * - `usePortfolioManage` — gọi API, giữ cursor phân trang, bọc lỗi.
 * - `PortfolioManageKpi`   — tổng tiền trên cả trang.
 * - `PortfolioManageTable` — bảng + sắp xếp + 3 nút hành động mỗi dòng.
 * - `PortfolioManageDrawer`— vị thế + số liệu của một danh mục.
 * - `PortfolioFormDialog`  — tạo/sửa.
 *
 * Panel broker (nhập API key, sync, **đặt lệnh**) không còn nằm ở đây: nó đã
 * chuyển sang `/portfolios/manage/broker`. Trộn đặt lệnh vào trang quản lý danh
 * mục vừa sai ngữ nghĩa vừa là một rủi ro: một cú bấm nhầm ở trang danh sách là
 * một lệnh ra thị trường. Trang này chỉ đọc/thêm/sửa/xoá danh mục.
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";

import { useConfirm } from "../components/ConfirmModal.js";
import { useToast } from "../components/ShellToast.js";
import { ShellPageChrome } from "../components/ShellPageTemplate.js";
import { useI18n } from "../context/LangContext.js";
import "../components/soc/soc.tokens.css";
import { PortfolioFormDialog } from "./portfolio/manage/PortfolioFormDialog";
import { PortfolioManageDrawer } from "./portfolio/manage/PortfolioManageDrawer";
import { PortfolioManageKpi } from "./portfolio/manage/PortfolioManageKpi";
import {
  PortfolioManageTable,
  type SortDir,
  type SortKey,
} from "./portfolio/manage/PortfolioManageTable";
import type { PortfolioRow } from "./portfolio/manage/format";
import {
  usePortfolioManage,
  type ManagedError,
  type PortfolioManageAdapter,
} from "./portfolio/manage/usePortfolioManage";

export interface PortfoliosPageProps {
  className?: string;
  /** Tiêm adapter giả trong test. Mặc định là adapter thật của app. */
  adapter?: PortfolioManageAdapter;
}

type DialogState = { mode: "create" } | { mode: "edit"; row: PortfolioRow } | null;

/** Mặc định sort theo giá trị thị trường giảm dần — màn hình của nhà đầu tư. */
const DEFAULT_SORT: { key: SortKey; dir: SortDir } = { key: "marketValue", dir: "desc" };

export function PortfoliosPage({ className = "", adapter }: PortfoliosPageProps) {
  const { t } = useI18n();
  const toast = useToast();
  const confirm = useConfirm();
  const {
    portfolios, summaries, totals, loading, loadingMoney, error,
    savingId, deletingId, canPrev, hasNext, reload, createPortfolio, updatePortfolio,
    deletePortfolio, goNext, goPrev,
  } = usePortfolioManage(adapter);

  const [dialog, setDialog] = useState<DialogState>(null);
  const [dialogError, setDialogError] = useState<ManagedError | null>(null);
  const [detailId, setDetailId] = useState<string | number | null>(null);
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>(DEFAULT_SORT);
  // Mở drawer từ bảng ⇒ nút đã bấm nằm trong `scrollable` nên focus sẽ quay
  // về đúng chỗ sau khi đóng, không bị mất vào body.
  const openerRef = useRef<HTMLElement | null>(null);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return portfolios;
    return portfolios.filter((row) => {
      const name = String(row.name ?? "").toLowerCase();
      const desc = String(row.description ?? "").toLowerCase();
      return name.includes(q) || desc.includes(q);
    });
  }, [portfolios, query]);

  const detailRow = useMemo(
    () => portfolios.find((row) => String(row.id) === String(detailId)) ?? null,
    [portfolios, detailId],
  );
  const detailSummary = detailId === null ? undefined : summaries[String(detailId)];

  const onSort = useCallback((key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: key === "name" || key === "createdAt" ? "asc" : "desc" },
    );
  }, []);

  const openCreate = useCallback(() => {
    setDialogError(null);
    setDialog({ mode: "create" });
  }, []);

  const openEdit = useCallback((row: PortfolioRow) => {
    setDialogError(null);
    setDialog({ mode: "edit", row });
  }, []);

  const closeDialog = useCallback(() => {
    setDialog(null);
    setDialogError(null);
  }, []);

  const onSubmit = useCallback(
    async (input: { name: string; description?: string; openingBalance?: string }) => {
      const result =
        dialog?.mode === "edit"
          ? await updatePortfolio(dialog.row.id, input)
          : await createPortfolio(input);
      if (result.ok) {
        closeDialog();
        toast.success(
          dialog?.mode === "edit"
            ? t("portfoliosManage.toast.updated", { defaultValue: "Đã lưu danh mục." })
            : t("portfoliosManage.toast.created", { defaultValue: "Đã tạo danh mục." }),
        );
        return;
      }
      setDialogError(result.error);
    },
    [dialog, createPortfolio, updatePortfolio, closeDialog, toast, t],
  );

  const onDelete = useCallback(
    async (row: PortfolioRow) => {
      const ok = await confirm({
        title: t("portfoliosManage.delete.title", { defaultValue: "Xoá danh mục" }),
        message: t("portfoliosManage.delete.message", {
          defaultValue: 'Xoá "{name}"? Thao tác này không hoàn tác được.',
          name: row.name,
        }),
        variant: "destructive",
      });
      if (!ok) return;
      const result = await deletePortfolio(row.id);
      if (result.ok) {
        toast.success(t("portfoliosManage.toast.deleted", { defaultValue: "Đã xoá danh mục." }));
        if (String(detailId) === String(row.id)) setDetailId(null);
        return;
      }
      // 409 `portfolio_has_financial_history` là hành vi ĐÚNG, không phải sự cố
      // (views.py:206-242: sổ cái append-only, D-17 giữ ≥ 7 năm) — nói rõ với
      // user thay vì đẩy chuỗi kỹ thuật của CoreApiRequestError.
      // LƯU Ý: message của BE khuyên "hãy ẩn danh mục" nhưng model `Portfolio`
      // KHÔNG có field archive ⇒ không hứa tính năng không tồn tại.
      if (result.error.code === "portfolio_has_financial_history") {
        toast.error(
          t("portfoliosManage.delete.hasHistory", {
            defaultValue:
              "Danh mục đã có lịch sử giao dịch nên không thể xoá. Hãy đổi tên để đánh dấu là không dùng nữa, hoặc liên hệ quản trị viên.",
          }),
        );
        return;
      }
      toast.error(
        result.error.message ||
          t("portfoliosManage.delete.failed", { defaultValue: "Không xoá được danh mục." }),
      );
    },
    [confirm, deletePortfolio, detailId, toast, t],
  );

  const openDetail = useCallback((row: PortfolioRow) => {
    openerRef.current = document.activeElement as HTMLElement | null;
    setDetailId(row.id);
  }, []);

  const closeDetail = useCallback(() => {
    setDetailId(null);
    openerRef.current?.focus?.();
  }, []);

  return (
    <ShellPageChrome
      eyebrow={t("portfoliosManage.eyebrow", { defaultValue: "Portfolio" })}
      title={t("portfoliosManage.title", { defaultValue: "Quản lý danh mục" })}
      className={`${className} pfm-page`.trim()}
    >
      <div className="pfm-toolbar">
        <button type="button" className="pfm-btn-primary" onClick={openCreate}>
          {t("portfoliosManage.action.create", { defaultValue: "Tạo danh mục" })}
        </button>
        <input
          type="search"
          className="pfm-toolbar__search"
          value={query}
          placeholder={t("portfoliosManage.search.placeholder", { defaultValue: "Lọc theo tên hoặc mô tả" })}
          aria-label={t("portfoliosManage.search.label", { defaultValue: "Lọc danh mục" })}
          onChange={(ev) => setQuery(ev.target.value)}
        />
        <span className="pfm-toolbar__count" role="status">
          {t("portfoliosManage.count", {
            defaultValue: "{shown}/{total} danh mục",
            shown: visible.length,
            total: portfolios.length,
          })}
        </span>
        <span className="pfm-toolbar__spacer" />
        <Link to="/portfolios/manage/broker" className="pfm-btn">
          {t("portfoliosManage.brokerLink", { defaultValue: "Kết nối broker" })}
        </Link>
        <button type="button" className="pfm-btn" onClick={reload} disabled={loading}>
          {t("portfoliosManage.action.reload", { defaultValue: "Tải lại" })}
        </button>
      </div>

      <PortfolioManageKpi totals={totals} summaries={summaries} loading={loading || loadingMoney} />

      {error && (
        <div className="pfm-state pfm-state--error" role="alert">
          <p>{t("portfoliosManage.state.loadFailed", { defaultValue: "Không tải được danh mục." })}</p>
          <p className="pfm-state__actions">
            <button type="button" className="pfm-btn" onClick={reload}>
              {t("portfoliosManage.action.retry", { defaultValue: "Thử lại" })}
            </button>
          </p>
        </div>
      )}

      {!error && loading && portfolios.length === 0 && (
        <p className="pfm-state" role="status">
          {t("portfoliosManage.state.loading", { defaultValue: "Đang tải danh mục..." })}
        </p>
      )}

      {!error && !loading && portfolios.length === 0 && (
        <div className="pfm-state">
          <p>{t("portfoliosManage.state.emptyTitle", { defaultValue: "Chưa có danh mục nào." })}</p>
          <p>
            {t("portfoliosManage.state.emptyHint", {
              defaultValue:
                "Tạo danh mục đầu tiên để bắt đầu theo dõi tiền, vị thế và lãi lỗ.",
            })}
          </p>
          <p className="pfm-state__actions">
            <button type="button" className="pfm-btn-primary" onClick={openCreate}>
              {t("portfoliosManage.action.create", { defaultValue: "Tạo danh mục" })}
            </button>
          </p>
        </div>
      )}

      {portfolios.length > 0 && visible.length === 0 && (
        <p className="pfm-state" role="status">
          {t("portfoliosManage.state.noMatch", {
            defaultValue: 'Không có danh mục nào khớp với "{query}".',
            query: query.trim(),
          })}
        </p>
      )}

      {visible.length > 0 && (
        <PortfolioManageTable
          portfolios={visible}
          summaries={summaries}
          loading={loading}
          loadingMoney={loadingMoney}
          sort={sort}
          onSort={onSort}
          onEdit={openEdit}
          onDelete={onDelete}
          onOpenDetail={openDetail}
          savingId={savingId}
          deletingId={deletingId}
        />
      )}

      <div className="pfm-pager">
        <button type="button" className="pfm-btn" onClick={goPrev} disabled={!canPrev || loading}>
          {t("portfoliosManage.pager.prev", { defaultValue: "Trang trước" })}
        </button>
        <span className="pfm-pager__label" role="status">
          {t("portfoliosManage.pager.position", {
            defaultValue: canPrev
              ? "Đang xem trang sau — bấm “Trang trước” để quay lại."
              : "Trang đầu tiên",
          })}
        </span>
        <button type="button" className="pfm-btn" onClick={goNext} disabled={loading || !hasNext}>
          {t("portfoliosManage.pager.next", { defaultValue: "Trang sau" })}
        </button>
      </div>

      <PortfolioFormDialog
        open={dialog !== null}
        portfolio={dialog?.mode === "edit" ? dialog.row : null}
        busy={savingId !== null}
        error={dialogError}
        onSubmit={onSubmit}
        onClose={closeDialog}
      />

      <PortfolioManageDrawer
        portfolio={detailRow}
        summary={detailSummary}
        getHoldings={adapter?.getPortfolioHoldings}
        onClose={closeDetail}
      />
    </ShellPageChrome>
  );
}

export default PortfoliosPage;