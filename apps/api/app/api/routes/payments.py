from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ...services.supabase import get_supabase

router = APIRouter(prefix="/payments", tags=["payments"])


class SetCiBody(BaseModel):
    payment_id: str
    ci: str


@router.post("/set-ci")
def set_ci(body: SetCiBody):
    sb = get_supabase()
    # Sanitizar: mantener letras/números y caracteres básicos como '-' y '_'
    ci = body.ci.strip()
    if not ci:
        raise HTTPException(status_code=400, detail="ci vacío")
    try:
        updated = sb.update_one("payments", {"id": f"eq.{body.payment_id}"}, {"ci": ci})
        return {"ok": True, "data": updated}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
