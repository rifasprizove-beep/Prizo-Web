from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel
from ...services.supabase import approve_payment as sb_approve_payment, find_payment_by_reference


router = APIRouter(prefix="/webhooks", tags=["webhooks"])


class PaymentWebhook(BaseModel):
    reference: str | None = None
    status: str | None = None
    amount: float | None = None


@router.post("/payment")
async def payment_webhook(payload: PaymentWebhook, request: Request):
    # TODO: validar firma del proveedor (según pasarela)
    if not payload.reference:
        raise HTTPException(status_code=400, detail="reference is required")

    payment = find_payment_by_reference(payload.reference)
    if not payment:
        raise HTTPException(status_code=404, detail="payment not found")

    provider_status = (payload.status or "").lower()
    is_approved = provider_status in {"approved", "success", "paid"}

    if is_approved:
        try:
            sb_approve_payment(payment_id=payment["id"], approved_by="webhook")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"approve failed: {e}")

    return {"received": True, "processed": is_approved}
