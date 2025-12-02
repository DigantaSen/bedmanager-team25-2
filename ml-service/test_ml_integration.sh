#!/bin/bash
# Test ML Service Integration

echo "============================================"
echo "ML SERVICE INTEGRATION TEST"
echo "============================================"
echo ""

echo "1. Testing ML Service Health..."
curl -s http://localhost:8000/health | python3 -m json.tool | head -15
echo ""

echo "2. Testing Discharge Prediction (ICU)..."
curl -s -X POST http://localhost:8000/api/ml/predict/discharge \
  -H "Content-Type: application/json" \
  -d '{"ward": "ICU"}' | python3 -m json.tool
echo ""

echo "3. Testing Discharge Prediction (General)..."
curl -s -X POST http://localhost:8000/api/ml/predict/discharge \
  -H "Content-Type: application/json" \
  -d '{"ward": "General"}' | python3 -m json.tool
echo ""

echo "4. Testing Cleaning Duration Prediction..."
curl -s -X POST http://localhost:8000/api/ml/predict/cleaning-duration \
  -H "Content-Type: application/json" \
  -d '{"ward": "ICU", "estimated_duration": 35}' | python3 -m json.tool
echo ""

echo "5. Testing Bed Availability Prediction..."
curl -s -X POST http://localhost:8000/api/ml/predict/bed-availability \
  -H "Content-Type: application/json" \
  -d '{"ward": "Emergency", "prediction_horizon_hours": 6}' | python3 -m json.tool
echo ""

echo "6. Testing Models Status..."
curl -s http://localhost:8000/models/status | python3 -m json.tool
echo ""

echo "============================================"
echo "ML SERVICE INTEGRATION TEST COMPLETE"
echo "============================================"
