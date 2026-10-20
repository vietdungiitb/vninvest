import type { ReactNode } from "react";
import styles from "../CommercialPage.module.css";
import { joinClassNames } from "../commercialUtils.js";

export interface CommercialMetaItem {
  label: string;
  value: ReactNode;
}

export interface CommercialMetaProps {
  items: CommercialMetaItem[];
  className?: string;
}

export function CommercialMeta({ items, className }: CommercialMetaProps) {
  return (
    <dl className={joinClassNames(styles.cmMetaList, className)} data-cm-zone="meta-list">
      {items.map((item, index) => (
        <div key={`${item.label}-${index}`} className={styles.cmMetaItem}>
          <dt className={styles.cmMetaLabel}>{item.label}</dt>
          <dd className={styles.cmMetaValue}>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}
