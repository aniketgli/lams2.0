import nodemailer from 'nodemailer';
import { ServerEmailLog, SendEmailPayload } from './email.types';
import { activeCopyAddresses, mergeCopies } from '../../masters/notificationRecipients';
import { EmailTransportConfig, resolveEmailTransport, transportOptions } from '../../masters/emailSettings';

/**
 * Sends notification email using the sender / SMTP settings from
 * Master Settings > Organization (falling back to .env). Callers can no
 * longer pass their own SMTP server: an email always goes through the
 * institute's configured server.
 */
export class EmailService {
  private static emailLogs: ServerEmailLog[] = [];
  private static readonly MAX_LOGS = 500;

  static getRecentLogs(limit = 100): ServerEmailLog[] {
    return this.emailLogs.slice(-limit).reverse();
  }

  private static remember(entry: ServerEmailLog) {
    this.emailLogs.push(entry);
    if (this.emailLogs.length > this.MAX_LOGS) this.emailLogs.splice(0, this.emailLogs.length - this.MAX_LOGS);
  }

  private static ready(config: EmailTransportConfig): string | null {
    if (!config.enabled) return 'Notification emails are turned off in Master Settings > Organization.';
    if (!config.host) return 'No SMTP server is configured (Master Settings > Organization).';
    if (!config.fromEmail) return 'No sender email is configured (Master Settings > Organization).';
    if (config.user && !config.password) return 'The SMTP password is missing. Enter it again in Master Settings > Organization.';
    return null;
  }

  /** Checks the saved settings can reach and log in to the SMTP server. */
  static async testSmtpConnection(override?: EmailTransportConfig): Promise<{ success: boolean; message: string }> {
    const config = override ?? (await resolveEmailTransport());
    if (!config.host) return { success: false, message: 'No SMTP server is configured.' };
    try {
      await nodemailer.createTransport(transportOptions(config)).verify();
      return { success: true, message: `Connected to ${config.host}:${config.port} and signed in.` };
    } catch (err) {
      return { success: false, message: `Could not connect: ${err instanceof Error ? err.message : 'unknown error'}` };
    }
  }

  static async sendEmail(payload: SendEmailPayload): Promise<{
    success: boolean;
    status: 'delivered' | 'simulated' | 'failed';
    messageId?: string;
    message: string;
    warning?: string;
    log?: ServerEmailLog;
  }> {
    const { to, toName, cc, subject, html, text, category, eventType, referenceId } = payload;
    const config = await resolveEmailTransport();

    // Organization-wide CC / BCC (never added to SECURITY emails such as password resets).
    const copies = mergeCopies(to, Array.isArray(cc) ? cc : undefined, await activeCopyAddresses(), category);

    const logEntry: ServerEmailLog = {
      id: `mail-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      to,
      toName,
      cc: copies.cc.length ? copies.cc : undefined,
      bcc: copies.bcc.length ? copies.bcc : undefined,
      subject,
      status: 'sent',
      referenceId,
      category,
    };

    const notReady = this.ready(config);
    if (notReady) {
      logEntry.status = 'simulated';
      logEntry.error = notReady;
      this.remember(logEntry);
      console.log(`[EMAIL NOT SENT] ${notReady} To: ${to} | Subject: "${subject}" | Event: ${eventType || 'GENERAL'}`);
      return { success: true, status: 'simulated', message: notReady, log: logEntry };
    }

    try {
      const info = await nodemailer.createTransport(transportOptions(config)).sendMail({
        from: { name: config.fromName, address: config.fromEmail },
        to: toName ? { name: toName, address: to } : to,
        cc: copies.cc.length ? copies.cc : undefined,
        bcc: copies.bcc.length ? copies.bcc : undefined,
        replyTo: config.replyTo || undefined,
        subject,
        text: text || undefined,
        html: html || undefined,
      });
      logEntry.status = 'delivered';
      logEntry.messageId = info.messageId;
      this.remember(logEntry);
      return { success: true, status: 'delivered', messageId: info.messageId, message: `Email sent to ${to}.` };
    } catch (err) {
      const reason = err instanceof Error ? err.message : 'SMTP dispatch failed';
      console.error('[EMAIL FAILED]', reason);
      logEntry.status = 'failed';
      logEntry.error = reason;
      this.remember(logEntry);
      return { success: false, status: 'failed', message: `Email could not be sent: ${reason}`, log: logEntry };
    }
  }
}
