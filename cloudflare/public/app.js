/* Mind-link UI — zero friction: create → connect Telegram → invite. No CLI. */
const S = {
  token: localStorage.getItem("ml_token") || "",
  me: null,
  page: "home",
  status: null,
};

const $ = (sel) => document.querySelector(sel);
const main = () => $("#main");
const nav = () => $("#nav");

function api(path, opts = {}) {
  const headers = { "content-type": "application/json", ...(opts.headers || {}) };
  if (S.token) headers.authorization = `Bearer ${S.token}`;
  return fetch(path, { ...opts, headers, credentials: "include" }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || r.statusText);
    return data;
  });
}

function setToken(t) {
  S.token = t || "";
  if (t) localStorage.setItem("ml_token", t);
  else localStorage.removeItem("ml_token");
}

function route(page, params = {}) {
  S.page = page;
  S.me = null;
  const u = new URL(location.href);
  u.searchParams.set("p", page);
  if (!params.invite && page !== "accept") u.searchParams.delete("invite");
  Object.entries(params).forEach(([k, v]) =>
    v == null ? u.searchParams.delete(k) : u.searchParams.set(k, v)
  );
  history.replaceState({}, "", u);
  render();
}

function qs(name) {
  return new URL(location.href).searchParams.get(name);
}

