"""Privacy scopes and work-context sanitization for mind-link.

Design:
  - Default deny for personal life details.
  - Per-link allowlists decide what a peer *agent* may learn.
  - "Ambient" collaboration shares only sanitized work context,
    never dinner / health / family / secrets unless explicitly allowed.
"""
from __future__ import annotations

from dataclasses import dataclass, field, asdict
from typing import Any, Iterable, Optional
import re

# Categories that NEVER ride ambient sync unless the link explicitly
# allows that category (and even then, prefer confirm for sensitive).
PERSONAL_CATEGORIES = frozenset(
    {
        "dinner_food",
        "health",
        "family",
        "romance",
        "precise_location",
        "finance_personal",
        "credentials",
        "private_messages",
        "biometrics",
        "politics_personal",
        "religion_personal",
    }
)

# Safe ambient defaults for collaboration
DEFAULT_WORK_ALLOW = frozenset(
    {
        "project_name",
        "project_goal_public",
        "shared_task_status",
        "availability_window",
        "meeting_intent",
        "public_links",
        "collab_blockers",
    }
)

SENSITIVE_ALWAYS_CONFIRM = frozenset(
    {"money", "legal", "medical", "reputation", "credentials", "finance_personal"}
)

# Heuristic patterns that look personal — stripped from free text unless allowed.
_PERSONAL_PATTERNS = [
    re.compile(r"\b(dinner|lunch|breakfast|ate|eating|hungry)\b", re.I),
    re.compile(r"\b(girlfriend|boyfriend|wife|husband|mom|dad|kids?)\b", re.I),
    re.compile(r"\b(password|otp|ssn|aadhaar|pan\b|cvv|card number)\b", re.I),
    re.compile(r"\b(depressed|anxiety|diagnosis|prescription|doctor visit)\b", re.I),
    re.compile(r"\b(home address|i live at|my apartment)\b", re.I),
    re.compile(r"\b(bank balance|salary|net worth)\b", re.I),
]


@dataclass
class SharePolicy:
    """What this peer agent is allowed to receive."""

    mode: str = "work_only"  # work_only | explicit_only | custom
    allow_categories: list[str] = field(default_factory=lambda: sorted(DEFAULT_WORK_ALLOW))
    deny_categories: list[str] = field(default_factory=lambda: sorted(PERSONAL_CATEGORIES))
    ambient: bool = True  # participate in background work-context sync
    ambient_requires_confirm_first: bool = True  # first ambient enable needs human OK once
    max_ambient_fields: int = 12
    notes: str = ""

    def allowed(self, category: str) -> bool:
        cat = category.strip().lower()
        if cat in {d.lower() for d in self.deny_categories}:
            return False
        if self.mode == "explicit_only":
            return False  # ambient never; only user-confirmed envelopes
        if self.mode == "work_only":
            return cat in {a.lower() for a in self.allow_categories} or cat in DEFAULT_WORK_ALLOW
        # custom
        return cat in {a.lower() for a in self.allow_categories}

    def filter_context(self, ctx: dict[str, Any]) -> dict[str, Any]:
        """Keep only allowed keys from a work-context dict.

        Values may be str or simple JSON-compatible types.
        Keys should be category-like: project_name, shared_task_status, ...
        Free-text fields are additionally scrubbed.
        """
        out: dict[str, Any] = {}
        for key, value in (ctx or {}).items():
            if not self.allowed(key):
                continue
            if isinstance(value, str):
                cleaned = scrub_personal_text(value, allow_personal=False)
                if cleaned.strip():
                    out[key] = cleaned.strip()
            else:
                out[key] = value
            if len(out) >= self.max_ambient_fields:
                break
        return out


def scrub_personal_text(text: str, *, allow_personal: bool = False) -> str:
    if allow_personal or not text:
        return text
    lines = []
    for line in text.splitlines():
        if any(p.search(line) for p in _PERSONAL_PATTERNS):
            lines.append("[redacted-personal]")
        else:
            lines.append(line)
    return "\n".join(lines)


def classify_snippet(text: str) -> str:
    """Best-effort category guess for a free-text snippet."""
    t = text.lower()
    if any(p.search(text) for p in _PERSONAL_PATTERNS[:1]):
        return "dinner_food"
    if "password" in t or "otp" in t:
        return "credentials"
    if any(w in t for w in ("project", "pr ", "repo", "deploy", "deadline", "sprint")):
        return "project_goal_public"
    if any(w in t for w in ("meet", "calendar", "schedule", "available")):
        return "availability_window"
    return "project_goal_public"


def build_ambient_envelope_body(
    *,
    from_agent: str,
    work_context: dict[str, Any],
    policy: SharePolicy,
    headline: str = "ambient work context",
) -> Optional[str]:
    filtered = policy.filter_context(work_context)
    if not filtered:
        return None
    lines = [f"{headline}", "share_mode: " + policy.mode, "fields:"]
    for k, v in filtered.items():
        lines.append(f"- {k}: {v}")
    lines.append("")
    lines.append("Privacy: personal life details intentionally omitted.")
    return "\n".join(lines)


def policy_from_dict(raw: Optional[dict]) -> SharePolicy:
    raw = raw or {}
    mode = str(raw.get("mode") or "work_only").strip().lower()
    if mode not in {"work_only", "explicit_only", "custom"}:
        mode = "work_only"
    allow = raw.get("allow_categories")
    deny = raw.get("deny_categories")
    return SharePolicy(
        mode=mode,
        allow_categories=[str(x) for x in (allow if allow is not None else sorted(DEFAULT_WORK_ALLOW))],
        deny_categories=[str(x) for x in (deny if deny is not None else sorted(PERSONAL_CATEGORIES))],
        ambient=bool(raw.get("ambient", True)),
        ambient_requires_confirm_first=bool(raw.get("ambient_requires_confirm_first", True)),
        max_ambient_fields=int(raw.get("max_ambient_fields") or 12),
        notes=str(raw.get("notes") or ""),
    )


def explain_share(policy: SharePolicy) -> str:
    return (
        f"mode={policy.mode} ambient={policy.ambient}\n"
        f"allow={', '.join(policy.allow_categories) or '(none)'}\n"
        f"deny={', '.join(policy.deny_categories) or '(none)'}\n"
        "Personal categories (dinner, health, family, secrets) are denied by default."
    )
