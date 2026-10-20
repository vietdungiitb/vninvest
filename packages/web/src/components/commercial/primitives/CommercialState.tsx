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
      className={joinClassNames(styles.cmState, className)}
      data-cm-zone="state"
      aria-busy={loading ? "true" : "false"}
    >
      <div className={styles.cmError} role="alert" data-cm-zone="state-error">
        {hasError ? (
          <>
            <p className={styles.cmErrorMessage}>{error}</p>
            <p className={styles.cmErrorHint}>{retryHint ?? defaultRetryHint}</p>
            <button type="button" className={styles.cmRetryButton} onClick={onRetry}>
              {retryLabel}
            </button>
          </>
        ) : null}
      </div>
      <div className={styles.cmLive} role="status" aria-live="polite" data-cm-zone="state-live">
        {loading ? (
          <>
            <div className={styles.cmSkeleton} aria-hidden="true">
              <span className={styles.cmSkeletonLine} />
              <span className={styles.cmSkeletonLine} />
              <span className={styles.cmSkeletonLine} />
            </div>
            <p className={styles.cmLoading}>{loadingLabel}</p>
          </>
        ) : null}
        {empty && !loading ? (
          <div className={styles.cmEmpty}>
            <span className={styles.cmEmptyValue}>{emptyValue}</span>
            <p className={styles.cmEmptyReason}>{emptyReason ?? defaultEmptyReason}</p>
            {emptyCta}
          </div>
        ) : null}
      </div>
    </div>
  );
}
