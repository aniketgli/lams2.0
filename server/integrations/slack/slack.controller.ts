import { Request, Response } from 'express';
import { SlackService } from './slack.service';

export class SlackController {
  static async notify(req: Request, res: Response) {
    try {
      const { webhookUrl, text, blocks } = req.body || {};
      if (!webhookUrl) {
        return res.status(400).json({ error: 'Missing webhookUrl' });
      }

      if (webhookUrl.includes('T00000000') || webhookUrl.includes('XXXXXXXXXXXXXXXXXXXXXXXX')) {
        return res.json({ success: false, message: 'Mock or default webhook URL provided' });
      }

      const result = await SlackService.notifyWebhook({ webhookUrl, text, blocks });
      res.json(result);
    } catch (err: any) {
      console.warn('Slack notification result:', err?.message || err);
      res.status(200).json({ success: false, error: err?.message || 'Failed to dispatch to Slack' });
    }
  }
}
