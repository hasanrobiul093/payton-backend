import * as nodemailer from 'nodemailer';

/**
 * Create a reusable SMTP transporter using environment variables.
 */
function createTransporter() {
    return nodemailer.createTransport({
        host: process.env.EMAIL_HOST,
        port: Number(process.env.EMAIL_PORT) || 587,
        secure: Number(process.env.EMAIL_PORT) === 465,
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASSWORD,
        },
    });
}

/**
 * Send an OTP verification email.
 *
 * @param to    - Recipient email address
 * @param otp   - The 6-digit OTP code
 */
export async function sendOtpEmail(to: string, otp: string, type: 'reset' | 'verify'): Promise<void> {
    const transporter = createTransporter();

    const fromName = process.env.EMAIL_FROM_NAME || 'Payton';
    const fromAddr = process.env.EMAIL_FROM || process.env.EMAIL_USER;

    await transporter.sendMail({
        from: `"${fromName}" <${fromAddr}>`,
        to,
        subject: type === 'reset' ? 'Password Reset OTP' : 'Email Verification OTP',
        text: `Your OTP code is: ${otp}\n\nThis code will expire in 5 minutes.\n\nIf you did not request this, please ignore this email.`,
        html: `
      <div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto; padding: 24px;">
        <h2 style="color: #333;">${type === 'reset' ? 'Password Reset' : 'Email Verification'}</h2>
        <p>You requested a ${type === 'reset' ? 'password reset' : 'email verification'}. Use the following OTP code:</p>
        <div style="background: #f4f4f4; padding: 16px; text-align: center; border-radius: 8px; margin: 16px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 8px; color: #222;">${otp}</span>
        </div>
        <p style="color: #666; font-size: 14px;">This code will expire in <strong>5 minutes</strong>.</p>
        <p style="color: #999; font-size: 12px;">If you did not request this, please ignore this email.</p>
      </div>
    `,
    });
}
