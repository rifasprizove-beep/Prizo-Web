import httpx
from typing import Any, Dict, Optional
from ..core.config import get_settings


class SupabaseClient:
    def __init__(self, url: str, service_key: str):
        self.base_url = url.rstrip("/")
        self.service_key = service_key

    def _headers(self) -> Dict[str, str]:
        return {
            "apikey": self.service_key,
            "Authorization": f"Bearer {self.service_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    def call_rpc(self, name: str, payload: Dict[str, Any]) -> Any:
        url = f"{self.base_url}/rest/v1/rpc/{name}"
        with httpx.Client(timeout=20.0) as client:
            res = client.post(url, json=payload, headers=self._headers())
            res.raise_for_status()
            return res.json()

    def get_one(self, table: str, params: Dict[str, str], select: str = "*") -> Optional[Dict[str, Any]]:
        url = f"{self.base_url}/rest/v1/{table}"
        headers = self._headers()
        headers.update({"Prefer": "return=representation,single-object"})
        query = {"select": select}
        query.update(params)
        with httpx.Client(timeout=20.0) as client:
            res = client.get(url, headers=headers, params=query)
            if res.status_code in (404, 406):
                return None
            res.raise_for_status()
            data = res.json()
            if isinstance(data, list):
                return data[0] if data else None
            return data

    def get_many(self, table: str, params: Dict[str, str], select: str = "*") -> Any:
        """Consulta PostgREST con soporte de embeds (select con relaciones) y filtros.
        Devuelve lista JSON tal cual.
        """
        url = f"{self.base_url}/rest/v1/{table}"
        headers = self._headers()
        query = {"select": select}
        query.update(params)
        with httpx.Client(timeout=25.0) as client:
            res = client.get(url, headers=headers, params=query)
            if res.status_code in (404, 406):
                return []
            res.raise_for_status()
            return res.json()


def get_supabase() -> SupabaseClient:
    s = get_settings()
    return SupabaseClient(url=s.SUPABASE_URL, service_key=s.SUPABASE_SERVICE_KEY)


def approve_payment(payment_id: str, approved_by: str) -> Any:
    sb = get_supabase()
    return sb.call_rpc("approve_payment", {"p_payment_id": payment_id, "p_approved_by": approved_by})


def find_payment_by_reference(reference: str) -> Optional[Dict[str, Any]]:
    sb = get_supabase()
    return sb.get_one("payments", {"reference": f"eq.{reference}"}, select="id, reference, status")
