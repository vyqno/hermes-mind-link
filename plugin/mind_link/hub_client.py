"""Client for Mind-link Hub (public HTTPS mesh)."""
from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from typing import Any, Optional


class HubError(Exception):
    pass


class HubClient:
    def __init__(self, base_url: str, token: Optional[str] = None, timeout: float = 30.0):
        self.base_url = base_url.rstrip("/")
        self.token = token or os.environ.get("MINDLINK_HUB_TOKEN") or ""
        self.timeout = timeout

    def _req(self, method: str, path: str, body: Optional[dict] = None, auth: bool = True) -> dict:
        data = None if body is None else json.dumps(body).encode("utf-8")
        headers = {"Content-Type": "application/json", "Accept": "application/json"}
        if auth:
            if not self.token:
                raise HubError("MINDLINK_HUB_TOKEN not set")
            headers["Authorization"] = f"Bearer {self.token}"
        req = urllib.request.Request(
            self.base_url + path, data=data, headers=headers, method=method
        )
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return json.loads(resp.read().decode("utf-8"))
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", errors="replace")
            raise HubError(f"HTTP {e.code}: {detail}") from e
        except urllib.error.URLError as e:
            raise HubError(str(e)) from e

    def register(self, agent_id: str, display_name: str) -> dict[str, Any]:
        return self._req(
            "POST",
            "/v1/register",
            {"agent_id": agent_id, "display_name": display_name},
            auth=False,
        )

    def send(
        self,
        envelope: str,
        to: Optional[str] = None,
        to_group: Optional[str] = None,
        ttl_seconds: int = 86400,
    ) -> dict[str, Any]:
        body: dict[str, Any] = {"envelope": envelope, "ttl_seconds": ttl_seconds}
        if to_group:
            body["to_group"] = to_group
        else:
            body["to"] = to
        return self._req("POST", "/v1/send", body)

    def inbox(self, limit: int = 20) -> list[dict[str, Any]]:
        q = f"/v1/inbox?limit={int(limit)}"
        return list(self._req("GET", q).get("messages") or [])

    def ensure_group(self, group_id: str, members: list[str]) -> dict[str, Any]:
        return self._req(
            "POST",
            "/v1/groups",
            {"group_id": group_id, "members": members},
        )
