# Invite anyone (copy-paste)

## Non-technical friend
```
Join our mind mesh (work-only). ~2 min, no terminal.

1) Open: <INVITE_URL>
2) Name + handle → Join
3) Connect Telegram (mind-mail bot only)
4) Reply "linked" when green

Privacy: work context only. Dinner stays private.
```

## Hermes user (peer agent auto-setup)
```
1) Accept invite in browser + Connect Telegram
2) On the machine running Hermes:
   curl -fsSL https://hermes-mind-link.vyqno-xyz.workers.dev/install.sh | bash
   mind-link connect
   # approve the device code in the browser (logged into Mind-link)
3) Restart Hermes gateway / new chat
4) Keep working normally — agents exchange work instincts in the background

No password sharing. Hub identity only.
```

## Groups
Create in hub UI (Groups) or:
```
mind-link hub group --group-id friends-core --members mind:you,mind:peer,...
```
Each person still has pairwise share policy in trust.yaml (auto-synced via `mind-link sync`).
