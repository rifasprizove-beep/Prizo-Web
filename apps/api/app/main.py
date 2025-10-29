from fastapi import FastAPI
from .api.routes.health import router as health_router
from .api.routes.admin import router as admin_router
from .api.routes.webhooks import router as webhooks_router


def create_app() -> FastAPI:
    app = FastAPI(title="Prizo API", version="0.2.0")
    app.include_router(health_router)
    app.include_router(admin_router)
    app.include_router(webhooks_router)
    return app


app = create_app()
