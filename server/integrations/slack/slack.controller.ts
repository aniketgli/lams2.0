import type { Request, Response } from 'express';
import { badRequest } from '../../lib/http';
import { SlackService } from './slack.service';

export class SlackController {
  static async notify(req: Request, res: Response) {
    const { webhookUrl, text, blocks } = req.body || {};
    if (typeof text !== 'string' || !text.trim() || text.length > 4000) throw badRequest('Message text is required (max 4000 characters).');
    if (blocks !== undefined && (!Array.isArray(blocks) || blocks.length > 50)) throw badRequest('Invalid Slack blocks.');
    const result = await SlackService.notifyWebhook({ webhookUrl, text, blocks });
    res.json(result);
  }
}
