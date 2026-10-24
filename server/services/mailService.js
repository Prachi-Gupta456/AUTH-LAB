import transporter from '../config/nodemailer.js';

// One place for all email wording. Adding a new purpose later = add one entry here.
const TEMPLATES = {
  email_verify: {
    subject: 'Verify your email',
    intro: 'Use this OTP to verify your email address.',
  },
  login: {
    subject: 'Your login OTP',
    intro: 'Use this OTP to log in to your account.',
  },
  password_reset: {
    subject: 'Password Reset OTP',
    intro: 'Use this OTP to reset your password.',
  },
};

export const sendOtpMail = async ({ to, otp, purpose }) => {
  const { subject, intro } = TEMPLATES[purpose];
  const minutes = Number(process.env.OTP_TTL_MINUTES || 10);

  await transporter.sendMail({
    from: `"Auth Lab" <${process.env.EMAIL}>`, // shows "Auth Lab" instead of a raw address
    to,
    subject,
    // Plain-text fallback (for clients that block HTML)
    text: `${intro}\n\nYour OTP is ${otp}. It expires in ${minutes} minutes.\n\nIf you did not request this, you can ignore this email.`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:420px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px">
        <h2 style="margin:0 0 12px">${subject}</h2>
        <p style="color:#555">${intro}</p>
        <p style="font-size:32px;letter-spacing:8px;font-weight:bold;margin:20px 0">${otp}</p>
        <p style="color:#888;font-size:13px">Expires in ${minutes} minutes. If you did not request this, ignore this email.</p>
      </div>`,
  });
};

// Escape everything we put into HTML: UA/IP strings come from the outside world
const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export const sendSecurityAlert = async ({ to, subject, lines }) => {
  await transporter.sendMail({
    from: `"Auth Lab Security" <${process.env.EMAIL}>`,
    to,
    subject,
    text: lines.join('\n'),
    html: `<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;padding:24px;border:1px solid #eee;border-radius:12px">
      <h2 style="margin:0 0 12px">${esc(subject)}</h2>
      ${lines.map((l) => `<p style="color:#444">${esc(l)}</p>`).join('')}
    </div>`,
  });
};