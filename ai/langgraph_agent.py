"""LangGraph agent for FarmSense chat.

A ReAct loop: think, decide whether to call a tool, call it, observe the
result, repeat. Runs against the OpenAI API.

The safety property: the model must
NEVER produce an agronomic quantity of its own. Every number a farmer acts on
comes from a tool result, and the tools carry the farmer's own JWT so the
database applies row-level security to the agent exactly as it does to them.

That property depends on tool calls actually being dispatched, which is why
`_recover_text_tool_calls` exists - a local model that emits its call as prose
would otherwise silently bypass the tools and answer from its own weights.
"""

from __future__ import annotations

import json
import logging
from typing import Annotated, Any, Literal

from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.graph import END, StateGraph
from langgraph.graph.message import add_messages
from langgraph.prebuilt import ToolNode
from typing_extensions import TypedDict

from config import (
    OPENAI_API_KEY,
    OPENAI_MODEL,
)
from tools import (
    BackendError,
    _get,
    get_crop_state_summary,
    get_fertilizer_recommendation,
    get_irrigation_recommendation,
)

logger = logging.getLogger(__name__)

MAX_TOOL_ROUNDS = 6

SYSTEM_PROMPT = """You are the FarmSense assistant, helping smallholder farmers in \
Gorakhpur district, Uttar Pradesh, India grow rice and wheat.

HARD RULES - these are not style preferences:

1. NEVER state a fertilizer quantity, irrigation volume, pesticide name, or \
chemical dose from your own knowledge. Every such number must come from a tool \
result in this conversation. If a tool has not given you the number, say you \
need to look it up and call the tool. A confident wrong number here costs a \
farmer money and can damage a crop.

2. ALWAYS carry the confidence information through. Tool results begin with a \
CONFIDENCE line. If it says LOW or VERY_LOW, say so plainly in your answer and \
tell the farmer to check the field themselves. Never present a low-confidence \
estimate as fact.

3. If an image diagnosis comes back below the confidence gate, do NOT suggest a \
treatment anyway. Ask for a clearer photo, or point them to the local extension \
office (Krishi Vigyan Kendra, Gorakhpur).

4. Use the farmer's units. Land is bigha, katha and dhur - not hectares or \
acres. Fertilizer is kg and 50kg sacks. If a tool gives you hectares, convert \
using what the tool returned, do not compute your own conversion.

HOW TO ANSWER:

- Short, direct, practical. A farmer reading this on a phone in a field.
- Lead with the action, then the reason.
- Plain language. Say "the soil is dry" not "root zone depletion exceeds RAW".
- ALWAYS answer in English, even if the farmer writes in Hindi, Bhojpuri or \
another language. Keep crop, product and place names as they are.
- When you genuinely do not know, say so and suggest they contact their local \
agriculture extension officer. That is a good answer, not a failure.

You have tools for crop condition, irrigation, and fertilizer. \
Call get_crop_state first for any general question - it is the single \
source of truth that the other tools agree with."""


class AgentState(TypedDict):
    """State passed through the LangGraph agent."""

    messages: Annotated[list[BaseMessage], add_messages]
    crop_id: str
    token: str
    tools_used: list[str]
    tool_rounds: int


# --- Tool definitions ---
# These are thin wrappers that pull crop_id and token from the config
# (injected at graph creation time).


