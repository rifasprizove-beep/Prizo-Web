from fastapi import APIRouter
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
        sample = sb.get_many("raffles", {"limit": "1"}, select="id");
        return {"ok": True, "sample": sample}
    except Exception as e:
        return {"ok": False, "detail": str(e)}
