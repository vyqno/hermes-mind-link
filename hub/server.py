#!/usr/bin/env python3
"""Mind-link Hub — store-and-forward agent mesh (Instinct-shaped network).

Stdlib only. Run on any always-on host with a public URL (VPS, Fly, Railway, …).

  python hub/server.py --host 0.0.0.0 --port 8787 --data ./hub-data

Env:
  MINDLINK_HUB_ADMIN_TOKEN  optional admin token for /v1/groups bootstrap
"""
from __future__ import annotations

import argparse
import json
import os
import secrets
import sqlite3
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any, Optional
from urllib.parse import parse_qs, urlparse


SCHEMA = """
CREATE TABLE IF NOT EXISTS agents (
  agent_id TEXT PRIMARY KEY,
  display_name TEXT NOT NULL,
  token_hash TEXT NOT NULL,
  created_at REAL NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  to_agent TEXT NOT NULL,
  from_agent TEXT NOT NULL,
  group_id TEXT,
  envelope TEXT NOT NULL,
  created_at REAL NOT NULL,
  expires_at REAL NOT NULL,
  delivered INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_inbox ON messages(to_agent, delivered, expires_at);
CREATE TABLE IF NOT EXISTS groups (
  group_id TEXT PRIMARY KEY,
  admin_agent TEXT NOT NULL,
  members_json TEXT NOT NULL,
  created_at REAL NOT NULL
);
"""


def _hash(token: str) -> str:
    # lightweight hash (not password-hashing grade; tokens are long random)
    import hashlib

    return hashlib.sha256(token.encode("utf-8")).hexdigest()


class Hub:
    def __init__(self, db_path: Path):
        self.db_path = db_path
        db_path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        with self._connect() as c:
            c.executescript(SCHEMA)

    def _connect(self) -> sqlite3.Connection:
        c = sqlite3.connect(self.db_path, check_same_thread=False)
        c.row_factory = sqlite3.Row
        return c

    def register(self, agent_id: str, display_name: str) -> str:
        agent_id = agent_id.strip()
        if not agent_id.startswith("mind:"):
            raise ValueError("agent_id must start with mind:")
        token = secrets.token_urlsafe(32)
        now = time.time()
        with self._lock, self._connect() as c:
            row = c.execute("SELECT agent_id FROM agents WHERE agent_id=?", (agent_id,)).fetchone()
            if row:
                # re-register rotates token
                c.execute(
                    "UPDATE agents SET display_name=?, token_hash=?, created_at=? WHERE agent_id=?",
                    (display_name, _hash(token), now, agent_id),
                )
            else:
                c.execute(
                    "INSERT INTO agents(agent_id, display_name, token_hash, created_at) VALUES (?,?,?,?)",
                    (agent_id, display_name, _hash(token), now),
                )
            c.commit()
        return token

    def auth(self, bearer: Optional[str]) -> Optional[str]:
        if not bearer:
            return None
        token = bearer.removeprefix("Bearer ").strip() if bearer.startswith("Bearer ") else bearer.strip()
        h = _hash(token)
        with self._connect() as c:
            row = c.execute("SELECT agent_id FROM agents WHERE token_hash=?", (h,)).fetchone()
            return str(row["agent_id"]) if row else None

    def send(
        self,
        from_agent: str,
        envelope: str,
        to: Optional[str] = None,
        to_group: Optional[str] = None,
        ttl_seconds: int = 86400,
    ) -> list[str]:
        now = time.time()
        exp = now + max(60, min(ttl_seconds, 7 * 86400))
        targets: list[str] = []
        with self._lock, self._connect() as c:
            if to_group:
                g = c.execute("SELECT members_json FROM groups WHERE group_id=?", (to_group,)).fetchone()
                if not g:
                    raise ValueError("unknown group")
                members = json.loads(g["members_json"])
                targets = [m for m in members if m != from_agent]
                group_id = to_group
            elif to:
                targets = [to]
                group_id = None
            else:
                raise ValueError("to or to_group required")
            ids = []
            for t in targets:
                mid = secrets.token_hex(12)
                c.execute(
                    "INSERT INTO messages(id,to_agent,from_agent,group_id,envelope,created_at,expires_at,delivered)"
                    " VALUES (?,?,?,?,?,?,?,0)",
                    (mid, t, from_agent, group_id, envelope, now, exp),
                )
                ids.append(mid)
            c.commit()
        return ids

    def inbox(self, agent_id: str, limit: int = 20) -> list[dict[str, Any]]:
        now = time.time()
        limit = max(1, min(limit, 100))
        with self._lock, self._connect() as c:
            rows = c.execute(
                "SELECT id, from_agent, group_id, envelope, created_at FROM messages "
                "WHERE to_agent=? AND delivered=0 AND expires_at>? ORDER BY created_at ASC LIMIT ?",
                (agent_id, now, limit),
            ).fetchall()
            out = []
            for r in rows:
                out.append(
                    {
                        "id": r["id"],
                        "from": r["from_agent"],
                        "group_id": r["group_id"],
                        "envelope": r["envelope"],
                        "created_at": r["created_at"],
                    }
                )
                c.execute("UPDATE messages SET delivered=1 WHERE id=?", (r["id"],))
            c.commit()
        return out

    def upsert_group(self, admin: str, group_id: str, members: list[str]) -> None:
        members = sorted(set(members))
        if admin not in members:
            members.append(admin)
        now = time.time()
        with self._lock, self._connect() as c:
            row = c.execute("SELECT admin_agent FROM groups WHERE group_id=?", (group_id,)).fetchone()
            if row and row["admin_agent"] != admin:
                raise PermissionError("not group admin")
            if row:
                c.execute(
                    "UPDATE groups SET members_json=? WHERE group_id=?",
                    (json.dumps(members), group_id),
                )
            else:
                c.execute(
                    "INSERT INTO groups(group_id, admin_agent, members_json, created_at) VALUES (?,?,?,?)",
                    (group_id, admin, json.dumps(members), now),
                )
            c.commit()


