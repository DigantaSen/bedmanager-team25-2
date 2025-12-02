"""
Training script for Cleaning Duration Prediction Model

This script:
1. Connects to MongoDB and extracts CleaningLog data
2. Builds features from historical cleaning patterns
3. Trains a Random Forest Regressor to predict cleaning duration
4. Evaluates model performance
5. Saves the trained model to models/cleaning_duration_model.pkl
"""

import sys
import os
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from pymongo import MongoClient
from sklearn.ensemble import RandomForestRegressor
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


def extract_cleaning_data(db):
    """
    Extract cleaning log data to predict cleaning durations
    
    We use completed cleaning logs where we have:
    - startTime
    - endTime
    - actualDuration (calculated)
    - ward
    """
    logger.info("Extracting cleaning log data from MongoDB...")
    
    cleaning_logs = db['cleaninglogs']
    
    # Get all cleaning logs
    logs = list(cleaning_logs.find())
    logger.info(f"Found {len(logs)} cleaning log entries")
    
    if len(logs) == 0:
        logger.warning("No cleaning logs found in database")
        return pd.DataFrame()
    
    # Convert to DataFrame
    df = pd.DataFrame(logs)
    
    # Filter for logs with valid actualDuration (regardless of status)
    df = df[df['actualDuration'].notna()]
    df = df[df['actualDuration'] > 0]
    df = df[df['endTime'].notna()]  # Must have endTime
    
    logger.info(f"Found {len(df)} cleaning sessions with actual duration")
    
    if len(df) == 0:
        logger.warning("No completed cleaning sessions found")
        return pd.DataFrame()
    
    # Filter out unreasonable durations (> 8 hours or < 1 minute)
    df = df[
        (df['actualDuration'] >= 1) & 
        (df['actualDuration'] <= 480)
    ]
    
    logger.info(f"Valid cleaning sessions after filtering: {len(df)}")
    
    # Extract time features from startTime
    df['hour'] = df['startTime'].dt.hour
    df['day_of_week'] = df['startTime'].dt.dayofweek
    df['month'] = df['startTime'].dt.month
    df['day_of_month'] = df['startTime'].dt.day
    
    return df


def engineer_features(df):
    """
    Create features for cleaning duration prediction
    
    Features:
    - Time-based: hour, day_of_week, month, is_weekend, is_business_hours
    - Ward encoding
    - Estimated duration (from the log)
    - Historical patterns: average duration by ward, time of day
    """
    logger.info("Engineering features...")
    
    # Time-based features
    df['is_weekend'] = (df['day_of_week'] >= 5).astype(int)
    df['is_business_hours'] = ((df['hour'] >= 8) & (df['hour'] <= 17)).astype(int)
    
    # Time of day categorization
    def get_time_of_day(hour):
        if 6 <= hour < 12:
            return 0  # morning
        elif 12 <= hour < 18:
            return 1  # afternoon
        elif 18 <= hour < 22:
            return 2  # evening
        else:
            return 3  # night
    
    df['time_of_day'] = df['hour'].apply(get_time_of_day)
    
    # Ward encoding - Updated to match actual database schema
    # Only ICU, General, Emergency exist in the database
    ward_mapping = {
        'ICU': 0,
        'General': 1,
        'Emergency': 2
    }
    df['ward_encoded'] = df['ward'].map(ward_mapping).fillna(1)  # Default to General
    
    # Historical averages by ward
    ward_avg_duration = df.groupby('ward')['actualDuration'].transform('mean')
    df['ward_avg_duration'] = ward_avg_duration
    
    # Historical averages by time of day
    time_avg_duration = df.groupby('time_of_day')['actualDuration'].transform('mean')
    df['time_avg_duration'] = time_avg_duration
    
    # Historical averages by ward + time_of_day
    ward_time_avg = df.groupby(['ward', 'time_of_day'])['actualDuration'].transform('mean')
    df['ward_time_avg_duration'] = ward_time_avg
    
    # Use estimated duration as a feature (it's often close to actual)
    df['estimated_duration'] = df['estimatedDuration']
    
    # Calculate variance in ward cleaning times
    ward_std_duration = df.groupby('ward')['actualDuration'].transform('std').fillna(0)
    df['ward_std_duration'] = ward_std_duration
    
    logger.info(f"Features engineered. Dataset shape: {df.shape}")
    
    # Show duration statistics
    logger.info(f"Duration statistics (minutes):")
    logger.info(f"  Mean: {df['actualDuration'].mean():.2f}")
    logger.info(f"  Median: {df['actualDuration'].median():.2f}")
    logger.info(f"  Std: {df['actualDuration'].std():.2f}")
    logger.info(f"  Min: {df['actualDuration'].min():.2f}")
    logger.info(f"  Max: {df['actualDuration'].max():.2f}")
    
    return df