def create_tools(crop_id: str, token: str):
    """Create tool functions bound to a specific crop and user token."""

    @tool
    def get_crop_state() -> str:
        """Get the current condition of a crop: growth stage, health score, water
        status, stresses, and the confidence in that estimate. Use this first
        for any general question about how a crop is doing. This is the single
        source of truth - all other tools agree with it."""
        logger.info(f"Tool: get_crop_state for crop {crop_id}")
        try:
            result = get_crop_state_summary(crop_id, token)
            logger.debug(f"get_crop_state result length: {len(result)}")
            return result
        except BackendError as e:
            logger.warning(f"get_crop_state backend error: {e}")
            return f"Could not retrieve crop state: {e}"
        except Exception as e:
            logger.exception("get_crop_state unexpected error")
            return f"Unexpected error: {e}"

    @tool
    def get_irrigation() -> str:
        """Get whether to irrigate now or wait for rain, and exactly how much water
        to apply. Combines the FAO-56 water balance with the rainfall forecast.
        Use for any question about watering, irrigation timing, or pump running time.
        Never estimate water amounts yourself - always call this."""
        logger.info(f"Tool: get_irrigation for crop {crop_id}")
        try:
            result = get_irrigation_recommendation(crop_id, token)
            logger.debug(f"get_irrigation result length: {len(result)}")
            return result
        except BackendError as e:
            logger.warning(f"get_irrigation backend error: {e}")
            return f"Could not retrieve irrigation recommendation: {e}"
        except Exception as e:
            logger.exception("get_irrigation unexpected error")
            return f"Unexpected error: {e}"

    @tool
    def get_fertilizer() -> str:
        """Get the fertilizer plan: which products, how many kg, and when,
        computed from official ICAR / UP Dept of Agriculture rate tables and the
        field's measured area. Use for any question about urea, DAP, potash,
        NPK, or top-dressing. NEVER state a fertilizer quantity from your own
        knowledge - always call this tool."""
        logger.info(f"Tool: get_fertilizer for crop {crop_id}")
        try:
            result = get_fertilizer_recommendation(crop_id, token)
            logger.debug(f"get_fertilizer result length: {len(result)}")
            return result
        except BackendError as e:
            logger.warning(f"get_fertilizer backend error: {e}")
            return f"Could not retrieve fertilizer recommendation: {e}"
        except Exception as e:
            logger.exception("get_fertilizer unexpected error")
            return f"Unexpected error: {e}"

    return [get_crop_state, get_irrigation, get_fertilizer]


def _chat_model():
    """The OpenAI chat model.

    temperature=0: this agent is not writing prose - it is deciding which tool
    to call and relaying the numbers that come back, and sampling variety in
    that job just means occasionally deciding not to call the tool.
    """
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not set.")

    return ChatOpenAI(
        model=OPENAI_MODEL,
        api_key=OPENAI_API_KEY,
        temperature=0,
        max_tokens=1500,
    )


def _recover_text_tool_calls(
    response: AIMessage, valid_names: set[str]
) -> AIMessage:
    """Rescue a tool call the model emitted as prose instead of structure.

    Local models sometimes return a tool call in the message body rather than
    in the structured `tool_calls` field. `langchain-ollama` 1.1.0 does this
    reliably for zero-argument tools - which is all three of ours, since
    crop_id and token are closed over rather than passed - and the raw Ollama
    API returns proper tool_calls for the identical request, so the model is
    not at fault.

    Left alone the consequence is severe rather than cosmetic. `should_continue`
    sees no tool_calls, ends the turn, and the farmer is shown
    `{"type":"function","function":{"name":"get_fertilizer",...}}` as their
    agronomic advice.

    So: a tool call that arrives as text is still a tool call. Parse it back
    into structure, and only ever for a name we actually published - a
    hallucinated tool name is discarded rather than dispatched.
    """
    if response.tool_calls or not isinstance(response.content, str):
        return response

    text = response.content.strip()
    if "function" not in text or "{" not in text:
        return response

    recovered: list[dict[str, Any]] = []

    decoder = json.JSONDecoder()

    for start in (i for i, ch in enumerate(text) if ch == "{"):
        chunk = text[start:]
        parsed = None

        # raw_decode reads one JSON value and ignores whatever follows, which
        # covers the model wrapping its call in a markdown fence or adding a
        # sentence after it.
        try:
            parsed, _ = decoder.raw_decode(chunk)
        except json.JSONDecodeError:
            # Models also truncate their own JSON mid-object. Try closing it.
            for extra in range(1, 4):
                try:
                    parsed = json.loads(chunk + "}" * extra)
                    break
                except json.JSONDecodeError:
                    continue

        fn = parsed.get("function") if isinstance(parsed, dict) else None
        if not isinstance(fn, dict):
            continue

        name = fn.get("name")
        if name not in valid_names:
            continue

        # Zero-arg tools get invented arguments ("crop_type": "rice").
        # Passing those through raises a validation error inside ToolNode,
        # so drop them: the tool takes its parameters from the closure.
        recovered.append(
            {"name": name, "args": {}, "id": f"recovered_{len(recovered)}", "type": "tool_call"}
        )
        break

    if not recovered:
        return response

    logger.warning(
        "Recovered %d tool call(s) emitted as text; see _recover_text_tool_calls.",
        len(recovered),
    )
    return AIMessage(content="", tool_calls=recovered, id=response.id)


