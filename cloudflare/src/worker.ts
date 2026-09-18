/**
 * Hermes Mind-link Hub — Cloudflare Worker + D1
 * Public HTTPS mesh + JSON API + UI assets.
 */
export interface Env {
  DB: D1Database;
  ASSETS: Fetcher;
  APP_NAME: string;
  PUBLIC_ORIGIN?: string;
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

function json(data: unknown, status = 200, extra: HeadersInit = {}): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8",
      "access-control-allow-origin": "*",
      "access-control-allow-headers": "authorization, content-type",
      "access-control-allow-methods": "GET,POST,PATCH,DELETE,OPTIONS",
      ...extra,
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
  return btoa(String.fromCharCode(...a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function id(bytes = 12): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function inviteCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  for (const x of a) out += alphabet[x % alphabet.length];
  return out;
}

function now(): number {
  return Date.now() / 1000;
}

function bearer(req: Request): string | null {
  const h = req.headers.get("authorization") || "";
  if (h.toLowerCase().startsWith("bearer ")) return h.slice(7).trim();
  return null;
}

async function authAgent(env: Env, req: Request): Promise<string | null> {
  const t = bearer(req);
  if (!t) return null;
  const h = await sha256(t);
  const row = await env.DB.prepare("SELECT agent_id FROM agents WHERE token_hash = ?").bind(h).first<{ agent_id: string }>();
  return row?.agent_id ?? null;
}

async function readJson(req: Request): Promise<Json> {
  try {
    return (await req.json()) as Json;
  } catch {
    return {};
  }
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

export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;

    if (req.method === "OPTIONS") {
      return json({ ok: true });
    }

    // Health
    if (path === "/health" || path === "/api/health") {
      return json({ ok: true, service: "mind-link-hub", app: env.APP_NAME || "Mind-link" });
    }

    // -------- API --------
    if (path.startsWith("/v1/") || path.startsWith("/api/")) {
      const p = path.replace(/^\/api/, "/v1").replace(/^\/v1/, "/v1");
      try {
        return await handleApi(req, env, p, url);
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        return bad(msg, 500);
      }
    }

    // Static UI
    if (env.ASSETS) {
      return env.ASSETS.fetch(req);
    }
    return bad("no UI assets", 404);
  },
};

async function handleApi(req: Request, env: Env, path: string, url: URL): Promise<Response> {
  // Public register / bootstrap
  if (path === "/v1/register" && req.method === "POST") {
    const body = await readJson(req);
    let agentId = String(body.agent_id || "").trim().toLowerCase();
    const display = String(body.display_name || "").trim() || agentId;
    let handle = String(body.handle || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "");
    if (!agentId) {
      if (!handle) handle = "user" + id(3);
      agentId = `mind:${handle}`;
    }
    if (!agentId.startsWith("mind:")) return bad("agent_id must start with mind:");
    if (!handle) handle = agentId.slice(5);
    const tok = token();
    const th = await sha256(tok);
    const t = now();
    const existing = await env.DB.prepare("SELECT agent_id FROM agents WHERE agent_id = ? OR handle = ?")
      .bind(agentId, handle)
      .first();
    if (existing) {
      // rotate token if same agent re-registering with proof? For onboarding simplicity: reject handle clash
      return bad("agent_id or handle already taken — pick another handle", 409);
    }
    await env.DB.prepare(
      `INSERT INTO agents(agent_id, display_name, handle, token_hash, telegram_bot, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(agentId, display, handle, th, body.telegram_bot ? String(body.telegram_bot) : null, t, t)
      .run();
    await env.DB.prepare(
      `INSERT INTO work_context(agent_id, fields_json, updated_at) VALUES (?, '{}', ?)`
    )
      .bind(agentId, t)
      .run();
    return json({
      agent_id: agentId,
      handle,
      display_name: display,
      token: tok,
      note: "Save this token once. It will not be shown again.",
      setup: {
        env: {
          MINDLINK_HUB_URL: originOf(req, env),
          MINDLINK_HUB_TOKEN: tok,
        },
        hermes: [
          "pip install -e .  # from hermes-mind-link repo (optional CLI)",
          "Add MINDLINK_HUB_URL and MINDLINK_HUB_TOKEN to ~/.hermes/.env",
          "./scripts/install.sh && hermes tools enable a2a --platform telegram",
        ],
      },
    });
  }

  // Accept invite (public with invite code + optional new account)
  if (path === "/v1/invites/accept" && req.method === "POST") {
    const body = await readJson(req);
    const code = String(body.code || "").trim().toUpperCase();
    if (!code) return bad("code required");
    const inv = await env.DB.prepare("SELECT * FROM invites WHERE code = ?").bind(code).first<{
      code: string;
      from_agent: string;
      share_mode: string;
      max_uses: number;
      uses: number;
      expires_at: number;
      label: string | null;
    }>();
    if (!inv) return bad("invalid invite", 404);
    if (inv.expires_at < now()) return bad("invite expired", 410);
    if (inv.uses >= inv.max_uses) return bad("invite exhausted", 410);

    let agent = await authAgent(env, req);
    let newToken: string | undefined;
    if (!agent) {
      // create account inline
      const handle = String(body.handle || "").trim().toLowerCase().replace(/[^a-z0-9_]/g, "") || "friend" + id(2);
      const display = String(body.display_name || handle);
      const agentId = `mind:${handle}`;
      const clash = await env.DB.prepare("SELECT agent_id FROM agents WHERE agent_id = ? OR handle = ?")
        .bind(agentId, handle)
        .first();
      if (clash) return bad("handle taken", 409);
      newToken = token();
      const th = await sha256(newToken);
      const t = now();
      await env.DB.prepare(
        `INSERT INTO agents(agent_id, display_name, handle, token_hash, telegram_bot, created_at, updated_at)
         VALUES (?, ?, ?, ?, NULL, ?, ?)`
      )
        .bind(agentId, display, handle, th, t, t)
        .run();
      await env.DB.prepare(`INSERT INTO work_context(agent_id, fields_json, updated_at) VALUES (?, '{}', ?)`)
        .bind(agentId, t)
        .run();
      agent = agentId;
    }

    const from = inv.from_agent;
    if (agent === from) return bad("cannot accept own invite");
    const share = JSON.stringify(defaultShare(inv.share_mode || "work_only"));
    const t = now();
    // mutual contacts
    const fromRow = await env.DB.prepare("SELECT display_name FROM agents WHERE agent_id = ?")
      .bind(from)
      .first<{ display_name: string }>();
    const meRow = await env.DB.prepare("SELECT display_name FROM agents WHERE agent_id = ?")
      .bind(agent)
      .first<{ display_name: string }>();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO contacts(owner_agent, peer_agent, display_name, status, share_mode, share_json, notes, created_at)
       VALUES (?, ?, ?, 'active', ?, ?, '', ?)`
    )
      .bind(agent, from, fromRow?.display_name || from, inv.share_mode || "work_only", share, t)
      .run();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO contacts(owner_agent, peer_agent, display_name, status, share_mode, share_json, notes, created_at)
       VALUES (?, ?, ?, 'active', ?, ?, '', ?)`
    )
      .bind(from, agent, meRow?.display_name || agent, inv.share_mode || "work_only", share, t)
      .run();
    await env.DB.prepare("UPDATE invites SET uses = uses + 1 WHERE code = ?").bind(code).run();

    return json({
      ok: true,
      agent_id: agent,
      linked_with: from,
      token: newToken,
      note: newToken ? "New account created — save token once." : "Linked to existing account.",
    });
  }

  // Public invite preview
  if (path.startsWith("/v1/invites/") && req.method === "GET") {
    const code = path.split("/").pop()!.toUpperCase();
    const inv = await env.DB.prepare(
      `SELECT i.code, i.label, i.share_mode, i.expires_at, i.max_uses, i.uses, a.display_name AS from_name, a.handle AS from_handle
       FROM invites i JOIN agents a ON a.agent_id = i.from_agent WHERE i.code = ?`
    )
      .bind(code)
      .first();
    if (!inv) return bad("not found", 404);
    return json({ invite: inv, origin: originOf(req, env) });
  }

  // Auth required below
  const agent = await authAgent(env, req);
  if (!agent) return bad("unauthorized", 401);

  if (path === "/v1/me" && req.method === "GET") {
    const row = await env.DB.prepare(
      "SELECT agent_id, display_name, handle, telegram_bot, created_at FROM agents WHERE agent_id = ?"
    )
      .bind(agent)
      .first();
    const contacts = await env.DB.prepare(
      "SELECT peer_agent, display_name, status, share_mode, notes, created_at FROM contacts WHERE owner_agent = ? ORDER BY display_name"
    )
      .bind(agent)
      .all();
    const groups = await env.DB.prepare("SELECT group_id, title, members_json, admin_agent FROM groups").all();
    const myGroups = (groups.results || []).filter((g: any) => {
      try {
        return JSON.parse(g.members_json).includes(agent);
      } catch {
        return false;
      }
    });
    return json({ me: row, contacts: contacts.results || [], groups: myGroups });
  }

  if (path === "/v1/me" && req.method === "PATCH") {
    const body = await readJson(req);
    const display = body.display_name != null ? String(body.display_name) : null;
    const tg = body.telegram_bot != null ? String(body.telegram_bot) : null;
    if (display) {
      await env.DB.prepare("UPDATE agents SET display_name = ?, updated_at = ? WHERE agent_id = ?")
        .bind(display, now(), agent)
        .run();
    }
    if (tg !== null) {
      await env.DB.prepare("UPDATE agents SET telegram_bot = ?, updated_at = ? WHERE agent_id = ?")
        .bind(tg || null, now(), agent)
        .run();
    }
    return json({ ok: true });
  }

  // Contacts
  if (path === "/v1/contacts" && req.method === "GET") {
    const rows = await env.DB.prepare(
      `SELECT c.*, a.handle AS peer_handle, a.telegram_bot AS peer_telegram
       FROM contacts c LEFT JOIN agents a ON a.agent_id = c.peer_agent
       WHERE c.owner_agent = ? ORDER BY c.display_name`
    )
      .bind(agent)
      .all();
    return json({ contacts: rows.results || [] });
  }

  if (path === "/v1/contacts" && req.method === "POST") {
    const body = await readJson(req);
    const peer = String(body.peer_agent || body.peer || "").trim().toLowerCase();
    if (!peer.startsWith("mind:")) return bad("peer_agent must be mind:...");
    const peerRow = await env.DB.prepare("SELECT agent_id, display_name FROM agents WHERE agent_id = ?")
      .bind(peer)
      .first<{ agent_id: string; display_name: string }>();
    if (!peerRow) return bad("peer not registered on this hub", 404);
    const mode = String(body.share_mode || "work_only");
    const share = JSON.stringify(body.share || defaultShare(mode));
    const t = now();
    await env.DB.prepare(
      `INSERT OR REPLACE INTO contacts(owner_agent, peer_agent, display_name, status, share_mode, share_json, notes, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
      .bind(
        agent,
        peer,
        String(body.display_name || peerRow.display_name),
        String(body.status || "active"),
        mode,
        share,
        String(body.notes || ""),
        t
      )
      .run();
    return json({ ok: true });
  }

  if (path.startsWith("/v1/contacts/") && req.method === "PATCH") {
    const peer = decodeURIComponent(path.slice("/v1/contacts/".length));
    const body = await readJson(req);
    const row = await env.DB.prepare("SELECT * FROM contacts WHERE owner_agent = ? AND peer_agent = ?")
      .bind(agent, peer)
      .first();
    if (!row) return bad("not found", 404);
    const mode = body.share_mode != null ? String(body.share_mode) : (row as any).share_mode;
    const share =
      body.share != null ? JSON.stringify(body.share) : body.share_mode != null ? JSON.stringify(defaultShare(mode)) : (row as any).share_json;
    const status = body.status != null ? String(body.status) : (row as any).status;
    const display = body.display_name != null ? String(body.display_name) : (row as any).display_name;
    const notes = body.notes != null ? String(body.notes) : (row as any).notes;
    await env.DB.prepare(
      `UPDATE contacts SET display_name=?, status=?, share_mode=?, share_json=?, notes=? WHERE owner_agent=? AND peer_agent=?`
    )
      .bind(display, status, mode, share, notes, agent, peer)
      .run();
    return json({ ok: true });
  }

  if (path.startsWith("/v1/contacts/") && req.method === "DELETE") {
    const peer = decodeURIComponent(path.slice("/v1/contacts/".length));
    await env.DB.prepare("DELETE FROM contacts WHERE owner_agent = ? AND peer_agent = ?").bind(agent, peer).run();
    return json({ ok: true });
  }

  // Invites create
  if (path === "/v1/invites" && req.method === "POST") {
    const body = await readJson(req);
    const code = inviteCode();
    const t = now();
    const exp = t + Number(body.ttl_seconds || 7 * 86400);
    const mode = String(body.share_mode || "work_only");
    await env.DB.prepare(
      `INSERT INTO invites(code, from_agent, label, share_mode, max_uses, uses, expires_at, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?, ?)`
    )
      .bind(code, agent, body.label ? String(body.label) : null, mode, Number(body.max_uses || 5), exp, t)
      .run();
    const origin = originOf(req, env);
    return json({
      code,
      url: `${origin}/?invite=${code}`,
      share_mode: mode,
      expires_at: exp,
    });
  }

  if (path === "/v1/invites" && req.method === "GET") {
    const rows = await env.DB.prepare(
      "SELECT code, label, share_mode, max_uses, uses, expires_at, created_at FROM invites WHERE from_agent = ? ORDER BY created_at DESC"
    )
      .bind(agent)
      .all();
    return json({ invites: rows.results || [] });
  }

  // Send / inbox / groups (protocol)
  if (path === "/v1/send" && req.method === "POST") {
    const body = await readJson(req);
    const envelope = String(body.envelope || "");
    if (!envelope) return bad("envelope required");
    const ttl = Math.max(60, Math.min(Number(body.ttl_seconds || 86400), 7 * 86400));
    const exp = now() + ttl;
    const targets: string[] = [];
    let groupId: string | null = null;
    if (body.to_group) {
      const g = await env.DB.prepare("SELECT members_json FROM groups WHERE group_id = ?")
        .bind(String(body.to_group))
        .first<{ members_json: string }>();
      if (!g) return bad("unknown group", 404);
      const members: string[] = JSON.parse(g.members_json);
      if (!members.includes(agent)) return bad("not a group member", 403);
      targets.push(...members.filter((m) => m !== agent));
      groupId = String(body.to_group);
    } else if (body.to) {
      targets.push(String(body.to));
    } else return bad("to or to_group required");

    const ids: string[] = [];
    for (const to of targets) {
      // optional: require active contact
      const mid = id(12);
      await env.DB.prepare(
        `INSERT INTO messages(id, to_agent, from_agent, group_id, envelope, created_at, expires_at, delivered)
         VALUES (?, ?, ?, ?, ?, ?, ?, 0)`
      )
        .bind(mid, to, agent, groupId, envelope, now(), exp)
        .run();
      ids.push(mid);
    }
    return json({ message_ids: ids });
  }

  if (path === "/v1/inbox" && req.method === "GET") {
    const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") || 20), 100));
    const t = now();
    const rows = await env.DB.prepare(
      `SELECT id, from_agent, group_id, envelope, created_at FROM messages
       WHERE to_agent = ? AND delivered = 0 AND expires_at > ?
       ORDER BY created_at ASC LIMIT ?`
    )
      .bind(agent, t, limit)
      .all();
    const msgs = rows.results || [];
    for (const m of msgs as any[]) {
      await env.DB.prepare("UPDATE messages SET delivered = 1 WHERE id = ?").bind(m.id).run();
    }
    return json({
      messages: msgs.map((m: any) => ({
        id: m.id,
        from: m.from_agent,
        group_id: m.group_id,
        envelope: m.envelope,
        created_at: m.created_at,
      })),
    });
  }

  if (path === "/v1/groups" && req.method === "POST") {
    const body = await readJson(req);
    const groupId = String(body.group_id || "").trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
    if (!groupId) return bad("group_id required");
    const title = String(body.title || groupId);
    let members = (body.members as string[]) || [];
    members = [...new Set(members.map(String))];
    if (!members.includes(agent)) members.push(agent);
    const existing = await env.DB.prepare("SELECT admin_agent FROM groups WHERE group_id = ?")
      .bind(groupId)
      .first<{ admin_agent: string }>();
    if (existing && existing.admin_agent !== agent) return bad("not group admin", 403);
    if (existing) {
      await env.DB.prepare("UPDATE groups SET title = ?, members_json = ? WHERE group_id = ?")
        .bind(title, JSON.stringify(members), groupId)
        .run();
    } else {
      await env.DB.prepare(
        `INSERT INTO groups(group_id, title, admin_agent, members_json, created_at) VALUES (?, ?, ?, ?, ?)`
      )
        .bind(groupId, title, agent, JSON.stringify(members), now())
        .run();
    }
    return json({ ok: true, group_id: groupId, members });
  }

  if (path === "/v1/groups" && req.method === "GET") {
    const all = await env.DB.prepare("SELECT group_id, title, admin_agent, members_json, created_at FROM groups").all();
    const mine = (all.results || []).filter((g: any) => {
      try {
        return JSON.parse(g.members_json).includes(agent);
      } catch {
        return false;
      }
    });
    return json({ groups: mine });
  }

  // Work context (non-private cloud board)
  if (path === "/v1/context" && req.method === "GET") {
    const row = await env.DB.prepare("SELECT fields_json, updated_at FROM work_context WHERE agent_id = ?")
      .bind(agent)
      .first<{ fields_json: string; updated_at: number }>();
    return json({ fields: JSON.parse(row?.fields_json || "{}"), updated_at: row?.updated_at || null });
  }

  if (path === "/v1/context" && req.method === "PUT") {
    const body = await readJson(req);
    const fields = body.fields && typeof body.fields === "object" ? body.fields : {};
    // strip obvious personal keys
    for (const k of DEFAULT_DENY) delete (fields as any)[k];
    delete (fields as any).private_notes;
    await env.DB.prepare(
      `INSERT INTO work_context(agent_id, fields_json, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(agent_id) DO UPDATE SET fields_json=excluded.fields_json, updated_at=excluded.updated_at`
    )
      .bind(agent, JSON.stringify(fields), now())
      .run();
    return json({ ok: true, fields });
  }

  // Setup pack for Hermes
  if (path === "/v1/setup-pack" && req.method === "GET") {
    const me = await env.DB.prepare("SELECT * FROM agents WHERE agent_id = ?").bind(agent).first();
    const contacts = await env.DB.prepare("SELECT * FROM contacts WHERE owner_agent = ?").bind(agent).all();
    const origin = originOf(req, env);
    const trustLinks = (contacts.results || []).map((c: any) => ({
      id: String(c.peer_agent).replace(/^mind:/, ""),
      display_name: c.display_name,
      status: c.status,
      agent: { kind: "hub", ref: c.peer_agent },
      delivery_default: "agent",
      share: JSON.parse(c.share_json || "{}"),
    }));
    const trustYaml = {
      version: 2,
      self: {
        agent_id: agent,
        surface: "telegram",
        ambient_default: true,
        hub_url: origin,
      },
      links: trustLinks,
    };
    return json({
      env: {
        MINDLINK_HUB_URL: origin,
        MINDLINK_HUB_TOKEN: "(your saved token)",
      },
      trust: trustYaml,
      hermes_steps: [
        "Install https://github.com/vyqno/hermes-mind-link && ./scripts/install.sh",
        "Put MINDLINK_HUB_URL + MINDLINK_HUB_TOKEN in ~/.hermes/.env",
        "Write trust.yaml from /v1/setup-pack into ~/.hermes/mind-link/trust.yaml",
        "Keep talking on Telegram to your Hermes bot",
      ],
      me,
    });
  }

  return bad("not found", 404);
}
