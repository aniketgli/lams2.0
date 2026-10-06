import { SlackNotificationPayload } from './slack.types';

export class SlackService {
  static async notifyWebhook(payload: SlackNotificationPayload): Promise<{ success: boolean; message: string }> {
    const { webhookUrl, text, blocks } = payload;
    if (!webhookUrl || typeof webhookUrl !== 'string') {
      return { success: false, message: 'Missing or invalid webhookUrl' };
    }

    if (webhookUrl.includes('T00000000') || webhookUrl.includes('XXXXXXXXXXXXXXXXXXXXXXXX')) {
      return { success: false, message: 'Mock or placeholder webhook URL provided' };
    }

    try {
      const slackRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, blocks })
      });

      if (!slackRes.ok) {
        const textErr = await slackRes.text();
        return { success: false, message: `Slack responded with HTTP ${slackRes.status}: ${textErr}` };
      }

      return { success: true, message: 'Dispatched to Slack Incoming Webhook' };
    } catch (err: any) {
      return { success: false, message: err?.message || 'Network error reaching Slack' };
    }
  }
}
