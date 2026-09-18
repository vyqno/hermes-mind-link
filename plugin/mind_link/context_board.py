"""Local work-context board — what *this* mind is working on.

Stored at $HERMES_HOME/mind-link/context-board.yaml
User-visible. Ambient sync only pushes policy-filtered fields to peers.
"""
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Optional
import os
from datetime import datetime, timezone

try:
    import yaml
except ImportError:  # pragma: no cover
    yaml = None  # type: ignore


def _default_path() -> Path:
    home = Path(os.environ.get("HERMES_HOME", Path.home() / ".hermes"))
    return home / "mind-link" / "context-board.yaml"


@dataclass
class ContextBoard:
    path: Path
    updated_at: str = ""
    # only work-ish fields by convention
    fields: dict[str, Any] = field(default_factory=dict)
    # explicit do-not-share notes for the local agent
    private_notes: str = ""

    @classmethod
    def load(cls, path: Optional[Path] = None) -> "ContextBoard":
        if yaml is None:
            raise RuntimeError("PyYAML required")
        path = path or _default_path()
        if not path.exists():
            return cls(path=path, fields={}, private_notes="")
        data = yaml.safe_load(path.read_text()) or {}
        return cls(
            path=path,
            updated_at=str(data.get("updated_at") or ""),
            fields=dict(data.get("fields") or {}),
            private_notes=str(data.get("private_notes") or ""),
        )

    def set_field(self, key: str, value: Any) -> None:
        self.fields[key] = value
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def clear_field(self, key: str) -> None:
        self.fields.pop(key, None)
        self.updated_at = datetime.now(timezone.utc).isoformat()

    def save(self) -> None:
        if yaml is None:
            raise RuntimeError("PyYAML required")
        self.path.parent.mkdir(parents=True, exist_ok=True)
        payload = {
            "updated_at": self.updated_at or datetime.now(timezone.utc).isoformat(),
            "fields": self.fields,
            "private_notes": self.private_notes,
            "_doc": "Work context only. private_notes never leave this machine via mind-link.",
        }
        self.path.write_text(yaml.safe_dump(payload, sort_keys=False))
