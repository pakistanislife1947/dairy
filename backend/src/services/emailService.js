const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST,
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendVerificationEmail(to, name, token) {
  const url = `${process.env.CLIENT_URL}/verify-email?token=${token}`;
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM || 'Dairy ERP <noreply@dairy.local>',
    to,
    subject: 'Verify Your Email — Dairy ERP',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#1e40af">🥛 Dairy ERP</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>Click the button below to verify your email address. This link expires in <strong>24 hours</strong>.</p>
        <a href="${url}" style="display:inline-block;padding:12px 28px;background:#1e40af;color:#fff;
           text-decoration:none;border-radius:6px;font-weight:600;margin:16px 0">
          Verify Email
        </a>
        <p style="color:#6b7280;font-size:12px">If you did not create this account, ignore this email.</p>
      </div>`,
  });
}

async function sendPasswordResetEmail(to, name, token) {
  const url = `${process.env.CLIENT_URL}/reset-password?token=${token}`;
  await transporter.sendMail({
    from:    process.env.EMAIL_FROM,
    to,
    subject: 'Password Reset — Dairy ERP',
    html: `
      <div style="font-family:sans-serif;max-width:480px;margin:0 auto;padding:32px">
        <h2 style="color:#1e40af">🥛 Dairy ERP</h2>
        <p>Hi <strong>${name}</strong>,</p>
        <p>You requested a password reset. Click below (expires in <strong>1 hour</strong>):</p>
        <a href="${url}" style="display:inline-block;padding:12px 28px;background:#dc2626;color:#fff;
           text-decoration:none;border-radius:6px;font-weight:600;margin:16px 0">
          Reset Password
        </a>
        <p style="color:#6b7280;font-size:12px">If you did not request this, ignore this email.</p>
      </div>`,
  });
}

module.exports = { sendVerificationEmail, sendPasswordResetEmail };
