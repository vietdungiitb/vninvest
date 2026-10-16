import { createElement } from "react";
import { useI18n } from "../context/LangContext.js";
import { diffObjects, type DiffRow } from "../lib/diffUtil.js";
import styles from "./aiSettings.module.css";

const e = createElement;

export interface AiConfigConflict {
  currentUpdatedAt: string | null;
  current: Record<string, unknown>;
}

interface AiConfigPreviewModalProps {
  /** Giá trị đang hiển thị (server lần đọc cuối) và giá trị định lưu. */
  before: Record<string, unknown> | null;
  after: Record<string, unknown> | null;
  /** Đặt khi PUT trả 409 — modal chuyển sang chế độ xung đột. */
  conflict?: AiConfigConflict | null;
  saving?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onReloadOverwrite?: () => void;
}

/**
 * R1.9 AC4/AC5 — preview diff trước khi lưu + màn xung đột 409.
 * Copy pattern SocConfigPreviewModal + lib/diffUtil, style bằng token AI CC.
 */
export function AiConfigPreviewModal({
  before,
  after,
  conflict = null,
  saving = false,
  onConfirm,
  onCancel,
  onReloadOverwrite,
}: AiConfigPreviewModalProps) {
  const { t } = useI18n();
  const rows: DiffRow[] = diffObjects(before, after);
  return e(
    "div",
    { className: styles.drawerOverlay, "data-testid": "config-preview", onClick: onCancel },
    e(
      "div",
      {
        className: styles.drawerContent,
        role: "dialog",
        "aria-modal": true,
        onClick: (ev: React.MouseEvent) => ev.stopPropagation(),
      },
      [
        e("div", { key: "head", className: styles.drawerHeader }, [
          e(
            "h2",
            { key: "title", className: styles.drawerTitle },
            t(conflict ? "aiCommandCenter.conflictTitle" : "aiCommandCenter.previewTitle")
          ),
          e(
            "button",
            { key: "x", type: "button", className: styles.drawerClose, onClick: onCancel, "aria-label": t("aiCommandCenter.previewCancel") },
            "✕"
          ),
        ]),
        e("div", { key: "body", className: styles.drawerBody }, [
          conflict
            ? e("div", { key: "conflict", "data-testid": "config-conflict" }, [
                e("p", { key: "desc", className: styles.helpText }, t("aiCommandCenter.conflictDesc")),
                e("div", { key: "actions", className: styles.toolbar }, [
                  e(
                    "button",
                    {
                      key: "reload",
                      type: "button",
                      className: `${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`,
                      disabled: saving,
                      onClick: onReloadOverwrite,
                      "data-testid": "conflict-reload",
                    },
                    t("aiCommandCenter.conflictReload")
                  ),
                  e(
                    "button",
                    {
                      key: "cancel",
                      type: "button",
                      className: `${styles.btn} ${styles.btnGhost} ${styles.btnSm}`,
                      disabled: saving,
                      onClick: onCancel,
                      "data-testid": "conflict-cancel",
                    },
                    t("aiCommandCenter.conflictCancel")
                  ),
                ]),
              ])
            : e("div", { key: "preview" }, [
                e("table", { key: "diff", className: styles.table },
                  e("tbody", null,
                    rows.length === 0
                      ? e("tr", { key: "empty" },
                          e("td", { className: styles.td }, t("aiCommandCenter.noChanges")))
                      : rows.map((row) =>
                          e("tr", { key: row.key, className: styles.tr }, [
                            e("td", { key: "k", className: styles.td }, row.key),
                            e("td", { key: "b", className: styles.td }, row.before),
                            e("td", { key: "a", className: styles.td }, row.after),
                          ])
                        )
                  )
                ),
              ]),
        ]),
        conflict
          ? null
          : e("div", { key: "foot", className: styles.drawerFooter }, [
              e(
                "button",
                {
                  key: "confirm",
                  type: "button",
                  className: `${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`,
                  disabled: saving,
                  onClick: onConfirm,
                  "data-testid": "preview-confirm",
                },
                t("aiCommandCenter.previewConfirm")
              ),
              e(
                "button",
                {
                  key: "cancel",
                  type: "button",
                  className: `${styles.btn} ${styles.btnGhost} ${styles.btnSm}`,
                  disabled: saving,
                  onClick: onCancel,
                  "data-testid": "preview-cancel",
                },
                t("aiCommandCenter.previewCancel")
              ),
            ]),
      ]
    )
  );
}
