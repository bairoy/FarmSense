# 11 — Grounding the agent: the LLM is not allowed to do arithmetic

## A correction to the brief first

The improvement report I worked from described "the LangGraph tool-calling agent
grounded in real backend data" as existing good work to extend, and asked for
four tools to be added to `ai/tools.py`.

**None of that existed.** `ai/` contained exactly three files: `api.py` (19
lines, one endpoint), `disease_model.py`, and an empty `requirements.txt`. There
was no agent, no `tools.py`, no `chat_service.py`, and no `/chat` endpoint. The
report's instruction to "add auth to `/detect-disease` matching the `/chat`
pattern" had no pattern to match.

Worth recording because it's a general lesson: **verify the premises of a spec
before implementing against them.** The design in the report was sound; its
description of the starting point was not.

So this layer is built from scratch.

## The problem

A farmer asks: *"How much urea should I put on my rice?"*

An LLM will answer that question. Fluently. With a specific number. Immediately.
It has read thousands of agronomy documents and it will produce something
plausible — maybe the Indian Punjab recommendation, maybe a generic figure,
maybe a hallucination.

The farmer has **no way to tell that number apart from the right one.**

They will go and buy that much urea.

## The concept

The rule, stated as a negative because that's how it has to be enforced:

> **The agent never originates an agronomic number.**

Every quantity comes back from a tool. Every tool is a thin wrapper over a
backend endpoint. Every endpoint traces to a published rate table or a physical
model.

The model's job is **explanation and translation**, not computation:
- Turning "root zone depletion 78mm exceeds RAW 62mm" into "the soil is dry"
- Answering in Hindi or Bhojpuri when asked in Hindi or Bhojpuri
- Knowing which tool the question needs
- Carrying the confidence caveat into the answer

Those are things an LLM is genuinely good at. Arithmetic over safety-critical
constants is not.

## The decisions

### Tools are thin. Deliberately.

```python
def get_fertilizer_recommendation(crop_id: str, token: str) -> str:
    data = _get(f"/api/recommendations/{crop_id}/fertilizer", token)
    ...formatting only...
```

No computation in the tool layer. If the tool did arithmetic, that arithmetic
would be a second implementation that could drift from the one the dashboard
uses — and then the chat and the UI disagree again.

### Forward the farmer's token, don't use a service key

```python
headers={"Authorization": f"Bearer {token}"}
```

The agent calls the backend **as the farmer**. The existing ownership checks
apply unchanged, so the agent cannot read a crop its user doesn't own even if it
is instructed to. **Authorisation is not something the tool layer gets to
decide.**

A service key here would make prompt injection a data-breach vector rather than
an annoyance.

### Confidence leads, it doesn't trail

```python
return (f"[CONFIDENCE: {band.upper()} ({score}), {staleness}]\n{caveat}\n" + ...)
```

This ordering is not cosmetic. A model summarising a long tool result reliably
carries the **opening** framing into its answer, and just as reliably drops a
**trailing** disclaimer. If you want the caveat to survive summarisation, put it
first.

### The system prompt states hard rules as prohibitions

```
1. NEVER state a fertilizer quantity, irrigation volume, pesticide name, or
   chemical dose from your own knowledge. Every such number must come from a
   tool result in this conversation.
```

Prohibitions transfer better than aspirations. "Be accurate about fertilizer" is
unenforceable; "never state a quantity that isn't in a tool result" is checkable
by reading the transcript.

### The gate is repeated inside the tool result

Not just in the prompt — in the data the model is reading:

```python
if not data.get("actionable"):
    lines.append("\nDo not suggest any specific chemical or dose for this result. "
                 "The classification was not confident enough to act on.")
```

Defence in depth. The instruction sits in the immediate context, right next to
the low-confidence result, where it's hardest to ignore.

### Image analysis goes through the backend, not the local model

```python
response = httpx.post(f"{BACKEND_URL}/api/disease/crop/{crop_id}/analyse", ...)
```

`ai/` has the model loaded in memory. Calling it directly would be faster. But
then the diagnosis **vanishes when the chat ends** — no R2 storage, no
`crop_states` row, no health history. Going the long way round is what makes the
result persist.

### Errors become tool results, not exceptions

```python
except BackendError as exc:
    return f"Could not retrieve that data: {exc}"
```

The model can then tell the farmer "your session expired" instead of the whole
request 500-ing. A failure the user can understand beats a stack trace.

### A manual tool loop, not a framework

Four tools, no branching workflow, no persistent graph state. LangGraph would
add a dependency and a concept without adding capability. ~60 lines of loop:

```python
for _ in range(MAX_TOOL_ROUNDS):
    response = client.messages.create(model=MODEL, tools=TOOL_SCHEMAS, ...)
    if response.stop_reason != "tool_use":
        return {"reply": text, ...}
    ...run tools, append results...
```

And when the loop runs out, **say so** rather than returning a partial answer
that looks complete.

### Tool descriptions carry the prohibition too

```python
"description": "... NEVER state a fertilizer quantity from your own knowledge - "
               "always call this tool."
```

The schema description is in context every single turn, unlike the system prompt
in a long conversation.

## What breaks if you get this wrong

| Mistake | Consequence |
|---|---|
| LLM computes quantities | Plausible wrong numbers a farmer cannot distinguish from right ones. |
| Service key instead of user token | Prompt injection becomes a cross-tenant data breach. |
| Confidence at the end of tool output | Dropped during summarisation. Farmer never sees it. |
| Aspirational prompt ("be careful") | Unenforceable, unverifiable. |
| Gate only in the prompt, not the data | Model reasons around it when the result looks obvious. |
| Calling the model in-process | Diagnosis vanishes; health history stays empty. |
| Raising on backend errors | Whole chat 500s instead of explaining the problem. |
| Silent partial answer on loop exhaustion | Looks like a complete answer. Isn't. |

## Code

- `ai/tools.py` — four tools + schemas
- `ai/chat_service.py` — system prompt and the tool loop
