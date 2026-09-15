"""
Prediction routes for ML models
"""

from collections import defaultdict
from datetime import timedelta
import logging
import statistics
import threading
import time

import pandas as pd
from fastapi import APIRouter, HTTPException
from pymongo import MongoClient

from config import settings
from schemas import (
    DischargeRequest,
    BedAvailabilityRequest,
    CleaningDurationRequest,
    PredictionResponse
)
from utils import (
    extract_time_features,
    get_time_of_day,
    ward_to_numeric,
    to_utc,
    format_prediction_response
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/predict", tags=["predictions"])

# Global model storage (will be loaded from main.py)
models = {
    'discharge': None,
    'bed_availability': None,
    'cleaning_duration': None
}

# Fallback averages used until historical data has been loaded from MongoDB
DEFAULT_STAY_HOURS = {
    'ICU': 48.0,
    'Emergency': 24.0,
    'General': 36.0
}
DEFAULT_CLEANING_MINUTES = {
    'ICU': 35.0,
    'Emergency': 28.0,
    'General': 30.0
}
DEFAULT_CLEANING_STD_MINUTES = 10.0

# Historical averages are cached in memory and refreshed in a background thread,
# so prediction requests never wait on MongoDB
_history = {
    'stats': None,
    'next_refresh_at': 0.0,
    'refreshing': False
}
_history_lock = threading.Lock()
_mongo_client = None


def set_models(discharge_model, bed_availability_model, cleaning_duration_model):
    """Set loaded models (called from main.py)"""
    models['discharge'] = discharge_model
    models['bed_availability'] = bed_availability_model
    models['cleaning_duration'] = cleaning_duration_model


def _get_database():
    """Return the database named in MONGO_URI (bedmanager if none is given)"""
    global _mongo_client
    if _mongo_client is None:
        _mongo_client = MongoClient(
            settings.MONGO_URI,
            serverSelectionTimeoutMS=settings.MONGO_TIMEOUT_MS,
            connectTimeoutMS=settings.MONGO_TIMEOUT_MS
        )
    return _mongo_client.get_default_database(default='bedmanager')


def _mean(values):
    return sum(values) / len(values) if values else None


def _compute_stay_stats(db):
    """
    Length of stay (hours) grouped by ward, time of day, and ward + time of day.
    Mirrors the feature definitions in train/train_discharge.py.
    """
    bed_wards = {bed['_id']: bed.get('ward', 'General') for bed in db.beds.find({}, {'ward': 1})}

    sessions = defaultdict(list)  # bedId -> [[assigned_at, released_at], ...]
    logs = db.occupancylogs.find(
        {'statusChange': {'$in': ['assigned', 'released']}},
        {'bedId': 1, 'statusChange': 1, 'timestamp': 1}
    ).sort('timestamp', 1)

    for log in logs:
        bed_sessions = sessions[log['bedId']]
        if log['statusChange'] == 'assigned':
            bed_sessions.append([log['timestamp'], None])
            continue
        # A release closes the most recent open session for that bed
        for session in reversed(bed_sessions):
            if session[1] is None:
                session[1] = log['timestamp']
                break

    by_ward, by_time, by_ward_time = defaultdict(list), defaultdict(list), defaultdict(list)
    for bed_id, bed_sessions in sessions.items():
        ward = bed_wards.get(bed_id, 'General')
        for assigned_at, released_at in bed_sessions:
            if released_at is None:
                continue
            hours = (released_at - assigned_at).total_seconds() / 3600
            if not 0 < hours < 720:  # Same filter as training (under 30 days)
                continue
            time_of_day = get_time_of_day(assigned_at.hour)
            by_ward[ward].append(hours)
            by_time[time_of_day].append(hours)
            by_ward_time[(ward, time_of_day)].append(hours)

    all_hours = [hours for values in by_ward.values() for hours in values]
    return {
        'samples': len(all_hours),
        'overall': _mean(all_hours),
        'ward': {key: _mean(values) for key, values in by_ward.items()},
        'time_of_day': {key: _mean(values) for key, values in by_time.items()},
        'ward_time_of_day': {key: _mean(values) for key, values in by_ward_time.items()}
    }


def _compute_cleaning_stats(db):
    """
    Cleaning duration (minutes) grouped by ward, time of day, and ward + time of day.
    Mirrors the feature definitions in train/train_cleaning_duration.py.
    """
    logs = db.cleaninglogs.find(
        {'actualDuration': {'$gte': 1, '$lte': 480}, 'endTime': {'$ne': None}},
        {'ward': 1, 'startTime': 1, 'actualDuration': 1}
    )

    by_ward, by_time, by_ward_time = defaultdict(list), defaultdict(list), defaultdict(list)
    for log in logs:
        if not log.get('startTime'):
            continue
        ward = log.get('ward', 'General')
        time_of_day = get_time_of_day(log['startTime'].hour)
        minutes = log['actualDuration']
        by_ward[ward].append(minutes)
        by_time[time_of_day].append(minutes)
        by_ward_time[(ward, time_of_day)].append(minutes)

    all_minutes = [minutes for values in by_ward.values() for minutes in values]
    return {
        'samples': len(all_minutes),
        'overall': _mean(all_minutes),
        'ward': {key: _mean(values) for key, values in by_ward.items()},
        'ward_std': {key: statistics.stdev(values) if len(values) > 1 else 0.0 for key, values in by_ward.items()},
        'time_of_day': {key: _mean(values) for key, values in by_time.items()},
        'ward_time_of_day': {key: _mean(values) for key, values in by_ward_time.items()}
    }


def _refresh_history():
    """Recompute historical averages from MongoDB (runs in a background thread)"""
    started = time.monotonic()
    try:
        db = _get_database()
        stats = {
            'stay': _compute_stay_stats(db),
            'cleaning': _compute_cleaning_stats(db)
        }
        with _history_lock:
            _history['stats'] = stats
            _history['next_refresh_at'] = time.monotonic() + settings.HISTORY_CACHE_TTL_SECONDS
        logger.info(
            f"Historical averages loaded in {time.monotonic() - started:.1f}s "
            f"({stats['stay']['samples']} stays, {stats['cleaning']['samples']} cleanings)"
        )
    except Exception as e:
        with _history_lock:
            _history['next_refresh_at'] = time.monotonic() + settings.HISTORY_RETRY_SECONDS
        logger.warning(f"Could not load historical averages from MongoDB, using defaults: {e}")
    finally:
        with _history_lock:
            _history['refreshing'] = False


def _get_history():
    """Return cached historical averages (None until loaded), starting a background refresh when stale"""
    with _history_lock:
        if not _history['refreshing'] and time.monotonic() >= _history['next_refresh_at']:
            _history['refreshing'] = True
            threading.Thread(target=_refresh_history, name="history-refresh", daemon=True).start()
        return _history['stats']


def warm_history_cache():
    """Start loading historical averages at startup (called from main.py)"""
    _get_history()


@router.post("/discharge", response_model=PredictionResponse)
def predict_discharge(request: DischargeRequest):
    """
    Predict patient discharge time in hours from admission

    Returns estimated hours until discharge based on:
    - Ward type
    - Admission time (hour, day of week)
    - Historical patterns
    """
    try:
        if models['discharge'] is None:
            raise HTTPException(
                status_code=503,
                detail="Discharge prediction model not loaded"
            )

        model_package = models['discharge']
        model = model_package['model']
        feature_columns = model_package['feature_columns']

        # Time features use UTC, matching the MongoDB timestamps the model was trained on
        admission_time = to_utc(request.admission_time)
        time_features = extract_time_features(admission_time)

        # Historical averages (same definitions as training), or ward defaults until loaded
        history = _get_history()
        stay = history['stay'] if history else None
        if stay and stay['overall'] is not None:
            time_of_day = time_features['time_of_day']
            ward_avg = stay['ward'].get(request.ward, stay['overall'])
            time_avg = stay['time_of_day'].get(time_of_day, ward_avg)
            ward_time_avg = stay['ward_time_of_day'].get((request.ward, time_of_day), ward_avg)
            history_source = 'database'
        else:
            ward_avg = time_avg = ward_time_avg = DEFAULT_STAY_HOURS.get(request.ward, 36.0)
            history_source = 'defaults'

        features = {
            **time_features,
            'ward_encoded': ward_to_numeric(request.ward),
            'ward_avg_duration': ward_avg,
            'time_avg_duration': time_avg,
            'ward_time_avg_duration': ward_time_avg
        }

        # Use a DataFrame so the model receives the feature names it was trained with
        X = pd.DataFrame([features], columns=feature_columns)

        # Predict
        prediction_hours = float(model.predict(X)[0])
        estimated_discharge = admission_time + timedelta(hours=prediction_hours)

        return format_prediction_response(
            prediction={
                "hours_until_discharge": round(prediction_hours, 2),
                "estimated_discharge_time": estimated_discharge.isoformat()
            },
            metadata={
                "ward": request.ward,
                "admission_time": admission_time.isoformat(),
                "history_source": history_source,
                "model_version": model_package.get('version', '1.0.0')
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Discharge prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/bed-availability", response_model=PredictionResponse)
def predict_bed_availability(request: BedAvailabilityRequest):
    """
    Predict if a bed will become available in the next N hours

    Returns probability that a bed in the specified ward will become available
    """
    try:
        if models['bed_availability'] is None:
            raise HTTPException(
                status_code=503,
                detail="Bed availability prediction model not loaded"
            )

        model_package = models['bed_availability']
        model = model_package['model']
        feature_columns = model_package['feature_columns']

        current_time = to_utc(request.current_time)
        time_features = extract_time_features(current_time)

        # Build feature vector
        features = {
            **time_features,
            'ward_encoded': ward_to_numeric(request.ward),
            'is_occupied': 1,  # Assume bed is currently occupied
            'is_cleaning': 0,
            'ward_occupancy_rate': 0.75,  # Default occupancy rate
            'hour_availability_rate': 0.15  # Default availability rate
        }

        X = pd.DataFrame([features], columns=feature_columns)

        # Predict probability
        will_be_available = int(model.predict(X)[0])
        probability = float(model.predict_proba(X)[0][1])

        return format_prediction_response(
            prediction={
                "will_be_available": bool(will_be_available),
                "probability": round(probability, 4),
                "prediction_horizon_hours": request.prediction_horizon_hours
            },
            confidence=probability,
            metadata={
                "ward": request.ward,
                "current_time": current_time.isoformat(),
                "model_version": model_package.get('version', '1.0.0')
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Bed availability prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cleaning-duration", response_model=PredictionResponse)
def predict_cleaning_duration(request: CleaningDurationRequest):
    """
    Predict actual cleaning duration for a bed

    Returns predicted cleaning time in minutes based on:
    - Ward type
    - Time of day
    - Estimated duration
    - Historical patterns
    """
    try:
        if models['cleaning_duration'] is None:
            raise HTTPException(
                status_code=503,
                detail="Cleaning duration prediction model not loaded"
            )

        model_package = models['cleaning_duration']
        model = model_package['model']
        feature_columns = model_package['feature_columns']

        start_time = to_utc(request.start_time)
        time_features = extract_time_features(start_time)
        estimated_duration = request.estimated_duration or 30

        # Historical averages (same definitions as training), or ward defaults until loaded
        history = _get_history()
        cleaning = history['cleaning'] if history else None
        if cleaning and cleaning['overall'] is not None:
            time_of_day = time_features['time_of_day']
            ward_avg = cleaning['ward'].get(request.ward, cleaning['overall'])
            time_avg = cleaning['time_of_day'].get(time_of_day, ward_avg)
            ward_time_avg = cleaning['ward_time_of_day'].get((request.ward, time_of_day), ward_avg)
            ward_std = cleaning['ward_std'].get(request.ward, DEFAULT_CLEANING_STD_MINUTES)
            history_source = 'database'
        else:
            ward_avg = time_avg = ward_time_avg = DEFAULT_CLEANING_MINUTES.get(request.ward, 30.0)
            ward_std = DEFAULT_CLEANING_STD_MINUTES
            history_source = 'defaults'

        features = {
            **time_features,
            'ward_encoded': ward_to_numeric(request.ward),
            'estimated_duration': estimated_duration,
            'ward_avg_duration': ward_avg,
            'time_avg_duration': time_avg,
            'ward_time_avg_duration': ward_time_avg,
            'ward_std_duration': ward_std
        }

        X = pd.DataFrame([features], columns=feature_columns)

        # Predict
        predicted_duration = float(model.predict(X)[0])
        estimated_end = start_time + timedelta(minutes=predicted_duration)

        return format_prediction_response(
            prediction={
                "predicted_duration_minutes": round(predicted_duration, 2),
                "estimated_end_time": estimated_end.isoformat(),
                "variance_from_estimate": round(predicted_duration - estimated_duration, 2)
            },
            metadata={
                "ward": request.ward,
                "start_time": start_time.isoformat(),
                "estimated_duration": estimated_duration,
                "history_source": history_source,
                "model_version": model_package.get('version', '1.0.0')
            }
        )

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Cleaning duration prediction error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
