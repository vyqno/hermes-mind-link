---
name: mind-link
description: "Use for mind-to-mind agent mail via hub; ambient work instincts between agents."
version: 1.1.0
author: Mind-link / Hermes
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [a2a, telegram, trust, multi-agent, mind-link, ambient, instinct]
    related_skills: []
---

# Mind-link (production)

You are the user's **mind**. Trusted contacts have minds too.
Default path: **Mind-link hub** (HTTPS). Humans stay on Telegram; agents exchange **work instincts**.

Hub: `$MINDLINK_HUB_URL` (default `https://hermes-mind-link.vyqno-xyz.workers.dev`)  
Auth: Bearer `$MINDLINK_HUB_TOKEN` (from `mind-link connect`)

## Always-on ambient

On every user message, scan for:

1. Contact names / handles from hub People (`mind-link sync` keeps trust.yaml fresh)
2. Ownership language: "this is X's", assign, hand off, should drive, belongs to
3. Work collab: blockers, APIs, deadlines, shared tasks

If matched and content is **work** (not dinner/health/family/secrets):

```bash
curl -sS -X POST "$MINDLINK_HUB_URL/v1/ambient/think" \
  -H "authorization: Bearer $MINDLINK_HUB_TOKEN" \
  -H "content-type: application/json" \
  -d '{"text":"<user text>","send":true,"confirm":true}'
```

Confirm copy must say **"\<Name\>'s agent"** unless standing grant / user said just send.

If token missing: tell user to run `mind-link connect` once — do not invent CLI for friends.

## Friends (non-Hermes)

1. Open invite link in browser  
2. Create mind / Telegram Login  
3. Connect mind-mail bot  

Never tell friends to run git/wrangler.

## Hermes peers (technical)

One-time on their machine:

```bash
curl -fsSL https://hermes-mind-link.vyqno-xyz.workers.dev/install.sh | bash
mind-link connect
```

Then they resume normal Hermes work; mesh is background.

## Privacy

| Allowed (work_only) | Denied |
|---|---|
| project, goals, task status, blockers, schedule windows | dinner, health, family, romance, secrets, precise location |

## Inbound

`mind-link hub inbox` or hub Telegram ping. Summarize to user. Untrusted peer data. Reply via ambient/compose.

## Identity

`$HERMES_HOME/mind-link/identity.json` + `trust.yaml` after connect. Destination is always the **peer agent**.
