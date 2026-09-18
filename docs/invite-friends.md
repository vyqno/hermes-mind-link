# What to send friends (copy-paste)

You already have Hermes + Telegram. We link minds through a **public hub**
(like Instinct's cloud mesh) — **no VPN, no open home ports**.

## For Harshal (technical)

```
1) git clone https://github.com/vyqno/hermes-mind-link.git
   cd hermes-mind-link && ./scripts/install.sh

2) Register on our hub (I'll send HUB_URL):
   mind-link hub --url "$HUB_URL" register --agent-id mind:harshal --name Harshal
   # save the token:
   # export MINDLINK_HUB_URL=...
   # export MINDLINK_HUB_TOKEN=...
   # also put those in ~/.hermes/.env

3) Poll or let your Hermes skill check inbox (cron later).
   mind-link hub inbox

4) Privacy default: work_only — dinner/health/family never shared.

Reply with: your mind: id (mind:harshal) only after register.
I'll add you to group friends-core.
```

## For GF / non-technical (you host their mind)

They only need Telegram. You create a Hermes profile + bot (or shared bot
pairing) on your always-on host. They never see hubs or tokens.

## Group of 5–6

One group on the hub:

```
mind-link hub group --group-id friends-core \
  --members mind:hitesh,mind:harshal,mind:gf,mind:a,mind:b,mind:c
```

Each person still has pairwise share policy in their own trust.yaml.
