from typing import Annotated

from fastapi import APIRouter, HTTPException, Path

from app import api_models as m
from app.services import collections

router = APIRouter(prefix="/collections", tags=["collections"])


@router.get("")
def list_collections() -> m.CollectionList:
    return collections.list_collections()


@router.get("/{collection_id}")
def get_collection(
    collection_id: Annotated[str, Path(pattern=r"^[a-z0-9-]+$", max_length=64)],
) -> m.Collection:
    collection = collections.get_collection(collection_id)
    if collection is None:
        raise HTTPException(404, f"Collection {collection_id} not found")
    return collection
