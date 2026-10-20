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
    <div className={styles.cmTableWrap} data-cm-zone="table">
      <table className={joinClassNames(styles.cmTable, className)}>
        <caption className={styles.cmTableCaption}>{caption}</caption>
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key} scope="col" className={styles.cmTableHeadCell}>
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td colSpan={Math.max(columns.length, 1)} className={styles.cmTableEmpty}>
                {empty}
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={row.id ?? `row-${rowIndex}`}>
                {columns.map((column) =>
                  column.rowHeader ? (
                    <th key={column.key} scope="row" className={styles.cmTableRowHeader}>
                      {row.cells[column.key]}
                    </th>
                  ) : (
                    <td key={column.key} className={styles.cmTableBodyCell}>
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
