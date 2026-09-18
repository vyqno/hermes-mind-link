from mind_link.envelope import build_envelope, parse_envelope


def test_roundtrip():
    env = build_envelope(
        from_agent="mind:a",
        to_agent="agent:b",
        intent="ping",
        body="hello",
        correlation_id="abc123",
    )
    text = env.render()
    assert text.startswith("[MIND-LINK]")
    parsed = parse_envelope(text)
    assert parsed is not None
    assert parsed.from_agent == "mind:a"
    assert parsed.to_agent == "agent:b"
    assert parsed.intent == "ping"
    assert parsed.body == "hello"
    assert parsed.correlation_id == "abc123"


def test_reply_header():
    env = build_envelope(
        from_agent="mind:b",
        to_agent="mind:a",
        intent="ping",
        body="pong",
        is_reply=True,
        correlation_id="abc123",
    )
    parsed = parse_envelope(env.render())
    assert parsed is not None
    assert parsed.is_reply is True


def test_noise_prefix():
    core = build_envelope(
        from_agent="mind:a", to_agent="agent:b", intent="x", body="y", correlation_id="1"
    ).render()
    parsed = parse_envelope("note from peer:\n" + core)
    assert parsed is not None
    assert parsed.body == "y"
