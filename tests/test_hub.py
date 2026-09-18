"""Hub store-and-forward tests (in-process, no network bind flakiness)."""
from pathlib import Path
import threading
import time

from hub.server import Hub
from mind_link.hub_client import HubClient


def test_hub_register_send_inbox(tmp_path: Path):
    hub = Hub(tmp_path / "hub.sqlite3")
    # reuse server internals without HTTP for unit speed
    t1 = hub.register("mind:hitesh", "Hitesh")
    t2 = hub.register("mind:harshal", "Harshal")
    assert t1 and t2 and t1 != t2
    assert hub.auth(f"Bearer {t1}") == "mind:hitesh"

    # HTTP layer via ThreadingHTTPServer is heavier; test core Hub API
    ids = hub.send(
        from_agent="mind:hitesh",
        to="mind:harshal",
        envelope="[MIND-LINK]\nfrom: mind:hitesh\nto: agent:harshal\nintent: ping\ncorrelation_id: 1\nrequires_human_on_receipt: false\n---\nhi\n",
    )
    assert len(ids) == 1
    inbox = hub.inbox("mind:harshal")
    assert len(inbox) == 1
    assert "hi" in inbox[0]["envelope"]
    assert hub.inbox("mind:harshal") == []  # delivered


def test_hub_group_fanout(tmp_path: Path):
    hub = Hub(tmp_path / "g.sqlite3")
    hub.register("mind:a", "A")
    hub.register("mind:b", "B")
    hub.register("mind:c", "C")
    hub.upsert_group("mind:a", "friends", ["mind:a", "mind:b", "mind:c"])
    ids = hub.send(from_agent="mind:a", to_group="friends", envelope="hello group")
    assert len(ids) == 2
    assert len(hub.inbox("mind:b")) == 1
    assert len(hub.inbox("mind:c")) == 1
    assert hub.inbox("mind:a") == []
