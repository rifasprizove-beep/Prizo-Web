from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from ...services.supabase import approve_payment as sb_approve_payment


router = APIRouter(prefix="/admin", tags=["admin"])


class ApprovePaymentBody(BaseModel):
    payment_id: str
    approved_by: str


@router.post("/approve-payment")
async def approve_payment(body: ApprovePaymentBody):
    try:
        data = sb_approve_payment(payment_id=body.payment_id, approved_by=body.approved_by)
        return {"ok": True, "result": data}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
