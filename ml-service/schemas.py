"""
Pydantic schemas for ML prediction requests and responses
"""

from pydantic import BaseModel, Field
from typing import Optional, Dict, Any, Literal
from datetime import datetime


class DischargeRequest(BaseModel):
    """Request schema for discharge prediction"""
    ward: str = Field(..., description="Ward name (ICU, Emergency, General, etc.)")
    admission_time: Optional[datetime] = Field(None, description="Patient admission time (defaults to now)")

    class Config:
        json_schema_extra = {
            "example": {
                "ward": "ICU",
                "admission_time": "2025-12-01T10:00:00Z"
            }
        }


class BedAvailabilityRequest(BaseModel):
    """Request schema for bed availability prediction (6-hour horizon)"""
    ward: str = Field(..., description="Ward name")
    bed_status: Literal['available', 'cleaning', 'occupied'] = Field(..., description="Current status of the bed")
    current_time: Optional[datetime] = Field(None, description="Current time (defaults to now)")

    class Config:
        json_schema_extra = {
            "example": {
                "ward": "General",
                "bed_status": "occupied",
                "current_time": "2025-12-01T14:00:00Z"
            }
        }


class CleaningDurationRequest(BaseModel):
    """Request schema for cleaning duration prediction"""
    ward: str = Field(..., description="Ward name")
    start_time: Optional[datetime] = Field(None, description="Cleaning start time (defaults to now)")
    estimated_duration: float = Field(..., gt=0, description="Staff estimate of the cleaning duration in minutes")

    class Config:
        json_schema_extra = {
            "example": {
                "ward": "ICU",
                "start_time": "2025-12-01T15:00:00Z",
                "estimated_duration": 30
            }
        }


class PredictionResponse(BaseModel):
    """Standard response schema for predictions"""
    success: bool
    prediction: Any
    confidence: Optional[float] = None
    metadata: Optional[Dict[str, Any]] = None
    timestamp: datetime

    class Config:
        json_schema_extra = {
            "example": {
                "success": True,
                "prediction": 48.5,
                "confidence": 0.85,
                "metadata": {
                    "model_version": "1.0.0",
                    "ward": "ICU"
                },
                "timestamp": "2025-12-01T16:00:00Z"
            }
        }


class ErrorResponse(BaseModel):
    """Error response schema"""
    success: bool = False
    error: str
    message: str
    timestamp: datetime
