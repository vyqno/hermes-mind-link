"""CLI: mind-link validate | prompt | envelope | list"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .envelope import build_envelope, parse_envelope
from .trust import TrustError, TrustRegistry


def _add_trust(sp: argparse.ArgumentParser) -> None:
    sp.add_argument(
        "--trust",
        type=Path,
        default=None,
        help="Path to trust.yaml (default: $HERMES_HOME/mind-link/trust.yaml)",
    )


def main(argv=None) -> int:
    p = argparse.ArgumentParser(prog="mind-link", description="Hermes Mind-link utilities")
    sub = p.add_subparsers(dest="cmd", required=True)

    v = sub.add_parser("validate", help="Validate trust.yaml")
    _add_trust(v)

    ls = sub.add_parser("list", help="List links")
    _add_trust(ls)

    pp = sub.add_parser("prompt", help="Print confirm prompt for a link")
    _add_trust(pp)
    pp.add_argument("link_id")
    pp.add_argument("--body", required=True)
    pp.add_argument("--scope", default="message.relay")

    pe = sub.add_parser("envelope", help="Build an outbound envelope")
    _add_trust(pe)
    pe.add_argument("link_id")
    pe.add_argument("--body", required=True)
    pe.add_argument("--intent", default="relay")
    pe.add_argument("--human-on-receipt", action="store_true")

    pr = sub.add_parser("parse", help="Parse envelope from stdin or --text")
    pr.add_argument("--text", default=None)

    args = p.parse_args(argv)
    trust_path = getattr(args, "trust", None)

    if args.cmd == "parse":
        text = args.text if args.text is not None else sys.stdin.read()
        env = parse_envelope(text)
        if not env:
            print("error: not a mind-link envelope", file=sys.stderr)
            return 2
        print(json.dumps(env.__dict__, indent=2))
        return 0

    try:
        reg = TrustRegistry.load(trust_path)
    except TrustError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    if args.cmd == "validate":
        print(
            f"ok version={reg.version} self={reg.self_agent_id} "
            f"links={len(reg.links)} path={reg.path}"
        )
        return 0

    if args.cmd == "list":
        for link in reg.links.values():
            print(
                f"{link.id}\t{link.status}\t{link.agent_kind}/{link.agent_ref}\t"
                f"{link.delivery_default}\t{link.display_name}"
            )
        return 0

    if args.cmd == "prompt":
        try:
            link = reg.get(args.link_id)
        except TrustError as e:
            print(f"error: {e}", file=sys.stderr)
            return 2
        print(reg.confirm_prompt(link, args.body, args.scope))
        print(f"needs_confirm={reg.needs_confirm(link, args.scope)}")
        return 0

    if args.cmd == "envelope":
        try:
            link = reg.get(args.link_id)
        except TrustError as e:
            print(f"error: {e}", file=sys.stderr)
            return 2
        env = build_envelope(
            from_agent=reg.self_agent_id,
            to_agent=f"agent:{link.id}",
            intent=args.intent,
            body=args.body,
            requires_human_on_receipt=args.human_on_receipt,
        )
        print(env.render(), end="")
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
