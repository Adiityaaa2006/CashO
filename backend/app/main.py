from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.api.routes import router as api_router
from app.api.sync_routes import router as sync_router, review_router
from app.db.database import init_db

app = FastAPI(
    title=settings.APP_NAME,
    version=settings.VERSION,
    description="CashO - Financial Tracking & Insights Engine",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
def on_startup():
    init_db()

@app.get("/")
def root():
    return {
        "app": settings.APP_NAME,
        "version": settings.VERSION,
        "status": "online"
    }

app.include_router(api_router, prefix="/api")
app.include_router(sync_router)
app.include_router(review_router)
