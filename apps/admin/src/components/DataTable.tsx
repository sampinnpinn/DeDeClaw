import type { ReactNode } from 'react';
import styles from './DataTable.module.css';

export interface TableColumn<TItem> {
  key: keyof TItem | string;
  title: string;
  render: (item: TItem) => ReactNode;
}

interface DataTableProps<TItem> {
  rows: TItem[];
  columns: TableColumn<TItem>[];
  emptyText?: string;
}

export default function DataTable<TItem>({ rows, columns, emptyText = '暂无数据' }: DataTableProps<TItem>) {
  return (
    <table className={styles.table}>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={String(column.key)} className={styles.headCell}>
              {column.title}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td className={styles.empty} colSpan={columns.length}>
              {emptyText}
            </td>
          </tr>
        ) : (
          rows.map((row, rowIndex) => (
            <tr key={rowIndex}>
              {columns.map((column) => (
                <td key={String(column.key)} className={styles.cell}>
                  {column.render(row)}
                </td>
              ))}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
