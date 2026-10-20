import type { ReactNode } from "react";
import styles from "../CommercialPage.module.css";
import { joinClassNames } from "../commercialUtils.js";

export interface CommercialToolbarProps {
  children?: ReactNode;
  label?: string;
  className?: string;
  id?: string;
}

export function CommercialToolbar({ children, label, className, id }: CommercialToolbarProps) {
  return (
    <div
      id={id}
      className={joinClassNames(styles["cm-toolbar"], className)}
      data-cm-zone="toolbar-group"
      {...(label ? { role: "group", "aria-label": label } : {})}
    >
      {children}
    </div>
  );
}
