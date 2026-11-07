const nodemailer = require("nodemailer");

/**
 * Send an email.
 * - With SMTP_* configured → actually sends the mail.
 * - Without (typical dev) → logs it to the server console so the
 *   forgot-password flow stays fully testable locally.
 */
const sendEmail = async ({ to, subject, text, html }) => {
  if (process.env.SMTP_HOST) {
    const transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT) || 587,
      secure: Number(process.env.SMTP_PORT) === 465,
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    });

    const info = await transporter.sendMail({
      from: process.env.MAIL_FROM || "WorkFlow <no-reply@workflow.local>",
      to,
      subject,
      text,
      html,
    });
    return { delivered: true, messageId: info.messageId };
  }

  // Dev fallback: no SMTP configured.
  console.log("───────── [dev email] ─────────────────────────");
  console.log(`To:      ${to}`);
  console.log(`Subject: ${subject}`);
  console.log(text);
  console.log("───────────────────────────────────────────────");
  return { delivered: false, dev: true };
};

module.exports = { sendEmail };
