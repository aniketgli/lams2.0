import { SlackNotificationPayload } from './slack.types';

export class SlackService {
  static async notifyWebhook(payload: SlackNotificationPayload): Promise<{ success: boolean; message: string }> {
    const { webhookUrl, text, blocks } = payload;
    if (!webhookUrl || typeof webhookUrl !== 'string') {
      throw new Error('Missing or invalid webhookUrl');
    }

    const slackRes = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, blocks })
    });

    if (!slackRes.ok) {
      const textErr = await slackRes.text();
      throw new Error(`Slack HTTP error ${slackRes.status}: ${textErr}`);
    }

    return { success: true, message: 'Dispatched to Slack Incoming Webhook' };
  }
}
