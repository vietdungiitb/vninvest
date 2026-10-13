/**
 * Form tạo / sửa danh mục — dùng chung cho create và edit.
 *
 * Khác biệt với form cũ (`PortfoliosPage.tsx:124-134`):
 * - cũ hardcode `"0"` khi chưa nhập số dư ⇒ **bịa số dư mở đầu**. `buildPortfolioPayload`
 *   gửi `null` để model giữ trạng thái "chưa xác định" (`models.py` help_text của
 *   `opening_balance`).
 * - cũ không có `description` dù serializer có (`serializers.py:96-102`).
 * - cũ nuốt lỗi validator vào toast thô; bản này bóc `fieldErrors` ra đúng ô.
 *
 * `useEffect` bám `open`/`portfolio` để reset form mỗi lần mở — không reset bằng
 * cách set state trong render (sẽ phá vỡ controlled input).
 */

import { useEffect, useId, useRef, useState } from "react";

import { useI18n } from "../../../context/LangContext.js";
import { normalizeDecimalInput, type PortfolioRow } from "./format";
import type { ManagedError } from "./usePortfolioManage";
import "./portfolioManage.css";

export interface PortfolioFormDialogProps {
  open: boolean;
  /** `null` = tạo mới. Có id = sửa. */
  portfolio: PortfolioRow | null;
  busy: boolean;
  /** `null` khi không có `portfolio`. */
  error: ManagedError | null;
  onSubmit(input: { name: string; description?: string; openingBalance?: string }): void;
  onClose(): void;
}

export function PortfolioFormDialog({
  open, portfolio, busy, error, onSubmit, onClose,
}: PortfolioFormDialogProps) {
  const { t } = useI18n();
  const nameId = useId();
  const descId = useId();
  const balanceId = useId();
  const titleId = useId();
  const errorId = useId();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [balance, setBalance] = useState("");
  const nameRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setName(portfolio?.name ?? "");
    setDescription(portfolio?.description ?? "");
    setBalance(
      portfolio?.opening_balance === null || portfolio?.opening_balance === undefined
        ? ""
        : String(portfolio.opening_balance),
    );
    // Mở dialog luôn đưa con trỏ về ô tên — bàn phím không phải đi tìm.
    nameRef.current?.focus();
  }, [open, portfolio]);

  useEffect(() => {
    if (!open) return;
    const onKey = (ev: KeyboardEvent) => {
      if (ev.key === "Escape" && !busy) onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, busy, onClose]);

  if (!open) return null;

  const fieldError = (key: string): string | null =>
    error?.fieldErrors?.[key] ??
    (error?.code === "name_required" && key === "name"
      ? t("portfoliosManage.form.nameRequired", { defaultValue: "Tên là bắt buộc." })
      : null);

  const submit = (ev: React.FormEvent) => {
    ev.preventDefault();
    if (busy) return;
    if (!name.trim()) return;
    onSubmit({ name, description, openingBalance: balance });
  };

  return (
    <div
      className="pfm-modal"
      role="presentation"
      onMouseDown={(ev) => {
        if (ev.target === ev.currentTarget && !busy) onClose();
      }}
    >
      <div
        className="pfm-modal__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-busy={busy || undefined}
      >
        <h2 id={titleId} className="pfm-modal__title">
          {portfolio
            ? t("portfoliosManage.form.editTitle", { defaultValue: "Sửa danh mục" })
            : t("portfoliosManage.form.createTitle", { defaultValue: "Tạo danh mục mới" })}
        </h2>

        <form className="pfm-form" onSubmit={submit} noValidate>
          <div className="pfm-field">
            <label htmlFor={nameId}>
              {t("portfoliosManage.form.name", { defaultValue: "Tên danh mục" })}
            </label>
            <input
              id={nameId}
              ref={nameRef}
              type="text"
              value={name}
              maxLength={100}
              required
              aria-invalid={fieldError("name") ? true : undefined}
              aria-describedby={fieldError("name") ? errorId : undefined}
              onChange={(ev) => setName(ev.target.value)}
            />
            {fieldError("name") && (
              <p id={errorId} className="pfm-field__error" role="alert">
                {fieldError("name")}
              </p>
            )}
          </div>

          <div className="pfm-field">
            <label htmlFor={descId}>
              {t("portfoliosManage.form.description", { defaultValue: "Mô tả" })}
            </label>
            <textarea
              id={descId}
              value={description}
              rows={3}
              maxLength={500}
              onChange={(ev) => setDescription(ev.target.value)}
            />
          </div>

          <div className="pfm-field">
            <label htmlFor={balanceId}>
              {t("portfoliosManage.form.openingBalance", {
                defaultValue: "Số dư mở đầu (VND)",
              })}
            </label>
            <input
              id={balanceId}
              type="text"
              inputMode="decimal"
              value={balance}
              placeholder="0"
              aria-describedby={`${balanceId}-hint`}
              onChange={(ev) => setBalance(normalizeDecimalInput(ev.target.value))}
            />
            <p id={`${balanceId}-hint`} className="pfm-field__hint">
              {t("portfoliosManage.form.openingBalanceHint", {
                defaultValue:
                  "Để trống nếu chưa xác định. Số này quyết định NAV có tính được hay không.",
              })}
            </p>
          </div>

          {error && !error.fieldErrors && (
            <p className="pfm-form__error" role="alert">
              {error.message}
            </p>
          )}

          <div className="pfm-form__actions">
            <button type="button" onClick={onClose} disabled={busy}>
              {t("portfoliosManage.form.cancel", { defaultValue: "Huỷ" })}
            </button>
            <button type="submit" className="pfm-btn-primary" disabled={busy || !name.trim()}>
              {busy
                ? t("portfoliosManage.form.saving", { defaultValue: "Đang lưu..." })
                : portfolio
                  ? t("portfoliosManage.form.save", { defaultValue: "Lưu thay đổi" })
                  : t("portfoliosManage.form.create", { defaultValue: "Tạo danh mục" })}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PortfolioFormDialog;