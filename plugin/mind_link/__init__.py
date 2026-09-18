"""Hermes Mind-link — trust, privacy, envelopes, context board."""
from .trust import TrustRegistry, TrustError
from .envelope import build_envelope, parse_envelope
from .privacy import SharePolicy, scrub_personal_text, policy_from_dict
from .context_board import ContextBoard

__version__ = "0.2.0"
__all__ = [
    "TrustRegistry",
    "TrustError",
    "build_envelope",
    "parse_envelope",
    "SharePolicy",
    "scrub_personal_text",
    "policy_from_dict",
    "ContextBoard",
    "__version__",
]
