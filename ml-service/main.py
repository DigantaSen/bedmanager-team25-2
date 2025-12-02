"""
FastAPI Main Application for Hospital Bed Manager ML Service

This microservice provides machine learning predictions for:
- Discharge time prediction
- Bed availability forecasting
- Cleaning duration estimation
- Ward occupancy forecasting
- Emergency demand prediction
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from contextlib import asynccontextmanager
import uvicorn
from datetime import datetime
import logging
import joblib
import os

from config import settings

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Global variables for loaded models
models_loaded = {
    "discharge": False,
    "bed_availability": False,
    "cleaning_duration": False
}

# Model storage
loaded_models = {
    'discharge': None,
    'bed_availability': None,
    'cleaning_duration': None
}


def load_ml_models():
    """Load ML models from disk"""
    logger.info("Loading ML models...")
    
    # Load discharge model
    if os.path.exists(settings.DISCHARGE_MODEL_PATH):
        try:
            loaded_models['discharge'] = joblib.load(settings.DISCHARGE_MODEL_PATH)
            models_loaded['discharge'] = True
            logger.info("✓ Discharge model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load discharge model: {e}")
    else:
        logger.warning(f"Discharge model not found at {settings.DISCHARGE_MODEL_PATH}")
    
    # Load bed availability model
    if os.path.exists(settings.BED_AVAILABILITY_MODEL_PATH):
        try:
            loaded_models['bed_availability'] = joblib.load(settings.BED_AVAILABILITY_MODEL_PATH)
            models_loaded['bed_availability'] = True
            logger.info("✓ Bed availability model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load bed availability model: {e}")
    else:
        logger.warning(f"Bed availability model not found at {settings.BED_AVAILABILITY_MODEL_PATH}")
    
    # Load cleaning duration model
    if os.path.exists(settings.CLEANING_DURATION_MODEL_PATH):
        try:
            loaded_models['cleaning_duration'] = joblib.load(settings.CLEANING_DURATION_MODEL_PATH)
            models_loaded['cleaning_duration'] = True
            logger.info("✓ Cleaning duration model loaded successfully")
        except Exception as e:
            logger.error(f"Failed to load cleaning duration model: {e}")
    else:
        logger.warning(f"Cleaning duration model not found at {settings.CLEANING_DURATION_MODEL_PATH}")
    
    logger.info(f"Models loaded: {sum(models_loaded.values())}/3")


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Lifespan event handler for startup and shutdown"""
    # Startup
    logger.info(f"Starting {settings.SERVICE_NAME} v{settings.VERSION}")
    logger.info(f"Models directory: {settings.MODELS_DIR}")
    
    # Load ML models
    load_ml_models()
    
    # Set models in prediction routes
    from routes.predictions import set_models
    set_models(
        loaded_models['discharge'],
        loaded_models['bed_availability'],
        loaded_models['cleaning_duration']
    )
    
    logger.info("ML Service started successfully")
    
    yield
    
    # Shutdown
    logger.info("ML Service shutting down...")

# Initialize FastAPI app
app = FastAPI(
    title=settings.SERVICE_NAME,
    version=settings.VERSION,
    description="ML microservice for predictive analytics in hospital bed management",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
async def root():
    """Root endpoint - service information"""
    return {
        "service": settings.SERVICE_NAME,
        "version": settings.VERSION,
        "status": "running",
        "timestamp": datetime.utcnow().isoformat(),
        "endpoints": {
            "health": "/health",
            "docs": "/docs",
            "models_status": "/models/status",
            "predictions": {
                "discharge": f"{settings.API_PREFIX}/predict/discharge",
                "bed_availability": f"{settings.API_PREFIX}/predict/bed-availability",
                "cleaning_duration": f"{settings.API_PREFIX}/predict/cleaning-duration"
            }
        }
    }

@app.get("/health")
async def health_check():
    """Health check endpoint"""
    return {
        "status": "healthy",
        "service": settings.SERVICE_NAME,
        "version": settings.VERSION,
        "timestamp": datetime.utcnow().isoformat(),
        "models_loaded": models_loaded
    }

@app.get("/models/status")
async def models_status():
    """Check which models are loaded and ready"""
    import os
    
    model_files = {
        "discharge": os.path.exists(settings.DISCHARGE_MODEL_PATH),
        "bed_availability": os.path.exists(settings.BED_AVAILABILITY_MODEL_PATH),
        "cleaning_duration": os.path.exists(settings.CLEANING_DURATION_MODEL_PATH)
    }
    
    return {
        "models_directory": settings.MODELS_DIR,
        "models_exist": model_files,
        "models_loaded": models_loaded,
        "ready_for_predictions": any(models_loaded.values())
    }

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """Global exception handler"""
    logger.error(f"Unhandled exception: {str(exc)}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "error": "Internal server error",
            "message": str(exc) if settings.LOG_LEVEL == "DEBUG" else "An error occurred"
        }
    )

# Import and include prediction routes
from routes.predictions import router as predictions_router
app.include_router(predictions_router, prefix=settings.API_PREFIX)

if __name__ == "__main__":
    logger.info(f"Starting server on {settings.HOST}:{settings.PORT}")
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=True,
        log_level=settings.LOG_LEVEL.lower()
    )
