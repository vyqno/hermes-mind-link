/* Mind-link — Instinct-parity UI. No terminal. Telegram + browser only. */
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
  if (page !== "accept") u.searchParams.delete("invite");
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
        ["think", "Think"],
        ["inbox", "Inbox"],
        ["contacts", "People"],
        ["invites", "Invite"],
        ["telegram", "Telegram"],
        ["groups", "Groups"],
        ["context", "Work board"],
      ]
    : [
        ["home", "Home"],
        ["onboard", "Get started"],
        ["login", "Log in"],
      ];
  nav().innerHTML = items
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
    <h1>Your mind talks to their mind.<br/>No apps to learn. No terminal.</h1>
    <p>
      Instinct-style trusted connections — open, on Cloudflare.
      Think out loud. We detect people like Harshal, send <strong>their agent</strong> work context only,
      and ping them on Telegram. Dinner stays private.
    </p>
    <div class="actions">
      <button class="btn primary" onclick="route('onboard')">Get started</button>
      ${qs("invite") ? `<button class="btn" onclick="route('accept')">Accept invite</button>` : `<button class="btn" onclick="route('login')">Log in</button>`}
    </div>
  </section>
  <div class="grid">
    <div class="card"><h3>Think</h3><p>“This is Harshal’s thing” → his agent, not a random DM dump.</p></div>
    <div class="card"><h3>Telegram</h3><p>One link. Friends never open a terminal.</p></div>
    <div class="card"><h3>Privacy</h3><p>Work only by default. You control each person.</p></div>
    <div class="card"><h3>Groups</h3><p>5–6 friends, same mesh, pairwise rules.</p></div>
  </div>`;
}

function onboardView() {
  return `
  <div class="panel">
    <h2>Create your mind</h2>
    <p class="muted">Name + handle. Signed in automatically. No tokens to copy.</p>
    <label>Name</label>
    <input id="ob_name" placeholder="Hitesh" />
    <label>Handle</label>
    <input id="ob_handle" placeholder="hitesh" />
    <div class="actions"><button class="btn primary" onclick="doRegister()">Continue</button></div>
    <div id="ob_out"></div>
  </div>`;
}

async function doRegister() {
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
    $("#ob_out").innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

function loginView() {
  return `
  <div class="panel">
    <h2>Log in</h2>
    <p class="muted">Only if you cleared browser data.</p>
    <textarea id="login_tok" placeholder="Recovery token"></textarea>
    <div class="actions"><button class="btn primary" onclick="doLogin()">Continue</button></div>
    <div id="login_out"></div>
  </div>`;
}

async function doLogin() {
  const t = $("#login_tok").value.trim();
  if (t) setToken(t);
  try {
    S.me = null;
    await ensureMe();
    route("think");
  } catch (e) {
    $("#login_out").innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

function acceptView() {
  return `
  <div class="panel">
    <h2>Join a trusted mind</h2>
    <p class="muted">Invite → Telegram. Zero terminal.</p>
    <label>Invite code</label>
    <input id="ac_code" value="${esc(qs("invite") || "")}" />
    <label>Your name</label>
    <input id="ac_name" />
    <label>Handle</label>
    <input id="ac_handle" />
    <div class="actions"><button class="btn primary" onclick="doAccept()">Join</button></div>
    <div id="ac_out"></div>
  </div>`;
}

async function doAccept() {
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
    route("telegram");
  } catch (e) {
    $("#ac_out").innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

async function thinkView() {
  const data = await ensureMe();
  const needTg = data.needs?.telegram;
  const contacts = data.contacts || [];
  const opts = contacts
    .map((c) => `<option value="${esc(c.peer_agent)}">${esc(c.display_name)}</option>`)
    .join("");
  return `
  ${
    needTg
      ? `<div class="panel" style="border-color:#0f766e;margin-bottom:14px">
    <strong>Connect Telegram</strong> so pings actually land.
    <button class="btn primary" style="margin-left:8px" onclick="route('telegram')">Connect</button>
  </div>`
      : ""
  }
  <div class="panel">
    <h2>Think out loud</h2>
    <p class="muted">Like Instinct: say “this is Harshal’s thing” — we match his mind, scrub personal stuff, send his <em>agent</em>.</p>
    <textarea id="think_text" placeholder="e.g. This API ownership is Harshal's thing — he should drive the contract. I'm blocked until he decides."></textarea>
    <div class="actions">
      <button class="btn" onclick="analyzeThink()">Detect who</button>
      <button class="btn primary" onclick="sendThink(false)">Preview</button>
      <button class="btn primary" onclick="sendThink(true)">Send to their agent(s)</button>
    </div>
    <div id="think_out"></div>
  </div>
  <div class="panel">
    <h2>Message one mind</h2>
    <label>To</label>
    <select id="compose_to"><option value="">Select contact</option>${opts}</select>
    <label>Message</label>
    <textarea id="compose_text" placeholder="Work context only…"></textarea>
    <div class="actions"><button class="btn primary" onclick="composeSend()">Send to their agent</button></div>
    <div id="compose_out"></div>
  </div>`;
}

async function analyzeThink() {
  const text = $("#think_text").value;
  const out = $("#think_out");
  try {
    const data = await api("/v1/ambient/analyze", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
    if (data.would_block) {
      out.innerHTML = `<p class="err">Blocked as personal/sensitive. Nothing would send.</p>`;
      return;
    }
    if (!data.matches?.length) {
      out.innerHTML = `<p class="warn">No contact matched. Invite them under People first.</p>
        <pre class="cmd">${esc(data.scrubbed)}</pre>`;
      return;
    }
    out.innerHTML = `<p class="ok">Matched: ${data.matches.map((m) => esc(m.display_name)).join(", ")}</p>
      <p class="muted">Intent: ${esc(data.classification.intent)} · TG linked: ${data.matches
        .map((m) => (m.telegram_linked ? "yes" : "no"))
        .join("/")}</p>
      <pre class="cmd">${esc(data.scrubbed)}</pre>`;
  } catch (e) {
    out.innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

async function sendThink(doSend) {
  const text = $("#think_text").value;
  const out = $("#think_out");
  try {
    const data = await api("/v1/ambient/think", {
      method: "POST",
      body: JSON.stringify({ text, send: doSend, confirm: true }),
    });
    if (data.preview) {
      out.innerHTML = `<p class="warn">Preview → ${esc((data.targets || []).join(", ") || "nobody")}</p>
        <pre class="cmd">${esc(data.scrubbed || "")}</pre>
        <p class="muted">${esc(data.message || "Click Send to deliver.")}</p>`;
      return;
    }
    if (!data.ok) {
      out.innerHTML = `<p class="err">${esc(data.message || data.reason)}</p>`;
      return;
    }
    out.innerHTML = `<p class="ok">Sent to agent(s): ${esc((data.targets || []).join(", "))}</p>
      <p class="muted">They get a Telegram ping if linked. Not a raw dump of your private chat.</p>`;
  } catch (e) {
    out.innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

async function composeSend() {
  const out = $("#compose_out");
  try {
    const data = await api("/v1/compose", {
      method: "POST",
      body: JSON.stringify({
        to: $("#compose_to").value,
        text: $("#compose_text").value,
      }),
    });
    out.innerHTML = `<p class="ok">Sent to ${esc(data.display_name)}'s agent</p>`;
    $("#compose_text").value = "";
  } catch (e) {
    out.innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

async function telegramView() {
  const st = await api("/v1/telegram/status");
  if (st.linked) {
    return `<div class="panel"><h2>Telegram linked ✓</h2>
      <p class="ok">@${esc(st.telegram_username || "you")}</p>
      <p class="muted">Mind-mail pushes here. Friends never use a terminal.</p>
      <button class="btn primary" onclick="route('think')">Start thinking</button></div>`;
  }
  if (!st.platform_ready) {
    return `<div class="panel"><h2>Telegram</h2>
      <p class="warn">Platform bot not ready on server.</p></div>`;
  }
  return `<div class="panel"><h2>Connect Telegram</h2>
    <p class="muted">One button. Opens @${esc(st.bot_username)}. No setup pack.</p>
    <button class="btn primary" onclick="pairTelegram()">Open Telegram to link</button>
    <div id="tg_out"></div>
    <button class="btn" style="margin-top:10px" onclick="route('telegram')">I’ve linked — refresh</button>
  </div>`;
}

async function pairTelegram() {
  try {
    const data = await api("/v1/telegram/pair", { method: "POST", body: "{}" });
    $("#tg_out").innerHTML = `<p class="muted">Opens bot with one-time code.</p>
      <a class="btn primary" href="${esc(data.deep_link)}" target="_blank" rel="noreferrer">Open bot</a>`;
    window.open(data.deep_link, "_blank");
  } catch (e) {
    $("#tg_out").innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

async function contactsView() {
  const { contacts } = await api("/v1/contacts");
  const list =
    contacts
      .map(
        (c) => `<div class="item"><div>
        <strong>${esc(c.display_name)}</strong>
        <div class="muted">${esc(c.peer_agent)}</div>
        <span class="pill">${esc(c.share_mode)}</span>
      </div>
      <select onchange="patchContact('${esc(c.peer_agent)}', this.value)">
        <option value="work_only" ${c.share_mode === "work_only" ? "selected" : ""}>work only</option>
        <option value="explicit_only" ${c.share_mode === "explicit_only" ? "selected" : ""}>ask every time</option>
      </select></div>`
      )
      .join("") || `<p class="muted">No people yet. Invite someone.</p>`;
  return `<div class="panel"><h2>People</h2>
    <p class="muted">Trusted minds. Default: work only — not dinner, not secrets.</p>
    <div class="list">${list}</div>
    <button class="btn primary" onclick="route('invites')">Invite</button></div>`;
}

async function patchContact(peer, mode) {
  await api(`/v1/contacts/${encodeURIComponent(peer)}`, {
    method: "PATCH",
    body: JSON.stringify({ share_mode: mode }),
  });
  route("contacts");
}

async function invitesView() {
  const { invites } = await api("/v1/invites");
  const list =
    invites
      .map(
        (i) => `<div class="item"><div>
        <strong>${esc(i.label || i.code)}</strong>
        <div class="token-box">${esc(location.origin)}/?invite=${esc(i.code)}</div>
      </div>
      <button class="btn" onclick="navigator.clipboard.writeText('${location.origin}/?invite=${esc(i.code)}')">Copy</button></div>`
      )
      .join("") || `<p class="muted">None yet.</p>`;
  return `<div class="panel"><h2>Invite</h2>
    <p class="muted">Harshal / GF / friends: one link. They never see a terminal.</p>
    <input id="inv_label" placeholder="Harshal" />
    <button class="btn primary" onclick="createInvite()">Create link</button>
    <div id="inv_out"></div>
    <div class="list" style="margin-top:14px">${list}</div></div>`;
}

async function createInvite() {
  const data = await api("/v1/invites", {
    method: "POST",
    body: JSON.stringify({ label: $("#inv_label").value.trim(), share_mode: "work_only", max_uses: 20 }),
  });
  $("#inv_out").innerHTML = `<div class="token-box">${esc(data.url)}</div>`;
  setTimeout(() => route("invites"), 400);
}

async function groupsView() {
  const { groups } = await api("/v1/groups");
  const list =
    groups
      .map((g) => {
        const m = JSON.parse(g.members_json || "[]");
        return `<div class="item"><div><strong>${esc(g.title || g.group_id)}</strong>
          <div class="muted">${m.map(esc).join(", ")}</div></div></div>`;
      })
      .join("") || `<p class="muted">No groups.</p>`;
  return `<div class="panel"><h2>Groups</h2><div class="list">${list}</div>
    <input id="g_id" placeholder="friends-core" />
    <input id="g_title" placeholder="Friends" />
    <textarea id="g_members" placeholder="mind:you, mind:harshal"></textarea>
    <button class="btn primary" onclick="saveGroup()">Save group</button>
    <div id="g_out"></div></div>`;
}

async function saveGroup() {
  try {
    await api("/v1/groups", {
      method: "POST",
      body: JSON.stringify({
        group_id: $("#g_id").value.trim(),
        title: $("#g_title").value.trim(),
        members: $("#g_members")
          .value.split(",")
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    });
    route("groups");
  } catch (e) {
    $("#g_out").innerHTML = `<p class="err">${esc(e.message)}</p>`;
  }
}

async function inboxView() {
  const { messages } = await api("/v1/inbox?limit=50");
  const list =
    messages
      .map(
        (m) => `<div class="item"><div>
        <strong>${esc(m.from)}</strong>
        <span class="pill">${m.notified ? "pushed" : "queued"}</span>
        <pre class="cmd">${esc(m.envelope)}</pre>
      </div></div>`
      )
      .join("") || `<p class="muted">Empty.</p>`;
  return `<div class="panel"><h2>Inbox</h2>
    <p class="muted">Also pushed to Telegram when linked.</p>
    <div class="list">${list}</div>
    <button class="btn" onclick="route('inbox')">Refresh</button></div>`;
}

async function contextView() {
  const data = await api("/v1/context");
  const f = data.fields || {};
  return `<div class="panel"><h2>Work board</h2>
    <input id="f_project_name" placeholder="project" value="${esc(f.project_name || "")}" />
    <input id="f_project_goal_public" placeholder="goal" value="${esc(f.project_goal_public || "")}" />
    <input id="f_shared_task_status" placeholder="status" value="${esc(f.shared_task_status || "")}" />
    <button class="btn primary" onclick="saveContext()">Save</button>
    <div id="ctx_out"></div></div>`;
}

async function saveContext() {
  const fields = {
    project_name: $("#f_project_name").value,
    project_goal_public: $("#f_project_goal_public").value,
    shared_task_status: $("#f_shared_task_status").value,
  };
  Object.keys(fields).forEach((k) => !fields[k] && delete fields[k]);
  await api("/v1/context", { method: "PUT", body: JSON.stringify({ fields }) });
  $("#ctx_out").innerHTML = `<p class="ok">Saved</p>`;
}

async function render() {
  if (qs("invite") && !S.token) S.page = "accept";
  else if (qs("p")) S.page = qs("p");
  if (S.page === "setup" || S.page === "dashboard" || S.page === "home") {
    if (S.token && S.page !== "home") S.page = S.page === "dashboard" ? "think" : S.page;
  }
  if (S.token && (S.page === "home" || S.page === "dashboard")) S.page = "think";

  renderNav();
  const el = main();
  el.innerHTML = `<p class="muted">Loading…</p>`;
  try {
    const map = {
      home: homeView,
      onboard: onboardView,
      login: loginView,
      accept: acceptView,
      think: thinkView,
      telegram: telegramView,
      contacts: contactsView,
      invites: invitesView,
      groups: groupsView,
      inbox: inboxView,
      context: contextView,
    };
    const fn = map[S.page] || homeView;
    el.innerHTML = await fn();
  } catch (e) {
    if (String(e.message).includes("unauthorized")) {
      setToken("");
      el.innerHTML = `<div class="panel"><p class="err">Session expired.</p>
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
  analyzeThink,
  sendThink,
  composeSend,
  pairTelegram,
  patchContact,
  createInvite,
  saveGroup,
  saveContext,
});

render();
