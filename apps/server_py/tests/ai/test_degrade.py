from app.ai.degrade import resolve_degrade_policy


def test_degrade_tightens_tool_steps():
    policy = resolve_degrade_policy(96)
    assert policy.max_tool_steps == 2
