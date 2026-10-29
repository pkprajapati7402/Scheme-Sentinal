import { config } from '../config.js';
import { getDatabase } from '../store/db.js';
import { SchemeStateRepository, DocumentRepository } from '../store/repositories.js';

export interface InlineKeyboardButton {
  text: string;
  callback_data?: string;
  url?: string;
}

export class TelegramBotClient {
  private token: string;
  private isPolling: boolean = false;

  constructor(token?: string) {
    this.token = token || config.TELEGRAM_BOT_TOKEN;
  }

  get isConfigured(): boolean {
    return Boolean(this.token && this.token.length > 5);
  }

  async sendMessage(
    chatId: string | number,
    text: string,
    keyboard?: InlineKeyboardButton[][]
  ): Promise<any> {
    if (!this.isConfigured) {
      console.log(`[Telegram Mock] To: ${chatId}\n${text}`);
      if (keyboard) {
        console.log(`[Buttons]: ${JSON.stringify(keyboard)}`);
      }
      return { ok: true, mock: true };
    }

    const payload: Record<string, any> = {
      chat_id: chatId,
      text,
    };

    if (keyboard && keyboard.length > 0) {
      payload.reply_markup = {
        inline_keyboard: keyboard,
      };
    }

    const url = `https://api.telegram.org/bot${this.token}/sendMessage`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Telegram API error HTTP ${res.status}: ${errText}`);
    }

    return await res.json();
  }

  async sendReminderWithButtons(
    chatId: string | number,
    text: string,
    schemeId: string,
    sourceUrl: string
  ): Promise<void> {
    const keyboard: InlineKeyboardButton[][] = [
      [
        { text: '✅ I applied', callback_data: `applied:${schemeId}` },
        { text: '⏰ Snooze 3 days', callback_data: `snooze:${schemeId}:3` },
      ],
      [{ text: '🔗 Open official page', url: sourceUrl }],
    ];

    await this.sendMessage(chatId, text, keyboard);
  }

  async startPolling(): Promise<void> {
    if (!this.isConfigured) {
      console.log('[Telegram Bot] Token not set. Running in passive/mock mode.');
      return;
    }

    this.isPolling = true;
    let offset = 0;
    console.log('[Telegram Bot] Starting long polling for updates...');

    const db = getDatabase();
    const stateRepo = new SchemeStateRepository(db);
    const docRepo = new DocumentRepository(db);

    while (this.isPolling) {
      try {
        const url = `https://api.telegram.org/bot${this.token}/getUpdates?offset=${offset}&timeout=30`;
        const res = await fetch(url);
        if (!res.ok) {
          await new Promise((r) => setTimeout(r, 5000));
          continue;
        }

        const data = (await res.json()) as any;
        if (data && data.ok && Array.isArray(data.result)) {
          for (const update of data.result) {
            offset = update.update_id + 1;

            if (update.message?.text) {
              const text = update.message.text.trim();
              const chatId = update.message.chat.id;

              if (text.startsWith('/start')) {
                await this.sendMessage(
                  chatId,
                  `👋 Welcome to Scheme Sentinel!\n\nI watch Indian scholarship sources for you so you never miss a deadline or verification stage.\n\nCommands:\n/status - View watched scholarships\n/docs - Document checklist\n/help - Disclaimer and usage`
                );
              } else if (text.startsWith('/status')) {
                const schemes = stateRepo.listAll();
                if (schemes.length === 0) {
                  await this.sendMessage(chatId, 'No active schemes currently tracked. Run seed first.');
                } else {
                  let reply = '📋 Current Scholarship Status:\n\n';
                  for (const s of schemes) {
                    let deadline = 'TBD';
                    try {
                      const d = JSON.parse(s.deadlinesJson);
                      deadline = d.freshApplication || 'TBD';
                    } catch {}
                    reply += `• ${s.schemeId}\n  Stage: ${s.stage} | Eligibility: ${s.eligibility}\n  Deadline: ${deadline}\n\n`;
                  }
                  await this.sendMessage(chatId, reply);
                }
              } else if (text.startsWith('/docs')) {
                const docs = docRepo.listAll();
                let reply = '📄 Document Checklist:\n\n';
                for (const d of docs) {
                  reply += `• ${d.doc_type}: ${d.status.toUpperCase()}\n`;
                }
                await this.sendMessage(chatId, reply);
              } else if (text.startsWith('/applied')) {
                const parts = text.split(' ');
                const schemeId = parts[1];
                if (schemeId) {
                  const state = stateRepo.findById(schemeId);
                  if (state) {
                    state.stage = 'applied';
                    stateRepo.upsert(state);
                    await this.sendMessage(chatId, `✅ Marked as applied for "${schemeId}". Now tracking verification stages!`);
                  } else {
                    await this.sendMessage(chatId, `Scheme "${schemeId}" not found.`);
                  }
                } else {
                  await this.sendMessage(chatId, 'Usage: /applied <schemeId>');
                }
              } else if (text.startsWith('/help')) {
                await this.sendMessage(
                  chatId,
                  `🛡️ Scheme Sentinel Help:\n\nIndependent student project. Not affiliated with any government portal. Dates and eligibility may change. Always verify on the official portal before acting.`
                );
              }
            } else if (update.callback_query) {
              const cq = update.callback_query;
              const data = cq.data;
              const chatId = cq.message.chat.id;

              if (data.startsWith('applied:')) {
                const schemeId = data.replace('applied:', '');
                const state = stateRepo.findById(schemeId);
                if (state) {
                  state.stage = 'applied';
                  stateRepo.upsert(state);
                  await this.sendMessage(chatId, `✅ Marked "${schemeId}" as applied!`);
                }
              } else if (data.startsWith('snooze:')) {
                await this.sendMessage(chatId, `⏰ Reminders snoozed for 3 days.`);
              }
            }
          }
        }
      } catch (err: any) {
        console.error('Polling error:', err.message);
        await new Promise((r) => setTimeout(r, 5000));
      }
    }
  }

  stopPolling(): void {
    this.isPolling = false;
  }
}

if (process.argv[1] && process.argv[1].endsWith('telegram.ts')) {
  const bot = new TelegramBotClient();
  bot.startPolling().catch(console.error);
}
