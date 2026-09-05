// Sign-in email (OTP delivery) via SMTP, ported from iq-mermaid's lib/mail.ts.
// Reads SMTP_HOST/PORT/USER/PASS + FROM_EMAIL. Without SMTP config the send is
// silently skipped (dev-friendly) — the endpoint still stores the challenge.
import nodemailer from "nodemailer";

export async function sendOtpEmail(email: string, code: string, brand = "IQ Translate"): Promise<void> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    console.warn(`[auth] SMTP not configured — sign-in code for ${email} not emailed`);
    return;
  }
  const port = Number(process.env.SMTP_PORT || 587);
  const transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 15_000,
  });
  const from = process.env.FROM_EMAIL || "noreply@iq-rest.com";
  await transporter.sendMail({
    from,
    to: email,
    subject: `${brand} — your sign-in code: ${code}`,
    text: `Your ${brand} sign-in code is ${code}. It expires in 5 minutes.\n\nIf you didn't ask for a code, you can ignore this email.`,
    html: `<div style="font-family:system-ui,sans-serif"><p>Your ${brand} sign-in code is:</p><p style="font-size:40px;font-weight:bold;letter-spacing:8px">${code}</p><p>It expires in 5 minutes.</p><p>If you didn't ask for a code, you can ignore this email.</p></div>`,
  });
}
