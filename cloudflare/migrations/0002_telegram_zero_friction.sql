-- Zero-friction Telegram link + delivery flags
ALTER TABLE agents ADD COLUMN telegram_chat_id TEXT;
ALTER TABLE agents ADD COLUMN telegram_username TEXT;
ALTER TABLE messages ADD COLUMN notified INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS pair_codes (
  code TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  expires_at REAL NOT NULL,
  created_at REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_agents_tg ON agents(telegram_chat_id);
CREATE INDEX IF NOT EXISTS idx_msg_notify ON messages(notified, delivered, expires_at);
