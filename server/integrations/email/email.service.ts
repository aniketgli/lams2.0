import nodemailer from 'nodemailer';
import { ServerEmailLog, SendEmailPayload } from './email.types';
import { activeCopyAddresses, mergeCopies, scopeOfEvent } from '../../masters/notificationRecipients';
import { EmailTransportConfig, resolveEmailTransport, transportOptions } from '../../masters/emailSettings';

/**
 * Sends notification email using the sender / SMTP settings from
 * Master Settings > Organization (falling back to .env). Callers can no
 * longer pass their own SMTP server: an email always goes through the
 * institute's configured server.
 */
/**
 * One pooled SMTP transport is reused for every mail, so a burst (everyone's leave decided at
 * once) shares a few open connections instead of opening a new TCP + TLS connection per mail.
 * It is rebuilt when the sender / server settings change.
 */
let pooled: { key: string; transport: ReturnType<typeof nodemailer.createTransport> } | null = null;
function transportFor(config: EmailTransportConfig) {
  const options = { ...transportOptions(config), pool: true, maxConnections: 3, maxMessages: 100 };
  const key = JSON.stringify(options);
  if (pooled?.key !== key) {
    pooled?.transport.close();
    pooled = { key, transport: nodemailer.createTransport(options) };
  }
  return pooled.transport;
}

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

  /** Why mails cannot be sent with these settings on this server, or null when they can. */
  static notReadyReason(config: EmailTransportConfig): string | null {
    return this.ready(config);
  }

  private static ready(config: EmailTransportConfig): string | null {
    if (!config.enabled) return 'Notification emails are turned off in Master Settings > Organization.';
    if (!config.host) return 'No SMTP server is configured (Master Settings > Organization).';
    if (!config.fromEmail) return 'No sender email is configured (Master Settings > Organization).';
    if (config.user && !config.password) {
      return config.passwordUnreadable
        ? 'The saved SMTP password cannot be read on this server: it was saved where SETTINGS_ENCRYPTION_KEY (or SESSION_SECRET) is different. Use the same SETTINGS_ENCRYPTION_KEY in .env on every machine that shares this database, then enter the password again in Master Settings > Organization.'
        : 'The SMTP password is missing. Enter it again in Master Settings > Organization.';
    }
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
    const { to, toName, cc, subject, html, text, category, eventType, referenceId, attachments } = payload;
    const config = await resolveEmailTransport();

    // Organization-wide CC / BCC (never added to SECURITY emails such as password resets).
    const copies = mergeCopies(to, Array.isArray(cc) ? cc : undefined, await activeCopyAddresses(scopeOfEvent(eventType)), category);

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
      eventType,
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
      const info = await transportFor(config).sendMail({
        from: { name: config.fromName, address: config.fromEmail },
        to: toName ? { name: toName, address: to } : to,
        cc: copies.cc.length ? copies.cc : undefined,
        bcc: copies.bcc.length ? copies.bcc : undefined,
        replyTo: config.replyTo || undefined,
        // System-generated: well-behaved mail servers / auto-responders (vacation replies, out-of-office) must not answer it (RFC 3834).
        headers: { 'Auto-Submitted': 'auto-generated', 'X-Auto-Response-Suppress': 'All', Precedence: 'bulk' },
        subject,
        text: text || undefined,
        html: html || undefined,
        attachments: attachments?.length ? attachments : undefined,
      });
      logEntry.status = 'delivered';
      logEntry.messageId = info.messageId;
      this.remember(logEntry);
      return { success: true, status: 'delivered', messageId: info.messageId, message: `Email sent to ${to}.` };
    } catch (err) {
      const raw = err instanceof Error ? err.message : 'SMTP dispatch failed';
      // 530 / 5.7.0: the server wants a sign-in that was not given (or was refused).
      const reason = /\b530\b|5\.7\.0|authentication required/i.test(raw) && !config.user
        ? `${raw}. The mail server requires sign-in: enter the Username and Password in Master Settings > Organization.`
        : raw;
      console.error('[EMAIL FAILED]', reason);
      logEntry.status = 'failed';
      logEntry.error = reason;
      this.remember(logEntry);
      return { success: false, status: 'failed', message: `Email could not be sent: ${reason}`, log: logEntry };
    }
  }
}
