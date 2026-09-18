# trust.yaml schema

```yaml
version: 1
self:
  agent_id: mind:alice
  surface: telegram
links:
  - id: bob
    display_name: Bob
    status: active | pending | paused
    agent:
      kind: a2a | hermes_peer | local_profile
      ref: bob
    human:
      telegram_user_id: null | "123456"
    scopes: [schedule.probe, message.relay, ping]
    standing_grants: []
    delivery_default: agent | human | both
```

Rules:

- `delivery_default: agent` is the mind-to-mind default.
- `standing_grants` never includes money.
- Tokens never live in this file.
