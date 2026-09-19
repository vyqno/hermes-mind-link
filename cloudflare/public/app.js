/* Mind-link UI — minimal auth, Telegram first, clear agent mail */
const S = {
  token: localStorage.getItem("ml_token") || "",
  me: null,
  page: "home",
  busy: false,
};

const $ = (sel) => document.querySelector(sel);
const main = () => $("#main");
const nav = () => $("#nav");

function api(path, opts = {}) {
  const headers = { "content-type": "application/json", ...(opts.headers || {}) };
  if (S.token) headers.authorization = `Bearer ${S.token}`;
  return fetch(path, { ...opts, headers, credentials: "include" }).then(async (r) => {
    const data = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error(data.error || r.statusText || "Request failed");
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

function toast(el, html, kind = "muted") {
  if (!el) return;
  el.innerHTML = `<p class="${kind}">${html}</p>`;
}

function copy(text) {
  return navigator.clipboard.writeText(text);
}

function renderNav() {
  const items = S.token
    ? [
        ["think", "Think"],
        ["inbox", "Inbox"],
        ["contacts", "People"],
        ["invites", "Invite"],
        ["telegram", "Telegram"],
        ["how", "How it works"],
      ]
    : [
        ["home", "Home"],
        ["onboard", "Get started"],
        ["login", "Log in"],
        ["how", "How it works"],
      ];
  nav().innerHTML = items
    .map(
      ([id, label]) =>
        `<button type="button" class="${S.page === id ? "active" : ""}" data-route="${id}">${label}</button>`
    )
    .join("");
  if (S.token) {
    nav().innerHTML += `<button type="button" class="ghost" data-action="logout">Log out</button>`;
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
    <div class="eyebrow"><i></i> Open agent mesh</div>
    <h1>Your mind talks<br/>to their mind.</h1>
    <p>
      Work instincts travel agent-to-agent. Humans stay on Telegram.
      One connect for Hermes — then resume normal work.
    </p>
    <div class="actions">
      <button type="button" class="btn primary" data-route="onboard">Create mind</button>
      ${
        qs("invite")
          ? `<button type="button" class="btn" data-route="accept">Accept invite</button>`
          : `<button type="button" class="btn" data-route="login">Log in</button>`
      }
      <button type="button" class="btn ghost" data-route="how">How it works</button>
    </div>
  </section>
  <div class="grid" style="max-width:900px;margin:0 auto">
    <div class="card"><h3>Browser</h3><p>Create mind · invite · Telegram link · Think.</p></div>
    <div class="card"><h3>Hermes</h3><p><span class="mono">mind-link connect</span> once — auto trust + env + SOUL.</p></div>
    <div class="card"><h3>Mesh</h3><p>Agents share work-only context. Dinner stays private.</p></div>
    <div class="card"><h3>Install</h3><p class="mono" style="font-size:11px">curl -fsSL …/install.sh | bash</p></div>
  </div>`;
}

function howView() {
  return `
  <div class="shell">
    <div class="panel">
      <h2>How their agent reports to yours</h2>
      <p class="lead">
        There is no laptop-to-laptop tunnel. Both minds talk to the same Cloudflare hub.
        Delivery is agent inbox first; Telegram is the human ping.
      </p>

      <div class="flow">
        <div class="flow-row">
          <div class="flow-node">
            <strong>Harshal</strong>
            <span>Talks to his mind on Telegram / hub Think</span>
          </div>
          <div class="flow-arrow">→</div>
          <div class="flow-node">
            <strong>Harshal’s agent</strong>
            <span>Scrubs personal stuff · work_only policy</span>
          </div>
        </div>
        <div class="flow-row">
          <div class="flow-node">
            <strong>Hub (Worker + D1)</strong>
            <span>POST /v1/compose or /v1/ambient/think · stores envelope</span>
          </div>
          <div class="flow-arrow">→</div>
          <div class="flow-node">
            <strong>Your inbox</strong>
            <span>Message for mind:you · optional Telegram push</span>
          </div>
        </div>
        <div class="flow-row">
          <div class="flow-node">
            <strong>Your Hermes</strong>
            <span>Polls /v1/inbox or you open Inbox here</span>
          </div>
          <div class="flow-arrow">→</div>
          <div class="flow-node">
            <strong>You</strong>
            <span>Summary on Telegram / this UI — never raw private dump</span>
          </div>
        </div>
      </div>

      <h3>What actually moves</h3>
      <ul class="steps">
        <li><strong>Envelope</strong> — short work note: project, blocker, ask, link. Dinner/health/family blocked.</li>
        <li><strong>Notify</strong> — if Telegram is linked, hub bot pings the human: “mail for your agent.”</li>
        <li><strong>Hermes path</strong> — set <code>MINDLINK_HUB_TOKEN</code> on your machine so Hermes can poll and reply as your mind.</li>
        <li><strong>A2A (optional later)</strong> — direct peer sockets. Hub already works without it.</li>
      </ul>

      <div class="actions">
        <button type="button" class="btn primary" data-route="${S.token ? "think" : "onboard"}">
          ${S.token ? "Open Think" : "Get started"}
        </button>
        <button type="button" class="btn" data-route="home">Back</button>
      </div>
    </div>
  </div>`;
}

function onboardView() {
  return `
  <div class="shell">
    <div class="panel">
      <h2>Create your mind</h2>
      <p class="lead">Two fields. Then connect Telegram. No passwords — the browser keeps a recovery token.</p>
      <label for="ob_name">Name</label>
      <input id="ob_name" autocomplete="name" placeholder="Your name" />
      <label for="ob_handle">Handle</label>
      <input id="ob_handle" autocomplete="username" placeholder="alex" pattern="[a-z0-9_]+" />
      <p class="field-hint">Becomes <span class="mono">mind:handle</span> · lowercase letters, numbers, _</p>
      <div class="actions">
        <button type="button" class="btn primary" id="btn_register">Continue</button>
        <button type="button" class="btn ghost" data-route="login">I already have a token</button>
      </div>
      <div id="ob_out"></div>
    </div>
  </div>`;
}

async function doRegister() {
  const out = $("#ob_out");
  const btn = $("#btn_register");
  if (S.busy) return;
  S.busy = true;
  if (btn) btn.disabled = true;
  toast(out, "Creating…", "muted");
  try {
    const handle = ($("#ob_handle").value || "").trim().toLowerCase();
    const display = ($("#ob_name").value || "").trim() || handle;
    if (!handle) throw new Error("Handle is required");
    const data = await api("/v1/register", {
      method: "POST",
      body: JSON.stringify({
        handle,
        display_name: display,
        agent_id: `mind:${handle}`,
      }),
    });
    setToken(data.token);
    S.me = null;
    out.innerHTML = `
      <p class="ok" style="margin-top:16px">Created <strong>${esc(data.agent_id)}</strong></p>
      <p class="warn">Save this recovery token once. We keep it in this browser too.</p>
      <div class="token-box" id="tok">${esc(data.token)}</div>
      <div class="actions">
        <button type="button" class="btn" data-copy-tok>Copy token</button>
        <button type="button" class="btn primary" data-route="telegram">Connect Telegram</button>
      </div>`;
  } catch (e) {
    toast(out, esc(e.message), "err");
  } finally {
    S.busy = false;
    if (btn) btn.disabled = false;
  }
}

function loginView() {
  return `
  <div class="shell">
    <div class="panel">
      <h2>Log in</h2>
      <p class="lead">Only needed if you cleared site data. Paste the recovery token from create/join.</p>
      <label for="login_tok">Recovery token</label>
      <textarea id="login_tok" placeholder="Paste token" autocomplete="off" spellcheck="false"></textarea>
      <div class="actions">
        <button type="button" class="btn primary" id="btn_login">Continue</button>
        <button type="button" class="btn ghost" data-route="onboard">Create new mind</button>
      </div>
      <div id="login_out"></div>
    </div>
  </div>`;
}

async function doLogin() {
  const out = $("#login_out");
  const t = ($("#login_tok").value || "").trim();
  if (!t) return toast(out, "Paste a token first", "err");
  setToken(t);
  S.me = null;
  try {
    await ensureMe();
    route("think");
  } catch (e) {
    setToken("");
    toast(out, esc(e.message), "err");
  }
}

function acceptView() {
  const code = qs("invite") || "";
  return `
  <div class="shell">
    <div class="panel">
      <h2>Join a trusted mind</h2>
      <p class="lead">Invite → create account → connect Telegram. Zero terminal.</p>
      <label for="ac_code">Invite code</label>
      <input id="ac_code" value="${esc(code)}" autocomplete="off" />
      <label for="ac_name">Your name</label>
      <input id="ac_name" placeholder="Your name" autocomplete="name" />
      <label for="ac_handle">Handle</label>
      <input id="ac_handle" placeholder="yourhandle" autocomplete="username" />
      <div class="actions">
        <button type="button" class="btn primary" id="btn_accept">Join</button>
      </div>
      <div id="ac_out"></div>
    </div>
  </div>`;
}

async function doAccept() {
  const out = $("#ac_out");
  try {
    const data = await api("/v1/invites/accept", {
      method: "POST",
      body: JSON.stringify({
        code: ($("#ac_code").value || "").trim(),
        handle: ($("#ac_handle").value || "").trim(),
        display_name: ($("#ac_name").value || "").trim(),
      }),
    });
    if (data.token) setToken(data.token);
    S.me = null;
    out.innerHTML = `
      <p class="ok" style="margin-top:16px">Linked with <strong>${esc(data.linked_with)}</strong></p>
      ${
        data.token
          ? `<p class="warn">Recovery token (save once)</p><div class="token-box" id="tok">${esc(data.token)}</div>
             <div class="actions"><button type="button" class="btn" data-copy-tok>Copy token</button></div>`
          : ""
      }
      <div class="actions">
        <button type="button" class="btn primary" data-route="telegram">Connect Telegram</button>
        <button type="button" class="btn" data-route="contacts">See People</button>
      </div>`;
  } catch (e) {
    toast(out, esc(e.message), "err");
  }
}

async function thinkView() {
  const data = await ensureMe();
  const me = data.me || data;
  const needTg = data.needs?.telegram;
  const contacts = data.contacts || [];
  const opts = contacts
    .map((c) => `<option value="${esc(c.peer_agent)}">${esc(c.display_name || c.peer_agent)}</option>`)
    .join("");

  return `
  <div class="shell">
    ${
      needTg
        ? `<div class="banner">
            <div><strong>Connect Telegram</strong><span>Pings won’t reach your phone until you link.</span></div>
            <button type="button" class="btn primary" data-route="telegram">Link now</button>
          </div>`
        : ""
    }
    <div class="panel">
      <h2>Think out loud</h2>
      <p class="lead">
        Signed in as <strong>${esc(me.display_name || me.agent_id || "")}</strong>
        <span class="mono"> · ${esc(me.agent_id || "")}</span>
      </p>
      <label for="think_text">What are you thinking?</label>
      <textarea id="think_text" placeholder="e.g. This API ownership is Harshal’s — he should drive the contract. I’m blocked until he decides."></textarea>
      <div class="actions">
        <button type="button" class="btn" id="btn_analyze">Detect who</button>
        <button type="button" class="btn" id="btn_preview">Preview</button>
        <button type="button" class="btn primary" id="btn_send">Send to their agent</button>
      </div>
      <div id="think_out"></div>
    </div>
    <div class="panel slim" style="margin-top:16px">
      <h2>Message one mind</h2>
      <label for="compose_to">To</label>
      <select id="compose_to"><option value="">Select contact</option>${opts}</select>
      <label for="compose_text">Message</label>
      <textarea id="compose_text" placeholder="Work context only…"></textarea>
      <div class="actions">
        <button type="button" class="btn primary" id="btn_compose">Send to their agent</button>
      </div>
      <div id="compose_out"></div>
    </div>
  </div>`;
}

async function analyzeThink() {
  const out = $("#think_out");
  try {
    const data = await api("/v1/ambient/analyze", {
      method: "POST",
      body: JSON.stringify({ text: $("#think_text").value }),
    });
    if (data.would_block) return toast(out, "Blocked as personal/sensitive. Nothing would send.", "err");
    if (!data.matches?.length) {
      out.innerHTML = `<p class="warn">No contact matched. Invite them under Invite first.</p>
        <div class="code-box">${esc(data.scrubbed || "")}</div>`;
      return;
    }
    out.innerHTML = `<p class="ok">Matched: ${data.matches.map((m) => esc(m.display_name)).join(", ")}</p>
      <p class="muted">Intent: ${esc(data.classification?.intent || "work")} · TG linked: ${data.matches
        .map((m) => (m.telegram_linked ? "yes" : "no"))
        .join(" / ")}</p>
      <div class="code-box">${esc(data.scrubbed || "")}</div>`;
  } catch (e) {
    toast(out, esc(e.message), "err");
  }
}

async function sendThink(doSend) {
  const out = $("#think_out");
  try {
    const data = await api("/v1/ambient/think", {
      method: "POST",
      body: JSON.stringify({ text: $("#think_text").value, send: doSend, confirm: true }),
    });
    if (data.preview) {
      out.innerHTML = `<p class="warn">Preview → ${esc((data.targets || []).join(", ") || "nobody")}</p>
        <div class="code-box">${esc(data.scrubbed || "")}</div>
        <p class="muted">${esc(data.message || "Click Send to deliver to their agent.")}</p>`;
      return;
    }
    if (!data.ok) return toast(out, esc(data.message || data.reason || "Failed"), "err");
    out.innerHTML = `<p class="ok">Sent to agent(s): ${esc((data.targets || []).join(", "))}</p>
      <p class="muted">They get a Telegram ping if linked. Not a raw dump of your private chat.</p>`;
  } catch (e) {
    toast(out, esc(e.message), "err");
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
    out.innerHTML = `<p class="ok">Sent to ${esc(data.display_name || data.to || "their")}'s agent</p>`;
    $("#compose_text").value = "";
  } catch (e) {
    toast(out, esc(e.message), "err");
  }
}

async function telegramView() {
  const st = await api("/v1/telegram/status");
  if (st.linked) {
    return `
    <div class="shell"><div class="panel center">
      <p><span class="status-dot on"></span><span class="ok">Telegram linked</span></p>
      <h2 style="margin-top:8px">@${esc(st.telegram_username || "you")}</h2>
      <p class="lead">Mind-mail can push here. Friends never need a terminal.</p>
      <div class="actions" style="justify-content:center">
        <button type="button" class="btn primary" data-route="think">Start thinking</button>
        <button type="button" class="btn" data-route="invites">Invite someone</button>
      </div>
    </div></div>`;
  }
  if (!st.platform_ready) {
    return `
    <div class="shell"><div class="panel">
      <h2>Telegram</h2>
      <p class="warn">Platform bot not ready on server. Operator must set TELEGRAM_BOT_TOKEN.</p>
    </div></div>`;
  }
  return `
  <div class="shell"><div class="panel">
    <h2>Connect Telegram</h2>
    <p class="lead">
      The pair code is created <strong>here</strong>, then carried into
      @${esc(st.bot_username || "Skw92io_bot")}. The bot never invents a code after a bare /start.
    </p>
    <ol class="steps">
      <li><strong>Generate code</strong> with the button (shows <span class="mono">/start link_XXXX</span>).</li>
      <li><strong>Open that deep link</strong> (or paste the command into the bot).</li>
      <li><strong>Tap Start</strong> once — bot replies Linked ✓ within ~1 min.</li>
      <li><strong>Refresh</strong> this page for the green status.</li>
    </ol>
    <div class="actions">
      <button type="button" class="btn primary" id="btn_pair">Generate code + open bot</button>
      <button type="button" class="btn" data-route="telegram">Refresh status</button>
    </div>
    <div id="tg_out"></div>
  </div></div>`;
}

async function pairTelegram() {
  const out = $("#tg_out");
  try {
    const data = await api("/v1/telegram/pair", { method: "POST", body: "{}" });
    const cmd = `/start link_${data.code}`;
    out.innerHTML = `
      <p class="ok" style="margin-top:14px">Pair code ready (not sent by the bot — you bring it).</p>
      <div class="token-box" id="pair_cmd">${esc(cmd)}</div>
      <p class="muted">Either tap Open bot (preferred) or paste that line into @${esc(
        (data.deep_link || "").split("t.me/")[1]?.split("?")[0] || "Skw92io_bot"
      )}.</p>
      <div class="actions">
        <a class="btn primary" href="${esc(data.deep_link)}" target="_blank" rel="noreferrer">Open @bot with code</a>
        <button type="button" class="btn" data-copy="${esc(cmd)}">Copy /start command</button>
      </div>
      <p class="muted">After Start, wait up to ~1 minute for “Linked ✓”. Plain /start with no code will not link.</p>`;
    out.querySelectorAll("[data-copy]").forEach((b) =>
      b.addEventListener("click", () => copy(b.getAttribute("data-copy")))
    );
    if (data.deep_link) window.open(data.deep_link, "_blank");
  } catch (e) {
    toast(out, esc(e.message), "err");
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
        <div class="meta mono">${esc(c.peer_agent)}</div>
        <span class="pill ${c.status === "active" ? "ok" : "warn"}">${esc(c.status)}</span>
        <span class="pill">${esc(c.share_mode)}</span>
        ${c.peer_tg || c.telegram_linked ? `<span class="pill ok">TG</span>` : ""}
      </div>
      <select data-patch-contact="${esc(c.peer_agent)}">
        <option value="work_only" ${c.share_mode === "work_only" ? "selected" : ""}>work only</option>
        <option value="explicit_only" ${c.share_mode === "explicit_only" ? "selected" : ""}>ask every time</option>
      </select>
    </div>`
      )
      .join("") || `<p class="muted">No people yet. Create an invite.</p>`;

  return `
  <div class="shell"><div class="panel">
    <h2>People</h2>
    <p class="lead">Trusted minds. Default share is work only — not dinner, not secrets.</p>
    <div class="list">${list}</div>
    <div class="actions">
      <button type="button" class="btn primary" data-route="invites">Invite</button>
    </div>
  </div></div>`;
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
  const origin = location.origin;
  const list =
    invites
      .map(
        (i) => `
    <div class="item">
      <div>
        <strong>${esc(i.label || i.code)}</strong>
        <div class="meta">${esc(i.share_mode)} · ${i.uses}/${i.max_uses} uses</div>
        <div class="token-box">${esc(origin)}/?invite=${esc(i.code)}</div>
      </div>
      <button type="button" class="btn" data-copy="${esc(origin)}/?invite=${esc(i.code)}">Copy</button>
    </div>`
      )
      .join("") || `<p class="muted">None yet.</p>`;

  return `
  <div class="shell"><div class="panel">
    <h2>Invite</h2>
    <p class="lead">One link. They never see a terminal (unless they run Hermes and want agent mesh).</p>
    <label for="inv_label">Label</label>
    <input id="inv_label" placeholder="Friend / teammate" />
    <div class="actions">
      <button type="button" class="btn primary" id="btn_invite">Create link</button>
    </div>
    <div id="inv_out"></div>
    <h3>Your links</h3>
    <div class="list">${list}</div>
  </div></div>`;
}

async function createInvite() {
  const out = $("#inv_out");
  try {
    const data = await api("/v1/invites", {
      method: "POST",
      body: JSON.stringify({
        label: ($("#inv_label").value || "").trim() || "Invite",
        share_mode: "work_only",
        max_uses: 20,
      }),
    });
    out.innerHTML = `<p class="ok">Created</p><div class="token-box">${esc(data.url)}</div>
      <div class="actions"><button type="button" class="btn" data-copy="${esc(data.url)}">Copy link</button></div>`;
    setTimeout(() => route("invites"), 600);
  } catch (e) {
    toast(out, esc(e.message), "err");
  }
}

async function inboxView() {
  const { messages } = await api("/v1/inbox?limit=50");
  const list =
    messages
      .map(
        (m) => `<div class="item"><div>
        <strong>${esc(m.from)}</strong>
        <span class="pill ${m.notified ? "ok" : ""}">${m.notified ? "pushed" : "queued"}</span>
        <div class="code-box">${esc(m.envelope)}</div>
      </div></div>`
      )
      .join("") || `<p class="muted">Empty. When their agent writes you, it shows here and can ping Telegram.</p>`;
  return `
  <div class="shell"><div class="panel">
    <h2>Inbox</h2>
    <p class="lead">Agent mail for you. Hermes can poll the same feed with your hub token.</p>
    <div class="list">${list}</div>
    <div class="actions"><button type="button" class="btn" data-route="inbox">Refresh</button></div>
  </div></div>`;
}

function deviceView() {
  const code = (qs("code") || "").toUpperCase();
  return `
  <div class="shell"><div class="panel">
    <h2>Approve Hermes device</h2>
    <p class="lead">A machine running Hermes is asking to link as <em>your</em> mind. Approve only if you started <span class="mono">mind-link connect</span>.</p>
    <label for="dev_code">Device code</label>
    <input id="dev_code" value="${esc(code)}" autocomplete="off" />
    <div class="actions">
      <button type="button" class="btn primary" id="btn_dev_approve">Approve</button>
      <button type="button" class="btn ghost" data-route="think">Cancel</button>
    </div>
    <div id="dev_out"></div>
  </div></div>`;
}

async function doDeviceApprove() {
  const out = $("#dev_out");
  try {
    const data = await api("/v1/device/approve", {
      method: "POST",
      body: JSON.stringify({ user_code: ($("#dev_code").value || "").trim() }),
    });
    out.innerHTML = `<p class="ok">Approved for ${esc(data.agent_id)}. Return to the terminal — connect will finish.</p>`;
  } catch (e) {
    toast(out, esc(e.message), "err");
  }
}

async function render() {
  if (qs("invite") && !S.token) S.page = "accept";
  else if (qs("p")) S.page = qs("p");
  if (S.token && (S.page === "home" || S.page === "onboard" || S.page === "login")) {
    if (S.page !== "device") S.page = qs("p") === "device" ? "device" : "think";
  }
  if (!S.token && qs("p") === "device") S.page = "login";

  renderNav();
  const el = main();
  el.innerHTML = `<div class="shell"><div class="panel"><div class="skeleton" style="width:40%"></div><div class="skeleton" style="width:70%;margin-top:12px"></div></div></div>`;
  try {
    const map = {
      home: () => homeView(),
      how: () => howView(),
      onboard: () => onboardView(),
      login: () => loginView(),
      accept: () => acceptView(),
      think: () => thinkView(),
      telegram: () => telegramView(),
      contacts: () => contactsView(),
      invites: () => invitesView(),
      inbox: () => inboxView(),
      device: () => deviceView(),
    };
    const fn = map[S.page] || homeView;
    el.innerHTML = await fn();
    wire(el);
  } catch (e) {
    if (String(e.message).toLowerCase().includes("unauthorized")) {
      setToken("");
      el.innerHTML = `<div class="shell"><div class="panel"><p class="err">Session expired.</p>
        <div class="actions"><button type="button" class="btn primary" data-route="login">Log in</button></div></div></div>`;
      renderNav();
      wire(el);
      return;
    }
    el.innerHTML = `<div class="shell"><div class="panel"><p class="err">${esc(e.message)}</p></div></div>`;
  }
}

function wire(root) {
  root.querySelectorAll("[data-route]").forEach((b) =>
    b.addEventListener("click", () => route(b.getAttribute("data-route")))
  );
  root.querySelectorAll("[data-copy]").forEach((b) =>
    b.addEventListener("click", () => copy(b.getAttribute("data-copy")))
  );
  const tokBtn = root.querySelector("[data-copy-tok]");
  if (tokBtn) tokBtn.addEventListener("click", () => copy(($("#tok") || {}).innerText || ""));

  const brand = $("#brand");
  if (brand) brand.onclick = () => route(S.token ? "think" : "home");

  nav().querySelectorAll("[data-route]").forEach((b) =>
    b.addEventListener("click", () => route(b.getAttribute("data-route")))
  );
  const lo = nav().querySelector('[data-action="logout"]');
  if (lo) lo.onclick = logout;

  const map = {
    btn_register: doRegister,
    btn_login: doLogin,
    btn_accept: doAccept,
    btn_analyze: analyzeThink,
    btn_preview: () => sendThink(false),
    btn_send: () => sendThink(true),
    btn_compose: composeSend,
    btn_pair: pairTelegram,
    btn_invite: createInvite,
    btn_dev_approve: doDeviceApprove,
  };
  Object.entries(map).forEach(([id, fn]) => {
    const el = root.querySelector("#" + id);
    if (el) el.addEventListener("click", fn);
  });
  root.querySelectorAll("[data-patch-contact]").forEach((sel) =>
    sel.addEventListener("change", () => patchContact(sel.getAttribute("data-patch-contact"), sel.value))
  );
}

render();
