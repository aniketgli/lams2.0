import { escapeHtml } from '../lib/validate';

/** The look of every system email (pure: no database, no network). */

export interface EmailBrand {
  orgName: string;
  /** True when the organization logo is attached to the mail under the content id `org-logo`. */
  hasLogo: boolean;
}

export interface EmailParts {
  title: string;
  greetingName: string;
  intro: string;
  rows: Array<[label: string, value: string | number]>;
  remark?: string | null;
  /** Shown only when the portal's public address (APP_URL) is configured. */
  button?: { label: string; url: string } | null;
  brand: EmailBrand;
  year: number;
}

const NAVY = '#17446f';

export function renderEmail(p: EmailParts): { html: string; text: string } {
  const e = escapeHtml;
  const rows = p.rows.map(([k, v], i) =>
    `<tr><td style="padding:12px 14px;width:34%;background:#f8fafc;font-weight:bold;color:#1e293b;${i ? 'border-top:1px solid #e2e8f0;' : ''}">${e(k)}</td><td style="padding:12px 14px;color:#334155;${i ? 'border-top:1px solid #e2e8f0;' : ''}">${e(v)}</td></tr>`).join('');
  const html = `<div style="background:#f1f5f9;padding:24px 12px;font-family:Arial,Helvetica,sans-serif">
<table role="presentation" width="100%" style="max-width:650px;margin:0 auto;border-collapse:collapse;background:#ffffff;border-radius:14px;overflow:hidden">
<tr><td style="background:${NAVY};padding:20px 28px">
<table role="presentation" width="100%" style="border-collapse:collapse"><tr>
<td style="vertical-align:middle">${p.brand.hasLogo ? `<img src="cid:org-logo" alt="${e(p.brand.orgName)}" style="height:48px;max-width:200px;background:#ffffff;border-radius:8px;padding:4px;display:block">` : `<span style="color:#ffffff;font-weight:bold;font-size:15px">${e(p.brand.orgName)}</span>`}</td>
<td style="text-align:right;vertical-align:middle"><div style="color:#ffffff;font-size:22px;font-weight:bold">${e(p.title)}</div><div style="color:#cbd5e1;font-size:12px;letter-spacing:1px;margin-top:4px">WII PORTAL</div></td>
</tr></table></td></tr>
<tr><td style="padding:28px;font-size:14px;line-height:1.6;color:#1e293b">
<p style="margin:0 0 14px">Dear <strong>${e(p.greetingName)}</strong>,</p>
<p style="margin:0 0 16px">${e(p.intro)}</p>
${rows ? `<table role="presentation" width="100%" style="border-collapse:collapse;border:1px solid #e2e8f0;font-size:14px">${rows}</table>` : ''}
${p.remark ? `<p style="margin:16px 0 0;border-left:3px solid #cbd5e1;padding-left:10px;color:#475569"><strong>Remark:</strong> ${e(p.remark)}</p>` : ''}
${p.button ? `<p style="text-align:center;margin:26px 0 8px"><a href="${e(p.button.url)}" style="background:${NAVY};color:#ffffff;text-decoration:none;font-weight:bold;padding:14px 32px;border-radius:999px;display:inline-block">${e(p.button.label)}</a></p>` : ''}
<p style="margin:22px 0 0">Regards,<br><strong>WII Portal</strong></p>
</td></tr>
<tr><td style="background:#f1f5f9;padding:16px 28px;text-align:center;font-size:12px;color:#64748b">This is an automated email. Please do not reply.<br>&copy; ${p.year} ${e(p.brand.orgName)}</td></tr>
</table></div>`;
  const text = [
    `Dear ${p.greetingName},`, '', p.intro, '',
    ...p.rows.map(([k, v]) => `${k}: ${v}`),
    ...(p.remark ? ['', `Remark: ${p.remark}`] : []),
    ...(p.button ? ['', `${p.button.label}: ${p.button.url}`] : []),
    '', 'Regards,', 'WII Portal', '', 'This is an automated email. Please do not reply.',
  ].join('\n');
  return { html, text };
}

/** `data:image/png;base64,...` → attachment parts, or null when it is not a safe image. */
export function logoAttachment(dataUrl: string | null | undefined): { content: Buffer; contentType: string; filename: string } | null {
  const m = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl ?? ''));
  if (!m) return null;
  return { content: Buffer.from(m[2], 'base64'), contentType: m[1], filename: `logo.${m[1].split('/')[1] === 'jpeg' ? 'jpg' : m[1].split('/')[1]}` };
}
