# Hospital Bed Manager - ML Service

Machine Learning microservice for predictive analytics in hospital bed management.

## 📋 Overview

This FastAPI-based microservice provides ML predictions for:
- **Discharge Time Prediction**: Estimate when patients will be discharged
- **Bed Availability Prediction**: Forecast bed availability in the next N hours
- **Cleaning Duration Prediction**: Estimate time required for bed cleaning
- **Ward Occupancy Forecasting**: Predict ward occupancy patterns (future)
- **Emergency Demand Prediction**: Forecast emergency admission demand (future)

## 🏗️ Architecture

```
ml-service/
├── main.py                 # FastAPI application
├── config.py              # Configuration and settings
├── requirements.txt       # Python dependencies
├── models/               # Trained ML models (.pkl files)
├── routes/               # API route definitions
├── utils/                # Helper functions
└── train/                # Training scripts
    ├── train_discharge.py
    ├── train_bed_availability.py
    └── train_cleaning_duration.py
```

## 🚀 Setup

### 1. Create Virtual Environment

```bash
cd ml-service
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate
```

### 2. Install Dependencies

```bash
pip install -r requirements.txt
```

### 3. Configure Environment

```bash
cp .env.example .env
# Edit .env with your settings
```

### 4. Train Models (First Time)

```bash
# Train discharge prediction model
python train/train_discharge.py

# Train bed availability model
python train/train_bed_availability.py

# Train cleaning duration model
python train/train_cleaning_duration.py
```

### 5. Start the Service

```bash
# Development mode (auto-reload)
python main.py

# Production mode
uvicorn main:app --host 0.0.0.0 --port 8000
```

## 📡 API Endpoints

### Health & Status

- `GET /` - Service information
- `GET /health` - Health check
- `GET /models/status` - Check which models are loaded

### Predictions (Coming in Phase 5)

- `POST /api/ml/predict/discharge` - Predict discharge time
- `POST /api/ml/predict/bed-availability` - Predict bed availability
- `POST /api/ml/predict/cleaning-duration` - Predict cleaning duration

## 📚 Documentation

Once the service is running, visit:
- Interactive API docs: http://localhost:8000/docs
- ReDoc documentation: http://localhost:8000/redoc

## 🔧 Integration with Node.js Backend

The Node.js backend calls this service via HTTP using axios:

```javascript
// backend/services/mlService.js (to be created)
const axios = require('axios');

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

async function predictDischarge(bedData) {
  const response = await axios.post(`${ML_SERVICE_URL}/api/ml/predict/discharge`, bedData);
  return response.data;
}
```

## 🧪 Testing

```bash
# Test health endpoint
curl http://localhost:8000/health

# Test models status
curl http://localhost:8000/models/status
```

## 📝 Notes

- **MongoDB is only used during training**, not during inference
- Models are loaded once at startup for fast predictions
- The service is stateless and can be horizontally scaled
- Models should be retrained periodically with new data

## 🔄 Model Retraining

To retrain models with new data:

```bash
# Activate virtual environment
source venv/bin/activate

# Run training scripts
python train/train_discharge.py
python train/train_bed_availability.py
python train/train_cleaning_duration.py

# Restart the service to load new models
```

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Change port in .env or use different port
ML_SERVICE_PORT=8001 python main.py
```

### Models Not Found
```bash
# Check models directory
ls -la models/

# Retrain models
python train/train_discharge.py
```

### MongoDB Connection Error (During Training)
- Ensure MongoDB is running
- Check MONGO_URI in .env
- Verify database name matches backend

## 📊 Current Status

✅ **Phase 1 Complete**: Core structure and FastAPI setup  
⏳ **Phase 2-7**: Training scripts and prediction endpoints (coming next)

---

**Version**: 1.0.0  
**Last Updated**: December 1, 2025
