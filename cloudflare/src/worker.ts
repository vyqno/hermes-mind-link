/**
 * Mind-link Hub — Cloudflare Worker
 * Zero-friction: browser + Telegram. We deliver; users don't run pollers.
 */
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_NAME: string;
  PUBLIC_ORIGIN?: string;
  TELEGRAM_BOT_TOKEN?: string;
  TELEGRAM_BOT_USERNAME?: string;
}

type Json = Record<string, unknown>;

const DEFAULT_ALLOW = [
  "project_name",
  "project_goal_public",
  "shared_task_status",
  "availability_window",
  "meeting_intent",
  "public_links",
  "collab_blockers",
];
const DEFAULT_DENY = [
  "dinner_food",
  "health",
  "family",
  "romance",
  "precise_location",
  "finance_personal",
  "credentials",
  "private_messages",
];

function json(data: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      ...headers,
    },
  });
}

function bad(msg: string, status = 400): Response {
  return json({ error: msg }, status);
}

async function sha256(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function token(): string {
  const a = new Uint8Array(32);
  crypto.getRandomValues(a);
  return btoa(String.fromCharCode(...a))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function id(n = 12): string {
  const a = new Uint8Array(n);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function inviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return [...a].map((x) => alphabet[x % alphabet.length]).join("");
}

function now(): number {
  return Date.now() / 1000;
}

function originOf(req: Request, env: Env): string {
  if (env.PUBLIC_ORIGIN) return env.PUBLIC_ORIGIN.replace(/\/$/, "");
  const u = new URL(req.url);
  return `${u.protocol}//${u.host}`;
}

function defaultShare(mode = "work_only") {
  return {
    mode,
    ambient: mode !== "explicit_only",
    ambient_requires_confirm_first: true,
    allow_categories: [...DEFAULT_ALLOW],
    deny_categories: [...DEFAULT_DENY],
  };
}

function cookieToken(req: Request): string | null {
  const c = req.headers.get("cookie") || "";
  const m = /(?:^|;\s*)ml_token=([^;]+)/.exec(c);
  return m ? decodeURIComponent(m[1]) : null;
}

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return cookieToken(req);
}

function sessionCookie(tok: string, origin: string): string {
  const secure = origin.startsWith("https") ? "; Secure" : "";
  return `ml_token=${encodeURIComponent(tok)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${60 * 60 * 24 * 365}${secure}`;
}

async function authAgent(env: Env, req: Request): Promise<string | null> {
  const t = bearer(req);
  if (!t) return null;
  const h = await sha256(t);
  const row = await env.DB.prepare("SELECT agent_id FROM agents WHERE token_hash = ?")
    .bind(h)
    .first<{ agent_id: string }>();
  return row?.agent_id ?? null;
}

async function readJson(req: Request): Promise<Json> {
  try {
    return (await req.json()) as Json;
  } catch {
    return {};
  }
}

async function tgApi(env: Env, method: string, body: object): Promise<any> {
  if (!env.TELEGRAM_BOT_TOKEN) return null;
  const r = await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

function envelopePreview(envelope: string): string {
  const parts = envelope.split(/\n---\n/);
  const body = (parts[1] || envelope).trim();
  return body.length > 800 ? body.slice(0, 800) + "…" : body;
}

async function notifyTelegram(
  env: Env,
  toAgent: string,
  fromAgent: string,
  envelope: string,
  groupId: string | null
): Promise<boolean> {
  const row = await env.DB.prepare(
    "SELECT telegram_chat_id, display_name FROM agents WHERE agent_id = ?"
  )
    .bind(toAgent)
    .first<{ telegram_chat_id: string | null; display_name: string }>();
  if (!row?.telegram_chat_id || !env.TELEGRAM_BOT_TOKEN) return false;
  const from = await env.DB.prepare("SELECT display_name FROM agents WHERE agent_id = ?")
    .bind(fromAgent)
    .first<{ display_name: string }>();
  const who = from?.display_name || fromAgent;
  const g = groupId ? ` (group ${groupId})` : "";
  const text =
    `◎ Mind-link from *${who}*${g}\n` +
    `Their agent → yours.\n\n` +
    envelopePreview(envelope) +
    `\n\n_Reply here to answer their agent._`;
  const res = await tgApi(env, "sendMessage", {
    chat_id: row.telegram_chat_id,
    text,
    parse_mode: "Markdown",
  });
  return !!(res && res.ok);
}

async function deliverPending(env: Env, limit = 40): Promise<number> {
  const t = now();
  const rows = await env.DB.prepare(
    `SELECT id, to_agent, from_agent, group_id, envelope FROM messages
     WHERE notified = 0 AND expires_at > ? ORDER BY created_at ASC LIMIT ?`
  )
    .bind(t, limit)
    .all();
  let n = 0;
  for (const m of (rows.results || []) as any[]) {
    const ok = await notifyTelegram(env, m.to_agent, m.from_agent, m.envelope, m.group_id);
    await env.DB.prepare("UPDATE messages SET notified = 1 WHERE id = ?").bind(m.id).run();
    if (ok) {
      await env.DB.prepare("UPDATE messages SET delivered = 1 WHERE id = ?").bind(m.id).run();
      n++;
    }
  }
  return n;
}

export default {
  async fetch(req: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    if (req.method === "OPTIONS") return json({ ok: true });

    if (path === "/health" || path === "/api/health") {
      return json({
        ok: true,
        service: "mind-link-hub",
        app: env.APP_NAME || "Mind-link",
        telegram: !!env.TELEGRAM_BOT_TOKEN,
        bot: env.TELEGRAM_BOT_USERNAME || null,
      });
    }

    if (path === "/telegram/webhook" && req.method === "POST") {
      const update = await readJson(req);
      ctx.waitUntil(handleTelegramUpdate(env, update));
      return json({ ok: true });
    }

    if (path.startsWith("/v1/") || path.startsWith("/api/")) {
      const p = path.replace(/^\/api/, "/v1");
      try {
        return await handleApi(req, env, p, url, ctx);
      } catch (e) {
        return bad(e instanceof Error ? e.message : String(e), 500);
      }
    }

    if (env.ASSETS) return env.ASSETS.fetch(req);
    return bad("no UI", 404);
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext) {
    ctx.waitUntil(deliverPending(env, 80));
  },
};

async function handleTelegramUpdate(env: Env, update: Json) {
  const msg: any = update.message || update.edited_message;
  if (!msg?.chat?.id) return;
  const chatId = String(msg.chat.id);
  const text = String(msg.text || "").trim();
  const username = msg.from?.username ? String(msg.from.username) : null;

  if (text.startsWith("/start")) {
    const payload = text.split(/\s+/)[1] || "";
    const code = payload.replace(/^link[_-]?/i, "").toUpperCase();
    if (!code) {
      await tgApi(env, "sendMessage", {
        chat_id: chatId,
        text: "Open Mind-link → Connect Telegram, then use the button.",
      });
      return;
    }
    const pair = await env.DB.prepare("SELECT agent_id, expires_at FROM pair_codes WHERE code = ?")
      .bind(code)
      .first<{ agent_id: string; expires_at: number }>();
    if (!pair || pair.expires_at < now()) {
      await tgApi(env, "sendMessage", {
        chat_id: chatId,
        text: "Link expired. Generate a new one in the app.",
      });
      return;
    }
    await env.DB.prepare(
      "UPDATE agents SET telegram_chat_id = ?, telegram_username = ?, updated_at = ? WHERE agent_id = ?"
    )
      .bind(chatId, username, now(), pair.agent_id)
      .run();
    await env.DB.prepare("DELETE FROM pair_codes WHERE code = ?").bind(code).run();
    const me = await env.DB.prepare("SELECT display_name FROM agents WHERE agent_id = ?")
      .bind(pair.agent_id)
      .first<{ display_name: string }>();
    await tgApi(env, "sendMessage", {
      chat_id: chatId,
      text: `Linked ✓ Connected as ${me?.display_name || pair.agent_id}.\n\nTrusted minds message you here. Reply to answer their agent.`,
    });
    return;
  }

  const agent = await env.DB.prepare(
    "SELECT agent_id, display_name FROM agents WHERE telegram_chat_id = ?"
  )
    .bind(chatId)
    .first<{ agent_id: string; display_name: string }>();
  if (!agent) {
    await tgApi(env, "sendMessage", {
      chat_id: chatId,
      text: "Not linked. Open Mind-link app → Connect Telegram.",
    });
    return;
  }
  if (!text || text.startsWith("/")) return;

  const last = await env.DB.prepare(
    `SELECT from_agent FROM messages WHERE to_agent = ? ORDER BY created_at DESC LIMIT 1`
  )
    .bind(agent.agent_id)
    .first<{ from_agent: string }>();
  if (!last) {
    await tgApi(env, "sendMessage", {
      chat_id: chatId,
      text: "No recent mind-mail. Invite a contact in the web app first.",
    });
    return;
  }

  const envelope =
    `[MIND-LINK]\nfrom: ${agent.agent_id}\nto: agent:${last.from_agent.replace(/^mind:/, "")}\n` +
    `intent: relay\ncorrelation_id: ${id(3)}\nrequires_human_on_receipt: false\n---\n${text}\n`;
  const mid = id(12);
  await env.DB.prepare(
    `INSERT INTO messages(id,to_agent,from_agent,group_id,envelope,created_at,expires_at,delivered,notified)
     VALUES (?,?,?,?,?,?,?,0,0)`
  )
    .bind(mid, last.from_agent, agent.agent_id, null, envelope, now(), now() + 86400)
    .run();
  const ok = await notifyTelegram(env, last.from_agent, agent.agent_id, envelope, null);
  await env.DB.prepare("UPDATE messages SET notified = 1, delivered = ? WHERE id = ?")
    .bind(ok ? 1 : 0, mid)
    .run();
  await tgApi(env, "sendMessage", {
    chat_id: chatId,
    text: `Sent to ${last.from_agent}'s agent ✓`,
  });
}

async function handleApi(
  req: Request,
  env: Env,
  path: string,
  url: URL,
  ctx: ExecutionContext
): Promise<Response> {
  if (path === "/v1/register" && req.method === "POST") {
    const body = await readJson(req);
    let handle = String(body.handle || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "");
    const display = String(body.display_name || handle || "Friend").trim();
    if (!handle) handle = "u" + id(3);
    const agentId = `mind:${handle}`;
    const clash = await env.DB.prepare("SELECT agent_id FROM agents WHERE agent_id=? OR handle=?")
      .bind(agentId, handle)
      .first();
    if (clash) return bad("handle taken — try another", 409);
    const tok = token();
    const th = await sha256(tok);
    const t = now();
    await env.DB.prepare(
      `INSERT INTO agents(agent_id,display_name,handle,token_hash,telegram_bot,created_at,updated_at)
       VALUES (?,?,?,?,NULL,?,?)`
    )
      .bind(agentId, display, handle, th, t, t)
      .run();
    await env.DB.prepare(`INSERT INTO work_context(agent_id,fields_json,updated_at) VALUES (?,'{}',?)`)
      .bind(agentId, t)
      .run();
    const origin = originOf(req, env);
    return json(
      {
        agent_id: agentId,
        handle,
        display_name: display,
        token: tok,
        next: "connect_telegram",
        telegram_ready: !!env.TELEGRAM_BOT_TOKEN,
      },
      200,
      { "set-cookie": sessionCookie(tok, origin) }
    );
  }

  if (path === "/v1/invites/accept" && req.method === "POST") {
    const body = await readJson(req);
    const code = String(body.code || "").trim().toUpperCase();
    const inv = await env.DB.prepare("SELECT * FROM invites WHERE code=?").bind(code).first<any>();
    if (!inv) return bad("invalid invite", 404);
    if (inv.expires_at < now()) return bad("invite expired", 410);
    if (inv.uses >= inv.max_uses) return bad("invite exhausted", 410);

    let agent = await authAgent(env, req);
    let newToken: string | undefined;
    let setCookie: string | undefined;
    if (!agent) {
      const handle =
        String(body.handle || "")
          .trim()
          .toLowerCase()
          .replace(/[^a-z0-9_]/g, "") || "f" + id(2);
      const display = String(body.display_name || handle);
      const agentId = `mind:${handle}`;
      if (
        await env.DB.prepare("SELECT 1 FROM agents WHERE agent_id=? OR handle=?")
          .bind(agentId, handle)
          .first()
      ) {
        return bad("handle taken", 409);
      }
      newToken = token();
      const th = await sha256(newToken);
      const t = now();
      await env.DB.prepare(
        `INSERT INTO agents(agent_id,display_name,handle,token_hash,telegram_bot,created_at,updated_at)
         VALUES (?,?,?,?,NULL,?,?)`
      )
        .bind(agentId, display, handle, th, t, t)
        .run();
      await env.DB.prepare(`INSERT INTO work_context(agent_id,fields_json,updated_at) VALUES (?,'{}',?)`)
        .bind(agentId, t)
        .run();
      agent = agentId;
      setCookie = sessionCookie(newToken, originOf(req, env));
    }
    if (agent === inv.from_agent) return bad("cannot accept own invite");
    const share = JSON.stringify(defaultShare(inv.share_mode || "work_only"));
    const t = now();
    const fromRow = await env.DB.prepare("SELECT display_name FROM agents WHERE agent_id=?")
      .bind(inv.from_agent)
      .first<any>();
    const meRow = await env.DB.prepare("SELECT display_name FROM agents WHERE agent_id=?")
      .bind(agent)
      .first<any>();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO contacts(owner_agent,peer_agent,display_name,status,share_mode,share_json,notes,created_at)
       VALUES (?,?,?,'active',?,?,'',?)`
    )
      .bind(agent, inv.from_agent, fromRow?.display_name || inv.from_agent, inv.share_mode || "work_only", share, t)
      .run();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO contacts(owner_agent,peer_agent,display_name,status,share_mode,share_json,notes,created_at)
       VALUES (?,?,?,'active',?,?,'',?)`
    )
      .bind(inv.from_agent, agent, meRow?.display_name || agent, inv.share_mode || "work_only", share, t)
      .run();
    await env.DB.prepare("UPDATE invites SET uses = uses + 1 WHERE code=?").bind(code).run();
    const headers: HeadersInit = setCookie ? { "set-cookie": setCookie } : {};
    return json(
      {
        ok: true,
        agent_id: agent,
        linked_with: inv.from_agent,
        token: newToken,
        next: "connect_telegram",
      },
      200,
      headers
    );
  }

  if (path.startsWith("/v1/invites/") && req.method === "GET" && path !== "/v1/invites") {
    const code = path.split("/").pop()!.toUpperCase();
    const inv = await env.DB.prepare(
      `SELECT i.code,i.label,i.share_mode,i.expires_at,i.max_uses,i.uses,a.display_name AS from_name,a.handle AS from_handle
       FROM invites i JOIN agents a ON a.agent_id=i.from_agent WHERE i.code=?`
    )
      .bind(code)
      .first();
    if (!inv) return bad("not found", 404);
    return json({ invite: inv });
  }

  // Open claim: Hermes (or user) posts chat_id + pair code. No CF webhook needed.
  if (path === "/v1/telegram/claim-open" && req.method === "POST") {
    const body = await readJson(req);
    const code = String(body.code || "").trim().toUpperCase().replace(/^LINK_/, "");
    const chatId = String(body.chat_id || "").trim();
    const username = body.username != null ? String(body.username) : null;
    if (!code || !chatId) return bad("code and chat_id required");
    const pair = await env.DB.prepare("SELECT agent_id, expires_at FROM pair_codes WHERE code = ?")
      .bind(code).first<{ agent_id: string; expires_at: number }>();
    if (!pair || pair.expires_at < now()) return bad("invalid or expired code", 410);
    await env.DB.prepare(
      "UPDATE agents SET telegram_chat_id = ?, telegram_username = ?, updated_at = ? WHERE agent_id = ?"
    ).bind(chatId, username, now(), pair.agent_id).run();
    await env.DB.prepare("DELETE FROM pair_codes WHERE code = ?").bind(code).run();
    if (env.TELEGRAM_BOT_TOKEN) {
      await tgApi(env, "sendMessage", {
        chat_id: chatId,
        text: "Mind-link linked ✓ Mind-mail will arrive here.",
      });
    }
    return json({ ok: true, agent_id: pair.agent_id });
  }

  if (path === "/v1/status" && req.method === "GET") {
    return json({
      telegram: !!env.TELEGRAM_BOT_TOKEN,
      bot_username: env.TELEGRAM_BOT_USERNAME || null,
      app: env.APP_NAME || "Mind-link",
    });
  }

  const agent = await authAgent(env, req);
  if (!agent) return bad("unauthorized", 401);

  if (path === "/v1/telegram/pair" && req.method === "POST") {
    if (!env.TELEGRAM_BOT_TOKEN || !env.TELEGRAM_BOT_USERNAME) {
      return bad("Telegram bot not configured (operator sets TELEGRAM_BOT_TOKEN once)", 503);
    }
    const code = inviteCode();
    const t = now();
    await env.DB.prepare(
      "INSERT INTO pair_codes(code, agent_id, expires_at, created_at) VALUES (?,?,?,?)"
    )
      .bind(code, agent, t + 900, t)
      .run();
    const uname = env.TELEGRAM_BOT_USERNAME.replace(/^@/, "");
    return json({
      code,
      deep_link: `https://t.me/${uname}?start=link_${code}`,
      expires_in: 900,
    });
  }

  if (path === "/v1/telegram/status" && req.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT telegram_chat_id, telegram_username FROM agents WHERE agent_id=?"
    )
      .bind(agent)
      .first<any>();
    return json({
      linked: !!row?.telegram_chat_id,
      telegram_username: row?.telegram_username || null,
      bot_username: env.TELEGRAM_BOT_USERNAME || null,
      platform_ready: !!env.TELEGRAM_BOT_TOKEN,
    });
  }

  if (path === "/v1/me" && req.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT agent_id,display_name,handle,telegram_bot,telegram_chat_id,telegram_username,created_at FROM agents WHERE agent_id=?"
    )
      .bind(agent)
      .first();
    const contacts = await env.DB.prepare(
      "SELECT peer_agent,display_name,status,share_mode,notes,created_at FROM contacts WHERE owner_agent=? ORDER BY display_name"
    )
      .bind(agent)
      .all();
    const groups = await env.DB.prepare("SELECT group_id,title,members_json,admin_agent FROM groups").all();
    const myGroups = (groups.results || []).filter((g: any) => {
      try {
        return JSON.parse(g.members_json).includes(agent);
      } catch {
        return false;
      }
    });
    return json({
      me: row,
      contacts: contacts.results || [],
      groups: myGroups,
      telegram_linked: !!(row as any)?.telegram_chat_id,
      needs: { telegram: !(row as any)?.telegram_chat_id, hermes_cli: false },
    });
  }

  if (path === "/v1/me" && req.method === "PATCH") {
    const body = await readJson(req);
    if (body.display_name != null) {
      await env.DB.prepare("UPDATE agents SET display_name=?, updated_at=? WHERE agent_id=?")
        .bind(String(body.display_name), now(), agent)
        .run();
    }
    return json({ ok: true });
  }

  if (path === "/v1/contacts" && req.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT c.*, a.handle AS peer_handle FROM contacts c
       LEFT JOIN agents a ON a.agent_id=c.peer_agent WHERE c.owner_agent=? ORDER BY c.display_name`
    )
      .bind(agent)
      .all();
    return json({ contacts: rows.results || [] });
  }

  if (path === "/v1/contacts" && req.method === "POST") {
    const body = await readJson(req);
    const peer = String(body.peer_agent || "").trim().toLowerCase();
    if (!peer.startsWith("mind:")) return bad("peer_agent must be mind:...");
    const peerRow = await env.DB.prepare("SELECT display_name FROM agents WHERE agent_id=?")
      .bind(peer)
      .first<any>();
    if (!peerRow) return bad("peer not on this hub", 404);
    const mode = String(body.share_mode || "work_only");
    await env.DB.prepare(
      `INSERT OR REPLACE INTO contacts(owner_agent,peer_agent,display_name,status,share_mode,share_json,notes,created_at)
       VALUES (?,?,?,?,?,?,?,?)`
    )
      .bind(
        agent,
        peer,
        String(body.display_name || peerRow.display_name),
        String(body.status || "active"),
        mode,
        JSON.stringify(body.share || defaultShare(mode)),
        String(body.notes || ""),
        now()
      )
      .run();
    return json({ ok: true });
  }

  if (path.startsWith("/v1/contacts/") && req.method === "PATCH") {
    const peer = decodeURIComponent(path.slice("/v1/contacts/".length));
    const body = await readJson(req);
    const row = await env.DB.prepare("SELECT * FROM contacts WHERE owner_agent=? AND peer_agent=?")
      .bind(agent, peer)
      .first<any>();
    if (!row) return bad("not found", 404);
    const mode = body.share_mode != null ? String(body.share_mode) : row.share_mode;
    const share =
      body.share != null
        ? JSON.stringify(body.share)
        : body.share_mode != null
          ? JSON.stringify(defaultShare(mode))
          : row.share_json;
    await env.DB.prepare(
      `UPDATE contacts SET display_name=?, status=?, share_mode=?, share_json=?, notes=? WHERE owner_agent=? AND peer_agent=?`
    )
      .bind(
        body.display_name != null ? String(body.display_name) : row.display_name,
        body.status != null ? String(body.status) : row.status,
        mode,
        share,
        body.notes != null ? String(body.notes) : row.notes,
        agent,
        peer
      )
      .run();
    return json({ ok: true });
  }

  if (path.startsWith("/v1/contacts/") && req.method === "DELETE") {
    const peer = decodeURIComponent(path.slice("/v1/contacts/".length));
    await env.DB.prepare("DELETE FROM contacts WHERE owner_agent=? AND peer_agent=?")
      .bind(agent, peer)
      .run();
    return json({ ok: true });
  }

  if (path === "/v1/invites" && req.method === "POST") {
    const body = await readJson(req);
    const code = inviteCode();
    const t = now();
    const mode = String(body.share_mode || "work_only");
    await env.DB.prepare(
      `INSERT INTO invites(code,from_agent,label,share_mode,max_uses,uses,expires_at,created_at)
       VALUES (?,?,?,?,?,0,?,?)`
    )
      .bind(
        code,
        agent,
        body.label ? String(body.label) : null,
        mode,
        Number(body.max_uses || 10),
        t + Number(body.ttl_seconds || 7 * 86400),
        t
      )
      .run();
    return json({
      code,
      url: `${originOf(req, env)}/?invite=${code}`,
      share_mode: mode,
    });
  }

  if (path === "/v1/invites" && req.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT code,label,share_mode,max_uses,uses,expires_at,created_at FROM invites WHERE from_agent=? ORDER BY created_at DESC"
    )
      .bind(agent)
      .all();
    return json({ invites: rows.results || [] });
  }

  if (path === "/v1/send" && req.method === "POST") {
    const body = await readJson(req);
    const envelope = String(body.envelope || "");
    if (!envelope) return bad("envelope required");
    const ttl = Math.max(60, Math.min(Number(body.ttl_seconds || 86400), 7 * 86400));
    const exp = now() + ttl;
    const targets: string[] = [];
    let groupId: string | null = null;
    if (body.to_group) {
      const g = await env.DB.prepare("SELECT members_json FROM groups WHERE group_id=?")
        .bind(String(body.to_group))
        .first<{ members_json: string }>();
      if (!g) return bad("unknown group", 404);
      const members: string[] = JSON.parse(g.members_json);
      if (!members.includes(agent)) return bad("not a member", 403);
      targets.push(...members.filter((m) => m !== agent));
      groupId = String(body.to_group);
    } else if (body.to) targets.push(String(body.to));
    else return bad("to or to_group required");

    const ids: string[] = [];
    for (const to of targets) {
      const mid = id(12);
      await env.DB.prepare(
        `INSERT INTO messages(id,to_agent,from_agent,group_id,envelope,created_at,expires_at,delivered,notified)
         VALUES (?,?,?,?,?,?,?,0,0)`
      )
        .bind(mid, to, agent, groupId, envelope, now(), exp)
        .run();
      ids.push(mid);
      ctx.waitUntil(
        (async () => {
          const ok = await notifyTelegram(env, to, agent, envelope, groupId);
          await env.DB.prepare("UPDATE messages SET notified=1, delivered=? WHERE id=?")
            .bind(ok ? 1 : 0, mid)
            .run();
        })()
      );
    }
    return json({ message_ids: ids, delivery: "push" });
  }

  if (path === "/v1/inbox" && req.method === "GET") {
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 30), 100));
    const rows = await env.DB.prepare(
      `SELECT id, from_agent, group_id, envelope, created_at, delivered, notified FROM messages
       WHERE to_agent=? AND expires_at>? ORDER BY created_at DESC LIMIT ?`
    )
      .bind(agent, now(), limit)
      .all();
    return json({
      messages: (rows.results || []).map((m: any) => ({
        id: m.id,
        from: m.from_agent,
        group_id: m.group_id,
        envelope: m.envelope,
        created_at: m.created_at,
        delivered: !!m.delivered,
        notified: !!m.notified,
      })),
    });
  }

  if (path === "/v1/groups" && req.method === "POST") {
    const body = await readJson(req);
    const groupId = String(body.group_id || "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, "");
    if (!groupId) return bad("group_id required");
    const title = String(body.title || groupId);
    let members = ((body.members as string[]) || []).map(String);
    members = [...new Set(members)];
    if (!members.includes(agent)) members.push(agent);
    const existing = await env.DB.prepare("SELECT admin_agent FROM groups WHERE group_id=?")
      .bind(groupId)
      .first<any>();
    if (existing && existing.admin_agent !== agent) return bad("not admin", 403);
    if (existing) {
      await env.DB.prepare("UPDATE groups SET title=?, members_json=? WHERE group_id=?")
        .bind(title, JSON.stringify(members), groupId)
        .run();
    } else {
      await env.DB.prepare(
        `INSERT INTO groups(group_id,title,admin_agent,members_json,created_at) VALUES (?,?,?,?,?)`
      )
        .bind(groupId, title, agent, JSON.stringify(members), now())
        .run();
    }
    return json({ ok: true, group_id: groupId, members });
  }

  if (path === "/v1/groups" && req.method === "GET") {
    const all = await env.DB.prepare(
      "SELECT group_id,title,admin_agent,members_json,created_at FROM groups"
    ).all();
    const mine = (all.results || []).filter((g: any) => {
      try {
        return JSON.parse(g.members_json).includes(agent);
      } catch {
        return false;
      }
    });
    return json({ groups: mine });
  }

  if (path === "/v1/context" && req.method === "GET") {
    const row = await env.DB.prepare("SELECT fields_json,updated_at FROM work_context WHERE agent_id=?")
      .bind(agent)
      .first<any>();
    return json({ fields: JSON.parse(row?.fields_json || "{}"), updated_at: row?.updated_at || null });
  }

  if (path === "/v1/context" && req.method === "PUT") {
    const body = await readJson(req);
    const fields = body.fields && typeof body.fields === "object" ? { ...(body.fields as object) } : {};
    for (const k of DEFAULT_DENY) delete (fields as any)[k];
    delete (fields as any).private_notes;
    await env.DB.prepare(
      `INSERT INTO work_context(agent_id,fields_json,updated_at) VALUES (?,?,?)
       ON CONFLICT(agent_id) DO UPDATE SET fields_json=excluded.fields_json, updated_at=excluded.updated_at`
    )
      .bind(agent, JSON.stringify(fields), now())
      .run();
    return json({ ok: true, fields });
  }

  if (path === "/v1/setup-pack" && req.method === "GET") {
    return json({
      note: "Optional power-user only. Normal users just Connect Telegram in the app — we deliver.",
      hermes_cli_required: false,
    });
  }

  if (path === "/v1/admin/deliver" && req.method === "POST") {
    const n = await deliverPending(env, 80);
    return json({ notified: n });
  }

  return bad("not found", 404);
}
