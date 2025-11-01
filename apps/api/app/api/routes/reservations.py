from fastapi import APIRouter, HTTPException
import httpx
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from ...services.supabase import get_supabase


router = APIRouter(prefix="/reservations", tags=["reservations"])


class ReserveByIdsBody(BaseModel):
    p_ticket_ids: List[str] = Field(default_factory=list)
    p_session_id: str
    p_minutes: Optional[int] = 10


@router.post("/ids")
def reserve_by_ids(body: ReserveByIdsBody) -> Any:
    sb = get_supabase()
    try:
        data = sb.call_rpc("reserve_tickets", body.model_dump())
        return {"ok": True, "data": data}
    except httpx.HTTPStatusError as e:
        # Propaga el estado real que devuelve Supabase y su cuerpo para facilitar el diagnóstico
        status = e.response.status_code if e.response is not None else 500
        detail = e.response.text if e.response is not None else str(e)
        raise HTTPException(status_code=status, detail=f"Supabase error {status}: {detail}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Supabase request error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ReleaseBody(BaseModel):
    p_ticket_ids: List[str] = Field(default_factory=list)
    p_session_id: str


@router.post("/release")
def release_ids(body: ReleaseBody) -> Any:
    sb = get_supabase()
    try:
        data = sb.call_rpc("release_tickets", body.model_dump())
        return {"ok": True, "data": data}
    except httpx.HTTPStatusError as e:
        status = e.response.status_code if e.response is not None else 500
        detail = e.response.text if e.response is not None else str(e)
        raise HTTPException(status_code=status, detail=f"Supabase error {status}: {detail}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Supabase request error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class ReserveRandomBody(BaseModel):
    p_raffle_id: str
    p_total: int
    p_session_id: str
    p_quantity: int
    p_minutes: Optional[int] = 10


@router.post("/random")
def reserve_random(body: ReserveRandomBody) -> Any:
    sb = get_supabase()
    try:
        data = sb.call_rpc("ensure_and_reserve_random_tickets", body.model_dump())
        return {"ok": True, "data": data}
    except httpx.HTTPStatusError as e:
        status = e.response.status_code if e.response is not None else 500
        detail = e.response.text if e.response is not None else str(e)
        raise HTTPException(status_code=status, detail=f"Supabase error {status}: {detail}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Supabase request error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
