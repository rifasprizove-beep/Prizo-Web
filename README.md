# Prizo Monorepo

Este repositorio ahora incluye una estructura para migrar a:

- Frontend (Next.js) en `apps/web`
- Backend (FastAPI) en `apps/api`
- SQL opcional para pg_cron en `supabase/sql`

Tu app actual de Vite/React sigue en la raíz y funciona mientras migras por partes.

## Estructura

```
apps/
  web/   # Next.js (SSR/ISR + SPA) con Tailwind y React Query
  api/   # FastAPI (webhooks, admin, tareas)
supabase/
  sql/   # SQL para tareas programadas (pg_cron)
```

## Correr cada servicio

### Frontend Next.js

```bash
cd apps/web
npm install
echo NEXT_PUBLIC_SUPABASE_URL=... >> .env.local
echo NEXT_PUBLIC_SUPABASE_ANON_KEY=... >> .env.local
npm run dev
```

### Backend FastAPI

```bash
cd apps/api
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Programar liberación con pg_cron (opcional)
Ejecuta el SQL de `supabase/sql/pg_cron_release_reservations.sql` en tu base de Supabase.
