import nodemailer from 'nodemailer';
import { env } from '../config/env';
import { logger } from './logger';

const smtpSettings =
  env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASSWORD && env.SMTP_FROM
    ? {
        host: env.SMTP_HOST,
        port: env.SMTP_PORT,
        user: env.SMTP_USER,
        password: env.SMTP_PASSWORD,
        from: env.SMTP_FROM,
      }
    : null;

const transporter = smtpSettings
  ? nodemailer.createTransport({
      host: smtpSettings.host,
      port: smtpSettings.port,
      secure: smtpSettings.port === 465,
      auth: { user: smtpSettings.user, pass: smtpSettings.password },
    })
  : null;

export const isMailConfigured = () => !!smtpSettings;

export async function sendPasswordSetupEmail(to: string, name: string, link: string) {
  if (!transporter || !smtpSettings) return false;

  try {
    await transporter.sendMail({
      from: smtpSettings.from,
      to,
      subject: 'Set up your Fleet-Pulse account',
      text: `Hello ${name},\n\nYour Fleet-Pulse account is ready. Set your password using this one-time link (expires in 24 hours):\n\n${link}\n\nIf you were not expecting this invitation, you can ignore this email.`,
    });
    return true;
  } catch {
    logger.error('Could not deliver a Fleet-Pulse password setup email');
    return false;
  }
}
