"""Hermes Mind-link — trust registry + envelope helpers."""
from .trust import TrustRegistry, TrustError
from .envelope import build_envelope, parse_envelope

__version__ = "0.1.0"
__all__ = ["TrustRegistry", "TrustError", "build_envelope", "parse_envelope", "__version__"]
