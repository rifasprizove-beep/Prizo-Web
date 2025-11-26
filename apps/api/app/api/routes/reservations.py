from fastapi import APIRouter, HTTPException
import logging
import httpx
from pydantic import BaseModel, Field
from typing import List, Optional, Any
from ...services.supabase import get_supabase


router = APIRouter(prefix="/reservations", tags=["reservations"])

logger = logging.getLogger("prizo.reservations")


class ReserveByIdsBody(BaseModel):
    p_ticket_ids: List[str] = Field(default_factory=list)
    p_session_id: str
    p_minutes: Optional[int] = 10


@router.post("/ids")
def reserve_by_ids(body: ReserveByIdsBody) -> Any:
    sb = get_supabase()
    try:
        logger.info("reserve_by_ids called: raffle tickets=%d session=%s", len(body.p_ticket_ids), body.p_session_id)
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
        logger.info("release_ids called: tickets=%d session=%s", len(body.p_ticket_ids), body.p_session_id)
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
    p_total: Optional[int] = None
    p_session_id: str
    p_quantity: int
    p_minutes: Optional[int] = 10


@router.post("/random")
def reserve_random(body: ReserveRandomBody) -> Any:
    sb = get_supabase()
    try:
        # Log the incoming body for debugging p_total / p_quantity behavior
        original = None
        try:
            original = body.model_dump()
            logger.info("reserve_random called: %s", original)
        except Exception:
            logger.info("reserve_random called (could not serialize body)")

        # Fetch canonical raffle data and override p_total to avoid client-supplied
        # incorrect totals that can cause ticket over-creation.
        try:
            raffle = sb.get_one('raffles', { 'id': f"eq.{body.p_raffle_id}" }, select='total_tickets,is_free')
            if raffle is not None and 'total_tickets' in raffle:
                used_total = raffle.get('total_tickets')
                # Replace/ensure p_total in payload we send to the DB function
                payload = body.model_dump()
                payload['p_total'] = used_total
                if original and original.get('p_total') is not None and original.get('p_total') != used_total:
                    logger.warning('reserve_random: client p_total (%s) differs from raffle.total_tickets (%s) for raffle %s', original.get('p_total'), used_total, body.p_raffle_id)
            else:
                payload = body.model_dump()
        except Exception as e:
            logger.warning('reserve_random: could not fetch raffle canonical total: %s', str(e))
            payload = body.model_dump()

        data = sb.call_rpc("ensure_and_reserve_random_tickets", payload)
        return {"ok": True, "data": data}
    except httpx.HTTPStatusError as e:
        status = e.response.status_code if e.response is not None else 500
        detail = e.response.text if e.response is not None else str(e)
        raise HTTPException(status_code=status, detail=f"Supabase error {status}: {detail}")
    except httpx.RequestError as e:
        raise HTTPException(status_code=502, detail=f"Supabase request error: {str(e)}")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
