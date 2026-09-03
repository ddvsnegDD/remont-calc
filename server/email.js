// Поддержка провайдеров (по аналогии с VideoAI/VidFlex):
//   SMTP Mail.ru (РФ, основной — работает на VPS) → UniSender Go (HTTP, для Railway) → Brevo → Resend
import nodemailer from 'nodemailer';

let provider = null;
let smtpTransporter = null;

function getProvider() {
  if (provider) return provider;

  // 0. SMTP Mail.ru (Россия, серверы в РФ) — как на VideoAI/VidFlex. Требует открытых SMTP-портов (VPS, не Railway)
  const smtpUser = process.env.SMTP_USER;
  const smtpPass = process.env.SMTP_PASS;
  if (smtpUser && smtpPass) {
    const host = process.env.SMTP_HOST || 'smtp.mail.ru';
    const port = Number(process.env.SMTP_PORT || 587);
    provider = {
      name: 'SMTP Mail.ru',
      async send(to, subject, html, fromName, replyTo) {
        if (!smtpTransporter) {
          smtpTransporter = nodemailer.createTransport({
            host,
            port,
            secure: port === 465,       // 465 = SSL, 587 = STARTTLS
            requireTLS: port === 587,
            auth: { user: smtpUser, pass: smtpPass },
          });
        }
        const fromEmail = process.env.EMAIL_FROM || smtpUser;
        await smtpTransporter.sendMail({
          from: `"${fromName}" <${fromEmail}>`,
          to,
          subject,
          html,
          ...(replyTo ? { replyTo } : {}),
        });
        return true;
      },
    };
    console.log('📧 Email провайдер: SMTP Mail.ru');
    return provider;
  }

  // 1. UniSender Go (Россия, РФ-юрисдикция) — транзакционный HTTP API, работает на Railway (без SMTP-портов)
  const usgKey = process.env.UNISENDER_GO_API_KEY;
  if (usgKey) {
    // По умолчанию российский сервер go1; при регистрации на другом ДЦ задать UNISENDER_GO_API_URL
    const apiUrl = process.env.UNISENDER_GO_API_URL
      || 'https://go1.unisender.ru/ru/transactional/api/v1/email/send.json';
    provider = {
      name: 'UniSender Go',
      async send(to, subject, html, fromName, replyTo) {
        const fromEmail = process.env.EMAIL_FROM || 'noreply@rpkm.ru';
        const res = await fetch(apiUrl, {
          method: 'POST',
          headers: {
            'X-API-KEY': usgKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: {
              recipients: [{ email: to }],
              subject,
              from_email: fromEmail,
              from_name: fromName,
              ...(replyTo ? { reply_to: replyTo } : {}),
              body: { html },
            },
          }),
        });
        const data = await res.json().catch(() => ({}));
        // UniSender Go возвращает 200 даже при частичных ошибках — проверяем failed
        if (!res.ok || (data.failed_emails && Object.keys(data.failed_emails).length)) {
          throw new Error(`UniSender Go ${res.status}: ${JSON.stringify(data)}`);
        }
        return true;
      },
    };
    console.log('📧 Email провайдер: UniSender Go');
    return provider;
  }

  // 2. Brevo (ex-Sendinblue) — бесплатно 300 писем/день, любые получатели
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    provider = {
      name: 'Brevo',
      async send(to, subject, html, fromName, replyTo) {
        const fromEmail = process.env.EMAIL_FROM || 'noreply@rpkm.ru';
        const res = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoKey,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            sender: { name: fromName, email: fromEmail },
            to: [{ email: to }],
            subject,
            htmlContent: html,
            ...(replyTo ? { replyTo: { email: replyTo } } : {}),
          }),
        });
        if (!res.ok) {
          const err = await res.text();
          throw new Error(`Brevo ${res.status}: ${err}`);
        }
        return true;
      },
    };
    console.log('📧 Email провайдер: Brevo');
    return provider;
  }

  // 3. Resend — фолбэк
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    let resendClient = null;
    provider = {
      name: 'Resend',
      async send(to, subject, html, fromName, replyTo) {
        if (!resendClient) {
          const { Resend } = await import('resend');
          resendClient = new Resend(resendKey);
        }
        const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
        await resendClient.emails.send({
          from: `${fromName} <${fromEmail}>`,
          to,
          subject,
          html,
          ...(replyTo ? { replyTo } : {}),
        });
        return true;
      },
    };
    console.log('📧 Email провайдер: Resend');
    return provider;
  }

  console.warn('⚠️  Ни BREVO_API_KEY, ни RESEND_API_KEY не заданы — коды будут только в логе сервера');
  return null;
}

// Отправить произвольное письмо (для уведомлений админу и т.д.)
// Возвращает true, если письмо ушло, иначе false. Не бросает исключений:
// вызывающий код сам решает, важен ли ему результат отправки.
// replyTo необязателен: нужен там, где на письмо должны отвечать не нам,
// а отправителю (форма обратной связи).
export async function sendRawEmail(to, subject, html, replyTo) {
  const p = getProvider();
  if (!p) { console.log(`📧 [no provider] To: ${to}, Subject: ${subject}`); return false; }
  try {
    await p.send(to, subject, html, 'РПКМ', replyTo);
    console.log(`✉️  Уведомление отправлено на ${to}`);
    return true;
  } catch (err) {
    console.error(`sendRawEmail error:`, err.message);
    return false;
  }
}

export async function sendAuthCode(email, code) {
  console.log(`📧 Код для ${email}: ${code}`);
  const p = getProvider();
  if (!p) return; // fallback: code is in server logs

  try {
    await p.send(
      email,
      `${code} — код входа в РПКМ`,
      `
        <div style="font-family:Inter,Arial,sans-serif;max-width:400px;margin:0 auto;padding:32px">
          <h2 style="color:#1A1A1C;margin:0 0 8px">Ваш код входа</h2>
          <div style="font-size:36px;font-weight:800;color:#B95C38;letter-spacing:6px;margin:16px 0">${code}</div>
          <p style="color:#6B7280;font-size:14px;line-height:1.6">Код действует 10 минут. Если вы не запрашивали вход — просто проигнорируйте это письмо.</p>
          <hr style="border:none;border-top:1px solid #E4E4E7;margin:24px 0">
          <p style="color:#9CA3AF;font-size:12px">РПКМ · Калькулятор ремонта</p>
        </div>
      `,
      'РПКМ',
    );
    console.log(`✉️  Email отправлен через ${p.name} на ${email}`);
  } catch (err) {
    console.error(`Email send error (${p?.name}):`, err.message);
  }
}