def make_handler(hub: Hub):
    class H(BaseHTTPRequestHandler):
        def log_message(self, fmt, *args):  # quieter
            pass

        def _read_json(self) -> dict:
            n = int(self.headers.get("Content-Length") or 0)
            raw = self.rfile.read(n) if n else b"{}"
            return json.loads(raw.decode("utf-8") or "{}")

        def _send(self, code: int, obj: Any):
            body = json.dumps(obj).encode("utf-8")
            self.send_response(code)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

        def do_GET(self):
            u = urlparse(self.path)
            if u.path == "/health":
                return self._send(200, {"ok": True, "service": "mind-link-hub"})
            if u.path == "/v1/inbox":
                agent = hub.auth(self.headers.get("Authorization"))
                if not agent:
                    return self._send(401, {"error": "unauthorized"})
                qs = parse_qs(u.query)
                limit = int((qs.get("limit") or ["20"])[0])
                return self._send(200, {"messages": hub.inbox(agent, limit)})
            return self._send(404, {"error": "not found"})

        def do_POST(self):
            u = urlparse(self.path)
            try:
                data = self._read_json()
            except Exception:
                return self._send(400, {"error": "invalid json"})

            if u.path == "/v1/register":
                try:
                    token = hub.register(
                        str(data.get("agent_id") or ""),
                        str(data.get("display_name") or data.get("agent_id") or ""),
                    )
                except ValueError as e:
                    return self._send(400, {"error": str(e)})
                return self._send(
                    200,
                    {
                        "agent_id": data.get("agent_id"),
                        "token": token,
                        "note": "store token in .env as MINDLINK_HUB_TOKEN — shown once",
                    },
                )

            agent = hub.auth(self.headers.get("Authorization"))
            if not agent:
                return self._send(401, {"error": "unauthorized"})

            if u.path == "/v1/send":
                try:
                    ids = hub.send(
                        from_agent=agent,
                        envelope=str(data.get("envelope") or ""),
                        to=data.get("to"),
                        to_group=data.get("to_group"),
                        ttl_seconds=int(data.get("ttl_seconds") or 86400),
                    )
                except ValueError as e:
                    return self._send(400, {"error": str(e)})
                return self._send(200, {"message_ids": ids})

            if u.path == "/v1/groups":
                try:
                    hub.upsert_group(
                        admin=agent,
                        group_id=str(data.get("group_id") or ""),
                        members=[str(m) for m in (data.get("members") or [])],
                    )
                except PermissionError as e:
                    return self._send(403, {"error": str(e)})
                except Exception as e:
                    return self._send(400, {"error": str(e)})
                return self._send(200, {"ok": True})

            return self._send(404, {"error": "not found"})

    return H


def main(argv=None) -> int:
    ap = argparse.ArgumentParser(description="Mind-link Hub")
    ap.add_argument("--host", default="127.0.0.1")
    ap.add_argument("--port", type=int, default=8787)
    ap.add_argument("--data", type=Path, default=Path("./hub-data"))
    args = ap.parse_args(argv)
    hub = Hub(args.data / "hub.sqlite3")
    server = ThreadingHTTPServer((args.host, args.port), make_handler(hub))
    print(f"mind-link hub on http://{args.host}:{args.port}  db={args.data / 'hub.sqlite3'}")
    server.serve_forever()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
