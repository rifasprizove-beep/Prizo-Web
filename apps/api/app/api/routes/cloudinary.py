from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import hashlib
import os
import time


router = APIRouter(prefix="/api", tags=["cloudinary"])


class SignBody(BaseModel):
    folder: str | None = None
    publicId: str | None = None


@router.post("/cloudinary/sign")
async def sign_upload(body: SignBody):
    """
    Firma parámetros de subida a Cloudinary.
    Envía { folder?, publicId? }. Requiere CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.
    Opcional: CLOUDINARY_UPLOAD_PRESET.
    """
    cloud_name = os.getenv("CLOUDINARY_CLOUD_NAME")
    api_key = os.getenv("CLOUDINARY_API_KEY")
    api_secret = os.getenv("CLOUDINARY_API_SECRET")
    upload_preset = os.getenv("CLOUDINARY_UPLOAD_PRESET")

    if not cloud_name or not api_key or not api_secret:
        raise HTTPException(status_code=500, detail="Cloudinary env vars missing")

    folder = body.folder or "evidence"
    public_id = body.publicId
    timestamp = int(time.time())

    # Construir cadena de firma ordenada alfabéticamente
    params = {
        "folder": folder,
        "timestamp": timestamp,
        "upload_preset": upload_preset,
        "public_id": public_id,
    }
    parts = [f"{k}={v}" for k, v in sorted(params.items()) if v not in (None, "")]
    to_sign = "&".join(parts) + api_secret
    signature = hashlib.sha1(to_sign.encode("utf-8")).hexdigest()

    return {
        "signature": signature,
        "timestamp": timestamp,
        "apiKey": api_key,
        "cloudName": cloud_name,
        "folder": folder,
        "publicId": public_id,
        "uploadPreset": upload_preset or None,
    }
