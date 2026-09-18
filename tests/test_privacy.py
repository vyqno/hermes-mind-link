from mind_link.privacy import SharePolicy, scrub_personal_text, build_ambient_envelope_body
from mind_link.context_board import ContextBoard
from mind_link.trust import TrustRegistry


def test_scrub_dinner():
    text = "Working on OSPYR deploy.\nHad dinner at home with family.\nNeed PR review."
    out = scrub_personal_text(text)
    assert "OSPYR" in out
    assert "dinner" not in out.lower() or "redacted" in out.lower()
    assert "family" not in out.lower() or "redacted" in out.lower()


def test_filter_context_work_only():
    policy = SharePolicy(mode="work_only")
    ctx = {
        "project_name": "mind-link",
        "shared_task_status": "shipping privacy",
        "dinner_food": "pasta",
        "health": "fine",
    }
    filtered = policy.filter_context(ctx)
    assert filtered["project_name"] == "mind-link"
    assert "dinner_food" not in filtered
    assert "health" not in filtered


def test_explicit_only_blocks_ambient():
    policy = SharePolicy(mode="explicit_only", ambient=False)
    assert policy.filter_context({"project_name": "x"}) == {}


def test_ambient_body_omits_personal():
    policy = SharePolicy(mode="work_only")
    body = build_ambient_envelope_body(
        from_agent="mind:a",
        work_context={"project_name": "X", "dinner_food": "y"},
        policy=policy,
    )
    assert body is not None
    assert "project_name" in body
    assert "dinner" not in body.lower()


def test_context_board_roundtrip(tmp_path):
    p = tmp_path / "board.yaml"
    b = ContextBoard(path=p)
    b.set_field("project_name", "OSPYR")
    b.private_notes = "had dosa; secret"
    b.save()
    b2 = ContextBoard.load(p)
    assert b2.fields["project_name"] == "OSPYR"
    assert "dosa" in b2.private_notes


def test_trust_share_policy():
    reg = TrustRegistry.from_dict(
        {
            "version": 2,
            "self": {"agent_id": "mind:h", "ambient_default": True},
            "links": [
                {
                    "id": "harshal",
                    "display_name": "Harshal",
                    "status": "active",
                    "agent": {"kind": "a2a", "ref": "harshal"},
                    "share": {"mode": "work_only", "ambient": True},
                }
            ],
        }
    )
    link = reg.get("harshal")
    assert link.share.mode == "work_only"
    assert reg.active_ambient_links()[0].id == "harshal"
    filtered = link.share.filter_context(
        {"project_name": "A", "dinner_food": "B", "private_messages": "C"}
    )
    assert filtered == {"project_name": "A"}