function esc(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderNav() {
  const items = S.token
    ? [
        ["home", "Home"],
        ["dashboard", "Home"],
        ["telegram", "Telegram"],
        ["contacts", "Contacts"],
        ["invites", "Invite"],
        ["groups", "Groups"],
        ["inbox", "Inbox"],
        ["context", "Work"],
      ]
    : [
        ["home", "Home"],
        ["onboard", "Get started"],
        ["login", "Log in"],
      ];
  // de-dupe dashboard/home label
  const seen = new Set();
  const clean = [];
  for (const [id, label] of items) {
    if (S.token && id === "home") continue;
    if (seen.has(label)) continue;
    seen.add(label);
    clean.push([id, label]);
  }
  nav().innerHTML = clean
    .map(
      ([id, label]) =>
        `<button class="${S.page === id ? "active" : ""}" onclick="route('${id}')">${label}</button>`
    )
    .join("");
  if (S.token) nav().innerHTML += `<button class="ghost" onclick="logout()">Log out</button>`;
}

function logout() {
  setToken("");
  S.me = null;
  route("home");
}

async function ensureMe() {
  if (!S.token) return null;
  if (S.me) return S.me;
  S.me = await api("/v1/me");
  return S.me;
}

function homeView() {
  return `
  <section class="hero">
    <h1>Text your mind.<br/>It talks to theirs.</h1>
    <p>
      Like Instinct — but open. You only use Telegram after a 30-second signup.
      No CLI, no VPN, no “save this poll yourself.” We deliver mind-mail for you.
    </p>
    <div class="actions">
      <button class="btn primary" onclick="route('onboard')">Get started free</button>
      ${qs("invite") ? `<button class="btn" onclick="route('accept')">Accept invite</button>` : `<button class="btn" onclick="route('login')">Log in</button>`}
    </div>
  </section>
  <div class="grid">
    <div class="card"><h3>1. Create mind</h3><p>Name + handle. Session saved automatically.</p></div>
    <div class="card"><h3>2. Connect Telegram</h3><p>One button → open bot → done.</p></div>
    <div class="card"><h3>3. Invite people</h3><p>Share a link. GF / friends / group of 6.</p></div>
    <div class="card"><h3>Privacy default</h3><p>Work only. Dinner & personal stay private.</p></div>
  </div>`;
}

function onboardView() {
  return `
  <div class="panel">
    <h2>Create your mind</h2>
    <p class="muted">30 seconds. No install. No token homework — we keep you signed in.</p>
    <label>Your name</label>
    <input id="ob_name" placeholder="Hitesh" autocomplete="name" />
    <label>Handle</label>
    <input id="ob_handle" placeholder="hitesh" pattern="[a-z0-9_]+" />
    <div class="actions">
      <button class="btn primary" onclick="doRegister()">Continue</button>
    </div>
    <div id="ob_out"></div>
  </div>`;
}

async function doRegister() {
  const out = $("#ob_out");
  out.innerHTML = `<p class="muted">Creating…</p>`;
  try {
    const handle = $("#ob_handle").value.trim().toLowerCase();
    const data = await api("/v1/register", {
      method: "POST",
      body: JSON.stringify({
        handle,
        display_name: $("#ob_name").value.trim() || handle,
      }),
    });
    setToken(data.token);
    S.me = null;
    route("telegram");
  } catch (e) {
    out.innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

function loginView() {
  return `
  <div class="panel">
    <h2>Log in</h2>
    <p class="muted">Paste the token only if you cleared browser data. Normal users stay signed in.</p>
    <textarea id="login_tok" placeholder="Token (optional recovery)"></textarea>
    <div class="actions"><button class="btn primary" onclick="doLogin()">Continue</button></div>
    <div id="login_out"></div>
  </div>`;
}

async function doLogin() {
  const t = $("#login_tok").value.trim();
  if (t) setToken(t);
  S.me = null;
  try {
    await ensureMe();
    route("dashboard");
  } catch (e) {
    $("#login_out").innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

function acceptView() {
  const code = qs("invite") || "";
  return `
  <div class="panel">
    <h2>Join a trusted mind</h2>
    <p class="muted">Accept invite → connect Telegram. That’s the whole onboarding.</p>
    <label>Invite code</label>
    <input id="ac_code" value="${esc(code)}" />
    <label>Your name</label>
    <input id="ac_name" placeholder="Your name" />
    <label>Handle</label>
    <input id="ac_handle" placeholder="yourname" />
    <div class="actions"><button class="btn primary" onclick="doAccept()">Join</button></div>
    <div id="ac_out"></div>
  </div>`;
}

async function doAccept() {
  const out = $("#ac_out");
  try {
    const data = await api("/v1/invites/accept", {
      method: "POST",
      body: JSON.stringify({
        code: $("#ac_code").value.trim(),
        handle: $("#ac_handle").value.trim(),
        display_name: $("#ac_name").value.trim(),
      }),
    });
    if (data.token) setToken(data.token);
    S.me = null;
    out.innerHTML = `<p class="ok">Linked with ${esc(data.linked_with)}</p>`;
    setTimeout(() => route("telegram"), 400);
  } catch (e) {
    out.innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

async function dashboardView() {
  const data = await ensureMe();
  const me = data.me;
  const needTg = data.needs?.telegram;
  return `
  <section class="hero">
    <h1>Hi, ${esc(me.display_name)}</h1>
    <p class="muted">${esc(me.agent_id)}</p>
  </section>
  ${
    needTg
      ? `<div class="panel" style="border-color:#0f766e">
    <h2>Next: Connect Telegram</h2>
    <p class="muted">This is the only setup step. After this, mind-mail arrives in Telegram automatically.</p>
    <div class="actions"><button class="btn primary" onclick="route('telegram')">Connect Telegram</button></div>
  </div>`
      : `<div class="panel"><p class="ok">Telegram linked ✓</p>
    <div class="actions">
      <button class="btn primary" onclick="route('invites')">Invite someone</button>
      <button class="btn" onclick="route('contacts')">Contacts</button>
    </div></div>`
  }
  <div class="grid" style="margin-top:14px">
    <div class="card"><h3>Contacts</h3><p>${data.contacts.length} minds</p></div>
    <div class="card"><h3>Groups</h3><p>${data.groups.length} circles</p></div>
  </div>`;
}

async function telegramView() {
  const st = await api("/v1/telegram/status");
  if (st.linked) {
    return `
    <div class="panel">
      <h2>Telegram connected ✓</h2>
      <p class="ok">@${esc(st.telegram_username || "linked")}</p>
      <p class="muted">Mind-mail is pushed here. You never run a poller or Hermes setup.</p>
      <div class="actions">
        <button class="btn primary" onclick="route('invites')">Invite friends</button>
        <button class="btn" onclick="route('dashboard')">Done</button>
      </div>
    </div>`;
  }
  if (!st.platform_ready) {
    return `
    <div class="panel">
      <h2>Almost ready</h2>
      <p class="warn">Platform Telegram bot isn’t configured on the server yet.</p>
      <p class="muted">Operator one-time: set Cloudflare secrets TELEGRAM_BOT_TOKEN + TELEGRAM_BOT_USERNAME, set webhook to /telegram/webhook. Users never see CLI.</p>
      <p class="muted">You can still invite contacts and use the web inbox meanwhile.</p>
      <div class="actions"><button class="btn" onclick="route('invites')">Continue to invites</button></div>
    </div>`;
  }
  return `
  <div class="panel">
    <h2>Connect Telegram</h2>
    <p class="muted">One tap. Opens our bot. That’s it — no Hermes, no tokens to copy.</p>
    <div class="actions">
      <button class="btn primary" id="tg_btn" onclick="pairTelegram()">Open Telegram to link</button>
    </div>
    <div id="tg_out" class="muted" style="margin-top:12px"></div>
  </div>`;
}

async function pairTelegram() {
  const out = $("#tg_out");
  out.innerHTML = "Creating secure link…";
  try {
    const data = await api("/v1/telegram/pair", { method: "POST", body: "{}" });
    out.innerHTML = `<p>Tap below on your phone. Link expires in 15 minutes.</p>
      <div class="actions"><a class="btn primary" href="${esc(data.deep_link)}" target="_blank" rel="noreferrer">Open @ bot</a></div>
      <p class="muted">After Telegram says Linked, come back — we’ll detect it.</p>
      <div class="actions"><button class="btn" onclick="route('telegram')">I’ve linked — refresh</button></div>`;
    // try open
    window.open(data.deep_link, "_blank");
  } catch (e) {
    out.innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

async function contactsView() {
  const { contacts } = await api("/v1/contacts");
  const list =
    contacts
      .map(
        (c) => `
    <div class="item">
      <div>
        <strong>${esc(c.display_name)}</strong>
        <div class="muted">${esc(c.peer_agent)}</div>
        <span class="pill ${esc(c.status)}">${esc(c.status)}</span>
        <span class="pill">${esc(c.share_mode)}</span>
      </div>
      <div class="actions" style="margin:0;flex-direction:column">
        <select onchange="patchContact('${esc(c.peer_agent)}', this.value)">
          <option value="work_only" ${c.share_mode === "work_only" ? "selected" : ""}>work only</option>
          <option value="explicit_only" ${c.share_mode === "explicit_only" ? "selected" : ""}>ask every time</option>
        </select>
        <button class="btn danger" onclick="delContact('${esc(c.peer_agent)}')">Remove</button>
      </div>
    </div>`
      )
      .join("") || `<p class="muted">No contacts. Invite someone.</p>`;
  return `<div class="panel"><h2>Contacts</h2>
    <p class="muted">What their agent may learn. Default blocks dinner/health/family.</p>
    <div class="list">${list}</div>
    <div class="actions"><button class="btn primary" onclick="route('invites')">Invite by link</button></div>
  </div>`;
}

async function patchContact(peer, mode) {
  await api(`/v1/contacts/${encodeURIComponent(peer)}`, {
    method: "PATCH",
    body: JSON.stringify({ share_mode: mode }),
  });
  route("contacts");
}
async function delContact(peer) {
  if (!confirm("Remove?")) return;
  await api(`/v1/contacts/${encodeURIComponent(peer)}`, { method: "DELETE" });
  route("contacts");
}

async function invitesView() {
  const { invites } = await api("/v1/invites");
  const list =
    invites
      .map(
        (i) => `
    <div class="item">
      <div>
        <strong>${esc(i.label || i.code)}</strong>
        <div class="muted">${i.uses}/${i.max_uses} uses · ${esc(i.share_mode)}</div>
        <div class="token-box">${esc(location.origin)}/?invite=${esc(i.code)}</div>
      </div>
      <button class="btn" onclick="navigator.clipboard.writeText('${location.origin}/?invite=${esc(i.code)}')">Copy</button>
    </div>`
      )
      .join("") || `<p class="muted">No invites yet.</p>`;
  return `
  <div class="panel">
    <h2>Invite</h2>
    <p class="muted">Send one link. They join in the browser, then connect Telegram. No setup pack.</p>
    <label>Label</label>
    <input id="inv_label" placeholder="Harshal" />
    <div class="actions"><button class="btn primary" onclick="createInvite()">Create invite link</button></div>
    <div id="inv_out"></div>
    <h3 style="margin-top:16px">Your links</h3>
    <div class="list">${list}</div>
  </div>`;
}

async function createInvite() {
  try {
    const data = await api("/v1/invites", {
      method: "POST",
      body: JSON.stringify({ label: $("#inv_label").value.trim(), share_mode: "work_only", max_uses: 10 }),
    });
    $("#inv_out").innerHTML = `<div class="token-box">${esc(data.url)}</div>
      <button class="btn" onclick="navigator.clipboard.writeText('${esc(data.url)}')">Copy link</button>`;
    setTimeout(() => route("invites"), 500);
  } catch (e) {
    $("#inv_out").innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

async function groupsView() {
  const { groups } = await api("/v1/groups");
  const list =
    groups
      .map((g) => {
        const members = JSON.parse(g.members_json || "[]");
        return `<div class="item"><div><strong>${esc(g.title || g.group_id)}</strong>
        <div class="muted">${members.map(esc).join(", ")}</div></div></div>`;
      })
      .join("") || `<p class="muted">No groups.</p>`;
  return `
  <div class="panel">
    <h2>Groups</h2>
    <div class="list">${list}</div>
    <label>Group id</label><input id="g_id" placeholder="friends-core" />
    <label>Title</label><input id="g_title" placeholder="Friends" />
    <label>Members (mind: ids)</label>
    <textarea id="g_members" placeholder="mind:you, mind:harshal, mind:gf"></textarea>
    <div class="actions"><button class="btn primary" onclick="saveGroup()">Save</button></div>
    <div id="g_out"></div>
  </div>`;
}

async function saveGroup() {
  try {
    const members = $("#g_members").value.split(",").map((s) => s.trim()).filter(Boolean);
    await api("/v1/groups", {
      method: "POST",
      body: JSON.stringify({
        group_id: $("#g_id").value.trim(),
        title: $("#g_title").value.trim(),
        members,
      }),
    });
    route("groups");
  } catch (e) {
    $("#g_out").innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

async function inboxView() {
  const { messages } = await api("/v1/inbox?limit=40");
  const list =
    messages
      .map(
        (m) => `<div class="item"><div>
        <strong>${esc(m.from)}</strong>
        <span class="pill">${m.notified ? "pushed" : "queued"}</span>
        <pre class="cmd">${esc(m.envelope)}</pre>
      </div></div>`
      )
      .join("") || `<p class="muted">Empty. When linked, new mail also hits Telegram.</p>`;
  return `<div class="panel"><h2>Inbox</h2><p class="muted">We push to Telegram — you don’t run poll jobs.</p>
    <div class="list">${list}</div>
    <button class="btn" onclick="route('inbox')">Refresh</button></div>`;
}

async function contextView() {
  const data = await api("/v1/context");
  const f = data.fields || {};
  return `
  <div class="panel">
    <h2>Work board</h2>
    <p class="muted">Only work fields. Never dinner.</p>
    <label>Project</label><input id="f_project_name" value="${esc(f.project_name || "")}" />
    <label>Goal</label><input id="f_project_goal_public" value="${esc(f.project_goal_public || "")}" />
    <label>Status</label><input id="f_shared_task_status" value="${esc(f.shared_task_status || "")}" />
    <div class="actions"><button class="btn primary" onclick="saveContext()">Save</button></div>
    <div id="ctx_out"></div>
  </div>`;
}

async function saveContext() {
  const fields = {
    project_name: $("#f_project_name").value,
    project_goal_public: $("#f_project_goal_public").value,
    shared_task_status: $("#f_shared_task_status").value,
  };
  Object.keys(fields).forEach((k) => !fields[k] && delete fields[k]);
  try {
    await api("/v1/context", { method: "PUT", body: JSON.stringify({ fields }) });
    $("#ctx_out").innerHTML = `<p class="ok">Saved</p>`;
  } catch (e) {
    $("#ctx_out").innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

async function render() {
  if (qs("invite") && !S.token && !qs("p")) S.page = "accept";
  else if (qs("p")) S.page = qs("p");
  // map old setup page away
  if (S.page === "setup") S.page = "telegram";

  renderNav();
  const el = main();
  el.innerHTML = `<p class="muted">Loading…</p>`;
  try {
    let html = "";
    switch (S.page) {
      case "home":
        html = homeView();
        break;
      case "onboard":
        html = onboardView();
        break;
      case "login":
        html = loginView();
        break;
      case "accept":
        html = acceptView();
        break;
      case "dashboard":
        html = await dashboardView();
        break;
      case "telegram":
        html = await telegramView();
        break;
      case "contacts":
        html = await contactsView();
        break;
      case "invites":
        html = await invitesView();
        break;
      case "groups":
        html = await groupsView();
        break;
      case "inbox":
        html = await inboxView();
        break;
      case "context":
        html = await contextView();
        break;
      default:
        html = homeView();
    }
    el.innerHTML = html;
  } catch (e) {
    if (String(e.message).includes("unauthorized")) {
      setToken("");
      el.innerHTML = `<div class="panel"><p class="err">Please log in again.</p>
        <button class="btn" onclick="route('onboard')">Get started</button></div>`;
      renderNav();
      return;
    }
    el.innerHTML = `<div class="panel"><p class="err">${esc(e.message)}</p></div>`;
  }
}

Object.assign(window, {
  route,
  logout,
  doRegister,
  doLogin,
  doAccept,
  pairTelegram,
  patchContact,
  delContact,
  createInvite,
  saveGroup,
  saveContext,
});

render();
