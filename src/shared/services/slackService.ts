import { SlackConfig, SlackNotification } from '../../types';

export const sendSlackNotification = async (
  config: SlackConfig,
  notification: Omit<SlackNotification, 'id' | 'timestamp' | 'deliveredStatus'>,
  addLogCallback?: (log: SlackNotification) => void
): Promise<SlackNotification> => {
  const newLog: SlackNotification = {
    ...notification,
    id: `slk-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }),
    deliveredStatus: 'simulated'
  };

  // If real webhook is configured and enabled, fire a POST request
  if (config.enableSlackNotifications && config.webhookUrl && config.webhookUrl.startsWith('https://hooks.slack.com')) {
    try {
      const response = await fetch('/api/slack/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          webhookUrl: config.webhookUrl,
          channel: notification.channel || config.defaultChannel,
          text: `*${notification.title}*\n${notification.message}`,
          blocks: [
            {
              type: 'header',
              text: { type: 'plain_text', text: notification.title, emoji: true }
            },
            {
              type: 'section',
              text: { type: 'mrkdwn', text: notification.message }
            },
            {
              type: 'context',
              elements: [
                { type: 'mrkdwn', text: `*Sender:* ${notification.sender} | *Channel:* ${notification.channel || config.defaultChannel}` }
              ]
            }
          ]
        })
      });

      if (response.ok) {
        newLog.deliveredStatus = 'sent';
      }
    } catch (err) {
      console.warn('Slack webhook HTTP call failed, falling back to internal log:', err);
      newLog.deliveredStatus = 'failed';
    }
  }

  if (addLogCallback) {
    addLogCallback(newLog);
  }

  return newLog;
};

export const buildLeaveSlackBlock = (
  userName: string,
  leaveTypeName: string,
  startDate: string,
  endDate: string,
  daysCount: number,
  reason: string,
  status: string
) => {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `🌴 New Leave Request: ${userName}`,
        emoji: true
      }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Leave Type:*\n${leaveTypeName}` },
        { type: 'mrkdwn', text: `*Duration:*\n${daysCount} Day(s) (${startDate} to ${endDate})` },
        { type: 'mrkdwn', text: `*Status:*\n\`${status.toUpperCase()}\`` },
        { type: 'mrkdwn', text: `*Applicant:*\n${userName}` }
      ]
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Reason:* _"${reason}"_`
      }
    }
  ];
};

export const buildODSlackBlock = (
  userName: string,
  location: string,
  startDate: string,
  endDate: string,
  daysCount: number,
  purpose: string,
  status: string
) => {
  return [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: `📍 Outdoor Duty (OD) Request: ${userName}`,
        emoji: true
      }
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Location:*\n${location}` },
        { type: 'mrkdwn', text: `*Dates:*\n${daysCount} Day(s) (${startDate} to ${endDate})` },
        { type: 'mrkdwn', text: `*Status:*\n\`${status.toUpperCase()}\`` },
        { type: 'mrkdwn', text: `*Applicant:*\n${userName}` }
      ]
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Official Purpose:* _"${purpose}"_`
      }
    }
  ];
};
