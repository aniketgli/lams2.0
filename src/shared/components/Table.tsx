import React from 'react';
import { ArrowUpDown, ArrowUp, ArrowDown, AlertCircle, Inbox, Loader2 } from 'lucide-react';
import { TablePagination, TablePaginationProps } from './TablePagination';

/* -------------------------------------------------------------------------- */
/* Low-Level Compound Table Components                                        */
/* -------------------------------------------------------------------------- */

export const Table: React.FC<React.TableHTMLAttributes<HTMLTableElement> & { containerClassName?: string }> = ({
  children,
  className = '',
  containerClassName = '',
  ...rest
}) => (
  // overflow-y-hidden: without it the browser reserves a vertical scrollbar
  // gutter, which cuts the header's grey strip short on the right.
  <div className={`w-full overflow-x-auto overflow-y-hidden rounded-xl border border-slate-200 bg-white shadow-2xs custom-table-scrollbar ${containerClassName}`}>
    <table className={`w-full text-left border-collapse text-xs ${className}`} {...rest}>
      {children}
    </table>
  </div>
);

export const TableHeader: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <thead className={`bg-slate-50/90 border-b border-slate-200 ${className}`} {...rest}>
    {children}
  </thead>
);

export const TableBody: React.FC<React.HTMLAttributes<HTMLTableSectionElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <tbody className={`divide-y divide-slate-100 ${className}`} {...rest}>
    {children}
  </tbody>
);

export interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  isClickable?: boolean;
  isStriped?: boolean;
}

export const TableRow: React.FC<TableRowProps> = ({
  children,
  isClickable = false,
  isStriped = false,
  className = '',
  ...rest
}) => (
  <tr
    className={`transition-colors ${
      isStriped ? 'even:bg-slate-50/50' : ''
    } ${
      isClickable
        ? 'cursor-pointer hover:bg-slate-100/70 active:bg-slate-100'
        : 'hover:bg-slate-50/80'
    } ${className}`}
    {...rest}
  >
    {children}
  </tr>
);

export interface TableHeadProps extends React.ThHTMLAttributes<HTMLTableCellElement> {
  sortable?: boolean;
  sortDirection?: 'asc' | 'desc' | null;
  onSort?: () => void;
}

export const TableHead: React.FC<TableHeadProps> = ({
  children,
  sortable = false,
  sortDirection,
  onSort,
  className = '',
  ...rest
}) => (
  <th
    onClick={sortable ? onSort : undefined}
    tabIndex={sortable ? 0 : undefined}
    onKeyDown={sortable ? (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSort?.(); } } : undefined}
    className={`group/th py-2.5 px-3 text-[11px] font-bold text-slate-600 uppercase tracking-wider whitespace-nowrap select-none ${
      sortable ? 'cursor-pointer hover:text-slate-900 group' : ''
    } ${className}`}
    {...rest}
  >
    {/* Follows the column alignment (text-right / text-center on the th). */}
    <div className="flex items-center gap-1.5 group-[.text-right]/th:justify-end group-[.text-center]/th:justify-center">
      <span>{children}</span>
      {sortable && (
        <span className="text-slate-400 group-hover:text-slate-700">
          {sortDirection === 'asc' ? (
            <ArrowUp className="w-3 h-3 text-primary" />
          ) : sortDirection === 'desc' ? (
            <ArrowDown className="w-3 h-3 text-primary" />
          ) : (
            <ArrowUpDown className="w-3 h-3 opacity-60" />
          )}
        </span>
      )}
    </div>
  </th>
);

export const TableCell: React.FC<React.TdHTMLAttributes<HTMLTableCellElement>> = ({
  children,
  className = '',
  ...rest
}) => (
  <td className={`py-2.5 px-3 text-xs font-medium text-slate-800 whitespace-nowrap ${className}`} {...rest}>
    {children}
  </td>
);

export interface TableEmptyProps {
  colSpan?: number;
  message?: string;
  description?: string;
}

export const TableEmpty: React.FC<TableEmptyProps> = ({
  colSpan = 1,
  message = 'No records found',
  description
}) => (
  <tr>
    <td colSpan={colSpan} className="py-12 text-center text-slate-400">
      <div className="flex flex-col items-center justify-center space-y-1.5">
        <Inbox className="w-8 h-8 text-slate-300 stroke-[1.5]" />
        <span className="text-xs font-bold text-slate-700">{message}</span>
        {description && <span className="text-[11px] text-slate-400">{description}</span>}
      </div>
    </td>
  </tr>
);

/* -------------------------------------------------------------------------- */
/* Declarative Generic DataTable Component                                    */
/* -------------------------------------------------------------------------- */

export interface ColumnDef<T> {
  key: string;
  header: React.ReactNode;
  width?: string;
  /** Sortable by default when sortValue is given. */
  sortable?: boolean;
  /**
   * Value used to sort this column (string, number or date ISO string).
   * When a DataTable has no `onSort`, it sorts by this itself.
   */
  sortValue?: (item: T) => string | number | boolean | null | undefined;
  align?: 'left' | 'center' | 'right';
  render?: (item: T, index: number) => React.ReactNode;
}

