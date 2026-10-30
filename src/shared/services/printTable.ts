import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

/**
 * Downloads a table as a themed PDF file (no print dialog): navy title band,
 * navy header row, striped rows and "Page x of y" on every page.
 *
 * The built-in PDF fonts cover Latin text only, so other scripts (e.g. Hindi
 * names) should be left out of PDF columns; CSV downloads keep them.
 */

export interface PdfTableOptions {
  title: string;
  /** Small lines under the title (filters, generated time). */
  subtitle?: string[];
  headers: string[];
  rows: unknown[][];
  /** File name without extension. */
  fileName: string;
  landscape?: boolean;
  /** Relative column widths (same length as headers); omitted = automatic. */
  columnWidths?: number[];
}

const NAVY: [number, number, number] = [32, 64, 136]; // --color-primary #204088
const INK: [number, number, number] = [15, 23, 42];

/** Text the standard PDF fonts can draw: arrows become "->", unsupported characters are dropped. */
export function pdfText(value: unknown): string {
  if (value === null || value === undefined || value === '') return '—';
  return String(value)
    .replace(/→/g, '->')
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[^\x20-\x7E -ÿ–—•…\n]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim() || '—';
}

export function downloadTablePdf({ title, subtitle = [], headers, rows, fileName, landscape = true, columnWidths }: PdfTableOptions): void {
  const doc = new jsPDF({ orientation: landscape ? 'landscape' : 'portrait', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 12;

  // Title band
  const bandHeight = 14 + subtitle.length * 4.5;
  doc.setFillColor(...INK);
  doc.roundedRect(margin, margin, pageWidth - margin * 2, bandHeight, 2, 2, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.text(pdfText(title), margin + 5, margin + 8);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(203, 213, 225);
  subtitle.forEach((line, i) => doc.text(pdfText(line), margin + 5, margin + 13 + i * 4.5));

  const usable = pageWidth - margin * 2;
  const total = columnWidths?.reduce((a, b) => a + b, 0) ?? 0;
  const columnStyles = columnWidths && total > 0
    ? Object.fromEntries(columnWidths.map((w, i) => [i, { cellWidth: (w / total) * usable }]))
    : undefined;

  autoTable(doc, {
    startY: margin + bandHeight + 4,
    margin: { left: margin, right: margin, bottom: 14 },
    head: [headers.map(pdfText)],
    body: rows.length ? rows.map((r) => r.map(pdfText)) : [[{ content: 'No records.', colSpan: headers.length, styles: { halign: 'center' as const, textColor: [148, 163, 184] as [number, number, number] } }]],
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 8, cellPadding: 2, textColor: INK, lineColor: [226, 232, 240], lineWidth: 0.2, overflow: 'linebreak', valign: 'top' },
    headStyles: { fillColor: NAVY, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [248, 250, 252] },
    columnStyles,
    didDrawPage: () => {
      const page = doc.getCurrentPageInfo().pageNumber;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('Wildlife Institute of India · WII Enterprise Portal', margin, pageHeight - 7);
      doc.text(`Page ${page}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
    },
  });

  // "Page x of y" now that the total is known.
  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFillColor(255, 255, 255);
    doc.rect(pageWidth - margin - 30, pageHeight - 10, 30, 5, 'F');
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text(`Page ${i} of ${pages}`, pageWidth - margin, pageHeight - 7, { align: 'right' });
  }

  doc.save(`${fileName.replace(/[^\w.-]+/g, '_')}.pdf`);
}

/** "30 Oct 2026, 11:05" in the viewer's locale. */
export function printedAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}

/** Saves CSV text as a file (UTF-8 with BOM so Excel shows names correctly). */
export function downloadCsvText(csv: string, fileName: string): void {
  const url = URL.createObjectURL(new Blob([csv.startsWith('﻿') ? csv : `﻿${csv}`], { type: 'text/csv;charset=utf-8' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = `${fileName.replace(/[^\w.-]+/g, '_')}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/** One CSV cell; values a spreadsheet would run as formulas are prefixed with a quote. */
export function csvCell(value: unknown): string {
  let text = value === null || value === undefined ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsvText(headers: string[], rows: unknown[][]): string {
  return `${[headers, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n')}\r\n`;
}
