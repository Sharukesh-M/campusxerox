import tls from 'tls';

/**
 * ============================================================
 * CampusXerox — Automated Messaging Service
 * 1. CallMeBot WhatsApp (Free Automated WhatsApp)
 * 2. Gmail SMTP Native SSL/TLS Client (500 Free Emails / Day)
 *    Zero npm package dependencies, 0 bundler warnings!
 * ============================================================
 */

/**
 * Send an automated WhatsApp message via CallMeBot API.
 */
export async function sendCallMeBotWhatsApp({
  phone,
  message,
}: {
  phone: string;
  message: string;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const apiKey = process.env.CALLMEBOT_API_KEY;
    if (!apiKey) {
      console.warn('CallMeBot WhatsApp skipped: CALLMEBOT_API_KEY is not configured in .env.local');
      return { success: false, error: 'CALLMEBOT_API_KEY missing' };
    }

    let cleanPhone = phone.replace(/[^0-9]/g, '');
    if (cleanPhone.length === 10) {
      cleanPhone = `91${cleanPhone}`;
    }

    const encodedMessage = encodeURIComponent(message);
    const url = `https://api.callmebot.com/whatsapp.php?phone=+${cleanPhone}&text=${encodedMessage}&apikey=${apiKey}`;

    const res = await fetch(url, { method: 'GET' });
    const responseText = await res.text();

    if (res.ok && (responseText.includes('Success') || responseText.includes('queued'))) {
      console.log(`CallMeBot WhatsApp dispatched to +${cleanPhone}`);
      return { success: true };
    } else {
      console.warn(`CallMeBot response: ${responseText}`);
      return { success: true };
    }
  } catch (error) {
    const errMessage = error instanceof Error ? error.message : 'Failed to send CallMeBot message';
    console.error('CallMeBot Error:', errMessage);
    return { success: false, error: errMessage };
  }
}

/**
 * Send a real email via Gmail SMTP using native Node.js TLS (smtp.gmail.com:465).
 * 100% Native Node.js built-in TLS client — zero npm dependencies!
 */
export async function sendEmailNotification({
  to,
  subject,
  html,
  text,
}: {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}): Promise<{ success: boolean; error?: string }> {
  const user = process.env.GMAIL_USER || 'sharukeshmurugesan@gmail.com';
  const pass = process.env.GMAIL_APP_PASSWORD;

  if (!pass) {
    console.warn('Gmail notification skipped: GMAIL_APP_PASSWORD missing in .env.local');
    return { success: false, error: 'GMAIL_APP_PASSWORD missing' };
  }

  return new Promise((resolve) => {
    try {
      const socket = tls.connect(465, 'smtp.gmail.com', { rejectUnauthorized: false }, () => {
        let step = 0;

        const sendCmd = (cmd: string) => {
          socket.write(cmd + '\r\n');
        };

        socket.on('data', (data) => {
          const resp = data.toString();

          if (step === 0 && resp.startsWith('220')) {
            step = 1;
            sendCmd(`EHLO localhost`);
          } else if (step === 1 && resp.startsWith('250')) {
            step = 2;
            sendCmd(`AUTH LOGIN`);
          } else if (step === 2 && resp.startsWith('334')) {
            step = 3;
            sendCmd(Buffer.from(user).toString('base64'));
          } else if (step === 3 && resp.startsWith('334')) {
            step = 4;
            sendCmd(Buffer.from(pass.replace(/\s+/g, '')).toString('base64'));
          } else if (step === 4 && resp.startsWith('235')) {
            step = 5;
            sendCmd(`MAIL FROM:<${user}>`);
          } else if (step === 5 && resp.startsWith('250')) {
            step = 6;
            sendCmd(`RCPT TO:<${to}>`);
          } else if (step === 6 && resp.startsWith('250')) {
            step = 7;
            sendCmd(`DATA`);
          } else if (step === 7 && resp.startsWith('354')) {
            step = 8;
            const bodyText = text || html?.replace(/<[^>]*>/g, '') || '';
            const bodyHtml = html || `<p>${bodyText}</p>`;
            const emailMessage = [
              `From: "CampusXerox" <${user}>`,
              `To: <${to}>`,
              `Subject: ${subject}`,
              `MIME-Version: 1.0`,
              `Content-Type: text/html; charset=utf-8`,
              ``,
              bodyHtml,
              `.`,
            ].join('\r\n');
            sendCmd(emailMessage);
          } else if (step === 8 && resp.startsWith('250')) {
            step = 9;
            sendCmd(`QUIT`);
            console.log(`✅ Real Gmail email sent successfully to ${to} for "${subject}"!`);
            socket.end();
            resolve({ success: true });
          }
        });

        socket.on('error', (err) => {
          console.error('Gmail TLS socket error:', err.message);
          resolve({ success: false, error: err.message });
        });
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown Gmail error';
      console.error('Gmail SMTP exception:', msg);
      resolve({ success: false, error: msg });
    }
  });
}
