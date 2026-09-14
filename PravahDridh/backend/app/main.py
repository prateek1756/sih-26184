from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from fastapi.exceptions import RequestValidationError
from app.core.config import settings
from app.api.v1.api import api_router
from app.schemas.common import StandardResponse, ErrorDetail


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup actions
    print(f"[{settings.PROJECT_NAME}] Starting up in {settings.ENVIRONMENT} mode...")
    yield
    # Shutdown actions
    print(f"[{settings.PROJECT_NAME}] Shutting down...")


app = FastAPI(
    title=settings.PROJECT_NAME,
    description="PravahDridh: Predictive Analytics Framework for Cybercrime Complaints to Forecast Cash Withdrawal Locations.",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json",
    docs_url=f"{settings.API_V1_STR}/docs",
    redoc_url=f"{settings.API_V1_STR}/redoc",
    lifespan=lifespan,
)

# CORS Middleware
if settings.BACKEND_CORS_ORIGINS:
    app.add_middleware(
        CORSMiddleware,
        allow_origins=[str(origin) for origin in settings.BACKEND_CORS_ORIGINS],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )


# Exception handler for Validation Errors to maintain StandardResponse envelope
@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    return JSONResponse(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        content=StandardResponse(
            status="error",
            error=ErrorDetail(
                code="VALIDATION_ERROR",
                message="Invalid request payload or query parameters",
                details=exc.errors(),
            ),
        ).model_dump(mode="json"),
    )


from app.api.v1.endpoints import complaints

# Root and Health Check
@app.get("/health", tags=["Health"])
async def health_check():
    return {"status": "healthy", "project": settings.PROJECT_NAME, "version": "1.0.0"}


# Mount API v1 router
app.include_router(api_router, prefix=settings.API_V1_STR)

# Also mount complaints directly under /api/complaints for standard REST contracts
app.include_router(complaints.router, prefix="/api/complaints", tags=["Complaints (Direct)"])
