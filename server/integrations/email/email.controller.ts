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
}
