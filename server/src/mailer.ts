import nodemailer from 'nodemailer';

/**
 * Sends the one-time sign-in codes. Without SMTP_HOST the code is printed to the server log instead (development and
 * tests); production must set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS and MAIL_FROM (the sender's domain needs SPF
 * and DKIM, or the mail lands in spam). The tests swap the sender with setMailer().
 */
export type SendCode = (email: string, code: string, lang: 'fa' | 'en') => Promise<void>;

export const maskEmail = (email: string) => {
  const [user, domain] = email.split('@');
  return `${user.slice(0, Math.min(3, Math.max(1, user.length - 1)))}•••@${domain}`;
};

const TEXT = {
  en: { subject: (c: string) => `Grid Rush sign-in code: ${c}`, body: (c: string) => `Your Grid Rush sign-in code is ${c}.\nIt works for 10 minutes. If you did not ask for it, ignore this email.` },
  fa: { subject: (c: string) => `کد ورود نقش‌آرا: ${c}`, body: (c: string) => `کد ورود نقش‌آرا: ${c}\nاین کد ۱۰ دقیقه اعتبار دارد. اگر آن را درخواست نکرده‌ای، این ایمیل را نادیده بگیر.` },
};

function smtpSender(): SendCode {
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587),
    secure: Number(process.env.SMTP_PORT) === 465,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });
  return async (email, code, lang) => {
    const t = TEXT[lang];
    const dir = lang === 'fa' ? 'rtl' : 'ltr';
    await transport.sendMail({
      from: process.env.MAIL_FROM || 'Grid Rush <no-reply@jollypanda.games>', to: email,
      subject: t.subject(code), text: t.body(code),
      // plain and link-free on purpose: links in sign-in mail look like phishing
      html: `<div dir="${dir}" style="font-family:sans-serif;font-size:16px">${t.body(code).replace('\n', '<br>').replace(code, `<b style="font-size:28px;letter-spacing:4px">${code}</b>`)}</div>`,
    });
  };
}

const logSender: SendCode = async (email, code) => { console.log(`[mail] code for ${maskEmail(email)}: ${code}`); };

let sender: SendCode = process.env.SMTP_HOST ? smtpSender() : logSender;
if (!process.env.SMTP_HOST && process.env.NODE_ENV === 'production') {
  console.warn('[mail] SMTP_HOST is not set: email sign-in codes are only written to this log');
}

export const sendLoginCode: SendCode = (email, code, lang) => sender(email, code, lang);
/** Tests: capture the codes instead of sending them. */
export function setMailer(s: SendCode) { sender = s; }
