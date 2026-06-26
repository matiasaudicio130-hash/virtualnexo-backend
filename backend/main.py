from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware
from app.core.limiter import limiter


async def _rate_limit_handler(_request: Request, _exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"detail": "Demasiadas solicitudes. Esperá unos momentos antes de reintentar."},
    )

from app.core.config import get_settings
from app.core.branding import APP_NAME, APP_VERSION
from app.routers import auth, kyc, admin, exchange, payments, settings as settings_router, tokens, pricing
from app.routers import stripe_router, reports, payouts, media, feed, reviews, ads, travel, messaging, notifications, profiles, comments, push, highlights, events, discovery
from app.routers import two_factor, sessions as sessions_router, follows, groups, albums, couples
from app.routers import search as search_router
from app.routers import analytics  as analytics_router
from app.routers import hashtags    as hashtags_router
from app.routers import moderation  as moderation_router
from app.routers import badges       as badges_router
from app.routers import collections  as collections_router

settings = get_settings()

app = FastAPI(
    title=APP_NAME,
    version=APP_VERSION,
    docs_url="/docs"       if settings.is_dev else None,
    redoc_url="/redoc"     if settings.is_dev else None,
    openapi_url="/openapi.json" if settings.is_dev else None,
)

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_handler)
app.add_middleware(SlowAPIMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept"],
)

app.include_router(auth.router, prefix="/api/v1")
app.include_router(kyc.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(exchange.router, prefix="/api/v1")
app.include_router(payments.router, prefix="/api/v1")
app.include_router(settings_router.router, prefix="/api/v1")
app.include_router(tokens.router, prefix="/api/v1")
app.include_router(pricing.router, prefix="/api/v1")
app.include_router(stripe_router.router, prefix="/api/v1")
app.include_router(reports.router, prefix="/api/v1")
app.include_router(payouts.router, prefix="/api/v1")
app.include_router(media.router, prefix="/api/v1")
app.include_router(feed.router, prefix="/api/v1")
app.include_router(reviews.router, prefix="/api/v1")
app.include_router(ads.router, prefix="/api/v1")
app.include_router(travel.router, prefix="/api/v1")
app.include_router(messaging.router, prefix="/api/v1")
app.include_router(notifications.router, prefix="/api/v1")
app.include_router(profiles.router, prefix="/api/v1")
app.include_router(comments.router,    prefix="/api/v1")
app.include_router(push.router,        prefix="/api/v1")
app.include_router(highlights.router,  prefix="/api/v1")
app.include_router(events.router,      prefix="/api/v1")
app.include_router(discovery.router,   prefix="/api/v1")
app.include_router(two_factor.router,      prefix="/api/v1")
app.include_router(sessions_router.router, prefix="/api/v1")
app.include_router(follows.router,         prefix="/api/v1")
app.include_router(groups.router,          prefix="/api/v1")
app.include_router(albums.router,          prefix="/api/v1")
app.include_router(couples.router,         prefix="/api/v1")
app.include_router(search_router.router,   prefix="/api/v1")
app.include_router(analytics_router.router, prefix="/api/v1")
app.include_router(hashtags_router.router,    prefix="/api/v1")
app.include_router(moderation_router.router, prefix="/api/v1")
app.include_router(badges_router.router,       prefix="/api/v1")
app.include_router(collections_router.router,  prefix="/api/v1")


@app.get("/health")
async def health():
    return {"status": "ok", "app": APP_NAME, "version": APP_VERSION}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host=settings.APP_HOST, port=settings.APP_PORT, reload=settings.is_dev)
