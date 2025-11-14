from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os
from .api.routes.health import router as health_router
from .api.routes.admin import router as admin_router
from .api.routes.webhooks import router as webhooks_router
from .api.routes.reservations import router as reservations_router
from .api.routes.verify import router as verify_router
from .api.routes.rate import router as rate_router
from .api.routes.cloudinary import router as cloudinary_router
from .api.routes.payments import router as payments_router


def create_app() -> FastAPI:
    app = FastAPI(title="Prizo API", version="0.2.0")
    # CORS: cuando allow_credentials=True no se puede usar "*".
    # Permitimos orígenes locales por defecto y soportamos FRONTEND_ORIGINS (separado por comas).
    raw_origins = os.getenv("FRONTEND_ORIGINS")
    default_origins = [
        # Next.js por defecto
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "https://localhost:3000",
        "https://127.0.0.1:3000",
        # Puertos alternativos comunes
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "https://localhost:3001",
        "https://127.0.0.1:3001",
        # Vite
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "https://localhost:5173",
        "https://127.0.0.1:5173",
    ]
    allow_origins = (
        [o.strip() for o in raw_origins.split(",") if o.strip()] if raw_origins else default_origins
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=allow_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
        expose_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(admin_router)
    app.include_router(webhooks_router)
    app.include_router(reservations_router)
    app.include_router(verify_router)
    app.include_router(rate_router)
    app.include_router(cloudinary_router)
    app.include_router(payments_router)
    return app


app = create_app()