def create_agent_graph(crop_id: str, token: str):
    """Build the LangGraph agent with tools bound to the given crop and token."""

    tools = create_tools(crop_id, token)
    tool_node = ToolNode(tools)
    tool_names = {t.name for t in tools}

    model = _chat_model().bind_tools(tools)

    def agent_node(state: AgentState) -> dict[str, Any]:
        """The agent decides whether to call a tool or respond."""
        messages = state["messages"]

        # Add system message if not present
        if not messages or not isinstance(messages[0], SystemMessage):
            messages = [SystemMessage(content=SYSTEM_PROMPT)] + list(messages)

        response = model.invoke(messages)
        if isinstance(response, AIMessage):
            response = _recover_text_tool_calls(response, tool_names)
        return {"messages": [response]}

    def should_continue(state: AgentState) -> Literal["tools", "end"]:
        """Decide whether to continue with tools or end."""
        messages = state["messages"]
        last_message = messages[-1]

        # Check tool round limit
        if state.get("tool_rounds", 0) >= MAX_TOOL_ROUNDS:
            return "end"

        # If the last message has tool calls, continue to tools
        if isinstance(last_message, AIMessage) and last_message.tool_calls:
            return "tools"

        return "end"

    def tools_node_wrapper(state: AgentState) -> dict[str, Any]:
        """Wrap the tool node to track tool usage."""
        result = tool_node.invoke(state)

        # Track which tools were used
        tools_used = list(state.get("tools_used", []))
        last_ai_msg = None
        for msg in reversed(state["messages"]):
            if isinstance(msg, AIMessage):
                last_ai_msg = msg
                break

        if last_ai_msg and last_ai_msg.tool_calls:
            for tc in last_ai_msg.tool_calls:
                tools_used.append(tc["name"])

        return {
            **result,
            "tools_used": tools_used,
            "tool_rounds": state.get("tool_rounds", 0) + 1,
        }

    # Build the graph
    graph = StateGraph(AgentState)

    graph.add_node("agent", agent_node)
    graph.add_node("tools", tools_node_wrapper)

    graph.set_entry_point("agent")

    graph.add_conditional_edges(
        "agent",
        should_continue,
        {
            "tools": "tools",
            "end": END,
        },
    )

    graph.add_edge("tools", "agent")

    return graph.compile()


def _messages_to_dict(messages: list[BaseMessage]) -> list[dict]:
    """Convert LangChain messages to serializable dicts for API response."""
    result = []
    for msg in messages:
        if isinstance(msg, SystemMessage):
            continue  # Don't include system message in history
        elif isinstance(msg, HumanMessage):
            result.append({"role": "user", "content": msg.content})
        elif isinstance(msg, AIMessage):
            content = msg.content
            # Include tool calls info if present
            if msg.tool_calls:
                tool_info = [{"name": tc["name"], "id": tc["id"]} for tc in msg.tool_calls]
                result.append({
                    "role": "assistant",
                    "content": content,
                    "tool_calls": tool_info,
                })
            else:
                result.append({"role": "assistant", "content": content})
        elif isinstance(msg, ToolMessage):
            result.append({
                "role": "tool",
                "tool_call_id": msg.tool_call_id,
                "content": msg.content,
            })
    return result


