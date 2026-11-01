import { buildTablePdf, toCsvText } from '../../src/shared/services/printTable';
import type { ReportFormat } from './schedule';

export interface ReportTable {
  title: string;
  headers: string[];
  rows: unknown[][];
  landscape?: boolean;
  columnWidths?: number[];
}

export interface Attachment { filename: string; content: Buffer; contentType: string }

const safeName = (name: string) => name.replace(/[^\w.-]+/g, '_');

/** The report as the files the administrator chose (UTF-8 CSV with a BOM for Excel, and / or the same themed PDF the screens download). */
export function renderReport(table: ReportTable, formats: readonly ReportFormat[], baseName: string, subtitle: string[]): Attachment[] {
  const files: Attachment[] = [];
  if (formats.includes('csv')) {
    files.push({ filename: `${safeName(baseName)}.csv`, content: Buffer.from(`﻿${toCsvText(table.headers, table.rows)}`, 'utf8'), contentType: 'text/csv; charset=utf-8' });
  }
  if (formats.includes('pdf')) {
    const doc = buildTablePdf({ title: table.title, subtitle, headers: table.headers, rows: table.rows, landscape: table.landscape ?? true, columnWidths: table.columnWidths });
    files.push({ filename: `${safeName(baseName)}.pdf`, content: Buffer.from(doc.output('arraybuffer')), contentType: 'application/pdf' });
  }
  return files;
}
