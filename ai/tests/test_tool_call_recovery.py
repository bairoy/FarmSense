"""Recovering tool calls that a local model emitted as text.

`langchain-ollama` 1.1.0 does not surface structured `tool_calls` for
zero-argument tools - which is all three FarmSense tools, since crop_id and the
farmer's token are closed over rather than passed as parameters. The identical
request against the raw Ollama API returns proper tool_calls, so this is a
binding-layer problem, not a model one.

Untreated, the farmer is shown
`{"type":"function","function":{"name":"get_fertilizer",...}}` where their
fertilizer advice should be. These tests pin the recovery, and - just as
importantly - pin that it never invents a call from ordinary prose.
"""

from langchain_core.messages import AIMessage

from langgraph_agent import _recover_text_tool_calls

TOOLS = {"get_crop_state", "get_irrigation", "get_fertilizer"}


def names(message: AIMessage) -> list[str]:
    return [c["name"] for c in message.tool_calls]


def test_recovers_the_exact_output_observed_from_llama31():
    # Copied verbatim from a live llama3.1 run, truncation included: the model
    # closed neither the outer object nor the response.
    raw = (
        '{"type":"function","function":{"name":"get_fertilizer",'
        '"parameters":{"crop_type":"rice"}}'
    )
    assert names(_recover_text_tool_calls(AIMessage(content=raw), TOOLS)) == ["get_fertilizer"]


def test_recovers_well_formed_and_fenced_and_trailed_json():
    for raw in (
        '{"type":"function","function":{"name":"get_irrigation","parameters":{}}}',
        '```json\n{"type":"function","function":{"name":"get_irrigation","parameters":{}}}\n```',
        '{"type":"function","function":{"name":"get_irrigation","parameters":{}}} Let me check.',
    ):
        assert names(_recover_text_tool_calls(AIMessage(content=raw), TOOLS)) == ["get_irrigation"]


def test_invented_arguments_are_discarded():
    # Zero-arg tools take everything from the closure. Forwarding a
    # hallucinated "crop_type" would fail validation inside ToolNode.
    raw = (
        '{"type":"function","function":{"name":"get_fertilizer",'
        '"parameters":{"crop_type":"rice","x":1}}}'
    )
    recovered = _recover_text_tool_calls(AIMessage(content=raw), TOOLS)
    assert recovered.tool_calls[0]["args"] == {}


def test_a_tool_name_we_never_published_is_not_dispatched():
    # The recovery must not become a way for the model to invent capabilities.
    raw = '{"type":"function","function":{"name":"get_weather","parameters":{}}}'
    result = _recover_text_tool_calls(AIMessage(content=raw), TOOLS)
    assert result.tool_calls == []
    assert result.content == raw, "unrecognised content must be preserved, not blanked"


def test_ordinary_prose_is_never_reinterpreted_as_a_call():
    for prose in (
        "Your rice looks healthy. Check for standing water.",
        "The function of urea is to supply nitrogen to the crop.",
        "",
    ):
        result = _recover_text_tool_calls(AIMessage(content=prose), TOOLS)
        assert result.tool_calls == []
        assert result.content == prose


def test_a_real_structured_call_passes_through_untouched():
    original = AIMessage(
        content="",
        tool_calls=[{"name": "get_crop_state", "args": {}, "id": "abc", "type": "tool_call"}],
    )
    result = _recover_text_tool_calls(original, TOOLS)
    assert result is original, "a working provider must not be touched at all"


def test_recovered_calls_carry_distinct_ids():
    # LangGraph pairs each ToolMessage back to its call by id.
    raw = '{"type":"function","function":{"name":"get_crop_state","parameters":{}}}'
    call = _recover_text_tool_calls(AIMessage(content=raw), TOOLS).tool_calls[0]
    assert call["id"]
    assert call["type"] == "tool_call"
