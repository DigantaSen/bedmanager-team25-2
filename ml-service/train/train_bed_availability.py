"""
Training script for Bed Availability Prediction Model

This script:
1. Connects to MongoDB and extracts Bed and CleaningLog data
2. Builds features from current bed states and cleaning patterns
3. Trains a Random Forest Classifier to predict bed availability
4. Evaluates model performance
5. Saves the trained model to models/bed_availability_model.pkl
"""

import sys
import os
from datetime import datetime, timedelta
import pandas as pd
import numpy as np
from pymongo import MongoClient
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, classification_report
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


def extract_bed_availability_data(db):
    """
    Extract bed and cleaning log data to predict future availability
    
    We'll create training samples by:
    - Taking snapshots of bed states at different times
    - Looking ahead to see if bed became available within prediction horizon
    """
    logger.info("Extracting bed availability data from MongoDB...")
    
    beds_collection = db['beds']
    cleaning_logs = db['cleaninglogs']
    occupancy_logs = db['occupancylogs']
    
    # Get all occupancy logs to build timeline
    occupancy_data = list(occupancy_logs.find().sort('timestamp', 1))
    logger.info(f"Found {len(occupancy_data)} occupancy log entries")
    
    if len(occupancy_data) < 50:
        logger.warning("Insufficient occupancy data for training")
        return pd.DataFrame()
    
    # Get bed information
    beds_data = list(beds_collection.find())
    beds_df = pd.DataFrame(beds_data)
    
    if len(beds_df) == 0:
        logger.error("No beds found in database")
        return pd.DataFrame()
    
    # Create bed lookup
    bed_lookup = {str(bed['_id']): bed for bed in beds_data}
    
    # Get cleaning logs
    cleaning_data = list(cleaning_logs.find().sort('startTime', 1))
    logger.info(f"Found {len(cleaning_data)} cleaning log entries")
    
    # Build training samples
    samples = []
    
    # Group occupancy logs by bed
    bed_timelines = {}
    for log in occupancy_data:
        bed_id = str(log['bedId'])
        if bed_id not in bed_timelines:
            bed_timelines[bed_id] = []
        bed_timelines[bed_id].append(log)
    
    # For each bed, create samples at various points in time
    for bed_id, timeline in bed_timelines.items():
        if bed_id not in bed_lookup:
            continue
        
        bed_info = bed_lookup[bed_id]
        ward = bed_info.get('ward', 'General')
        
        # Sample at various points in the timeline
        for i in range(0, len(timeline) - 1, max(1, len(timeline) // 20)):
            log = timeline[i]
            current_time = log['timestamp']
            status_change = log['statusChange']
            
            # Look ahead to see when bed becomes available
            future_time = current_time + timedelta(hours=6)
            
            # Check if bed became available within next 6 hours
            became_available = False
            for future_log in timeline[i+1:]:
                if future_log['timestamp'] > future_time:
                    break
                if future_log['statusChange'] == 'released':
                    became_available = True
                    break
            
            # Extract features
            hour = current_time.hour
            day_of_week = current_time.weekday()
            is_weekend = day_of_week >= 5
            is_business_hours = 8 <= hour <= 17
            
            # Current status
            is_occupied = status_change in ['assigned', 'reserved']
            is_cleaning = status_change in ['maintenance_start']
            
            samples.append({
                'bed_id': bed_id,
                'ward': ward,
                'timestamp': current_time,
                'hour': hour,
                'day_of_week': day_of_week,
                'is_weekend': int(is_weekend),
                'is_business_hours': int(is_business_hours),
                'is_occupied': int(is_occupied),
                'is_cleaning': int(is_cleaning),
                'will_be_available': int(became_available)
            })
    
    df = pd.DataFrame(samples)
    logger.info(f"Created {len(df)} training samples")
    
    if len(df) == 0:
        return df
    
    # Add ward-level features
    ward_occupancy = df.groupby('ward')['is_occupied'].transform('mean')
    df['ward_occupancy_rate'] = ward_occupancy
    
    # Time-based availability patterns
    time_availability = df.groupby('hour')['will_be_available'].transform('mean')
    df['hour_availability_rate'] = time_availability
    
    logger.info(f"Final dataset shape: {df.shape}")
    logger.info(f"Positive samples (will be available): {df['will_be_available'].sum()}")
    logger.info(f"Negative samples: {len(df) - df['will_be_available'].sum()}")
    
    return df


def engineer_features(df):
    """Create additional features for bed availability prediction"""
    logger.info("Engineering features...")
    
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
    
    # Month encoding
    df['month'] = df['timestamp'].dt.month
    
    logger.info(f"Features engineered. Dataset shape: {df.shape}")
    
    return df


def train_model(df):
    """Train Random Forest Classifier for bed availability prediction"""
    logger.info("Training bed availability prediction model...")
    
    # Define features
    feature_columns = [
        'hour', 'day_of_week', 'month', 'is_weekend', 'is_business_hours',
        'time_of_day', 'ward_encoded', 'is_occupied', 'is_cleaning',
        'ward_occupancy_rate', 'hour_availability_rate'
    ]
    
    # Prepare data
    X = df[feature_columns]
    y = df['will_be_available']
    
    logger.info(f"Training set size: {len(X)} samples")
    logger.info(f"Features: {feature_columns}")
    logger.info(f"Class distribution: {y.value_counts().to_dict()}")
    
    # Split data
    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=settings.TEST_SIZE,
        random_state=settings.RANDOM_STATE,
        stratify=y
    )
    
    logger.info(f"Train set: {len(X_train)}, Test set: {len(X_test)}")
    
    # Train Random Forest Classifier with STRONG EMPHASIS ON WARD-BASED FEATURES
    # Bed availability patterns differ significantly by ward (ICU vs General vs Emergency)
    model = RandomForestClassifier(
        n_estimators=200,        # More trees to capture ward-specific availability patterns
        max_depth=12,            # Deeper to learn ward turnover differences
        min_samples_split=6,     # Balanced to preserve ward groupings
        min_samples_leaf=2,      # Small leaf for ward-specific patterns
        max_features='sqrt',     # Emphasize ward as primary feature
        random_state=settings.RANDOM_STATE,
        n_jobs=-1,
        class_weight='balanced'
    )
    
    logger.info("Training Random Forest Classifier with WARD-FOCUSED hyperparameters...")
    logger.info("  - Ward type is PRIMARY predictor for bed availability")
    logger.info("  - ICU has longer stays → lower turnover than Emergency")
    model.fit(X_train, y_train)
    
    # Evaluate
    train_pred = model.predict(X_train)
    test_pred = model.predict(X_test)
    
    train_acc = accuracy_score(y_train, train_pred)
    test_acc = accuracy_score(y_test, test_pred)
    train_precision = precision_score(y_train, train_pred)
    test_precision = precision_score(y_test, test_pred)
    train_recall = recall_score(y_train, train_pred)
    test_recall = recall_score(y_test, test_pred)
    train_f1 = f1_score(y_train, train_pred)
    test_f1 = f1_score(y_test, test_pred)
    
    logger.info("\n" + "="*60)
    logger.info("MODEL EVALUATION - BED AVAILABILITY PREDICTION")
    logger.info("="*60)
    logger.info(f"Train Accuracy:  {train_acc:.4f}")
    logger.info(f"Test Accuracy:   {test_acc:.4f}")
    logger.info(f"Train Precision: {train_precision:.4f}")
    logger.info(f"Test Precision:  {test_precision:.4f}")
    logger.info(f"Train Recall:    {train_recall:.4f}")
    logger.info(f"Test Recall:     {test_recall:.4f}")
    logger.info(f"Train F1:        {train_f1:.4f}")
    logger.info(f"Test F1:         {test_f1:.4f}")
    logger.info("="*60)
    
    # Classification report
    logger.info("\nClassification Report (Test Set):")
    logger.info("\n" + classification_report(y_test, test_pred))
    
    # Feature importance
    feature_importance = pd.DataFrame({
        'feature': feature_columns,
        'importance': model.feature_importances_
    }).sort_values('importance', ascending=False)
    
    logger.info("Top 5 Feature Importances:")
    for idx, row in feature_importance.head().iterrows():
        logger.info(f"  {row['feature']}: {row['importance']:.4f}")
    
    return model, feature_columns, {
        'train_accuracy': train_acc,
        'test_accuracy': test_acc,
        'train_precision': train_precision,
        'test_precision': test_precision,
        'train_recall': train_recall,
        'test_recall': test_recall,
        'train_f1': train_f1,
        'test_f1': test_f1,
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
        'model_type': 'bed_availability_classifier'
    }
    
    model_path = settings.BED_AVAILABILITY_MODEL_PATH
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
        logger.info("BED AVAILABILITY PREDICTION MODEL TRAINING")
        logger.info("="*60)
        
        db, client = connect_to_mongodb()
        
        df = extract_bed_availability_data(db)
        
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
        logger.info(f"Test Accuracy: {metrics['test_accuracy']:.4f}")
        logger.info(f"Test F1 Score: {metrics['test_f1']:.4f}")
        logger.info("="*60)
        
    except Exception as e:
        logger.error(f"Training failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
