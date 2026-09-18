# Architecture

```
┌─────────────┐     Telegram      ┌──────────────────┐
│  Human you  │ ←───────────────→ │ Hermes gateway   │
└─────────────┘                   │  + mind-link     │
                                  │  skill/trust     │
                                  └────────┬─────────┘
                                           │ A2A / peer
                                  ┌────────▼─────────┐
                                  │ Peer Hermes mind │
                                  └────────┬─────────┘
                                           │ optional escalate
                                  ┌────────▼─────────┐
                                  │  Human friend    │
                                  └──────────────────┘
```

Mind-link never replaces the gateway. It constrains **who** gets messaged and **how confirms are worded**.