const collator = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** Compares two cell values; blanks always sort last, in either direction. */
function compareValues(a: unknown, b: unknown, dir: 'asc' | 'desc'): number {
  const empty = (v: unknown) => v === null || v === undefined || v === '';
  if (empty(a) && empty(b)) return 0;
  if (empty(a)) return 1;
  if (empty(b)) return -1;
  let result: number;
  if (typeof a === 'number' && typeof b === 'number') result = a - b;
  else if (typeof a === 'boolean' && typeof b === 'boolean') result = Number(b) - Number(a);
  else result = collator.compare(String(a), String(b));
  return dir === 'asc' ? result : -result;
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[];
  data: T[];
  loading?: boolean;
  error?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  keyExtractor?: (item: T, index: number) => string | number;
  onRowClick?: (item: T) => void;
  striped?: boolean;
  sortColumn?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (columnKey: string) => void;
  pagination?: TablePaginationProps;
  className?: string;
  containerClassName?: string;
}

export function DataTable<T>({
  columns,
  data,
  loading = false,
  error,
  emptyTitle = 'No records found',
  emptyDescription = 'There are no items to display matching your criteria.',
  keyExtractor,
  onRowClick,
  striped = false,
  sortColumn,
  sortDirection,
  onSort,
  pagination,
  className = '',
  containerClassName = ''
}: DataTableProps<T>) {
  // Built-in sorting when the parent does not control it.
  const controlled = Boolean(onSort);
  const [internalSort, setInternalSort] = React.useState<{ key: string; dir: 'asc' | 'desc' } | null>(null);
  const activeKey = controlled ? sortColumn : internalSort?.key;
  const activeDir = controlled ? sortDirection : internalSort?.dir;
  const isSortable = (col: ColumnDef<T>) => col.sortable ?? Boolean(col.sortValue);

  const handleSort = (col: ColumnDef<T>) => {
    if (!isSortable(col)) return;
    if (controlled) return onSort!(col.key);
    setInternalSort((prev) => (prev?.key === col.key
      ? (prev.dir === 'asc' ? { key: col.key, dir: 'desc' } : null) // asc → desc → unsorted
      : { key: col.key, dir: 'asc' }));
  };

  const rows = React.useMemo(() => {
    if (controlled || !internalSort) return data;
    const col = columns.find((c) => c.key === internalSort.key);
    if (!col) return data;
    const value = col.sortValue ?? ((item: T) => (item as any)?.[col.key]);
    return [...data].sort((a, b) => compareValues(value(a), value(b), internalSort.dir));
  }, [controlled, internalSort, data, columns]);

  return (
    <div className={`space-y-3 ${containerClassName}`}>
      <Table className={className}>
        <TableHeader>
          <tr>
            {columns.map((col) => (
              <TableHead
                key={col.key}
                sortable={isSortable(col)}
                sortDirection={activeKey === col.key ? activeDir ?? null : null}
                onSort={() => handleSort(col)}
                aria-sort={activeKey === col.key ? (activeDir === 'asc' ? 'ascending' : 'descending') : undefined}
                style={col.width ? { width: col.width } : undefined}
                className={col.align === 'right' ? 'text-right' : col.align === 'center' ? 'text-center' : 'text-left'}
              >
                {col.header}
              </TableHead>
            ))}
          </tr>
        </TableHeader>

        <TableBody>
          {loading ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-slate-500">
                <div className="flex flex-col items-center justify-center space-y-2">
                  <Loader2 className="w-6 h-6 animate-spin text-primary" />
                  <span className="text-xs font-semibold">Loading data...</span>
                </div>
              </td>
            </tr>
          ) : error ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-rose-600">
                <div className="flex flex-col items-center justify-center space-y-2">
                  <AlertCircle className="w-6 h-6 text-rose-500" />
                  <span className="text-xs font-semibold">{error}</span>
                </div>
              </td>
            </tr>
          ) : rows.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="py-12 text-center text-slate-400">
                <div className="flex flex-col items-center justify-center space-y-1.5">
                  <Inbox className="w-8 h-8 text-slate-300 stroke-[1.5]" />
                  <span className="text-xs font-bold text-slate-700">{emptyTitle}</span>
                  <span className="text-[11px] text-slate-400">{emptyDescription}</span>
                </div>
              </td>
            </tr>
          ) : (
            rows.map((item, rowIndex) => {
              const rowKey = keyExtractor ? keyExtractor(item, rowIndex) : (item as any)?.id || rowIndex;
              return (
                <TableRow
                  key={rowKey}
                  isClickable={Boolean(onRowClick)}
                  isStriped={striped}
                  onClick={() => onRowClick && onRowClick(item)}
                >
                  {columns.map((col) => {
                    const cellContent = col.render
                      ? col.render(item, rowIndex)
                      : (item as any)?.[col.key];

                    return (
                      <TableCell
                        key={col.key}
                        className={
                          col.align === 'right'
                            ? 'text-right'
                            : col.align === 'center'
                            ? 'text-center'
                            : 'text-left'
                        }
                      >
                        {cellContent}
                      </TableCell>
                    );
                  })}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>

      {pagination && <TablePagination {...pagination} />}
    </div>
  );
}
