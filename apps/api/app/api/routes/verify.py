from fastapi import APIRouter, HTTPException, Query
from typing import Any, List, Dict
from ...services.supabase import get_supabase


router = APIRouter(prefix="/verify", tags=["verify"])


@router.get("")
def verify_tickets(q: str = Query(..., min_length=2), include_pending: bool = True) -> Any:
    """Busca tickets asociados a pagos por email o cédula (ci).
    Devuelve tickets reservados (si include_pending) y vendidos (aprobados).
    """
    sb = get_supabase()
    try:
        # 1) Primer intento: RPC (si está instalado)
        try:
            data = sb.call_rpc(
                "verify_tickets",
                {"p_query": q, "p_include_pending": include_pending},
            )
            return {"ok": True, "data": data}
        except Exception:
            pass

        # 2) Fallback: consulta embebida en PostgREST con service key (sin depender del RPC)
        # Embedding: payment_tickets con joins a payments (inner) y tickets (y raffles desde tickets)
        select = (
            "payments!inner(id,email,ci,status,created_at),"
            "tickets(id,ticket_number,status,raffle_id,raffles(name))"
        )
        # Filtro: por email o ci (ilike) y por estado approved o pending
        term = f"*{q}*"
        params = {
            "or": f"(payments.email.ilike.{term},payments.ci.ilike.{term})",
            "payments.status": "in.(approved,pending)" if include_pending else "in.(approved)",
        }
        try:
            rows: List[Dict[str, Any]] = sb.get_many("payment_tickets", params, select=select)
        except Exception:
            # Si falla (por ejemplo, columna ci no existe), reintentar solo con email
            params = {
                "payments.email": f"ilike.{term}",
                "payments.status": "in.(approved,pending)" if include_pending else "in.(approved)",
            }
            rows = sb.get_many("payment_tickets", params, select=select)

        # Adaptar forma de salida al contrato del RPC
        out = []
        for r in rows:
            p = r.get("payments") or r.get("payment") or {}
            t = r.get("tickets") or r.get("ticket") or {}
            rf = (t.get("raffles") or {}).get("name") if isinstance(t.get("raffles"), dict) else None
            out.append({
                "raffle_id": t.get("raffle_id"),
                "raffle_name": rf,
                "ticket_id": t.get("id"),
                "ticket_number": t.get("ticket_number"),
                "ticket_status": t.get("status"),
                "payment_id": p.get("id"),
                "payment_status": p.get("status"),
                "created_at": p.get("created_at"),
            })
        return {"ok": True, "data": out}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
