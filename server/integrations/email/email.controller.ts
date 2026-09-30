import { Request, Response } from 'express';
import { EmailService } from './email.service';

export class EmailController {
  static getLogs(req: Request, res: Response) {
    const logs = EmailService.getRecentLogs();
    res.json({ logs });
  }

  static async testSmtp(req: Request, res: Response) {
    try {
      const { smtpConfig } = req.body || {};
      const result = await EmailService.testSmtpConnection(smtpConfig);
      res.json(result);
    } catch (err: any) {
      console.error('SMTP Verify Error:', err);
      res.status(500).json({
        success: false,
        message: err?.message || 'Failed to connect to SMTP server'
      });
    }
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
