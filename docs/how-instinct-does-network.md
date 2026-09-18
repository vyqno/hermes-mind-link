# How Instinct does network (and how we copy the *shape*)

## What Instinct actually does

Friends do **not** open ports to each other’s laptops.

```
You ──text/call──► Instinct cloud  ◄──text/call──  Friend
                       │
                       └── hosts every "mind", connectors, trust graph
```

- One company runs always-on computers in **their** cloud.
- Your phone only talks to **their** servers (iMessage/WhatsApp/SMS).
- When two people “trust-connect,” message routing is **server-side**.
- Geography does not matter. NAT does not matter.
- Tomorrow’s girlfriend / group of six is just more accounts on the same mesh.

Laptop↔laptop A2A/Tailscale is a **power-user** path. It is **not** the Instinct path.

## What we ship instead

```
You ──Telegram──► Your Hermes (home/VPS/cloud)
                      │
                      │ HTTPS outbound only
                      ▼
                 Mind-link HUB (public HTTPS)
                      ▲
                      │ HTTPS outbound only
                      │
Friend ──Telegram──► Friend’s Hermes
```

- **Human surface:** Telegram only (daily).
- **Agent surface:** Hub store-and-forward (world-reachable).
- **Privacy:** still local `trust.yaml` + share policies (work_only, etc.).
- **Scale:** N friends, N groups — hub routes by `agent_id` + optional `group_id`.

No friend needs your Wi-Fi. No Tailscale required between people.

## Three deployment modes

| Mode | Who runs what | Best for |
|---|---|---|
| **A. Hub + each runs Hermes** | You or OSPYR host the hub; each friend runs Hermes+Telegram | Technical friends (Harshal) |
| **B. You host minds** | You run hub + one Hermes multi-profile; friends only Telegram | GF / non-technical |
| **C. Full SaaS later** | Multi-tenant hosted minds (Instinct clone) | Product |

v0.3 implements the **Hub** (A) and documents B.

## Groups of 5–6

- Hub supports `group_id` fan-out: one ambient work update → all members’ inboxes.
- Each member still has **pairwise** share policy (GF may get more calendar, work friends get project only).
- Personal deny list remains default.