def _dict_to_messages(history: list[dict]) -> list[BaseMessage]:
    """Convert API history dicts back to LangChain messages."""
    messages = []
    for item in history:
        role = item.get("role")
        content = item.get("content", "")

        if role == "user":
            messages.append(HumanMessage(content=content))
        elif role == "assistant":
            tool_calls = item.get("tool_calls")
            if tool_calls:
                messages.append(AIMessage(
                    content=content,
                    tool_calls=[{
                        "name": tc["name"],
                        "id": tc["id"],
                        "args": {},
                    } for tc in tool_calls],
                ))
            else:
                messages.append(AIMessage(content=content))
        elif role == "tool":
            messages.append(ToolMessage(
                content=content,
                tool_call_id=item.get("tool_call_id", ""),
            ))

    return messages


def _crop_context(crop_id: str, token: str) -> str:
    """Basic facts about the crop, fetched cheaply so the model knows what it is talking about.

    Deliberately not the full crop-state computation - that is slow and only
    needed when the farmer asks about condition. Failures return a short note
    rather than raising, so chat still works without the context.
    """
    try:
        crop = _get(f"/api/crops/{crop_id}", token)
    except Exception as exc:  # noqa: BLE001
        logger.warning("Could not load crop context for %s: %s", crop_id, exc)
        return f"[Crop context: crop id {crop_id}; details could not be loaded.]"

    field_name = None
    field_id = crop.get("field_id")
    if field_id:
        try:
            field_name = _get(f"/api/fields/{field_id}", token).get("location_name")
        except Exception:  # noqa: BLE001
            field_name = None

    parts = [f"crop: {crop.get('crop_type', 'unknown')}"]
    if field_name:
        parts.append(f"field: {field_name}")
    if crop.get("sowing_date"):
        parts.append(f"sown on {crop['sowing_date']}")
    if crop.get("status"):
        parts.append(f"status: {crop['status']}")
    return "[Crop context - " + ", ".join(parts) + f". Crop id: {crop_id}.]"


def chat(
    message: str,
    token: str,
    history: list[dict] | None = None,
    crop_id: str | None = None,
) -> dict:
    """One turn of conversation, running tools until the model has an answer.

    Args:
        message: The user's message
        token: The user's Supabase token for backend calls
        history: Previous conversation history (optional)
        crop_id: The crop being discussed (optional, injected into context)

    Returns:
        dict with keys: reply, tools_used, history
    """
    if not OPENAI_API_KEY:
        return {
            "reply": "Chat is not configured. Please set OPENAI_API_KEY.",
            "tools_used": [],
            "history": [],
        }

    if not crop_id:
        return {
            "reply": "No crop context provided. Please view a specific crop to use chat.",
            "tools_used": [],
            "history": [],
        }

    # Build the agent graph for this crop/token
    graph = create_agent_graph(crop_id, token)

    # Convert history to messages
    messages = _dict_to_messages(history or [])

    # Add the new user message with crop context
    content = f"{message}\n\n{_crop_context(crop_id, token)}"
    messages.append(HumanMessage(content=content))

    # Run the agent
    initial_state: AgentState = {
        "messages": messages,
        "crop_id": crop_id,
        "token": token,
        "tools_used": [],
        "tool_rounds": 0,
    }

    try:
        logger.info(f"Chat request for crop {crop_id}: {message[:100]}...")
        final_state = graph.invoke(initial_state)
        logger.info(f"Chat completed, tools used: {final_state.get('tools_used', [])}")
    except Exception as e:
        logger.exception("Chat error for crop %s", crop_id)
        return {
            "reply": f"An error occurred: {e}",
            "tools_used": [],
            "history": _messages_to_dict(messages),
        }

    # Extract the final reply
    final_messages = final_state["messages"]
    tools_used = final_state.get("tools_used", [])

    # Find the last AI message that has content (not just tool calls)
    reply = ""
    for msg in reversed(final_messages):
        if isinstance(msg, AIMessage) and msg.content and not msg.tool_calls:
            reply = msg.content
            break

    if not reply:
        # If we ran out of rounds or something went wrong
        reply = (
            "I could not finish looking that up. Please try asking a more "
            "specific question, or check the crop page directly."
        )

    return {
        "reply": reply,
        "tools_used": tools_used,
        "history": _messages_to_dict(final_messages),
    }
