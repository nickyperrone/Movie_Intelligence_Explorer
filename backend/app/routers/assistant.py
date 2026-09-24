from typing import Annotated

from fastapi import APIRouter, Header

from app import api_models as m
from app.services import assistant

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.post("/answer")
def ask_assistant(
    request: m.AssistantRequest,
    x_device_id: Annotated[str | None, Header(max_length=64)] = None,
) -> m.AssistantReply:
    return assistant.answer(request.messages, x_device_id)
