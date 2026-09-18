from pathlib import Path
from mind_link.trust import TrustRegistry, TrustError
import pytest


SAMPLE = """
version: 1
self:
  agent_id: mind:hitesh
  surface: telegram
links:
  - id: harshal
    display_name: Harshal
    status: active
    agent: { kind: a2a, ref: harshal }
    human: { telegram_user_id: null }
    scopes: [message.relay]
    standing_grants: []
    delivery_default: agent
"""


def test_load(tmp_path: Path):
    p = tmp_path / "trust.yaml"
    p.write_text(SAMPLE)
    reg = TrustRegistry.load(p)
    link = reg.get("Harshal")
    assert link.id == "harshal"
    assert reg.needs_confirm(link, "message.relay") is True
    prompt = reg.confirm_prompt(link, "hi")
    assert "Harshal's agent" in prompt
    assert "agent:harshal" in prompt


def test_standing(tmp_path: Path):
    p = tmp_path / "trust.yaml"
    p.write_text(SAMPLE.replace("standing_grants: []", "standing_grants: [ping]"))
    reg = TrustRegistry.load(p)
    link = reg.get("harshal")
    assert reg.needs_confirm(link, "ping") is False
    assert reg.needs_confirm(link, "money") is True


def test_missing_self():
    with pytest.raises(TrustError):
        TrustRegistry.from_dict({"version": 1, "links": []})
