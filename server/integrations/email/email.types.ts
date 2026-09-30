export interface ServerEmailLog {
  id: string;
  timestamp: string;
  to: string;
  toName?: string;
  cc?: string[];
  subject: string;
  status: 'delivered' | 'sent' | 'simulated' | 'failed';
  error?: string;
  messageId?: string;
  referenceId?: string;
  category?: string;
}

export interface SmtpConfigPayload {
  host?: string;
  port?: number;
  secure?: boolean;
  user?: string;
  pass?: string;
  fromEmail?: string;
  fromName?: string;
}

export interface SendEmailPayload {
  to: string;
  toName?: string;
  cc?: string[];
  subject: string;
  html?: string;
  text?: string;
  smtpConfig?: SmtpConfigPayload;
  category?: string;
  eventType?: string;
  referenceId?: string;
}
