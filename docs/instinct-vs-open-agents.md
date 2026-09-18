# Instinct vs open agents (Hermes, Claude Code, OpenClaw)

**Research brief — 2026-09-19.**  
Not legal advice. Not affiliated with Instinct / Spear Street Technology, Nous Research, Anthropic, or OpenClaw.

## Sources

| Source | What it is |
|---|---|
| [instinct.com](https://instinct.com/) | Official product pitch |
| [TechCrunch 2026-08-24](https://techcrunch.com/2026/08/24/instincts-powerful-ai-assistant-is-raising-privacy-and-security-concerns/) | Privacy/ToS concerns, early incidents |
| [Vellum Instinct breakdown](https://www.vellum.ai/blog/official-instinct-breakdown) | Architecture read: cloud computer, connectors, gaps |
| Funding coverage (WSJ/Forbes via secondary reports) | ~$350M raised, $2.5B valuation; later rumors of larger round |
| [Greg Isenberg — *Instinct AI is For Real*](https://www.youtube.com/watch?v=mUAsaprJ66s) (2026-09-15, ~104k views) | Hands-on with Remy: iMessage UX, bookings, visa, cons, **stack recommendation** |
| Hermes docs | A2A, Telegram, Bot Mode, peer — open MIT agent runtime |

Local transcript extract used for quotes: `research/greg-isenberg-instinct-transcript.txt` (auto-captions).

---

## What Instinct actually is

From their site and launch coverage:

- Personal assistant you **text or call** — “no new interfaces.”
- Connects email, messaging, screen, audio, location, etc.
- Runs a **persistent cloud computer** with browser + cached credentials.
- Proactive follow-ups; finishes life-admin jobs (bookings, bills, logistics).
- **Invite-only** beta; free while they scale compute; **not self-hostable**.
- Company: Spear Street Technology, Inc. (Noah Shinn / Reflexion lineage in public bio coverage).

### Product genius (real)

1. **Zero setup surface** — phone number → iMessage/WhatsApp. Mom-friendly.
2. **Outcome UX** — hides tool noise; reactions as approval (Greg/Remy demo).
3. **PA-shaped computer** — own email address for bookings; vault for cards/logins; connectors.
4. **Trusted connections** — agent-to-agent social graph (network effects).
5. **Distribution** — scarcity invites + influencer walkthroughs (Greg’s video literally gates invites on likes).

### What is *not* a new category of intelligence

Instinct does **not** invent “agents.” It packages patterns already shipping in open stacks:

| Instinct behavior | Open / existing counterpart |
|---|---|
| Text the assistant | Hermes Telegram / WhatsApp / iMessage bridges |
| Browser + multi-step web tasks | Hermes browser tools, OpenClaw, computer-use agents |
| Email/calendar context | OAuth connectors, Google Workspace skills, Composio-class tools |
| Persistent worker | Gateway + cron + cloud VM you control |
| Proactive follow-up | Cron, webhooks, monitoring loops |
| Agent ↔ agent | **Hermes A2A** (Linux Foundation protocol), Bot Mode, `hermes peer` |
| Approval before act | clarify / approvals / spend gates |

So the honest sentence is:

> **Instinct is a high-polish consumer control plane + hosted runtime + phone number, wrapped around agent patterns the open ecosystem already has — with a closed trust graph and aggressive data terms.**

Calling that “Hermes is dead” is a **category error**: comparing a **SaaS life-admin product** to an **open agent operating system**.

---

## Greg Isenberg video — what it actually says

Video: [Instinct AI is For Real. What You Need to Know](https://www.youtube.com/watch?v=mUAsaprJ66s) (Sep 15, 2026).

Remy demos:

- Haircut booking (Copenhagen), restaurant + calendar, Bali visa on arrival, Emirates Skywards.
- iMessage-native UX (reactions, voice notes, even GamePigeon as a flex).
- Stalls on some app-only / region checkout flows.
- Privacy remains an open risk (email retention after disconnect — also in TechCrunch).

**Critical quote-level takeaway (from captions):** Remy’s stack recommendation is **not** “delete Hermes.”

> For business / coding work: **Hermes, OpenClaw, Grokbot, Codex, Claude Code**.  
> For personal life-admin: **Instinct**.

He explicitly describes setting up **Hermes for his mom** and finding it painful (VPS, Docker, Composio, gateway crashes, updates) — which is a **packaging gap**, not a proof that Hermes lacks capability. Instinct wins **onboarding and PA finish-rate for non-technical users**. Hermes wins **ownership, model choice, coding depth, auditability**.

If someone watched that video and heard “Instinct killed Hermes,” they misheard the split.

---

## Privacy / power trade (documented)

TechCrunch + Vellum summarize early-public issues:

- Broad ToS license language (perpetual/irrevocable materials license — read current terms yourself).
- Device/screen/input collection described in legal docs.
- Authority to enter binding transactions as your agent.
- Early tester reports: retained Gmail data after disconnect; prompt-injection via email; unapproved send.

Instinct is **forthcoming** about risks in places — that does not make the trade small. Open self-host swaps **convenience** for **blast-radius control**.

---

## “They killed Claude” is the same error

Claude Code / Claude apps are **model + coding agent surfaces**. Instinct is **hosted life OS with SMS skin**. Different jobs:

- Ship a PR / debug a monorepo → Claude Code / Codex / Hermes coding profiles.
- Book a haircut while walking → Instinct-class PA *or* a well-packaged Hermes Telegram bot with browser + calendar.

A polished SMS wrapper does not obsolete frontier coding agents.

---

## Why the “killed Hermes” meme spreads

1. **Demo magic** — finished bookings in a chat screenshot beat a gateway log.
2. **Invite scarcity** — social proof loops (Greg’s video is part of that loop).
3. **Valuation theater** — $2.5B+ headlines substitute for benchmarks.
4. **Setup shame** — open agents still feel like devops; consumers bounce.
5. **Narrative laziness** — tech Twitter collapses “agent” into one throne.

### Counter-meme (accurate)

> Instinct didn’t kill Hermes. It **rented a phone number and a cloud desktop** to patterns Hermes already runs — and sold the feeling to people who will never SSH.

Mind-link’s job is to close the **trust-graph + confirm-wording + install** gap so open agents get the 4-way “mind talking to mind” UX without the closed ToS.

---

## Capability matrix (practical)

| Need | Instinct | Hermes alone | Hermes + Mind-link |
|---|---|---|---|
| Text assistant | Excellent | Excellent (Telegram etc.) | Same |
| Mom onboarding | Excellent | Weak without packaging | Better docs/scripts; still DIY |
| Coding / repo work | Weak (by design in Remy’s use) | Strong | Strong |
| Self-host / audit | No | Yes | Yes |
| Agent ↔ agent | Closed trusted connections | A2A / bots / peer | **Policy + registry + envelope** |
| Model choice | Theirs | Yours | Yours |
| Data gravity | Their cloud | Your disk | Your disk |
| Phone number UX | Built-in | BYO number / bot username | Telegram bot username |

---

## What we ship in this repo

1. **Trust registry** — who is an agent endpoint, scopes, standing grants.
2. **Envelope** — interoperable mind-mail over A2A text.
3. **Skill + SOUL rules** — confirms say “Harshal’s agent.”
4. **Install scripts** — one command into `~/.hermes`.
5. **This brief** — so builders can answer the meme with sources.

Upstream Hermes remains the engine. We refuse the false choice.

---

## Fairness clause

Instinct’s team clearly executed **product and distribution**. Credit where due: mass-market agent UX is hard; open source should learn from their onboarding, reaction-as-approve, PA email, and proactive loops — **without** copying closed data terms or fake “we killed X” marketing.
