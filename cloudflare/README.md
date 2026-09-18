# Cloudflare Mind-link Hub

Global HTTPS mesh + **browser UI** for anyone.

## Features

- Create mind (handle → `mind:handle`) with one-time token
- Log in with token
- **Contacts** add / remove / share mode (`work_only` | `explicit_only`)
- **Invite links** (`/?invite=CODE`) — accept on phone
- **Groups** for 5–6 friends
- **Inbox** + send API (Hermes CLI compatible)
- **Work board** (cloud, non-personal)
- **Hermes setup pack** for Telegram bots

## Deploy

```bash
cd cloudflare
npm install
npx wrangler login
npx wrangler d1 create mind-link
# paste database_id into wrangler.toml
npm run db:remote
npm run deploy
```

Set `PUBLIC_ORIGIN` in wrangler.toml vars to your workers.dev or custom domain.

## Local

```bash
npm run db:local
npm run dev
# open http://127.0.0.1:8787
```

## API

Same as `docs/hub-protocol.md` plus UI routes:

- `GET/PATCH /v1/me`
- `GET/POST /v1/contacts`, `PATCH/DELETE /v1/contacts/:peer`
- `GET/POST /v1/invites`, `GET /v1/invites/:code`, `POST /v1/invites/accept`
- `GET/PUT /v1/context`
- `GET /v1/setup-pack`
