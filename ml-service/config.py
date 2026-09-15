"""
Configuration file for ML Service
Handles environment variables and service settings
"""

import os
from typing import Optional

from dotenv import load_dotenv

# Load ml-service/.env if present (existing environment variables take precedence)
load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

class Settings:
    """Application settings and configuration"""
    
    # Service Configuration
    SERVICE_NAME: str = "Hospital Bed Manager ML Service"
    VERSION: str = "1.0.0"
    API_PREFIX: str = "/api/ml"
    
    # Server Configuration
    # Listens on the loopback address only: the backend calls this service from the same
    # machine, and the endpoints have no authentication of their own, so exposing them on
    # every network interface would put them within reach of anything that can route here.
    # Set ML_SERVICE_HOST explicitly when the service really does need to be reachable.
    HOST: str = os.getenv("ML_SERVICE_HOST", "127.0.0.1")
    PORT: int = int(os.getenv("ML_SERVICE_PORT", "8000"))
    
    # MongoDB Configuration (training scripts and historical averages used by predictions)
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017/bedmanager")
    MONGO_TIMEOUT_MS: int = int(os.getenv("MONGO_TIMEOUT_MS", "20000"))

    # Historical averages are recomputed in the background at most this often
    HISTORY_CACHE_TTL_SECONDS: int = int(os.getenv("HISTORY_CACHE_TTL_SECONDS", "600"))
    HISTORY_RETRY_SECONDS: int = int(os.getenv("HISTORY_RETRY_SECONDS", "60"))
    
    # Model Paths
    MODELS_DIR: str = os.path.join(os.path.dirname(__file__), "models")
    DISCHARGE_MODEL_PATH: str = os.path.join(MODELS_DIR, "discharge_model.pkl")
    BED_AVAILABILITY_MODEL_PATH: str = os.path.join(MODELS_DIR, "bed_availability_model.pkl")
    CLEANING_DURATION_MODEL_PATH: str = os.path.join(MODELS_DIR, "cleaning_duration_model.pkl")
    
    # CORS Configuration
    CORS_ORIGINS: list = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost:5174",
    ]
    
    # Logging
    LOG_LEVEL: str = os.getenv("LOG_LEVEL", "INFO")
    
    # Model Training Configuration
    RANDOM_STATE: int = 42
    TEST_SIZE: float = 0.2
    
    # Prediction Defaults
    DEFAULT_PREDICTION_HORIZON_HOURS: int = 24
    MAX_PREDICTION_HORIZON_HOURS: int = 168  # 7 days

settings = Settings()
