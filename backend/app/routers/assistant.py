from fastapi import APIRouter

from app import api_models as m
from app.services import assistant

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/answer")
def ask_assistant(request: m.AssistantRequest) -> m.AssistantReply:
    return assistant.answer(request.messages)
