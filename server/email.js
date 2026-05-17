// Поддержка двух провайдеров: Brevo (приоритет) и Resend (фолбэк)

let provider = null;

function getProvider() {
  if (provider) return provider;

  // 1. Brevo (ex-Sendinblue) — бесплатно 300 писем/день, любые получатели
  const brevoKey = process.env.BREVO_API_KEY;
  if (brevoKey) {
    provider = {
      name: 'Brevo',
      async send(to, subject, html, fromName) {
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

  // 2. Resend — фолбэк
  const resendKey = process.env.RESEND_API_KEY;
  if (resendKey) {
    let resendClient = null;
    provider = {
      name: 'Resend',
      async send(to, subject, html, fromName) {
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
