# Privacy & ambient minds

## Goal

While you chat with Hermes, your mind and a trusted contact's mind can stay
loosely aligned on **shared work** — without either agent dumping a personal
life log (what you had for dinner, health, family, etc.).

That matches the Instinct "trusted connection" *idea*: agents talk; humans
control what the other side may know. Here it is explicit YAML + code, not a
closed cloud policy.

## Local artifacts

| Path | Role |
|---|---|
| `~/.hermes/mind-link/trust.yaml` | Who is linked + per-link **share** policy |
| `~/.hermes/mind-link/context-board.yaml` | What *you* are working on (`fields`) + `private_notes` |
| skill `mind-link` + SOUL rules | Default-on behavior in chat |

## Flow

1. You work in Hermes (desktop/Telegram). Agent updates **work** fields on the board.
2. Personal asides go to `private_notes` or are simply not recorded.
3. For an active link with `share.ambient: true` and `mode: work_only`, a
   sanitized snapshot can be sent as intent `ambient_context` to **their agent**.
4. Their agent may surface a short summary to them — under *their* rules.
5. `mind-link preview-share <id>` shows exactly what would leave before any send.

## Defaults

- Deny: dinner_food, health, family, romance, precise_location, finance_personal,
  credentials, private_messages, biometrics, ...
- Allow (work_only): project_name, project_goal_public, shared_task_status,
  availability_window, meeting_intent, public_links, collab_blockers

## User control

Widen or narrow per contact in `trust.yaml` → `links[].share`.  
Prefer **narrow**. Instinct-style trust is still **consent**, not omniscience.
