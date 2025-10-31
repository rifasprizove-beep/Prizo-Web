from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from .api.routes.health import router as health_router
from .api.routes.admin import router as admin_router
from .api.routes.webhooks import router as webhooks_router
from .api.routes.reservations import router as reservations_router
from .api.routes.verify import router as verify_router
from .api.routes.rate import router as rate_router
from .api.routes.cloudinary import router as cloudinary_router


def create_app() -> FastAPI:
    app = FastAPI(title="Prizo API", version="0.2.0")
    # CORS amplio para desarrollo; ajustar orígenes en producción
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )
    app.include_router(health_router)
    app.include_router(admin_router)
    app.include_router(webhooks_router)
    app.include_router(reservations_router)
    app.include_router(verify_router)
    app.include_router(rate_router)
    app.include_router(cloudinary_router)
    return app


app = create_app()