def train_model(df):
    """Train Random Forest Regressor for cleaning duration prediction"""
    logger.info("Training cleaning duration prediction model...")
    
    # Define features
    feature_columns = [
        'hour', 'day_of_week', 'month', 'day_of_month',
        'is_weekend', 'is_business_hours', 'time_of_day',
        'ward_encoded', 'estimated_duration',
        'ward_avg_duration', 'time_avg_duration',
        'ward_time_avg_duration', 'ward_std_duration'
    ]
    
    # Prepare data
    X = df[feature_columns]
    y = df['actualDuration']
    
    logger.info(f"Training set size: {len(X)} samples")
    logger.info(f"Features: {feature_columns}")
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=settings.TEST_SIZE,
        random_state=settings.RANDOM_STATE
    )
    
    logger.info(f"Train set: {len(X_train)}, Test set: {len(X_test)}")
    
    # Train Random Forest model with STRONG EMPHASIS ON WARD-BASED FEATURES
    # Cleaning duration varies significantly by ward type (ICU vs General vs Emergency)
    model = RandomForestRegressor(
        n_estimators=200,        # More trees to capture ward-specific cleaning patterns
        max_depth=12,            # Deeper to learn ward-specific cleaning requirements
        min_samples_split=6,     # Moderate splitting to preserve ward groupings
        min_samples_leaf=2,      # Small leaf to capture ward nuances
        max_features='sqrt',     # Emphasize most important features (ward type)
        random_state=settings.RANDOM_STATE,
        n_jobs=-1
    )
    
    logger.info("Training Random Forest Regressor with WARD-FOCUSED hyperparameters...")
    logger.info("  - Ward type is PRIMARY predictor for cleaning duration")
    logger.info("  - ICU beds typically require longer cleaning than General/Emergency")
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
    
    # Calculate MAPE (Mean Absolute Percentage Error)
    train_mape = np.mean(np.abs((y_train - train_pred) / y_train)) * 100
    test_mape = np.mean(np.abs((y_test - test_pred) / y_test)) * 100
    
    logger.info("\n" + "="*60)
    logger.info("MODEL EVALUATION - CLEANING DURATION PREDICTION")
    logger.info("="*60)
    logger.info(f"Train MAE: {train_mae:.2f} minutes")
    logger.info(f"Test MAE:  {test_mae:.2f} minutes")
    logger.info(f"Train RMSE: {train_rmse:.2f} minutes")
    logger.info(f"Test RMSE:  {test_rmse:.2f} minutes")
    logger.info(f"Train MAPE: {train_mape:.2f}%")
    logger.info(f"Test MAPE:  {test_mape:.2f}%")
    logger.info(f"Train R²: {train_r2:.4f}")
    logger.info(f"Test R²:  {test_r2:.4f}")
    logger.info("="*60 + "\n")
    
    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': feature_columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    logger.info("Top 5 Feature Importances:")
    for idx, row in feature_importance.head().iterrows():
        logger.info(f"  {row['feature']}: {row['importance']:.4f}")
    
    return model, feature_columns, {
        'train_mae': train_mae,
        'test_mae': test_mae,
        'train_rmse': train_rmse,
        'test_rmse': test_rmse,
        'train_mape': train_mape,
        'test_mape': test_mape,
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
        'trained_at': datetime.now().isoformat(),
        'version': '1.0.0',
        'model_type': 'cleaning_duration_regressor'
    }
    
    model_path = settings.CLEANING_DURATION_MODEL_PATH
    joblib.dump(model_package, model_path)
    
    logger.info(f"Model saved successfully to: {model_path}")
    
    if os.path.exists(model_path):
        file_size = os.path.getsize(model_path) / (1024 * 1024)
        logger.info(f"Model file size: {file_size:.2f} MB")
    
    return model_path


def main():
    """Main training pipeline"""
    try:
        logger.info("="*60)
        logger.info("CLEANING DURATION PREDICTION MODEL TRAINING")
        logger.info("="*60)
        
        db, client = connect_to_mongodb()
        
        df = extract_cleaning_data(db)
        
        if len(df) == 0:
            logger.error("No data available for training")
            return
        
        if len(df) < 100:
            logger.warning(f"Only {len(df)} samples available. Model may not be accurate.")
        
        df = engineer_features(df)
        
        model, feature_columns, metrics = train_model(df)
        
        model_path = save_model(model, feature_columns, metrics)
        
        client.close()
        logger.info("MongoDB connection closed")
        
        logger.info("\n" + "="*60)
        logger.info("TRAINING COMPLETE!")
        logger.info(f"Model saved to: {model_path}")
        logger.info(f"Test MAE: {metrics['test_mae']:.2f} minutes")
        logger.info(f"Test MAPE: {metrics['test_mape']:.2f}%")
        logger.info(f"Test R²: {metrics['test_r2']:.4f}")
        logger.info("="*60)
        
    except Exception as e:
        logger.error(f"Training failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
