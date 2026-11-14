import { describe, expect, test } from 'bun:test';
import http from 'node:http';
import { attachmentDisposition } from './http';

/** Sends the header through a real Node HTTP server, the way Express does. */
async function roundTrip(value: string): Promise<{ status: number; header: string | undefined }> {
  const server = http.createServer((_req, res) => {
    try {
      res.setHeader('Content-Disposition', value);
      res.end('ok');
    } catch {
      res.statusCode = 500;
      res.end();
    }
  });
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address() as { port: number };
  try {
    const response = await fetch(`http://127.0.0.1:${port}/`);
    return { status: response.status, header: response.headers.get('content-disposition') ?? undefined };
  } finally {
    server.close();
  }
}

describe('download names from uploads', () => {
  test('a Hindi file name no longer breaks the download (was ERR_INVALID_CHAR -> 500)', async () => {
    const value = attachmentDisposition('चिकित्सा प्रमाणपत्र.pdf', 'certificate');
    const { status, header } = await roundTrip(value);
    expect(status).toBe(200);
    expect(header).toContain('filename="certificate.pdf"');
    expect(header).toContain(`filename*=UTF-8''${encodeURIComponent('चिकित्सा प्रमाणपत्र.pdf')}`);
  });

  test('plain names are kept as they are', () => {
    expect(attachmentDisposition('medical-certificate.pdf')).toBe(`attachment; filename="medical-certificate.pdf"; filename*=UTF-8''medical-certificate.pdf`);
  });

  test('mixed names keep their readable ASCII part; quotes and line breaks cannot escape the header', async () => {
    const value = attachmentDisposition('Report é 😀 "x"\r\nSet-Cookie: a=b.png');
    expect(value).not.toMatch(/[\r\n]/);
    expect(value.split('filename="')[1].split('"')[0]).not.toContain('"');
    expect((await roundTrip(value)).status).toBe(200);
  });
});
