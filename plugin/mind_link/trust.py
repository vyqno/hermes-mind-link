"""Load and validate mind-link trust.yaml registries."""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional
import os

from .privacy import SharePolicy, policy_from_dict, SENSITIVE_ALWAYS_CONFIRM

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None  # type: ignore


class TrustError(Exception):
    """Invalid or missing trust configuration."""


@dataclass
class Link:
    id: str
    display_name: str
    status: str = "pending"
    agent_kind: str = "a2a"
    agent_ref: str = ""
    human_telegram_user_id: Optional[str] = None
    scopes: list[str] = field(default_factory=list)
    standing_grants: list[str] = field(default_factory=list)
    delivery_default: str = "agent"
    share: SharePolicy = field(default_factory=SharePolicy)
    notes: str = ""

    def allows_standing(self, scope: str) -> bool:
        return scope in self.standing_grants

    def is_active(self) -> bool:
        return self.status == "active"


@dataclass
class TrustRegistry:
    path: Path
    version: int
    self_agent_id: str
    surface: str
    ambient_default: bool
    links: dict[str, Link]

    @classmethod
    def default_path(cls) -> Path:
        home = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes"))
        return home / "mind-link" / "trust.yaml"

    @classmethod
    def load(cls, path: Optional[Path] = None) -> "TrustRegistry":
        if yaml is None:
            raise TrustError("PyYAML required: pip install pyyaml")
        path = path or cls.default_path()
        if not path.exists():
            raise TrustError(f"trust file not found: {path}")
        data = yaml.safe_load(path.read_text()) or {}
        return cls.from_dict(data, path=path)

    @classmethod
    def from_dict(cls, data: dict[str, Any], path: Optional[Path] = None) -> "TrustRegistry":
        if not isinstance(data, dict):
            raise TrustError("trust root must be a mapping")
        version = int(data.get("version", 1))
        self_block = data.get("self") or {}
        self_id = str(self_block.get("agent_id") or "").strip()
        surface = str(self_block.get("surface") or "telegram").strip()
        ambient_default = bool(self_block.get("ambient_default", True))
        if not self_id:
            raise TrustError("self.agent_id is required")
        links: dict[str, Link] = {}
        for raw in data.get("links") or []:
            if not isinstance(raw, dict):
                raise TrustError("each link must be a mapping")
            lid = str(raw.get("id") or "").strip()
            if not lid:
                raise TrustError("link.id is required")
            agent = raw.get("agent") or {}
            human = raw.get("human") or {}
            delivery = str(raw.get("delivery_default") or "agent").strip().lower()
            if delivery not in {"agent", "human", "both"}:
                raise TrustError(f"link {lid}: invalid delivery_default {delivery!r}")
            share = policy_from_dict(raw.get("share") or raw.get("share_policy"))
            link = Link(
                id=lid,
                display_name=str(raw.get("display_name") or lid),
                status=str(raw.get("status") or "pending"),
                agent_kind=str(agent.get("kind") or "a2a"),
                agent_ref=str(agent.get("ref") or lid),
                human_telegram_user_id=(
                    None
                    if human.get("telegram_user_id") in (None, "", "null")
                    else str(human.get("telegram_user_id"))
                ),
                scopes=[str(s) for s in (raw.get("scopes") or [])],
                standing_grants=[str(s) for s in (raw.get("standing_grants") or [])],
                delivery_default=delivery,
                share=share,
                notes=str(raw.get("notes") or ""),
            )
            if link.agent_kind not in {"a2a", "hermes_peer", "local_profile"}:
                raise TrustError(f"link {lid}: unknown agent.kind {link.agent_kind!r}")
            links[lid] = link
        return cls(
            path=path or Path("<memory>"),
            version=version,
            self_agent_id=self_id,
            surface=surface,
            ambient_default=ambient_default,
            links=links,
        )

    def get(self, link_id: str) -> Link:
        key = link_id.strip().lower()
        for lid, link in self.links.items():
            if lid.lower() == key or link.display_name.lower() == key:
                return link
        raise TrustError(f"no trust link named {link_id!r}")

    def active_ambient_links(self) -> list[Link]:
        out = []
        for link in self.links.values():
            if link.is_active() and link.share.ambient and self.ambient_default:
                out.append(link)
        return out

    def confirm_prompt(self, link: Link, body: str, scope: str = "message.relay") -> str:
        dest = f"{link.display_name}'s agent (agent:{link.id})"
        if link.delivery_default == "human":
            dest = f"{link.display_name} as HUMAN on Telegram"
        grant = "yes" if link.allows_standing(scope) else "no — confirm required"
        return (
            "Send mind-link message?\n"
            f"To: {dest}\n"
            f"Via: {link.agent_kind}/{link.agent_ref}\n"
            f"Scope: {scope}\n"
            f"Share mode: {link.share.mode}\n"
            f"Standing grant: {grant}\n"
            f"---\n{body.strip()}\n"
        )

    def needs_confirm(self, link: Link, scope: str) -> bool:
        if scope in SENSITIVE_ALWAYS_CONFIRM or scope in {
            "money",
            "legal",
            "medical",
            "reputation",
        }:
            return True
        return not link.allows_standing(scope)
