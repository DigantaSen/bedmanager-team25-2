"""
Utility functions for ML Service
"""

from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
import logging

logger = logging.getLogger(__name__)

def to_utc(dt: Optional[datetime]) -> datetime:
    """
    Normalize a datetime to timezone-aware UTC

    Args:
        dt: datetime (naive values are treated as UTC); None means now

    Returns:
        Timezone-aware UTC datetime
    """
    if dt is None:
        return datetime.now(timezone.utc)
    if dt.tzinfo is None:
        return dt.replace(tzinfo=timezone.utc)
    return dt.astimezone(timezone.utc)

def extract_time_features(dt: datetime) -> Dict[str, Any]:
    """
    Extract time-based features from datetime object
    
    Args:
        dt: datetime object
        
    Returns:
        Dictionary with time features
    """
    return {
        "hour": dt.hour,
        "day_of_week": dt.weekday(),
        "day_of_month": dt.day,
        "month": dt.month,
        "is_weekend": int(dt.weekday() >= 5),
        "is_business_hours": int(8 <= dt.hour <= 17),
        "time_of_day": get_time_of_day(dt.hour)
    }

def get_time_of_day(hour: int) -> int:
    """
    Categorize hour into time of day (numeric)
    
    Args:
        hour: Hour of day (0-23)
        
    Returns:
        Time of day category (0=morning, 1=afternoon, 2=evening, 3=night)
    """
    if 6 <= hour < 12:
        return 0  # morning
    elif 12 <= hour < 18:
        return 1  # afternoon
    elif 18 <= hour < 22:
        return 2  # evening
    else:
        return 3  # night

def calculate_duration_minutes(start_time: datetime, end_time: datetime) -> float:
    """
    Calculate duration between two timestamps in minutes
    
    Args:
        start_time: Start datetime
        end_time: End datetime
        
    Returns:
        Duration in minutes
    """
    duration = end_time - start_time
    return duration.total_seconds() / 60.0

def ward_to_numeric(ward: str) -> int:
    """
    Convert ward name to the numeric encoding the models were trained with

    Must match ward_mapping in train/train_discharge.py, train_cleaning_duration.py
    and train_bed_availability.py.

    Args:
        ward: Ward name (e.g., 'ICU', 'General', 'Emergency')

    Returns:
        Numeric encoding
    """
    ward_mapping = {
        "ICU": 0,
        "General": 1,
        "Emergency": 2
    }
    return ward_mapping.get(ward, 1)  # Unknown wards default to General, as in training

def priority_to_numeric(priority: str) -> int:
    """
    Convert priority level to numeric value
    
    Args:
        priority: Priority level (low, medium, high, critical)
        
    Returns:
        Numeric priority (0-3)
    """
    priority_mapping = {
        "low": 0,
        "medium": 1,
        "high": 2,
        "critical": 3
    }
    return priority_mapping.get(priority.lower(), 1)

def validate_prediction_input(data: Dict[str, Any], required_fields: list) -> tuple[bool, Optional[str]]:
    """
    Validate prediction input data
    
    Args:
        data: Input data dictionary
        required_fields: List of required field names
        
    Returns:
        Tuple of (is_valid, error_message)
    """
    missing_fields = [field for field in required_fields if field not in data]
    
    if missing_fields:
        return False, f"Missing required fields: {', '.join(missing_fields)}"
    
    return True, None

def format_prediction_response(
    prediction: Any,
    confidence: Optional[float] = None,
    metadata: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Format prediction response in consistent structure
    
    Args:
        prediction: The prediction value
        confidence: Optional confidence score
        metadata: Optional metadata dictionary
        
    Returns:
        Formatted response dictionary
    """
    response = {
        "success": True,
        "prediction": prediction,
        "timestamp": datetime.now(timezone.utc).isoformat()
    }
    
    if confidence is not None:
        response["confidence"] = confidence
    
    if metadata:
        response["metadata"] = metadata
    
    return response
