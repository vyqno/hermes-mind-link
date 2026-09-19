"""CLI: mind-link validate | hub | context | preview-share | ..."""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path

from .context_board import ContextBoard
from .envelope import build_envelope, parse_envelope
from .hub_client import HubClient, HubError
from .privacy import build_ambient_envelope_body, explain_share, scrub_personal_text
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

    sc = sub.add_parser("scrub", help="Scrub personal heuristics from text")
    sc.add_argument("--text", default=None)

    ctx = sub.add_parser("context", help="Show or update local work context board")
    ctx.add_argument("--board", type=Path, default=None)
    ctx_sub = ctx.add_subparsers(dest="ctx_cmd", required=True)
    ctx_sub.add_parser("show", help="Print work context (not private_notes to peers)")
    cs = ctx_sub.add_parser("set", help="Set a work field")
    cs.add_argument("key")
    cs.add_argument("value")
    cc = ctx_sub.add_parser("clear", help="Clear a work field")
    cc.add_argument("key")
    cp = ctx_sub.add_parser("private", help="Set private_notes (never shared)")
    cp.add_argument("text")

    prev = sub.add_parser(
        "preview-share",
        help="Show what a peer agent would receive from current context board",
    )
    _add_trust(prev)
    prev.add_argument("link_id")
    prev.add_argument("--board", type=Path, default=None)

    pol = sub.add_parser("policy", help="Explain share policy for a link")
    _add_trust(pol)
    pol.add_argument("link_id")

    hub = sub.add_parser("hub", help="Public HTTPS mind-link hub (no VPN between friends)")
    hub.add_argument(
        "--url",
        default=os.environ.get("MINDLINK_HUB_URL", "https://hermes-mind-link.vyqno-xyz.workers.dev"),
        help="Hub base URL",
    )
    hub.add_argument(
        "--token",
        default=os.environ.get("MINDLINK_HUB_TOKEN"),
        help="Hub bearer token (or MINDLINK_HUB_TOKEN)",
    )
    hub_sub = hub.add_subparsers(dest="hub_cmd", required=True)
    hr = hub_sub.add_parser("register", help="Register agent_id; prints token once")
    hr.add_argument("--agent-id", required=True)
    hr.add_argument("--name", default="")
    hs = hub_sub.add_parser("send", help="Send envelope to agent or group")
    hs.add_argument("--to", default=None)
    hs.add_argument("--to-group", default=None)
    hs.add_argument("--envelope", default=None, help="Envelope text; default stdin")
    hi = hub_sub.add_parser("inbox", help="Poll inbox")
    hi.add_argument("--limit", type=int, default=20)
    hg = hub_sub.add_parser("group", help="Create/update a group")
    hg.add_argument("--group-id", required=True)
    hg.add_argument("--members", required=True, help="Comma-separated mind: ids")

    cn = sub.add_parser("connect", help="Production: link this Hermes to the hub (device OAuth)")
    cn.add_argument("--url", default=os.environ.get("MINDLINK_HUB_URL", "https://hermes-mind-link.vyqno-xyz.workers.dev"))
    cn.add_argument("--token", default=None, help="Skip browser if you already have a hub token")
    cn.add_argument("--no-browser", action="store_true")

    sy = sub.add_parser("sync", help="Refresh trust.yaml from hub contacts")
    sy.add_argument("--url", default=os.environ.get("MINDLINK_HUB_URL"))
    sy.add_argument("--token", default=os.environ.get("MINDLINK_HUB_TOKEN"))

    args = p.parse_args(argv)

    if args.cmd == "connect":
        from .connect import connect as do_connect

        return do_connect(hub_url=args.url, token=args.token, open_browser=not args.no_browser)

    if args.cmd == "sync":
        from .connect import sync_trust

        return sync_trust(hub_url=args.url, token=args.token)

    if args.cmd == "hub":
        client = HubClient(args.url, token=args.token)
        try:
            if args.hub_cmd == "register":
                out = client.register(args.agent_id, args.name or args.agent_id)
                print(json.dumps(out, indent=2))
                print(
                    "Save token: export MINDLINK_HUB_TOKEN=...  (and MINDLINK_HUB_URL)",
                    file=sys.stderr,
                )
                return 0
            if args.hub_cmd == "send":
                env_text = args.envelope if args.envelope is not None else sys.stdin.read()
                out = client.send(env_text, to=args.to, to_group=args.to_group)
                print(json.dumps(out, indent=2))
                return 0
            if args.hub_cmd == "inbox":
                msgs = client.inbox(args.limit)
                print(json.dumps({"messages": msgs}, indent=2))
                return 0
            if args.hub_cmd == "group":
                members = [m.strip() for m in args.members.split(",") if m.strip()]
                out = client.ensure_group(args.group_id, members)
                print(json.dumps(out, indent=2))
                return 0
        except HubError as e:
            print(f"error: {e}", file=sys.stderr)
            return 2
        return 1

    if args.cmd == "parse":
        text = args.text if args.text is not None else sys.stdin.read()
        env = parse_envelope(text)
        if not env:
            print("error: not a mind-link envelope", file=sys.stderr)
            return 2
        print(json.dumps(env.__dict__, indent=2))
        return 0

    if args.cmd == "scrub":
        text = args.text if args.text is not None else sys.stdin.read()
        print(scrub_personal_text(text), end="" if text.endswith("\n") else "\n")
        return 0

    if args.cmd == "context":
        board = ContextBoard.load(args.board)
        if args.ctx_cmd == "show":
            print(json.dumps({"updated_at": board.updated_at, "fields": board.fields}, indent=2))
            if board.private_notes:
                print("--- private_notes (local only) ---")
                print(board.private_notes)
            return 0
        if args.ctx_cmd == "set":
            board.set_field(args.key, args.value)
            board.save()
            print(f"set {args.key}")
            return 0
        if args.ctx_cmd == "clear":
            board.clear_field(args.key)
            board.save()
            print(f"cleared {args.key}")
            return 0
        if args.ctx_cmd == "private":
            board.private_notes = args.text
            board.save()
            print("private_notes updated (never shared via mind-link)")
            return 0
        return 1

    trust_path = getattr(args, "trust", None)
    try:
        reg = TrustRegistry.load(trust_path)
    except TrustError as e:
        print(f"error: {e}", file=sys.stderr)
        return 2

    if args.cmd == "validate":
        ambient = len(reg.active_ambient_links())
        print(
            f"ok version={reg.version} self={reg.self_agent_id} "
            f"links={len(reg.links)} ambient_active={ambient} path={reg.path}"
        )
        return 0

    if args.cmd == "list":
        for link in reg.links.values():
            print(
                f"{link.id}\t{link.status}\t{link.agent_kind}/{link.agent_ref}\t"
                f"{link.delivery_default}\tshare={link.share.mode}\t"
                f"ambient={link.share.ambient}\t{link.display_name}"
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
        body = scrub_personal_text(args.body, allow_personal=False)
        env = build_envelope(
            from_agent=reg.self_agent_id,
            to_agent=f"agent:{link.id}",
            intent=args.intent,
            body=body,
            requires_human_on_receipt=args.human_on_receipt,
        )
        print(env.render(), end="")
        return 0

    if args.cmd == "policy":
        try:
            link = reg.get(args.link_id)
        except TrustError as e:
            print(f"error: {e}", file=sys.stderr)
            return 2
        print(f"link={link.id} ({link.display_name})")
        print(explain_share(link.share))
        return 0

    if args.cmd == "preview-share":
        try:
            link = reg.get(args.link_id)
        except TrustError as e:
            print(f"error: {e}", file=sys.stderr)
            return 2
        board = ContextBoard.load(args.board)
        filtered = link.share.filter_context(board.fields)
        print(json.dumps({"to": f"agent:{link.id}", "would_receive": filtered}, indent=2))
        body = build_ambient_envelope_body(
            from_agent=reg.self_agent_id,
            work_context=board.fields,
            policy=link.share,
        )
        if body:
            env = build_envelope(
                from_agent=reg.self_agent_id,
                to_agent=f"agent:{link.id}",
                intent="ambient_context",
                body=body,
            )
            print("--- envelope ---")
            print(env.render(), end="")
        else:
            print("(nothing shareable under this policy)")
        print(
            "NOTE: private_notes and personal categories are never included.",
            file=sys.stderr,
        )
        return 0

    return 1


if __name__ == "__main__":
    raise SystemExit(main())
