import type { ReactNode } from "react";
import styles from "../CommercialPage.module.css";
import { joinClassNames } from "../commercialUtils.js";
import { useCommercialTranslator } from "../commercialMessages.js";

export interface CommercialStateProps {
  loading?: boolean;
  empty?: boolean;
  emptyReason?: ReactNode;
  emptyCta?: ReactNode;
  error?: string;
  onRetry?: () => void;
  retryHint?: ReactNode;
  className?: string;
}

export function CommercialState({
  loading = false,
  empty = false,
  emptyReason,
  emptyCta,
  error,
  onRetry,
  retryHint,
  className,
}: CommercialStateProps) {
  const { t, messages } = useCommercialTranslator();
  const retryLabel = t("commercialPage.retry", messages.retry);
  const loadingLabel = t("commercialPage.loading", messages.loading);
  const emptyValue = t("commercialPage.emptyValue", messages.emptyValue);
  const defaultEmptyReason = t("commercialPage.emptyReason", messages.emptyReason);
  const defaultRetryHint = t("commercialPage.retryHint", messages.retryHint);
  const hasError = typeof error === "string" && error.trim().length > 0;

  return (
    <div
      className={joinClassNames(styles["cm-state"], className)}
      data-cm-zone="state"
      aria-busy={loading ? "true" : "false"}
    >
      <div className={styles["cm-error"]} role="alert" data-cm-zone="state-error">
        {hasError ? (
          <>
            <p className={styles["cm-error-message"]}>{error}</p>
            <p className={styles["cm-error-hint"]}>{retryHint ?? defaultRetryHint}</p>
            <button type="button" className={styles["cm-retry-button"]} onClick={onRetry}>
              {retryLabel}
            </button>
          </>
        ) : null}
      </div>
      <div className={styles["cm-live"]} role="status" aria-live="polite" data-cm-zone="state-live">
        {loading ? (
          <>
            <div className={styles["cm-skeleton"]} aria-hidden="true">
              <span className={styles["cm-skeleton-line"]} />
              <span className={styles["cm-skeleton-line"]} />
              <span className={styles["cm-skeleton-line"]} />
            </div>
            <p className={styles["cm-loading"]}>{loadingLabel}</p>
          </>
        ) : null}
        {empty && !loading ? (
          <div className={styles["cm-empty"]}>
            <span className={styles["cm-empty-value"]}>{emptyValue}</span>
            <p className={styles["cm-empty-reason"]}>{emptyReason ?? defaultEmptyReason}</p>
            {emptyCta}
          </div>
        ) : null}
      </div>
    </div>
  );
}
