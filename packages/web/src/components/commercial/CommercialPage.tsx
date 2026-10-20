import { useId } from "react";
import type { ReactNode } from "react";
import styles from "./CommercialPage.module.css";
import { joinClassNames } from "./commercialUtils.js";
import { CommercialState, type CommercialStateProps } from "./primitives/CommercialState.js";

export type CommercialPageState = Omit<CommercialStateProps, "error"> & { error?: string };

export interface CommercialPageProps {
  eyebrow?: ReactNode;
  title: string;
  description?: ReactNode;
  badge?: ReactNode;
  metrics?: ReactNode;
  notice?: ReactNode;
  error?: string;
  toolbar?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
  meta?: ReactNode;
  className?: string;
  id?: string;
  state?: CommercialPageState;
}

export interface CommercialMetricProps {
  label: string;
  value: ReactNode;
  className?: string;
}

export function CommercialMetric({ label, value, className }: CommercialMetricProps) {
  return (
    <div className={joinClassNames(styles.cmMetric, className)} data-cm-zone="metric">
      <span className={styles.cmMetricLabel}>{label}</span>
      <strong className={styles.cmMetricValue}>{value}</strong>
    </div>
  );
}

export function CommercialPage({
  eyebrow,
  title,
  description,
  badge,
  metrics,
  notice,
  error,
  toolbar,
  actions,
  children,
  meta,
  className,
  id,
  state,
}: CommercialPageProps) {
  const autoId = useId();
  const resolvedId = id || `cm-${autoId.replace(/:/g, "")}`;
  const titleId = `${resolvedId}-title`;
  const stateProps: CommercialStateProps = {
    ...state,
    error: error ?? state?.error,
  };

  return (
    <div
      id={resolvedId}
      className={joinClassNames(styles.cmPage, className)}
      role="region"
      aria-labelledby={titleId}
      data-cm-zone="page"
    >
      <header className={styles.cmHeader} data-cm-zone="header">
        {eyebrow ? <span className={styles.cmEyebrow}>{eyebrow}</span> : null}
        <div className={styles.cmTitleRow}>
          <div className={styles.cmTitleBlock}>
            <h1 id={titleId} className={styles.cmTitle}>
              {title}
            </h1>
            {description ? <p className={styles.cmDescription}>{description}</p> : null}
          </div>
          {badge ? <div className={styles.cmBadge}>{badge}</div> : null}
        </div>
        {metrics ? (
          <div className={styles.cmMetrics} data-cm-zone="metrics">
            {metrics}
          </div>
        ) : null}
      </header>
      {notice ? (
        <div className={styles.cmNotice} role="status" data-cm-zone="notice">
          {notice}
        </div>
      ) : null}
      {toolbar ? (
        <div className={styles.cmToolbar} data-cm-zone="toolbar">
          {toolbar}
        </div>
      ) : null}
      <div className={styles.cmBody} data-cm-zone="body">
        {children}
      </div>
      <CommercialState {...stateProps} />
      {actions ? (
        <div className={styles.cmActions} data-cm-zone="actions">
          {actions}
        </div>
      ) : null}
      {meta ? (
        <div className={styles.cmMeta} data-cm-zone="meta">
          {meta}
        </div>
      ) : null}
    </div>
  );
}

export default CommercialPage;
