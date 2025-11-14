from fastapi import APIRouter, HTTPException, Query
from typing import Any, List, Dict
from ...services.supabase import get_supabase
import traceback


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
            # continuar con fallback PostgREST sin romper la solicitud
            pass

        # 2) Fallback: consulta embebida en PostgREST con service key (sin depender del RPC)
        # Embedding: payment_tickets con joins a payments (inner) y tickets (y raffles desde tickets)
        select = (
            "payments!inner(id,email,ci,status,created_at),"
            "tickets(id,ticket_number,status,raffle_id,raffles(name))"
        )
        # Filtro: por email o ci (ilike) y por estado approved o pending
        term = f"*{q}*"
        # Incluir estados en revisión/ampliados cuando include_pending=True
        pending_set = "approved,pending,underpaid,overpaid,ref_mismatch" if include_pending else "approved"
        params = {
            "or": f"(payments.email.ilike.{term},payments.ci.ilike.{term})",
            "payments.status": f"in.({pending_set})",
        }
        try:
            rows: List[Dict[str, Any]] = sb.get_many("payment_tickets", params, select=select)
        except Exception:
            # Si falla (por ejemplo, columna ci no existe), reintentar solo con email
            try:
                params = {
                    "payments.email": f"ilike.{term}",
                    "payments.status": "in.(approved,pending,underpaid,overpaid,ref_mismatch)" if include_pending else "in.(approved)",
                }
                rows = sb.get_many("payment_tickets", params, select=select)
            except Exception as e2:
                try:
                    print("[verify] fallback error:", str(e2))
                    traceback.print_exc()
                except Exception:
                    pass
                rows = []

        # Súper fallback: si no hay resultados, buscamos primero payments y luego tickets por payment_id
        if not rows:
            try:
                pending_set = "approved,pending,underpaid,overpaid,ref_mismatch" if include_pending else "approved"
                pay_select = "id,email,ci,status,created_at"
                pay_params = {
                    "or": f"(email.ilike.{term},ci.ilike.{term})",
                    "status": f"in.({pending_set})",
                }
                payments = sb.get_many("payments", pay_params, select=pay_select)
                # Segundo intento: solo dígitos de la CI (cubrir "V-22321331" vs "22321331")
                if not payments:
                    only_digits = "".join(ch for ch in q if ch.isdigit())
                    if len(only_digits) >= 4:
                        dterm = f"*{only_digits}*"
                        pay_params2 = {
                            "ci": f"ilike.{dterm}",
                            "status": f"in.({pending_set})",
                        }
                        payments = sb.get_many("payments", pay_params2, select=pay_select)

                if payments:
                    ids = [p.get("id") for p in payments if p.get("id")]
                    if ids:
                        id_list = ",".join(ids)
                        pt_params = {"payment_id": f"in.({id_list})"}
                        rows = sb.get_many("payment_tickets", pt_params, select=select)
                try:
                    print(f"[verify] q='{q}' payments_encontrados={len(payments) if 'payments' in locals() and payments else 0} tickets_encontrados={len(rows) if rows else 0}")
                except Exception:
                    pass
            except Exception as e3:
                try:
                    print("[verify] super-fallback error:", str(e3))
                    traceback.print_exc()
                except Exception:
                    pass

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
        # Log y respuesta 200 con data vacía para que el cliente no vea CORS espurio
        try:
            print("[verify] error:", str(e))
            traceback.print_exc()
        except Exception:
            pass
        return {"ok": False, "data": [], "error": "internal_error"}
