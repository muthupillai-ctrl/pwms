import nodemailer from 'nodemailer';
import { env } from '../../config/env';
import { logger } from '../../utils/logger';

const transporter = nodemailer.createTransport({
  host: 'smtp.gmail.com',
  port: 587,
  secure: false,
  auth: {
    user: env.smtp.user,
    pass: env.smtp.pass,
  },
});

logger.info('SMTP transporter created', {
  host: 'smtp.gmail.com',
  port: 587,
  user: env.smtp.user,
  passLength: env.smtp.pass.length,
  from: env.smtp.from,
});

export async function sendOtpEmail(to: string, otp: string, fullName: string): Promise<void> {
  logger.debug('sendOtpEmail: verifying SMTP connection…');
  try {
    await transporter.verify();
    logger.debug('sendOtpEmail: SMTP connection OK');
  } catch (verifyErr: unknown) {
    const msg = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
    logger.error('sendOtpEmail: SMTP verify failed', { error: msg });
    throw verifyErr;
  }

  logger.debug('sendOtpEmail: sending mail', { to, otpLength: otp.length, from: env.smtp.from });

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;background:linear-gradient(135deg,#3B82F6,#1D4ED8);border-radius:12px;padding:12px 18px">
          <span style="color:white;font-size:1.25rem;font-weight:700;letter-spacing:1px">PWMS</span>
        </div>
      </div>
      <div style="background:white;border-radius:10px;padding:28px 24px;border:1px solid #E2E8F0">
        <h2 style="margin:0 0 8px;font-size:1.25rem;font-weight:700;color:#0F172A">Verify your email</h2>
        <p style="margin:0 0 24px;font-size:0.9375rem;color:#475569">Hi ${fullName}, use the code below to complete your PWMS registration.</p>
        <div style="background:#F1F5F9;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px">
          <span style="font-size:2.25rem;font-weight:700;letter-spacing:10px;color:#1D4ED8">${otp}</span>
        </div>
        <p style="margin:0;font-size:0.8125rem;color:#94A3B8">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
      </div>
      <p style="text-align:center;font-size:0.75rem;color:#94A3B8;margin-top:20px">Personal Wealth Management System</p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: env.smtp.from,
      to,
      subject: 'Your PWMS verification code',
      html,
    });
    logger.info('OTP email sent', { to, messageId: info.messageId, response: info.response });
  } catch (sendErr: unknown) {
    const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
    logger.error('sendOtpEmail: sendMail failed', { to, error: msg });
    throw sendErr;
  }
}

export async function sendPasswordResetEmail(to: string, otp: string, fullName: string): Promise<void> {
  logger.debug('sendPasswordResetEmail: verifying SMTP connection…');
  try {
    await transporter.verify();
    logger.debug('sendPasswordResetEmail: SMTP connection OK');
  } catch (verifyErr: unknown) {
    const msg = verifyErr instanceof Error ? verifyErr.message : String(verifyErr);
    logger.error('sendPasswordResetEmail: SMTP verify failed', { error: msg });
    throw verifyErr;
  }

  logger.debug('sendPasswordResetEmail: sending mail', { to, from: env.smtp.from });

  const html = `
    <div style="font-family:Inter,Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;background:#f8fafc;border-radius:12px">
      <div style="text-align:center;margin-bottom:24px">
        <div style="display:inline-block;background:linear-gradient(135deg,#3B82F6,#1D4ED8);border-radius:12px;padding:12px 18px">
          <span style="color:white;font-size:1.25rem;font-weight:700;letter-spacing:1px">PWMS</span>
        </div>
      </div>
      <div style="background:white;border-radius:10px;padding:28px 24px;border:1px solid #E2E8F0">
        <h2 style="margin:0 0 8px;font-size:1.25rem;font-weight:700;color:#0F172A">Reset your password</h2>
        <p style="margin:0 0 24px;font-size:0.9375rem;color:#475569">Hi ${fullName}, use the code below to reset your PWMS password.</p>
        <div style="background:#FEF2F2;border-radius:8px;padding:20px;text-align:center;margin-bottom:24px;border:1px solid #FECACA">
          <span style="font-size:2.25rem;font-weight:700;letter-spacing:10px;color:#DC2626">${otp}</span>
        </div>
        <p style="margin:0 0 12px;font-size:0.8125rem;color:#94A3B8">This code expires in <strong>10 minutes</strong>. Do not share it with anyone.</p>
        <p style="margin:0;font-size:0.8125rem;color:#94A3B8">If you did not request a password reset, you can safely ignore this email.</p>
      </div>
      <p style="text-align:center;font-size:0.75rem;color:#94A3B8;margin-top:20px">Personal Wealth Management System</p>
    </div>
  `;

  try {
    const info = await transporter.sendMail({
      from: env.smtp.from,
      to,
      subject: 'Reset your PWMS password',
      html,
    });
    logger.info('Password reset email sent', { to, messageId: info.messageId });
  } catch (sendErr: unknown) {
    const msg = sendErr instanceof Error ? sendErr.message : String(sendErr);
    logger.error('sendPasswordResetEmail: sendMail failed', { to, error: msg });
    throw sendErr;
  }
}
