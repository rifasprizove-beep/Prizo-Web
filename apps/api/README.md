# Prizo API (FastAPI)

## Ejecutar local

```bash
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

### Variables de entorno

Crear un archivo `.env` en `apps/api/` con:

```
SUPABASE_URL=https://<tu-proyecto>.supabase.co
SUPABASE_SERVICE_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Estas credenciales permiten al backend invocar RPCs con privilegios de servicio.

## Endpoints
- GET /health
- POST /admin/approve-payment { payment_id, approved_by }
- POST /webhooks/payment { reference, status, amount }

Conecta con Supabase usando una key de servicio para invocar RPCs (approve_payment, etc.).