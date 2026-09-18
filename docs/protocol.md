# Mind-link protocol v0.1

## Goals

- Address **agents**, not humans, by default.
- Work over Hermes **A2A** (HTTP JSON-RPC) without a proprietary network.
- Keep humans in control of outbound representation.
- Stay readable in Telegram confirms (plain-text envelope).

## Actors

| Actor | Example |
|---|---|
| Human A | You on Telegram |
| Mind A | Your Hermes gateway session |
| Mind B | Friend's Hermes (or any A2A peer) |
| Human B | Friend, only if Mind B escalates |

## Transport

1. **Preferred:** Hermes A2A — `a2a_call` / inbound Agent Card at `/.well-known/agent-card.json`
2. **Same org:** Bot Mode `message_agent` / `hermes peer`
3. **Fallback:** shared group with two bots (noisy; not default)

## Envelope

Plain text body of an A2A message:

```
[MIND-LINK]
from: mind:<id>
to: agent:<id>
intent: <ping|schedule|ask|relay|other>
correlation_id: <hex>
requires_human_on_receipt: false|true
---
<natural language for the receiving mind>
```

Replies use `[MIND-LINK-REPLY]` and the same `correlation_id`.

## Trust

Local file `$HERMES_HOME/mind-link/trust.yaml` maps human-facing names → agent endpoints and scopes.
Tokens never live in the trust file.

## Confirm semantics

Before Mind A sends to Mind B:

- If scope ∉ standing_grants → human confirm
- Confirm UI labels destination as **"<Name>'s agent"**
- Money / legal / medical / reputation → always confirm

## Non-goals (v0.1)

- Replacing Instinct's virtual phone numbers
- Automatic access to a friend's email without their agent
- Cross-vendor identity beyond A2A URLs + tokens
