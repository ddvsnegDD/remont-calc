import nodemailer from 'nodemailer';

let transporter = null;

function getTransporter() {
  if (transporter) return transporter;
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    console.warn('⚠️  SMTP не настроен — коды будут только в логе сервера');
    return null;
  }
  transporter = nodemailer.createTransport({
    host,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: true,
    auth: { user, pass },
    family: 4, // force IPv4 — Railway не поддерживает IPv6 к Яндексу
  });
  return transporter;
}

export async function sendAuthCode(email, code) {
  console.log(`📧 Код для ${email}: ${code}`);
  const t = getTransporter();
  if (!t) return; // fallback: code is in server logs
  try {
    await t.sendMail({
      from: `"РПКМ" <${process.env.SMTP_USER}>`,
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
