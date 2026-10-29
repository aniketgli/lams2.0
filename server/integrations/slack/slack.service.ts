import { SlackNotificationPayload } from './slack.types';

/**
 * Only genuine Slack incoming-webhook URLs are accepted. Without this check the
 * endpoint would let any signed-in user make the server send requests to
 * arbitrary (including internal-network) addresses.
 */
export function isSlackWebhookUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 500) return false;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  return (
    url.protocol === 'https:' &&
    url.hostname === 'hooks.slack.com' &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    /^\/services\/[A-Za-z0-9]+\/[A-Za-z0-9]+\/[A-Za-z0-9]+$/.test(url.pathname)
  );
}

const PLACEHOLDER = /T0{8}|X{24}/;

export class SlackService {
  static async notifyWebhook(payload: SlackNotificationPayload): Promise<{ success: boolean; message: string }> {
    const { webhookUrl, text, blocks } = payload;
    if (!isSlackWebhookUrl(webhookUrl)) {
      return { success: false, message: 'Webhook URL must be a Slack incoming webhook (https://hooks.slack.com/services/...).' };
    }
    if (PLACEHOLDER.test(webhookUrl)) {
      return { success: false, message: 'Placeholder webhook URL provided.' };
    }

    try {
      const slackRes = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, blocks }),
        redirect: 'error',
        signal: AbortSignal.timeout(10_000),
      });
      if (!slackRes.ok) {
        return { success: false, message: `Slack responded with HTTP ${slackRes.status}.` };
      }
      return { success: true, message: 'Dispatched to Slack.' };
    } catch (err) {
      console.warn('[slack] dispatch failed:', err instanceof Error ? err.message : err);
      return { success: false, message: 'Could not reach Slack.' };
    }
  }
}
