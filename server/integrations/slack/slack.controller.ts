import { Request, Response } from 'express';
import { SlackService } from './slack.service';

export class SlackController {
  static async notify(req: Request, res: Response) {
    try {
      const { webhookUrl, text, blocks } = req.body || {};
      if (!webhookUrl) {
        return res.status(400).json({ error: 'Missing webhookUrl' });
      }

      const result = await SlackService.notifyWebhook({ webhookUrl, text, blocks });
      res.json(result);
    } catch (err: any) {
      console.error('Slack Controller Error:', err);
      res.status(500).json({ error: err?.message || 'Failed to dispatch to Slack' });
    }
  }
}
