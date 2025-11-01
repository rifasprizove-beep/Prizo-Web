from fastapi import APIRouter
import httpx
from ...services.supabase import get_supabase

router = APIRouter()


@router.get("/health")
def health():
    return {"ok": True}


@router.get("/health/db")
def health_db():
    """Verifica conectividad con Supabase y acceso básico a la tabla raffles.
    Devuelve { ok: True, sample: {...} } o detalle del error.
    """
    try:
        sb = get_supabase()
        sample = sb.get_many("raffles", {"limit": "1"}, select="id")
        return {"ok": True, "sample": sample}
    except httpx.HTTPStatusError as e:
        status = e.response.status_code if e.response is not None else 500
        detail = e.response.text if e.response is not None else str(e)
        return {"ok": False, "status": status, "detail": detail}
    except httpx.RequestError as e:
        return {"ok": False, "status": 502, "detail": str(e)}
    except Exception as e:
        return {"ok": False, "status": 500, "detail": str(e)}
