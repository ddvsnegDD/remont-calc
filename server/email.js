import { Resend } from 'resend';

let resend = null;

function getClient() {
  if (resend) return resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.warn('⚠️  RESEND_API_KEY не задан — коды будут только в логе сервера');
    return null;
  }
  resend = new Resend(key);
  return resend;
}

export async function sendAuthCode(email, code) {
  console.log(`📧 Код для ${email}: ${code}`);
  const client = getClient();
  if (!client) return; // fallback: code is in server logs
  try {
    const fromEmail = process.env.EMAIL_FROM || 'onboarding@resend.dev';
    await client.emails.send({
      from: `РПКМ <${fromEmail}>`,
      to: email,
      subject: `${code} — код входа в РПКМ`,
      html: `
        <div style="font-family:Inter,Arial,sans-serif;max-width:400px;margin:0 auto;padding:32px">
          <h2 style="color:#1A1A1C;margin:0 0 8px">Ваш код входа</h2>
          <div style="font-size:36px;font-weight:800;color:#B95C38;letter-spacing:6px;margin:16px 0">${code}</div>
          <p style="color:#6B7280;font-size:14px;line-height:1.6">Код действует 10 минут. Если вы не запрашивали вход — просто проигнорируйте это письмо.</p>
          <hr style="border:none;border-top:1px solid #E4E4E7;margin:24px 0">
          <p style="color:#9CA3AF;font-size:12px">РПКМ · Калькулятор ремонта</p>
        </div>
      `,
    });
    console.log(`✉️  Email отправлен на ${email}`);
  } catch (err) {
    console.error('Email send error:', err.message);
  }
}
