import { describe, expect, test } from 'bun:test';
import { logoAttachment, renderEmail } from './emailLayout';

const base = { title: 'Leave request applied', greetingName: 'Asha <b>', intro: 'Hello', rows: [['Reason', '<script>x</script>']] as Array<[string, string]>, brand: { orgName: 'Wildlife Institute of India', hasLogo: false }, year: 2026 };

describe('renderEmail', () => {
  test('has the portal name, do-not-reply footer and escapes values', () => {
    const { html, text } = renderEmail(base);
    expect(html).toContain('WII PORTAL');
    expect(html).toContain('This is an automated email. Please do not reply.');
    expect(html).toContain('&copy; 2026 Wildlife Institute of India');
    expect(html).not.toContain('<script>');
    expect(html).not.toContain('Asha <b>');
    expect(text).toContain('Please do not reply.');
  });
  test('button only when a link is given', () => {
    expect(renderEmail(base).html).not.toContain('<a href');
    expect(renderEmail({ ...base, button: { label: 'Open WII Portal', url: 'https://portal.wii.gov.in' } }).html).toContain('href="https://portal.wii.gov.in"');
  });
  test('logo is referenced by content id only when attached', () => {
    expect(renderEmail(base).html).not.toContain('cid:org-logo');
    expect(renderEmail({ ...base, brand: { ...base.brand, hasLogo: true } }).html).toContain('cid:org-logo');
  });
});

describe('logoAttachment', () => {
  test('accepts png / jpeg / webp data urls only', () => {
    expect(logoAttachment('data:image/png;base64,iVBORw0KGgo=')?.contentType).toBe('image/png');
    expect(logoAttachment('data:image/svg+xml;base64,PHN2Zz4=')).toBeNull();
    expect(logoAttachment('javascript:alert(1)')).toBeNull();
    expect(logoAttachment(null)).toBeNull();
  });
});
