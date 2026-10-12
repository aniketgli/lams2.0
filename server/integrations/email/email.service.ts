import nodemailer from 'nodemailer';
import { envConfig } from '../../config/env.config';
import { ServerEmailLog, SendEmailPayload, SmtpConfigPayload } from './email.types';

export class EmailService {
  private static emailLogs: ServerEmailLog[] = [];

  static getRecentLogs(limit = 100): ServerEmailLog[] {
    return this.emailLogs.slice(-limit).reverse();
  }

  static async testSmtpConnection(config?: SmtpConfigPayload): Promise<{ success: boolean; message: string }> {
    const host = config?.host || envConfig.smtpHost;
    const port = Number(config?.port || envConfig.smtpPort || 587);
    const secure = config?.secure !== undefined ? Boolean(config.secure) : envConfig.smtpSecure;
    const user = config?.user || envConfig.smtpUser;
    const pass = config?.pass || envConfig.smtpPass;

    if (!host || !user || !pass) {
      throw new Error('Incomplete SMTP credentials. Host, username/email, and password are required.');
    }

    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
      connectionTimeout: 10000
    });

    await transporter.verify();
    return { success: true, message: `SMTP connection established successfully to ${host}:${port}` };
  }

  static async sendEmail(payload: SendEmailPayload): Promise<{
    success: boolean;
    status: 'delivered' | 'simulated' | 'failed';
    messageId?: string;
    message: string;
    warning?: string;
    log?: ServerEmailLog;
  }> {
    const { to, toName, cc, subject, html, text, smtpConfig, category, eventType, referenceId } = payload;

    const host = smtpConfig?.host || envConfig.smtpHost;
    const port = Number(smtpConfig?.port || envConfig.smtpPort || 587);
    const secure = smtpConfig?.secure !== undefined ? Boolean(smtpConfig.secure) : envConfig.smtpSecure;
    const user = smtpConfig?.user || envConfig.smtpUser;
    const pass = smtpConfig?.pass || envConfig.smtpPass;
    const fromEmail = smtpConfig?.fromEmail || envConfig.emailFrom;
    const fromName = smtpConfig?.fromName || envConfig.emailFromName;

    const logEntry: ServerEmailLog = {
      id: `mail-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      timestamp: new Date().toISOString(),
      to,
      toName,
      cc: Array.isArray(cc) ? cc : undefined,
      subject,
      status: 'sent',
      referenceId,
      category
    };

    if (host && user && pass) {
      try {
        const transporter = nodemailer.createTransport({
          host,
          port,
          secure,
          auth: { user, pass },
          tls: { rejectUnauthorized: false }
        });

        const info = await transporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to: toName ? `"${toName}" <${to}>` : to,
          cc: Array.isArray(cc) && cc.length > 0 ? cc.join(', ') : undefined,
          subject,
          text: text || undefined,
          html: html || undefined
        });

        logEntry.status = 'delivered';
        logEntry.messageId = info.messageId;
        this.emailLogs.push(logEntry);

        return {
          success: true,
          status: 'delivered',
          messageId: info.messageId,
          message: `Email dispatched successfully via ${host} to ${to}`
        };
      } catch (err: any) {
        console.error('Nodemailer Send Error:', err);
        logEntry.status = 'failed';
        logEntry.error = err?.message || 'SMTP dispatch failed';
        this.emailLogs.push(logEntry);

        return {
          success: true,
          status: 'simulated',
          warning: `Real SMTP failed (${err?.message}), email recorded in system audit log.`,
          log: logEntry,
          message: `Notification simulated due to SMTP error: ${err?.message}`
        };
      }
    } else {
      logEntry.status = 'simulated';
      this.emailLogs.push(logEntry);

      console.log(`[EMAIL DISPATCH] To: ${to} | Subject: "${subject}" | Event: ${eventType || 'GENERAL'}`);
      return {
        success: true,
        status: 'simulated',
        message: `Notification simulated and recorded to dispatch registry for ${to}`,
        log: logEntry
      };
    }
  }
}
