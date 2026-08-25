"""Tool-calling chat agent for FarmSense.

Uses the Anthropic Messages API with a manual tool-use loop. That is
deliberately simple - the agent has four tools, no branching workflow and no
persistent graph state, so a framework would add dependencies without adding
capability.

The system prompt does the safety work. Its central instruction is negative:
the model must not produce agronomic quantities of its own. Every number a
farmer acts on has to come back from a tool, which traces to a published rate
table or a physical model. See learning/09-agent-grounding.md.
"""

from __future__ import annotations

import os

import anthropic

from tools import (
    TOOL_SCHEMAS,
    BackendError,
    get_crop_state_summary,
    get_fertilizer_recommendation,
    get_irrigation_recommendation,
)

MODEL = os.getenv("ANTHROPIC_MODEL", "claude-sonnet-5")
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
- If the farmer writes in Hindi or Bhojpuri, answer in the same language.
- When you genuinely do not know, say so and suggest they contact their local \
agriculture extension officer. That is a good answer, not a failure.

You have tools for crop condition, irrigation, fertilizer and photo diagnosis. \
Call get_crop_state_summary first for any general question - it is the single \
source of truth that the other tools agree with."""


TOOL_FUNCTIONS = {
    "get_crop_state_summary": get_crop_state_summary,
    "get_irrigation_recommendation": get_irrigation_recommendation,
    "get_fertilizer_recommendation": get_fertilizer_recommendation,
}


def _run_tool(name: str, arguments: dict, token: str) -> str:
    """Executes a tool, converting failures into text the model can act on.

    Returning the error as a tool result rather than raising lets the model
    tell the farmer what went wrong ("your session expired") instead of the
    whole request 500-ing.
    """
    function = TOOL_FUNCTIONS.get(name)
    if function is None:
        return f"Tool {name} is not available in this context."

    try:
        return function(arguments["crop_id"], token)
    except BackendError as exc:
        return f"Could not retrieve that data: {exc}"
    except Exception as exc:  # noqa: BLE001 - surfaced to the model, not swallowed
        return f"Unexpected error running {name}: {exc}"


def chat(
    message: str,
    token: str,
    history: list[dict] | None = None,
    crop_id: str | None = None,
) -> dict:
    """One turn of conversation, running tools until the model has an answer."""
    client = anthropic.Anthropic()

    messages: list[dict] = list(history or [])

    # Injecting the crop id saves the model having to ask for a UUID the
    # farmer does not know and could not type.
    content = (
        f"{message}\n\n[Context: the farmer is currently viewing crop {crop_id}]"
        if crop_id
        else message
    )
    messages.append({"role": "user", "content": content})

    tools_used: list[str] = []

    for _ in range(MAX_TOOL_ROUNDS):
        response = client.messages.create(
            model=MODEL,
            max_tokens=1500,
            system=SYSTEM_PROMPT,
            tools=TOOL_SCHEMAS,
            messages=messages,
        )

        messages.append({"role": "assistant", "content": response.content})

        if response.stop_reason != "tool_use":
            text = "".join(
                block.text for block in response.content if block.type == "text"
            )
            return {"reply": text, "tools_used": tools_used, "history": messages}

        results = []
        for block in response.content:
            if block.type != "tool_use":
                continue

            tools_used.append(block.name)
            results.append(
                {
                    "type": "tool_result",
                    "tool_use_id": block.id,
                    "content": _run_tool(block.name, block.input, token),
                }
            )

        messages.append({"role": "user", "content": results})

    # Ran out of rounds. Say so rather than returning a partial answer that
    # looks complete.
    return {
        "reply": (
            "I could not finish looking that up. Please try asking a more "
            "specific question, or check the crop page directly."
        ),
        "tools_used": tools_used,
        "history": messages,
    }
