import { Request, Response } from 'express';
import { EmailService } from './email.service';
import { listOutbox, resend, resendRecent } from '../../notifications/outbox';
import { badRequest } from '../../lib/http';

export class EmailController {
  /** The email log: every mail from the outbox table (all servers, kept across restarts); the in-memory list without it. */
  static async getLogs(req: Request, res: Response) {
    const entries = await listOutbox({ status: typeof req.query.status === 'string' ? req.query.status : null });
    if (entries) return res.json({ source: 'database', entries });
    res.json({ source: 'memory', logs: EmailService.getRecentLogs() });
  }

  /** Sends mails that did not go out again: the ids given, or every one of the last day (`all: true`). */
  static async resend(req: Request, res: Response) {
    const body = (req.body ?? {}) as { ids?: unknown; all?: unknown };
    let count: number;
    if (body.all === true) count = await resendRecent();
    else if (Array.isArray(body.ids) && body.ids.length) count = await resend(body.ids.map(Number));
    else throw badRequest('Choose the emails to send again.');
    res.json({ queued: count, message: count ? `${count} email${count === 1 ? '' : 's'} queued to send again.` : 'Nothing to send again.' });
  }

  /** Tests the saved SMTP settings (the request cannot supply its own server). */
  static async testSmtp(_req: Request, res: Response) {
    const result = await EmailService.testSmtpConnection();
    res.status(result.success ? 200 : 502).json(result);
  }
}
