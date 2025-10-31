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

## Inicio rápido

1) Variables de entorno

- Copia `apps/web/.env.example` a `apps/web/.env.local` y completa los valores.
- Copia `apps/api/.env.example` a `apps/api/.env` y completa los valores.

Web (Next.js):

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_API_URL (opcional; ej. http://localhost:8000)
- NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME (opcional)
- CLOUDINARY_API_KEY (opcional)
- CLOUDINARY_API_SECRET (opcional)
- CLOUDINARY_UPLOAD_PRESET (opcional)

API (FastAPI):

- SUPABASE_URL
- SUPABASE_SERVICE_KEY

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

## Reservas de tickets (RPC y permisos)

Para que el flujo de reserva funcione desde el navegador (clave anon), necesitas crear las funciones RPC con `SECURITY DEFINER` y otorgar permisos de ejecución al rol `anon` (y opcionalmente `authenticated`).

1) Abre el editor SQL de tu proyecto en Supabase
2) Ejecuta el archivo: `supabase/sql/patch_reservations.sql`

Ese script:
- Crea `public.sessions` (si no existía)
- Define las funciones:
  - `public.ensure_session(uuid)`
  - `public.ensure_tickets_for_raffle(uuid,int)`
  - `public.ensure_and_reserve_random_tickets(uuid,int,uuid,int,int)`
  - `public.reserve_tickets(uuid[],uuid,int)`
  - `public.release_tickets(uuid[],uuid)`
- Todas con `SECURITY DEFINER`, `set search_path = public` y `GRANT EXECUTE` para `anon, authenticated`.

Si al presionar “Continuar” ves un error como “permission denied for function reserve_tickets”, te falta ejecutar ese patch o los `GRANT EXECUTE`.

## Subida de comprobantes con Cloudinary

El frontend ahora puede subir evidencias a Cloudinary de forma segura (firma en el backend de Next). Si no configuras Cloudinary, cae en Supabase Storage como fallback.

1) Crea un proyecto en Cloudinary y anota:
  - CLOUDINARY_CLOUD_NAME
  - CLOUDINARY_API_KEY
  - CLOUDINARY_API_SECRET
  - (Opcional) CLOUDINARY_UPLOAD_PRESET

2) Variables de entorno (apps/web):

  En `.env.local` agrega:

  - NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=<tu_cloud_name>
  - CLOUDINARY_API_KEY=<tu_api_key>
  - CLOUDINARY_API_SECRET=<tu_api_secret>
  - (Opcional) CLOUDINARY_UPLOAD_PRESET=<tu_preset>

3) Endpoint de firma:
  - `apps/web/src/app/api/cloudinary/sign/route.ts` genera una firma con tu API Secret y devuelve `{ signature, timestamp, apiKey, cloudName, folder }`.

4) El cliente usa `uploadEvidence()` que primero pide firma y luego sube directo a Cloudinary. Si no hay Cloudinary configurado, usa Supabase Storage en el bucket `evidence`.


## Limpieza y archivos redundantes

- Se añadió un `.gitignore` profesional que ignora artefactos como `node_modules`, `.next`, `.venv`, `__pycache__`, `.env*`, entre otros.
- Se eliminaron los directorios `__pycache__` del backend (Python). Si vuelven a aparecer localmente, no se versionarán.
- Usa los ejemplos `*.env.example` para mantener secretos fuera del repo.

## Nuevos campos: CI y Top Buyer en pagos; selección manual en rifas

Para agregar Cédula (CI) y marcar Top Buyer en pagos, y permitir/deshabilitar selección manual de números en rifas:

1) Ejecuta en Supabase:
- `supabase/sql/patch_payments_ci_top_buyer.sql` (agrega payments.ci y payments.is_top_buyer; actualiza `create_payment_for_session` para aceptar `p_ci`)
- `supabase/sql/patch_raffles_allow_manual.sql` (agrega `raffles.allow_manual` boolean)
 - `supabase/sql/patch_grant_reserve_random.sql` (otorga permisos de ejecución a `reserve_random_tickets`)

### Mantener reservas sin temporizador tras enviar pago

Ejecuta también:

- `supabase/sql/patch_hold_on_payment.sql`

Esto congela las reservas cuando el usuario envía el pago (quita el temporizador y desvincula la sesión), permite que el mismo usuario siga comprando más tickets, y agrega `reject_payment(uuid,text)` para liberar si el pago es rechazado.

2) El frontend ya admite enviar `p_ci` si el usuario ingresa su cédula en el formulario de pago.

