"""
Training script for Ward-Focused Discharge Time Prediction Model

This uses a simpler approach that gives primary weight to ward-based averages
rather than letting the model overfit to random temporal patterns.
"""

import sys
import os
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from pymongo import MongoClient
from sklearn.ensemble import RandomForestRegressor, GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
import joblib
import logging

# Add parent directory to path to import config
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from config import settings

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def connect_to_mongodb():
    """Connect to MongoDB and return database instance"""
    try:
        client = MongoClient(settings.MONGO_URI)
        db_name = settings.MONGO_URI.split('/')[-1].split('?')[0]
        if not db_name or db_name == '':
            db_name = 'bedmanager'
        db = client[db_name]
        db.command('ping')
        logger.info(f"Successfully connected to MongoDB: {db_name}")
        return db, client
    except Exception as e:
        logger.error(f"Failed to connect to MongoDB: {e}")
        raise


def extract_occupancy_data(db):
    """Extract occupancy log data and create discharge duration dataset"""
    logger.info("Extracting occupancy data from MongoDB...")
    
    occupancy_logs = db['occupancylogs']
    beds = db['beds']
    
    logs = list(occupancy_logs.find().sort('timestamp', 1))
    logger.info(f"Found {len(logs)} occupancy log entries")
    
    if len(logs) == 0:
        logger.warning("No occupancy logs found in database")
        return pd.DataFrame()
    
    # Build bed occupancy sessions
    bed_sessions = {}
    
    for log in logs:
        bed_id = str(log['bedId'])
        status_change = log['statusChange']
        timestamp = log['timestamp']
        
        if status_change == 'assigned':
            if bed_id not in bed_sessions:
                bed_sessions[bed_id] = []
            
            bed_sessions[bed_id].append({
                'bed_id': bed_id,
                'assigned_time': timestamp,
                'released_time': None,
                'user_id': str(log.get('userId', ''))
            })
        
        elif status_change == 'released' and bed_id in bed_sessions:
            for session in reversed(bed_sessions[bed_id]):
                if session['released_time'] is None:
                    session['released_time'] = timestamp
                    break
    
    # Get bed ward information
    bed_ward_map = {}
    for bed in beds.find():
        bed_ward_map[str(bed['_id'])] = bed['ward']
    
    # Convert to pandas DataFrame
    data = []
    for bed_id, sessions in bed_sessions.items():
        ward = bed_ward_map.get(bed_id, 'General')
        
        for session in sessions:
            if session['released_time'] is not None:
                duration_hours = (session['released_time'] - session['assigned_time']).total_seconds() / 3600
                
                # Only keep valid durations
                if 0 < duration_hours < 8760:  # Between 0 and 1 year
                    data.append({
                        'bed_id': bed_id,
                        'ward': ward,
                        'assigned_time': session['assigned_time'],
                        'released_time': session['released_time'],
                        'duration_hours': duration_hours
                    })
    
    df = pd.DataFrame(data)
    logger.info(f"Found {len(df)} complete occupancy sessions")
    logger.info(f"Valid sessions after filtering: {len(df)}")
    
    return df


def engineer_features(df):
    """Engineer features with PRIMARY FOCUS on ward-based patterns"""
    logger.info("Engineering features with ward-focused approach...")
    
    # Time features (less important)
    df['hour'] = df['assigned_time'].dt.hour
    df['day_of_week'] = df['assigned_time'].dt.dayofweek
    df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
    
    # Ward encoding (MOST IMPORTANT)
    ward_mapping = {
        'ICU': 0, 'Emergency': 1, 'General': 2,
        'Pediatric': 3, 'Surgery': 4, 'Cardiology': 5
    }
    df['ward_encoded'] = df['ward'].map(ward_mapping).fillna(2)
    
    # Ward average duration (VERY IMPORTANT)
    ward_avg = df.groupby('ward')['duration_hours'].transform('mean')
    df['ward_avg_duration'] = ward_avg
    
    # Ward + weekend interaction
    df['ward_weekend_interaction'] = df['ward_encoded'] * df['is_weekend']
    
    # Ward + hour interaction (limited to reduce noise)
    df['ward_hour_interaction'] = df['ward_encoded'] * (df['hour'] / 24.0)
    
    logger.info(f"Features engineered. Dataset shape: {df.shape}")
    logger.info(f"Ward averages:\n{df.groupby('ward')['ward_avg_duration'].first()}")
    
    return df


