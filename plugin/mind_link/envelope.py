"""Mind-link message envelope parse/build."""
from __future__ import annotations

from dataclasses import dataclass
import re
import secrets
from typing import Optional

HEADER = "[MIND-LINK]"
REPLY_HEADER = "[MIND-LINK-REPLY]"

_FIELD = re.compile(r"^([a-z_]+):\s*(.*)$", re.I)


@dataclass
class Envelope:
    from_agent: str
    to_agent: str
    intent: str
    body: str
    correlation_id: str
    requires_human_on_receipt: bool = False
    is_reply: bool = False

    def render(self) -> str:
        head = REPLY_HEADER if self.is_reply else HEADER
        rh = "true" if self.requires_human_on_receipt else "false"
        lines = [
            head,
            f"from: {self.from_agent}",
            f"to: {self.to_agent}",
            f"intent: {self.intent}",
            f"correlation_id: {self.correlation_id}",
            f"requires_human_on_receipt: {rh}",
            "---",
            self.body.strip(),
            "",
        ]
        return "\n".join(lines)


def build_envelope(
    *,
    from_agent: str,
    to_agent: str,
    intent: str,
    body: str,
    correlation_id: Optional[str] = None,
    requires_human_on_receipt: bool = False,
    is_reply: bool = False,
) -> Envelope:
    return Envelope(
        from_agent=from_agent.strip(),
        to_agent=to_agent.strip(),
        intent=intent.strip() or "relay",
        body=body,
        correlation_id=correlation_id or secrets.token_hex(3),
        requires_human_on_receipt=requires_human_on_receipt,
        is_reply=is_reply,
    )


def parse_envelope(text: str) -> Optional[Envelope]:
    raw = (text or "").strip()
    if not raw:
        return None
    is_reply = raw.startswith(REPLY_HEADER)
    if not (raw.startswith(HEADER) or is_reply):
        idx = raw.find(HEADER)
        ridx = raw.find(REPLY_HEADER)
        if idx < 0 and ridx < 0:
            return None
        if ridx >= 0 and (idx < 0 or ridx < idx):
            raw = raw[ridx:]
            is_reply = True
        else:
            raw = raw[idx:]
            is_reply = False
    parts = raw.split("\n---\n", 1)
    header_block = parts[0]
    body = parts[1].strip() if len(parts) > 1 else ""
    fields = {}
    for line in header_block.splitlines()[1:]:
        m = _FIELD.match(line.strip())
        if m:
            fields[m.group(1).lower()] = m.group(2).strip()
    if "from" not in fields or "to" not in fields:
        return None
    rh = fields.get("requires_human_on_receipt", "false").lower() in {"1", "true", "yes"}
    return Envelope(
        from_agent=fields["from"],
        to_agent=fields["to"],
        intent=fields.get("intent") or "relay",
        body=body,
        correlation_id=fields.get("correlation_id") or "",
        requires_human_on_receipt=rh,
        is_reply=is_reply,
    )
