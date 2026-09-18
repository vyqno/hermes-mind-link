/* Mind-link UI — onboarding, contacts, invites, groups, inbox, setup */
const S = {
  token: localStorage.getItem("ml_token") || "",
  me: null,
  page: "home",
};

const $ = (sel) => document.querySelector(sel);
const main = () => $("#main");
const nav = () => $("#nav");

function api(path, opts = {}) {
  const headers = { "content-type": "application/json", ...(opts.headers || {}) };
  if (S.token) headers.authorization = `Bearer ${S.token}`;
  return fetch(path, { ...opts, headers }).then(async (r) => {
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
  const u = new URL(location.href);
  u.searchParams.set("p", page);
  Object.entries(params).forEach(([k, v]) => (v == null ? u.searchParams.delete(k) : u.searchParams.set(k, v)));
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
        ["dashboard", "Dashboard"],
        ["contacts", "Contacts"],
        ["invites", "Invites"],
        ["groups", "Groups"],
        ["inbox", "Inbox"],
        ["context", "Work board"],
        ["setup", "Hermes setup"],
      ]
    : [
        ["home", "Home"],
        ["onboard", "Get started"],
        ["login", "I have a token"],
      ];
  nav().innerHTML = items
    .map(
      ([id, label]) =>
        `<button class="${S.page === id ? "active" : ""}" onclick="route('${id}')">${label}</button>`
    )
    .join("");
  if (S.token) {
    nav().innerHTML += `<button class="ghost" onclick="logout()">Log out</button>`;
  }
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
    <h1>Your mind talks to their mind.<br/>You only open Telegram.</h1>
    <p>
      Mind-link is an open, Instinct-shaped mesh for Hermes.
      Humans stay on Telegram. Agents meet on a Cloudflare hub — anywhere in the world,
      no VPN. Share <strong>work</strong> with trusted contacts; dinner and personal life stay private.
    </p>
    <div class="actions">
      <button class="btn primary" onclick="route('onboard')">Create my mind</button>
      <button class="btn" onclick="route('login')">I already have a token</button>
      ${qs("invite") ? `<button class="btn" onclick="route('accept')">Accept invite ${esc(qs("invite"))}</button>` : ""}
    </div>
  </section>
  <div class="grid">
    <div class="card"><h3>Telegram daily UI</h3><p>Talk to your Hermes bot. Confirms say “Harshal’s agent”, not his phone.</p></div>
    <div class="card"><h3>Contacts & invites</h3><p>Add friends with a link. Pairwise privacy: work friends ≠ partner.</p></div>
    <div class="card"><h3>Groups of 5–6</h3><p>Fan-out ambient work updates to a circle. Each share policy still applies.</p></div>
    <div class="card"><h3>Cloudflare global</h3><p>Hub is HTTPS only outbound from home NAT. Same model as Instinct’s cloud.</p></div>
  </div>`;
}

function onboardView() {
  return `
  <div class="panel">
    <h2>Create your mind (2 minutes)</h2>
    <p class="muted">You’ll get a token once. Save it. Then connect Hermes + Telegram.</p>
    <label>Display name</label>
    <input id="ob_name" placeholder="Hitesh" />
    <label>Handle (becomes mind:handle)</label>
    <input id="ob_handle" placeholder="hitesh" pattern="[a-z0-9_]+" />
    <label>Telegram bot username (optional)</label>
    <input id="ob_tg" placeholder="@my_hermes_bot" />
    <div class="actions">
      <button class="btn primary" onclick="doRegister()">Create mind</button>
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
        telegram_bot: $("#ob_tg").value.trim() || null,
        agent_id: handle ? `mind:${handle}` : undefined,
      }),
    });
    setToken(data.token);
    S.me = null;
    out.innerHTML = `
      <p class="ok">Created <strong>${esc(data.agent_id)}</strong></p>
      <p class="warn">Copy this token now — it won’t be shown again.</p>
      <div class="token-box" id="tok">${esc(data.token)}</div>
      <div class="actions">
        <button class="btn" onclick="navigator.clipboard.writeText(document.getElementById('tok').innerText)">Copy token</button>
        <button class="btn primary" onclick="route('setup')">Continue to Hermes setup</button>
        <button class="btn" onclick="route('dashboard')">Open dashboard</button>
      </div>`;
  } catch (e) {
    out.innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

function loginView() {
  return `
  <div class="panel">
    <h2>Log in with token</h2>
    <label>Hub token</label>
    <textarea id="login_tok" placeholder="Paste MINDLINK_HUB_TOKEN"></textarea>
    <div class="actions">
      <button class="btn primary" onclick="doLogin()">Save & continue</button>
    </div>
    <div id="login_out"></div>
  </div>`;
}

async function doLogin() {
  const t = $("#login_tok").value.trim();
  setToken(t);
  S.me = null;
  try {
    await ensureMe();
    route("dashboard");
  } catch (e) {
    setToken("");
    $("#login_out").innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

function acceptView() {
  const code = qs("invite") || "";
  return `
  <div class="panel">
    <h2>Accept invite</h2>
    <p class="muted">Link minds with work-only privacy by default.</p>
    <label>Invite code</label>
    <input id="ac_code" value="${esc(code)}" />
    <label>Your handle (if new)</label>
    <input id="ac_handle" placeholder="yourname" />
    <label>Display name</label>
    <input id="ac_name" placeholder="Your name" />
    <p class="muted">Already have a token? Log in first, then accept — handle fields ignored.</p>
    <div class="actions">
      <button class="btn primary" onclick="doAccept()">Accept</button>
    </div>
    <div id="ac_out"></div>
  </div>`;
}

async function doAccept() {
  const out = $("#ac_out");
  try {
    const body = {
      code: $("#ac_code").value.trim(),
      handle: $("#ac_handle").value.trim(),
      display_name: $("#ac_name").value.trim(),
    };
    const data = await api("/v1/invites/accept", { method: "POST", body: JSON.stringify(body) });
    if (data.token) setToken(data.token);
    S.me = null;
    out.innerHTML = `<p class="ok">Linked with ${esc(data.linked_with)}</p>
      ${data.token ? `<p class="warn">New token — save it:</p><div class="token-box">${esc(data.token)}</div>` : ""}
      <div class="actions"><button class="btn primary" onclick="route('contacts')">View contacts</button></div>`;
  } catch (e) {
    out.innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

async function dashboardView() {
  const data = await ensureMe();
  const me = data.me;
  return `
  <section class="hero">
    <h1>Hi, ${esc(me.display_name)}</h1>
    <p class="muted">${esc(me.agent_id)} · handle @${esc(me.handle || "")}</p>
  </section>
  <div class="grid">
    <div class="card"><h3>Contacts</h3><p>${data.contacts.length} trusted minds</p>
      <div class="actions"><button class="btn" onclick="route('contacts')">Manage</button></div></div>
    <div class="card"><h3>Groups</h3><p>${data.groups.length} circles</p>
      <div class="actions"><button class="btn" onclick="route('groups')">Manage</button></div></div>
    <div class="card"><h3>Invite someone</h3><p>Share a link. They join in the browser.</p>
      <div class="actions"><button class="btn primary" onclick="route('invites')">Create invite</button></div></div>
    <div class="card"><h3>Hermes / Telegram</h3><p>Wire your bot with one setup pack.</p>
      <div class="actions"><button class="btn" onclick="route('setup')">Setup</button></div></div>
  </div>`;
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
        <span class="muted">${esc(c.peer_agent)} ${c.peer_handle ? "· @" + esc(c.peer_handle) : ""}</span>
        <div style="margin-top:6px">
          <span class="pill ${esc(c.status)}">${esc(c.status)}</span>
          <span class="pill">${esc(c.share_mode)}</span>
        </div>
      </div>
      <div class="actions" style="margin:0;flex-direction:column">
        <select onchange="patchContact('${esc(c.peer_agent)}', this.value)">
          <option value="work_only" ${c.share_mode === "work_only" ? "selected" : ""}>work_only</option>
          <option value="explicit_only" ${c.share_mode === "explicit_only" ? "selected" : ""}>explicit_only</option>
        </select>
        <button class="btn danger" onclick="delContact('${esc(c.peer_agent)}')">Remove</button>
      </div>
    </div>`
      )
      .join("") || `<p class="muted">No contacts yet. Create an invite.</p>`;

  return `
  <div class="panel">
    <h2>Contacts</h2>
    <p class="muted">Each contact has a share mode. Default denies dinner/health/family.</p>
    <div class="list">${list}</div>
    <h3 style="margin-top:18px">Add by mind id</h3>
    <div class="row">
      <input id="add_peer" placeholder="mind:harshal" />
      <input id="add_name" placeholder="Display name (optional)" />
    </div>
    <div class="actions">
      <button class="btn primary" onclick="addContact()">Add contact</button>
      <button class="btn" onclick="route('invites')">Or invite by link</button>
    </div>
    <div id="c_out"></div>
  </div>`;
}

async function addContact() {
  try {
    await api("/v1/contacts", {
      method: "POST",
      body: JSON.stringify({
        peer_agent: $("#add_peer").value.trim(),
        display_name: $("#add_name").value.trim() || undefined,
        share_mode: "work_only",
        status: "active",
      }),
    });
    route("contacts");
  } catch (e) {
    $("#c_out").innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

async function patchContact(peer, mode) {
  await api(`/v1/contacts/${encodeURIComponent(peer)}`, {
    method: "PATCH",
    body: JSON.stringify({ share_mode: mode }),
  });
  route("contacts");
}

async function delContact(peer) {
  if (!confirm("Remove contact?")) return;
  await api(`/v1/contacts/${encodeURIComponent(peer)}`, { method: "DELETE" });
  route("contacts");
}

async function invitesView() {
  const { invites } = await api("/v1/invites");
  const origin = location.origin;
  const list =
    invites
      .map(
        (i) => `
    <div class="item">
      <div>
        <strong>${esc(i.code)}</strong>
        <div class="muted">${esc(i.label || "Invite")} · ${esc(i.share_mode)} · ${i.uses}/${i.max_uses} uses</div>
        <div class="token-box" style="margin-top:8px">${esc(origin)}/?invite=${esc(i.code)}</div>
      </div>
      <button class="btn" onclick="navigator.clipboard.writeText('${origin}/?invite=${esc(i.code)}')">Copy link</button>
    </div>`
      )
      .join("") || `<p class="muted">No invites yet.</p>`;

  return `
  <div class="panel">
    <h2>Invites</h2>
    <p class="muted">Send a link to Harshal, GF, or the group. They open it on mobile.</p>
    <label>Label</label>
    <input id="inv_label" placeholder="Harshal work link" />
    <label>Share mode for new link</label>
    <select id="inv_mode">
      <option value="work_only">work_only (recommended)</option>
      <option value="explicit_only">explicit_only</option>
    </select>
    <label>Max uses</label>
    <input id="inv_uses" type="number" value="5" min="1" max="50" />
    <div class="actions">
      <button class="btn primary" onclick="createInvite()">Create invite link</button>
    </div>
    <div id="inv_out"></div>
    <h3 style="margin-top:18px">Your invites</h3>
    <div class="list">${list}</div>
  </div>`;
}

async function createInvite() {
  try {
    const data = await api("/v1/invites", {
      method: "POST",
      body: JSON.stringify({
        label: $("#inv_label").value.trim(),
        share_mode: $("#inv_mode").value,
        max_uses: Number($("#inv_uses").value || 5),
      }),
    });
    $("#inv_out").innerHTML = `<p class="ok">Created</p><div class="token-box">${esc(data.url)}</div>`;
    setTimeout(() => route("invites"), 400);
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
          <div class="muted">${esc(g.group_id)} · ${members.length} members</div>
          <div class="muted">${members.map(esc).join(", ")}</div></div></div>`;
      })
      .join("") || `<p class="muted">No groups.</p>`;

  return `
  <div class="panel">
    <h2>Groups</h2>
    <p class="muted">Friends circle, roommates, OSPYR core — ambient fan-out.</p>
    <div class="list">${list}</div>
    <h3 style="margin-top:18px">Create / update group</h3>
    <label>Group id</label>
    <input id="g_id" placeholder="friends-core" />
    <label>Title</label>
    <input id="g_title" placeholder="Friends" />
    <label>Members (comma-separated mind: ids, include yourself)</label>
    <textarea id="g_members" placeholder="mind:hitesh, mind:harshal, mind:gf"></textarea>
    <div class="actions"><button class="btn primary" onclick="saveGroup()">Save group</button></div>
    <div id="g_out"></div>
  </div>`;
}

async function saveGroup() {
  try {
    const members = $("#g_members")
      .value.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
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
  const { messages } = await api("/v1/inbox?limit=30");
  const list =
    messages
      .map(
        (m) => `<div class="item"><div>
        <strong>From ${esc(m.from)}</strong>
        <div class="muted">${m.group_id ? "group " + esc(m.group_id) : "direct"}</div>
        <pre class="cmd">${esc(m.envelope)}</pre>
      </div></div>`
      )
      .join("") || `<p class="muted">Inbox empty.</p>`;
  return `<div class="panel"><h2>Inbox</h2><p class="muted">Polled messages mark delivered (Hermes should poll too).</p><div class="list">${list}</div>
    <div class="actions"><button class="btn" onclick="route('inbox')">Refresh</button></div></div>`;
}

async function contextView() {
  const data = await api("/v1/context");
  const fields = data.fields || {};
  return `
  <div class="panel">
    <h2>Work board (cloud)</h2>
    <p class="muted">Only non-personal fields. Never put dinner here.</p>
    <label>project_name</label>
    <input id="f_project_name" value="${esc(fields.project_name || "")}" />
    <label>project_goal_public</label>
    <input id="f_project_goal_public" value="${esc(fields.project_goal_public || "")}" />
    <label>shared_task_status</label>
    <input id="f_shared_task_status" value="${esc(fields.shared_task_status || "")}" />
    <label>collab_blockers</label>
    <input id="f_collab_blockers" value="${esc(fields.collab_blockers || "")}" />
    <div class="actions"><button class="btn primary" onclick="saveContext()">Save</button></div>
    <div id="ctx_out"></div>
  </div>`;
}

async function saveContext() {
  const fields = {
    project_name: $("#f_project_name").value,
    project_goal_public: $("#f_project_goal_public").value,
    shared_task_status: $("#f_shared_task_status").value,
    collab_blockers: $("#f_collab_blockers").value,
  };
  Object.keys(fields).forEach((k) => !fields[k] && delete fields[k]);
  try {
    await api("/v1/context", { method: "PUT", body: JSON.stringify({ fields }) });
    $("#ctx_out").innerHTML = `<p class="ok">Saved</p>`;
  } catch (e) {
    $("#ctx_out").innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

async function setupView() {
  const pack = await api("/v1/setup-pack");
  const trust = JSON.stringify(pack.trust, null, 2);
  return `
  <div class="panel">
    <h2>Connect Hermes + Telegram</h2>
    <ol class="steps">
      <li>You already chat your Hermes bot on Telegram — keep that.</li>
      <li>On the machine running Hermes:
        <pre class="cmd">git clone https://github.com/vyqno/hermes-mind-link.git
cd hermes-mind-link && ./scripts/install.sh
hermes tools enable a2a --platform telegram</pre>
      </li>
      <li>Add to <code>~/.hermes/.env</code>:
        <pre class="cmd">MINDLINK_HUB_URL=${esc(pack.env.MINDLINK_HUB_URL)}
MINDLINK_HUB_TOKEN=&lt;your token from onboarding&gt;</pre>
      </li>
      <li>Write trust file from this pack:
        <pre class="cmd">${esc(trust)}</pre>
        <button class="btn" onclick='navigator.clipboard.writeText(${JSON.stringify(trust)})'>Copy trust JSON</button>
        <p class="muted">Convert to YAML under ~/.hermes/mind-link/trust.yaml (or paste links manually).</p>
      </li>
      <li>Optional CLI poll: <code>mind-link hub inbox</code></li>
    </ol>
    <p class="muted">Non-technical friends: you host their Hermes profile; they only get a Telegram bot invite — no setup pack.</p>
  </div>`;
}

async function render() {
  // invite deep link
  if (qs("invite") && !qs("p")) S.page = S.token ? "accept" : "accept";
  else if (qs("p")) S.page = qs("p");

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
      case "setup":
        html = await setupView();
        break;
      default:
        html = homeView();
    }
    el.innerHTML = html;
  } catch (e) {
    if (String(e.message).includes("unauthorized")) {
      setToken("");
      el.innerHTML = `<div class="panel"><p class="err">Session expired. Log in again.</p>
        <button class="btn" onclick="route('login')">Log in</button></div>`;
      renderNav();
      return;
    }
    el.innerHTML = `<div class="panel"><p class="err">${esc(e.message)}</p></div>`;
  }
}

// expose handlers
Object.assign(window, {
  route,
  logout,
  doRegister,
  doLogin,
  doAccept,
  addContact,
  patchContact,
  delContact,
  createInvite,
  saveGroup,
  saveContext,
});

render();
