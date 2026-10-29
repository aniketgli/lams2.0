import { Request, Response } from 'express';
import { EmailService } from './email.service';

export class EmailController {
  static getLogs(req: Request, res: Response) {
    const logs = EmailService.getRecentLogs();
    res.json({ logs });
  }

  /** Tests the saved SMTP settings (the request cannot supply its own server). */
  static async testSmtp(_req: Request, res: Response) {
    const result = await EmailService.testSmtpConnection();
    res.status(result.success ? 200 : 502).json(result);
  }

  static async send(req: Request, res: Response) {
    try {
      const { to, subject } = req.body || {};
      if (!to || !subject) {
        return res.status(400).json({ success: false, error: 'Recipient "to" and "subject" are required' });
      }

      const result = await EmailService.sendEmail(req.body);
      res.json(result);
    } catch (err: any) {
      console.error('Email Dispatch Error:', err);
      res.status(500).json({ success: false, error: err?.message || 'Internal Server Error' });
    }
  }
}
