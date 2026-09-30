export interface SlackNotificationPayload {
  webhookUrl: string;
  text: string;
  blocks?: any[];
}
