"""CLI: mind-link validate | prompt | envelope | list"""
from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

from .envelope import build_envelope, parse_envelope
from .trust import TrustError, TrustRegistry


def main(argv=None):
    p = argparse.ArgumentParser(prog="mind-link", description="Hermes Mind-link utilities")
    p.add_argument("--trust", type=Path, default=None, help="Path to trust.yaml")
    sub = p.add_subparsers(dest="cmd", required=True)

    sub.add_parser("validate", help="Validate trust.yaml")
    sub.add_parser("list", help="List links")

    pp = sub.add_parser("prompt", help="Print confirm prompt for a link")
    pp.add_argument("link_id")
    pp.add_argument("--body", required=True)
    pp.add_argument("--scope", default="message.relay")

    pe = sub.add_parser("envelope", help="Build an outbound envelope")
    pe.add_argument("link_id")
    pe.add_argument("--body", required=True)
    pe.add_argument("--intent", default="relay")
    pe.add_argument("--human-on-receipt", action="store_true")

    pr = sub.add_parser("parse", help="Parse envelope from stdin or --text")
    pr.add_argument("--text", default=None)

    args = p.parse_args(argv)
    try:
        reg = TrustRegistry.load(args.trust)
    except TrustError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    if args.cmd == "validate":
        print(f"ok version={reg.version} self={reg.self_agent_id} links={len(reg.links)} path={reg.path}")
        return 0

    if args.cmd == "list":
        for link in reg.links.values():
            print(
                f"{link.id}	{link.status}	{link.agent_kind}/{link.agent_ref}	"
                f"{link.delivery_default}	{link.display_name}"
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

    if args.cmd == "parse":
        text = args.text if args.text is not None else sys.stdin.read()
        env = parse_envelope(text)
        if not env:
            print("error: not a mind-link envelope", file=sys.stderr)
            return 2
        print(json.dumps(env.__dict__, indent=2))
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
