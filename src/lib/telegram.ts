import https from 'https';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const BASE_URL = `https://api.telegram.org/bot${BOT_TOKEN}`;

function telegramRequest(method: string, data: Record<string, unknown>): Promise<void> {
  if (!BOT_TOKEN) {
    console.log('[Telegram] No bot token, skipping');
    return Promise.resolve();
  }
  
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify(data);
    const req = https.request(`${BASE_URL}/${method}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, (res) => {
      let body = '';
      res.on('data', chunk => body += chunk);
      res.on('end', () => {
        const result = JSON.parse(body);
        if (result.ok) resolve();
        else reject(new Error(result.description));
      });
    });
    req.on('error', reject);
    req.write(postData);
    req.end();
  });
}

export function sendTelegramMagicLink(telegramId: string, link: string): Promise<void> {
  const text = `🔑 *Kontraktor — Account Login*\n\nClick the button below to sign in:\n\nThe link is valid for 15 minutes.`;
  
  return telegramRequest('sendMessage', {
    chat_id: telegramId,
    text,
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [[{ text: '🔓 Sign in to Kontraktor', url: link }]]
    }
  });
}

export function sendNewBidNotification(chatId: string, projectTitle: string, contractorName: string, price: string | null): Promise<void> {
  const priceText = price ? `\n💰 Price: *Rp ${price}*` : '';
  const text = `🔨 *New Bid on Kontraktor*\n\n📋 Project: *${projectTitle}*\n👷 Contractor: *${contractorName}*${priceText}\n\nView project to review the bid.`;
  
  return telegramRequest('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  });
}

export function sendBidAcceptedNotification(chatId: string, projectTitle: string, contractorName: string): Promise<void> {
  const text = `✅ *Bid Accepted on Kontraktor*\n\n📋 Project: *${projectTitle}*\n👷 Contractor: *${contractorName}*\n\nProject status changed to *In Progress*.`;
  
  return telegramRequest('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  });
}

export function sendPaymentSuccessNotification(chatId: string, contractorName: string, amount: number, credits: number): Promise<void> {
  const text = `💰 *Payment Received on Kontraktor (Sandbox)*\n\n👷 Contractor: *${contractorName}*\n💵 Amount: *Rp ${amount.toLocaleString('id-ID')}*\n🔋 Credits Added: *+${credits}*`;
  
  return telegramRequest('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: 'Markdown',
  });
}
