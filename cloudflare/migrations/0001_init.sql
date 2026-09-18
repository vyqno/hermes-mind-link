-- Mind-link Hub schema (Cloudflare D1)
CREATE TABLE IF NOT EXISTS agents (
  agent_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  handle TEXT UNIQUE,
  token_hash TEXT NOT NULL,
  telegram_bot TEXT,
  created_at REAL NOT NULL,
  updated_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  to_agent TEXT NOT NULL,
  from_agent TEXT NOT NULL,
  group_id TEXT,
  envelope TEXT NOT NULL,
  created_at REAL NOT NULL,
  expires_at REAL NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_inbox ON messages(to_agent, delivered, expires_at);

CREATE TABLE IF NOT EXISTS groups (
  group_id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  admin_agent TEXT NOT NULL,
  members_json TEXT NOT NULL,
  created_at REAL NOT NULL
);

-- Directed contact edges with share policy
CREATE TABLE IF NOT EXISTS contacts (
  owner_agent TEXT NOT NULL,
  peer_agent TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|active|blocked
  share_mode TEXT NOT NULL DEFAULT 'work_only',
  share_json TEXT NOT NULL DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_at REAL NOT NULL,
  PRIMARY KEY (owner_agent, peer_agent)
);

CREATE TABLE IF NOT EXISTS invites (
  code TEXT PRIMARY KEY,
  from_agent TEXT NOT NULL,
  label TEXT,
  share_mode TEXT NOT NULL DEFAULT 'work_only',
  max_uses INTEGER NOT NULL DEFAULT 1,
  uses INTEGER NOT NULL DEFAULT 0,
  expires_at REAL NOT NULL,
  created_at REAL NOT NULL
);

CREATE TABLE IF NOT EXISTS work_context (
  agent_id TEXT PRIMARY KEY,
  fields_json TEXT NOT NULL DEFAULT '{}',
  updated_at REAL NOT NULL
);