def train_model(df):
    """Train Ward-Focused Random Forest Regressor"""
    logger.info("Training ward-focused discharge prediction model...")
    
    # Define features - WARD FEATURES FIRST
    feature_columns = [
        'ward_encoded',              # Most important
        'ward_avg_duration',         # Most important
        'ward_weekend_interaction',  # Interaction
        'ward_hour_interaction',     # Limited interaction
        'is_weekend',                # Minor adjustment
        'hour',                      # Minor adjustment
        'day_of_week',               # Minor adjustment
    ]
    
    # Prepare data
    X = df[feature_columns]
    y = df['duration_hours']
    
    logger.info(f"Training set size: {len(X)} samples")
    logger.info(f"Features (ordered by importance): {feature_columns}")
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=settings.TEST_SIZE,
        random_state=settings.RANDOM_STATE
    )
    
    logger.info(f"Train set: {len(X_train)}, Test set: {len(X_test)}")
    
    # Train Gradient Boosting (better for feature importance)
    model = GradientBoostingRegressor(
        n_estimators=100,
        max_depth=4,              # Shallow to prevent overfitting
        min_samples_split=20,     # Require many samples
        min_samples_leaf=10,      # Large leaves for generalization
        learning_rate=0.1,
        subsample=0.8,
        random_state=settings.RANDOM_STATE
    )
    
    logger.info("Training Gradient Boosting Regressor with ward-focused hyperparameters...")
    model.fit(X_train, y_train)
    
    # Evaluate
    train_pred = model.predict(X_train)
    test_pred = model.predict(X_test)
    
    train_mae = mean_absolute_error(y_train, train_pred)
    test_mae = mean_absolute_error(y_test, test_pred)
    train_rmse = np.sqrt(mean_squared_error(y_train, train_pred))
    test_rmse = np.sqrt(mean_squared_error(y_test, test_pred))
    train_r2 = r2_score(y_train, train_pred)
    test_r2 = r2_score(y_test, test_pred)
    
    logger.info("\n" + "="*60)
    logger.info("MODEL EVALUATION - WARD-FOCUSED DISCHARGE PREDICTION")
    logger.info("="*60)
    logger.info(f"Train MAE: {train_mae:.2f} hours")
    logger.info(f"Test MAE:  {test_mae:.2f} hours")
    logger.info(f"Train RMSE: {train_rmse:.2f} hours")
    logger.info(f"Test RMSE:  {test_rmse:.2f} hours")
    logger.info(f"Train R²: {train_r2:.4f}")
    logger.info(f"Test R²:  {test_r2:.4f}")
    logger.info("="*60 + "\n")
    
    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': feature_columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    logger.info("Feature Importances (should be ward-dominated):")
    for idx, row in feature_importance.iterrows():
        logger.info(f"  {row['feature']}: {row['importance']:.4f}")
    
    return model, feature_columns, {
        'train_mae': train_mae,
        'test_mae': test_mae,
        'train_rmse': train_rmse,
        'test_rmse': test_rmse,
        'train_r2': train_r2,
        'test_r2': test_r2,
        'feature_importance': feature_importance.to_dict('records')
    }


def save_model(model, feature_columns, metrics):
    """Save trained model and metadata to disk"""
    logger.info("Saving model to disk...")
    
    os.makedirs(settings.MODELS_DIR, exist_ok=True)
    
    model_package = {
        'model': model,
        'feature_columns': feature_columns,
        'metrics': metrics,
        'model_type': 'gradient_boosting_ward_focused',
        'trained_at': datetime.utcnow().isoformat(),
        'version': '2.0.0'
    }
    
    model_path = os.path.join(settings.MODELS_DIR, 'discharge_model.pkl')
    joblib.dump(model_package, model_path)
    
    file_size = os.path.getsize(model_path) / (1024 * 1024)
    logger.info(f"Model saved successfully to: {model_path}")
    logger.info(f"Model file size: {file_size:.2f} MB")


def main():
    """Main training pipeline"""
    logger.info("="*60)
    logger.info("WARD-FOCUSED DISCHARGE PREDICTION MODEL TRAINING")
    logger.info("="*60)
    
    try:
        # Connect to database
        db, client = connect_to_mongodb()
        
        # Extract data
        df = extract_occupancy_data(db)
        
        if df.empty:
            logger.error("No data available for training")
            return
        
        # Engineer features
        df = engineer_features(df)
        
        # Train model
        model, feature_columns, metrics = train_model(df)
        
        # Save model
        save_model(model, feature_columns, metrics)
        
        # Close connection
        client.close()
        logger.info("MongoDB connection closed")
        
        logger.info("\n" + "="*60)
        logger.info("TRAINING COMPLETE!")
        logger.info(f"Model saved to: {os.path.join(settings.MODELS_DIR, 'discharge_model.pkl')}")
        logger.info(f"Test MAE: {metrics['test_mae']:.2f} hours")
        logger.info(f"Test R²: {metrics['test_r2']:.4f}")
        logger.info("="*60)
        
    except Exception as e:
        logger.error(f"Training failed: {e}", exc_info=True)
        raise


if __name__ == "__main__":
    main()
