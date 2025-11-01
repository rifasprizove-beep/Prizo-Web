from fastapi import APIRouter
import httpx
from urllib.parse import urlparse
from ...core.config import get_settings
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


@router.get("/health/env")
def health_env():
    """Indica si las variables de entorno de Supabase están configuradas (sin exponer valores).
    Devuelve el host de SUPABASE_URL y si la SERVICE_KEY parece presente (longitud>20).
    """
    s = get_settings()
    try:
        parsed = urlparse(s.SUPABASE_URL)
        host = parsed.netloc
    except Exception:
        host = None
    key_present = bool(getattr(s, "SUPABASE_SERVICE_KEY", None)) and len(s.SUPABASE_SERVICE_KEY) > 20
    return {"ok": True, "supabase_host": host, "service_key_present": bool(key_present)}
