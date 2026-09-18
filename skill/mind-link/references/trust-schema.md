# trust.yaml schema (v2)

```yaml
version: 2
self:
  agent_id: mind:alice
  surface: telegram
  ambient_default: true
links:
  - id: bob
    display_name: Bob
    status: active | pending | paused
    agent:
      kind: a2a | hermes_peer | local_profile
      ref: bob
    human:
      telegram_user_id: null | "123456"
    scopes: [schedule.probe, message.relay, ambient_context, ping]
    standing_grants: []
    delivery_default: agent | human | both
    share:
      mode: work_only | explicit_only | custom
      ambient: true
      ambient_requires_confirm_first: true
      allow_categories: [project_name, project_goal_public, shared_task_status, ...]
      deny_categories: [dinner_food, health, family, credentials, ...]
```

## Privacy rules

- `delivery_default: agent` is mind-to-mind default.
- `share.mode: work_only` — ambient may send allow_categories only.
- `share.mode: explicit_only` — no ambient; user must confirm every message.
- Personal deny list is default; user must edit YAML to widen (discouraged).
- Tokens never live in this file.
- `context-board.yaml` `private_notes` never transmitted.
