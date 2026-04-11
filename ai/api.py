from fastapi import FastAPI, UploadFile, File, Header, HTTPException
from pydantic import BaseModel
from typing import Optional, List
import shutil
import os
from disease_model import predict_disease
from chat_service import create_chat_agent
from fastapi.middleware.cors import CORSMiddleware

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000", "http://127.0.0.1:5173", "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

class ChatRequest(BaseModel):
    message: str
    crop_id: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None

class ChatResponse(BaseModel):
    reply: str

@app.post("/detect-disease")
async def detect_disease(file: UploadFile = File(...)):
    file_path = os.path.join(UPLOAD_DIR, file.filename)

    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)

    result = predict_disease(file_path)

    return result

@app.post("/chat", response_model=ChatResponse)
async def chat_endpoint(request: ChatRequest, authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Authorization header is required")

    try:
        agent_executor = create_chat_agent(auth_token=authorization)
        
        # We can pass context like crop_id if available to guide the model.
        context_msg = f"User asks: {request.message}"
        if request.crop_id:
            context_msg += f"\n(Context: The user is referring to crop_id: {request.crop_id})"
        if request.latitude and request.longitude:
             context_msg += f"\n(Context: Location is lat: {request.latitude}, lon: {request.longitude})"
            
        result = agent_executor.invoke({"messages": [("user", context_msg)]})
        reply = result["messages"][-1].content
        return ChatResponse(reply=reply)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))