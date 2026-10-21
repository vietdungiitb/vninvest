import type { ReactNode } from "react";
import styles from "../CommercialPage.module.css";
import { joinClassNames } from "../commercialUtils.js";

export interface CommercialTableColumn {
  key: string;
  label: string;
  rowHeader?: boolean;
}

export interface CommercialTableRow {
  id?: string;
  /** `data-testid` của `<tr>` — dùng khi test cần truy cập cả hàng (vd: cả 2 nút hành động). */
  testId?: string;
  cells: Record<string, ReactNode>;
}

export interface CommercialTableProps {
  caption: string;
  columns: CommercialTableColumn[];
  rows: CommercialTableRow[];
  empty?: ReactNode;
  className?: string;
}

export function CommercialTable({ caption, columns, rows, empty, className }: CommercialTableProps) {
  return (
    <div className={styles["cm-table-wrap"]} data-cm-zone="table">
      <table className={joinClassNames(styles["cm-table"], className)}>
        <caption className={styles["cm-table-caption"]}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={styles["cm-table-head-cell"]}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={Math.max(columns.length, 1)} className={styles["cm-table-empty"]}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={row.id ?? `row-${rowIndex}`} data-testid={row.testId}>
                {columns.map((column) =>
                  column.rowHeader ? (
                    <th key={column.key} scope="row" className={styles["cm-table-row-header"]}>
                      {row.cells[column.key]}
                    </th>
                  ) : (
                    <td key={column.key} className={styles["cm-table-body-cell"]}>
                      {row.cells[column.key]}
                    </td>
                  ),
                )}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}
