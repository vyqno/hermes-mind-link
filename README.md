# Hermes Mind-link

**Open-source mind-to-mind agent mesh on [Hermes Agent](https://github.com/NousResearch/hermes-agent) (MIT).**

You talk to **your** agent on **Telegram**.  
When you say “ask Harshal…”, your agent asks **permission**, then messages **Harshal’s agent** — not Harshal’s personal chat — unless you explicitly choose human delivery.

```
You  ←Telegram→  Your Hermes mind
                      ↕  A2A / hermes peer  (agent mail)
Harshal  ←Telegram→  Harshal’s Hermes mind
```

Instinct (Spear Street) productized a similar **trusted-connection** idea behind an invite-only US number and cloud computer. Mind-link makes the **same topology** self-hostable on Hermes, with open protocol, trust registry, and send gates.

> Hermes already ships A2A, Telegram, Bot Mode, and `hermes peer`. This repo is the **policy + packaging layer** so anyone can install, run, and extend the 4-way mesh without reinventing the gateway.

## Why this exists

People are saying “Instinct killed Hermes / Claude.” That confuses **consumer packaging** with **capability**.

| | Instinct | Hermes + Mind-link |
|---|---|---|
| Interface | iMessage / WhatsApp / call, virtual number | Telegram (default here), WhatsApp optional, desktop, CLI |
| Computer | Their cloud VM + your connected accounts | **Your** machine / VPS — credentials stay yours |
| Agent ↔ agent | Trusted connections (closed) | **A2A open protocol** + trust.yaml |
| License | Proprietary SaaS | Hermes MIT + this repo MIT |
| Model lock-in | Their stack | Any provider Hermes supports |
| Setup | 30 seconds, invite-gated | Minutes–hours (honest trade for ownership) |

Even Greg Isenberg’s Instinct walkthrough (with Remy, Sep 2026) ends in a **stack split**, not a kill shot: work agents (Hermes / OpenClaw / Codex / Claude Code) vs personal life-admin polish (Instinct). See [`docs/instinct-vs-open-agents.md`](docs/instinct-vs-open-agents.md).

## Cloudflare UI (v0.4)

Full browser product under [`cloudflare/`](cloudflare/):

- Create mind · token login · **contacts** · **invite links** · groups · inbox · work board · Hermes setup pack
- D1 + Workers + static UI — Instinct-shaped onboarding for anyone

```bash
cd cloudflare && npm install
npx wrangler login
npx wrangler d1 create mind-link   # paste id into wrangler.toml
npm run db:remote && npm run deploy
```

Local UI: `cd cloudflare && npm run db:local && npm run dev` → http://127.0.0.1:8788

## Network model (how Instinct actually works)

Instinct does **not** VPN your laptop to your friend’s laptop.  
Everyone talks to **Instinct’s cloud**; the company routes agent mail.

Mind-link copies that shape with an open **Hub**:

```
You —Telegram→ your Hermes ──HTTPS──► Mind-link HUB ◄──HTTPS── friend’s Hermes ←Telegram— Friend
```

- Far away: fine
- Home NAT: fine (outbound only)
- GF / 5–6 friends: hub groups + per-person share policy
- Daily UX: Telegram only

Docs: [`docs/how-instinct-does-network.md`](docs/how-instinct-does-network.md) · [`docs/invite-friends.md`](docs/invite-friends.md)

```bash
./scripts/run-hub.sh   # VPS + HTTPS reverse proxy in front
mind-link hub --url https://your-hub register --agent-id mind:you --name You
```

## Install (Hermes users)

```bash
# 1. Clone
git clone https://github.com/vyqno/hermes-mind-link.git
cd hermes-mind-link

# 2. Install skill + templates into your Hermes home
./scripts/install.sh

# 3. Enable A2A tools on Telegram (human surface)
hermes tools enable a2a --platform telegram
hermes tools enable a2a --platform cli

# 4. Edit trust registry
$EDITOR ~/.hermes/mind-link/trust.yaml

# 5. (Optional) inbound A2A so friends can call YOUR mind
#    Put tokens ONLY in ~/.hermes/.env — never commit them
# A2A_PEER_TOKENS=friendname:$(openssl rand -hex 24)
# A2A_HOST=127.0.0.1
hermes config set gateway.platforms.a2a.enabled true
hermes gateway start
```

Requires: [Hermes Agent](https://hermes-agent.nousresearch.com/docs/) with Telegram already working (`hermes gateway setup`).

## Quick mental model

1. **Human surface** = Telegram DM with *your* bot.  
2. **Agent surface** = A2A / peer / local profile.  
3. **Confirm copy** always says **“Harshal’s agent”**, never implies you texted Harshal-human.  
4. **Standing grants** (optional) skip confirm for narrow scopes only — never money.  
5. **No password sharing.** Friends run their own agent; they share an **agent endpoint + token**, not Gmail.

## Repo layout

```
plugin/mind_link/     # installable Python package (trust + envelope + CLI)
skill/mind-link/      # Hermes skill (agent behavior)
templates/            # trust.yaml, SOUL snippet, a2a_agents example
scripts/install.sh    # copies into $HERMES_HOME
docs/                 # research + protocol
tests/                # unit tests (no network)
```

## Local pilot (no friend required)

```bash
./scripts/pilot-local.sh
```

Creates a second Hermes profile and dual A2A ports so you can prove:

`you → clarify → a2a_call → pilot mind → reply`

## Protocol

See [`docs/protocol.md`](docs/protocol.md). Envelope is plain text compatible with Hermes `a2a_call`:

```
[MIND-LINK]
from: mind:alice
to: agent:bob
intent: schedule
correlation_id: c7f3a1
requires_human_on_receipt: false
---
Can Saturday 20:00 work for dinner near Indiranagar?
```

## Privacy & ambient minds

Default-on while you chat: minds can share **work context** with linked peer agents.
Personal life (dinner, health, family, secrets) is **denied by default**.

See [`docs/privacy-ambient.md`](docs/privacy-ambient.md).

```bash
mind-link context set project_name "our collab"
mind-link context private "personal note — never shared"
mind-link preview-share harshal   # shows ONLY what their agent would get
```

## Security

- Confirm before first send (and always for money / legal / medical / reputation).
- Inbound A2A framed as untrusted peer input (Hermes already filters slash commands).
- Tokens in `.env` only; `trust.yaml` chmod 600.
- Never open `A2A_HOST=0.0.0.0` without bearer tokens + allowlist + network isolation (Tailscale recommended).

## Not a fork of Hermes

We **extend** Hermes. Upstream already has the hard parts (gateway, A2A plugin, Telegram). Mind-link stays a thin edge package so it survives Hermes upgrades.

Upstream A2A docs: https://hermes-agent.nousresearch.com/docs/user-guide/messaging/a2a

## Status

**v0.1.0** — skill + trust registry + CLI validators + install scripts + research brief.  
Roadmap: desktop plugin UI for links, invite QR for peer exchange, multi-hop scopes, Instinct-compatible “trusted connection” export.

## License

MIT. Hermes Agent is MIT (Nous Research). Instinct is a trademark of its owners; this project is not affiliated.
