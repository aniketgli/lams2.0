export interface ServerEmailLog {
  id: string;
  timestamp: string;
  to: string;
  toName?: string;
  cc?: string[];
  bcc?: string[];
  subject: string;
  status: 'delivered' | 'sent' | 'simulated' | 'failed';
  error?: string;
  messageId?: string;
  referenceId?: string;
  category?: string;
  /** What the mail was about, e.g. LEAVE_APPLIED. */
  eventType?: string;
}

export interface SendEmailPayload {
  to: string;
  toName?: string;
  cc?: string[];
  subject: string;
  html?: string;
  text?: string;
  category?: string;
  eventType?: string;
  referenceId?: string;
  attachments?: Array<{ filename: string; content: Buffer; contentType: string; cid?: string }>;
}
