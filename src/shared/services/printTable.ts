/**
 * Prints a table as a clean, themed document (the browser's print dialog
 * offers "Save as PDF"). Used for PDF exports so the page chrome — sidebar,
 * header, buttons — never ends up in the file. Every value is HTML-escaped.
 */

export interface PrintTableOptions {
  title: string;
  /** Small lines under the title (organisation, filters, generated time). */
  subtitle?: string[];
  headers: string[];
  rows: unknown[][];
  /** Landscape suits wide tables. */
  landscape?: boolean;
}

const escapeHtml = (value: unknown): string =>
  String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function buildPrintHtml({ title, subtitle = [], headers, rows, landscape = true }: PrintTableOptions): string {
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join('');
  const body = rows.length
    ? rows.map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c === null || c === undefined || c === '' ? '—' : c)}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${headers.length}" class="empty">No records.</td></tr>`;
  return `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(title)}</title>
<style>
  @page { size: A4 ${landscape ? 'landscape' : 'portrait'}; margin: 12mm; }
  * { box-sizing: border-box; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  body { font-family: Inter, "Segoe UI", system-ui, -apple-system, sans-serif; color: #0f172a; margin: 0; font-size: 9.5px; }
  .band { background: linear-gradient(90deg, #0f172a, #1c3577 50%, #0f172a); color: #fff; padding: 10px 14px; border-radius: 8px; }
  .band h1 { margin: 0; font-size: 15px; letter-spacing: -0.01em; }
  .band p { margin: 2px 0 0; font-size: 9.5px; color: #cbd5e1; }
  table { width: 100%; border-collapse: separate; border-spacing: 0; margin-top: 10px; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
  thead th { background: #204088; color: #fff; text-align: left; font-size: 8.5px; text-transform: uppercase; letter-spacing: 0.04em; padding: 6px 7px; }
  tbody td { padding: 5px 7px; border-top: 1px solid #e2e8f0; vertical-align: top; word-break: break-word; }
  tbody tr:nth-child(even) td { background: #f8fafc; }
  thead { display: table-header-group; }
  tr { page-break-inside: avoid; }
  .empty { text-align: center; color: #94a3b8; padding: 16px; }
  .foot { margin-top: 8px; color: #64748b; font-size: 8.5px; }
</style></head><body>
<div class="band"><h1>${escapeHtml(title)}</h1>${subtitle.map((s) => `<p>${escapeHtml(s)}</p>`).join('')}</div>
<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>
<p class="foot">${rows.length} record${rows.length === 1 ? '' : 's'}</p>
</body></html>`;
}

export function printTable(options: PrintTableOptions): void {
  const frame = document.createElement('iframe');
  frame.setAttribute('aria-hidden', 'true');
  frame.style.cssText = 'position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden';
  document.body.appendChild(frame);
  const doc = frame.contentDocument;
  const win = frame.contentWindow;
  if (!doc || !win) { frame.remove(); return; }
  doc.open();
  doc.write(buildPrintHtml(options));
  doc.close();
  win.addEventListener('afterprint', () => window.setTimeout(() => frame.remove(), 500), { once: true });
  window.setTimeout(() => { win.focus(); win.print(); }, 150);
  // Safety net if afterprint never fires.
  window.setTimeout(() => { if (frame.isConnected) frame.remove(); }, 60_000);
}

/** "30 Oct 2026, 11:05" in the viewer's locale. */
export function printedAt(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
}
