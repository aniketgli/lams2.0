import { buildTablePdf, reportFileName, toCsvText, withCsvReportFrame, type ReportMeta } from '../../src/shared/services/printTable';
import type { ReportFormat } from './schedule';

export interface ReportTable {
  title: string;
  headers: string[];
  rows: unknown[][];
  landscape?: boolean;
  columnWidths?: number[];
}

export interface Attachment { filename: string; content: Buffer; contentType: string }


/**
 * The report as the files the administrator chose: the same themed PDF and the same framed CSV (report
 * header, footer, UTF-8 with a BOM for Excel) the screens download, named WII_<Report>_<period>_<sent at>.
 */
export function renderReport(table: ReportTable, formats: readonly ReportFormat[], baseName: string, subtitle: string[], meta: Partial<ReportMeta> = {}): Attachment[] {
  const files: Attachment[] = [];
  const stem = reportFileName(baseName, meta.generatedAt);
  const fullMeta: Partial<ReportMeta> = { generatedBy: 'Scheduled report (sent automatically)', ...meta };
  if (formats.includes('csv')) {
    const csv = withCsvReportFrame(toCsvText(table.headers, table.rows), { title: table.title, subtitle, meta: fullMeta });
    files.push({ filename: `${stem}.csv`, content: Buffer.from(`\uFEFF${csv}`, 'utf8'), contentType: 'text/csv; charset=utf-8' });
  }
  if (formats.includes('pdf')) {
    const doc = buildTablePdf({ title: table.title, subtitle, headers: table.headers, rows: table.rows, landscape: table.landscape ?? true, columnWidths: table.columnWidths, meta: fullMeta });
    files.push({ filename: `${stem}.pdf`, content: Buffer.from(doc.output('arraybuffer')), contentType: 'application/pdf' });
  }
  return files;
}
