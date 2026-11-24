import nodemailer from 'nodemailer';

export interface PasswordResetEmailPayload {
  to: string;
  recipientName: string;
  resetUrl: string;
  expiresInMinutes: number;
}

export interface EmailSender {
  sendPasswordResetEmail: (payload: PasswordResetEmailPayload) => Promise<void>;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function createNodemailerSender(): EmailSender {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const smtpPort = Number(process.env.SMTP_PORT || 587);
  const smtpUser = process.env.SMTP_USER?.trim();
  const smtpPass = process.env.SMTP_PASS;
  const smtpSecure =
    process.env.SMTP_SECURE === 'true' || smtpPort === 465;
  const fromAddress =
    process.env.SMTP_FROM?.trim() || 'Presently Portal <no-reply@presently.local>';

  const transporter = smtpHost
    ? nodemailer.createTransport({
        host: smtpHost,
        port: Number.isFinite(smtpPort) ? smtpPort : 587,
        secure: smtpSecure,
        ...(smtpUser && smtpPass
          ? { auth: { user: smtpUser, pass: smtpPass } }
          : {}),
      })
    : nodemailer.createTransport({
        jsonTransport: true,
      });

  return {
    async sendPasswordResetEmail(payload: PasswordResetEmailPayload): Promise<void> {
      const safeName = escapeHtml(payload.recipientName || 'Faculty Member');
      const safeUrl = escapeHtml(payload.resetUrl);
      const minutes = payload.expiresInMinutes;

      const textBody = [
        `Hello ${payload.recipientName || 'Faculty Member'},`,
        '',
        'We received a request to reset your Presently (BTEB Academic Portal) password.',
        `Use the secure link below within ${minutes} minutes to set a new password:`,
        '',
        payload.resetUrl,
        '',
        'If you did not request this reset, you can safely ignore this email. Your existing password remains unchanged.',
      ].join('\n');

      const htmlBody = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; max-width: 560px; margin: 0 auto; padding: 24px; border: 1px solid #e2e8f0; border-radius: 12px; background: #ffffff;">
          <div style="margin-bottom: 16px; padding-bottom: 12px; border-bottom: 1px solid #e2e8f0;">
            <strong style="font-size: 16px; color: #0f172a;">Presently · BTEB Academic Portal</strong>
          </div>
          <p style="font-size: 14px; line-height: 1.6; margin: 0 0 12px;">Hello ${safeName},</p>
          <p style="font-size: 14px; line-height: 1.6; margin: 0 0 18px; color: #334155;">
            We received a request to reset the password for your institutional account. Click the button below within <strong>${minutes} minutes</strong> to choose a new password.
          </p>
          <div style="margin: 22px 0;">
            <a href="${safeUrl}" style="display: inline-block; background-color: #059669; color: #ffffff; text-decoration: none; font-weight: 600; font-size: 14px; padding: 11px 20px; border-radius: 8px;">
              Reset Password
            </a>
          </div>
          <p style="font-size: 12px; line-height: 1.6; color: #64748b; word-break: break-all; margin: 0 0 16px;">
            Or copy this link into your browser:<br />
            <a href="${safeUrl}" style="color: #059669;">${safeUrl}</a>
          </p>
          <p style="font-size: 12px; line-height: 1.5; color: #64748b; margin: 0; padding-top: 12px; border-top: 1px solid #f1f5f9;">
            This link expires in ${minutes} minutes and can only be used once. All active sessions will be signed out when your password changes.
          </p>
        </div>
      `.trim();

      const info = await transporter.sendMail({
        from: fromAddress,
        to: payload.to,
        subject: 'Presently Portal — Password Reset Request',
        text: textBody,
        html: htmlBody,
      });

      if (!smtpHost) {
        // Structured server-only delivery notice without exposing unhashed tokens in HTTP responses
        console.info(
          `[AuthMailer:jsonTransport] Password reset email dispatched to ${payload.to} (messageId=${info.messageId})`
        );
      }
    },
  };
}
