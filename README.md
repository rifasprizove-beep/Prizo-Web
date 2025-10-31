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

## Despliegue en Render (frontend estático + backend FastAPI)

Esta repo ya incluye los ajustes para publicar:

- Backend (FastAPI) como Web Service en Render.
- Frontend (Next.js) exportado como sitio estático.

Hay un blueprint `render.yaml` que te permite crear ambos servicios directamente.

### 1) Preparar variables de entorno

Backend (servicio `prizo-api`):

- SUPABASE_URL: URL de tu proyecto Supabase
- SUPABASE_SERVICE_KEY: Service role key
- CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (opcionales pero recomendados si usas subida de evidencias)
- CLOUDINARY_UPLOAD_PRESET (opcional)

Frontend (sitio `prizo-web`):

- NEXT_PUBLIC_API_URL: URL pública del backend en Render (por ejemplo, `https://prizo-api.onrender.com`)
- NEXT_PUBLIC_RATE_URL: opcional. Si no lo defines, el frontend usará `${NEXT_PUBLIC_API_URL}/api/rate`.

### 2) Crear los servicios con el blueprint

1. Entra a Render > Blueprints > New > Connect repo y selecciona esta repo.
2. Render detectará `render.yaml` y te mostrará 2 servicios:
   - prizo-api (Python Web Service)
   - prizo-web (Static Site)
3. Rellena las variables de entorno marcadas como `sync: false` durante la creación o luego en Settings.
4. Despliega.

Notas de build:
- El frontend corre `npm ci && npm run build && npm run export` en `apps/web` y publica `apps/web/out`.
- El backend instala `requirements.txt` y ejecuta `uvicorn app.main:app`.

### 3) Rutas y comunicación Frontend ↔ Backend

- El frontend llama al backend usando `NEXT_PUBLIC_API_URL`.
- Endpoints expuestos en el backend:
  - `GET /api/rate` → tasa USD→VES (BCV) desde mirrors públicos.
  - `POST /api/cloudinary/sign` → firma para subir a Cloudinary.
  - (Más los ya existentes: `/health`, `/reservations`, `/verify`, etc.)

### 4) Verificación rápida

Cuando ambos servicios estén arriba:

1. Abre `https://<dominio-del-backend>/health` → debe responder `{"status":"ok"}`.
2. Desde el sitio estático, prueba flujo de compra/carga de evidencia; si tienes CLOUDINARY_* configurado, la carga sube a Cloudinary; si no, cae a Supabase Storage (asegúrate de tener bucket `evidence`).

### 5) Problemas comunes

- Si ves errores con imágenes Next en el sitio estático, ya está activado `images.unoptimized: true` en `next.config.mjs`.
- Si una página dinámica falla al exportar, revisa que no haya APIs de servidor en esas páginas. En este proyecto, los datos se cargan en el cliente con Supabase/Fetch.

## Despliegue en DigitalOcean App Platform (alternativa a Render)

Incluí un App Spec en `.do/app.yaml` con dos componentes:

- `prizo-api`: Web Service (Python/FastAPI) servido bajo la ruta `/api`.
- `prizo-web`: Static Site (Next.js export) servido en `/`.

### Variables requeridas

Backend (`prizo-api`):

- SUPABASE_URL
- SUPABASE_SERVICE_KEY
- CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET (opcionales si subes evidencias a Cloudinary)
- CLOUDINARY_UPLOAD_PRESET (opcional)

Frontend (`prizo-web`):

- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- NEXT_PUBLIC_RATE_URL (opcional; si no, el frontend usa `/api/rate`)

Opcional:
- NODE_VERSION=18.20.4 (asegura Node 18 LTS durante build).

### Crear la App desde la consola de DO

1. DigitalOcean > Apps > Create App > From GitHub > selecciona este repo.
2. Elige “Use existing App Spec” y apunta a `.do/app.yaml`.
3. Revisa que los componentes aparezcan como:
  - Static Site → Source dir: `apps/web`, Output dir: `out`, Build: `npm ci && npm run build && npm run export`.
  - Web Service → Source dir: `apps/api`, Run: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`.
4. Crea los Environment Variables (marca secretos donde aplique) con alcance `RUN_AND_BUILD` para que estén disponibles en el build del frontend.
5. Deploy.

Con este App Spec, el dominio principal sirve el estático (`/`) y las rutas de API bajo la misma base (`/api/...`). Como el frontend ya usa rutas relativas por defecto, no necesitas `NEXT_PUBLIC_API_URL` en App Platform.
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

