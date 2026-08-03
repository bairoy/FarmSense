"""FastAPI inference service.

This service is internal: the React app never talks to it, only the Node
backend does. That is enforced with a shared secret rather than left to
obscurity — an unauthenticated inference endpoint on the public internet is
free compute for whoever finds it.
"""

import base64
from typing import Optional

from fastapi import Depends, FastAPI, File, Header, HTTPException, UploadFile
from pydantic import BaseModel

from config import AI_SERVICE_TOKEN, CONFIDENCE_GATE, MAX_UPLOAD_BYTES
from disease_model import predict_disease
from image_utils import compress_for_storage, load_image
import langgraph_agent

app = FastAPI(title="FarmSense AI", version="0.2.0")


async def require_service_token(authorization: str | None = Header(default=None)) -> None:
    """Reject anything that is not the backend.

    Fail closed: if AI_SERVICE_TOKEN is unset the service refuses every
    request rather than silently running wide open. A misconfigured deploy
    should be obviously broken, not quietly insecure.
    """
    if not AI_SERVICE_TOKEN:
        raise HTTPException(
            status_code=503,
            detail="AI_SERVICE_TOKEN is not configured; refusing requests.",
        )

    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing bearer token")

    if authorization.removeprefix("Bearer ").strip() != AI_SERVICE_TOKEN:
        raise HTTPException(status_code=401, detail="Invalid service token")


SERVICE_ID = "farmsense-ai"


@app.get("/health")
async def health() -> dict:
    """Unauthenticated liveness probe.

    Returns a service identifier as well as status. Without it, any unrelated
    process that happens to answer 200 on /health satisfies the backend's
    reachability check - which is exactly what happened during commissioning,
    when a Docker container bound to the same port and the backend cheerfully
    reported the AI service as healthy.

    Nothing sensitive is exposed: the name is already public in this repo.
    """
    return {"status": "ok", "service": SERVICE_ID}


@app.post("/detect-disease", dependencies=[Depends(require_service_token)])
async def detect_disease(file: UploadFile = File(...)) -> dict:
    """Classify a leaf photo and hand back the archival-quality JPEG.

    The image is decoded exactly once here, so the bytes the backend persists
    to R2 are provably the same pixels the model was shown. Nothing is written
    to the local filesystem — the old version saved every upload under
    `uploads/` using the client-supplied filename, which is both a disk leak
    and a path-traversal foothold.
    """
    raw = await file.read()

    if not raw:
        raise HTTPException(status_code=400, detail="Empty upload")
    if len(raw) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Image too large")

    try:
        image = load_image(raw)
    except Exception:
        raise HTTPException(status_code=400, detail="Could not decode image")

    result = predict_disease(image)

    # The gate lives here because this is where the probability is produced.
    # The backend attaches a treatment only when `actionable` is true.
    result["actionable"] = result["confidence"] >= CONFIDENCE_GATE
    result["confidence_gate"] = CONFIDENCE_GATE

    compressed = compress_for_storage(image)
    result["original_bytes"] = len(raw)
    result["stored_bytes"] = len(compressed)
    result["image_b64"] = base64.b64encode(compressed).decode("ascii")

    return result


# --- Chat endpoint ---


class ChatRequest(BaseModel):
    """Request body for the chat endpoint."""

    message: str
    crop_id: str
    history: Optional[list[dict]] = None


class ChatResponse(BaseModel):
    """Response body for the chat endpoint."""

    reply: str
    tools_used: list[str]
    history: list[dict]


@app.post("/chat", dependencies=[Depends(require_service_token)])
async def chat_endpoint(
    request: ChatRequest,
    x_user_token: str | None = Header(default=None, alias="X-User-Token"),
) -> ChatResponse:
    """Chat with the FarmSense agent about a specific crop.

    The backend forwards the user's Supabase token in X-User-Token so the
    agent's tools can call backend endpoints as that user. This preserves
    the ownership checks on crops and fields.
    """
    if not x_user_token:
        raise HTTPException(
            status_code=400,
            detail="X-User-Token header is required for chat",
        )

    result = langgraph_agent.chat(
        message=request.message,
        token=x_user_token,
        history=request.history,
        crop_id=request.crop_id,
    )

    return ChatResponse(
        reply=result["reply"],
        tools_used=result["tools_used"],
        history=result["history"],
    )
