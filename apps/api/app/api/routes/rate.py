from fastapi import APIRouter, HTTPException
import httpx

router = APIRouter(prefix="/api", tags=["rate"])


@router.get("/rate")
async def get_usdves_rate():
    """
    Devuelve la tasa USD->VES del BCV a partir de mirrors públicos.
    Respuesta: { rate: number, source: 'BCV', date: 'YYYYMMDD' }
    """
    mirrors = [
        "https://pydolarvenezuela.github.io/api/v1/dollar",
        "https://pydolarvenezuela-api.vercel.app/api/v1/dollar",
        "https://pydolarvenezuela.vercel.app/api/v1/dollar",
        "https://pydolarvenezuela.obh.software/api/v1/dollar",
        "https://dolartoday-api.vercel.app/api/pydolar",
        "https://venezuela-exchange.vercel.app/api",
    ]

    def to_number(val):
        if isinstance(val, (int, float)) and float(val) > 0:
            return float(val)
        if isinstance(val, str):
            s = val.strip().replace(".", "").replace(",", ".")
            try:
                n = float(s)
                if n > 0:
                    return n
            except Exception:
                return None
        return None

    def scan(obj):
        if not isinstance(obj, dict):
            return None
        for k, v in obj.items():
            key = str(k).lower()
            if any(x in key for x in ("bcv", "official", "oficial")):
                n = to_number(v)
                if n:
                    return n
            if key == "bcv" and isinstance(v, dict):
                cand = v.get("price") or v.get("promedio") or v.get("value") or v.get("venta") or v.get("sell")
                n = to_number(cand)
                if n:
                    return n
            if isinstance(v, dict):
                nested = scan(v)
                if nested:
                    return nested
        return None

    async with httpx.AsyncClient(timeout=8.0) as client:
        for url in mirrors:
            try:
                r = await client.get(url)
                if r.status_code >= 400:
                    continue
                n = scan(r.json())
                if n:
                    from datetime import datetime

                    date = datetime.utcnow().strftime("%Y%m%d")
                    return {"rate": float(n), "source": "BCV", "date": date}
            except Exception:
                continue

    raise HTTPException(status_code=502, detail="No rate source available")
