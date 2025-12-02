# Data Generation Workflow

## Overview
This document explains the updated data generation workflow that ensures consistency between bed seeding and synthetic data generation.

## Problem Fixed
Previously, `seedBeds.js` and `generateSyntheticData.js` were creating incompatible bed structures:
- `seedBeds.js` created 192 beds following a specific layout (ICU, General, Emergency)
- `generateSyntheticData.js` was creating its own beds with different IDs and ward names

This caused conflicts and inconsistent data in the database.

## Solution
Modified `generateSyntheticData.js` to:
1. **NOT create beds** - only fetch existing beds from the database
2. **Use seedBeds.js structure** - work with the 192 beds created by seedBeds.js
3. **Only generate logs/users/requests/alerts** - populate historical data for existing beds

## Bed Structure (from seedBeds.js)

### Total: 192 Beds

#### ICU Ward (24 beds)
- `iA1` to `iA12` (12 beds)
- `iB1` to `iB12` (12 beds)

#### General Ward - Floor 1 (84 beds)
- `A1` to `A21` (21 beds)
- `B1` to `B21` (21 beds)
- `C1` to `C21` (21 beds)
- `D1` to `D21` (21 beds)

#### Emergency Ward - Floor 2 (84 beds)
- `E1` to `E21` (21 beds)
- `F1` to `F21` (21 beds)
- `G1` to `G21` (21 beds)
- `H1` to `H21` (21 beds)

## Correct Execution Order

### Step 1: Run seedBeds.js
```bash
node seedBeds.js
```

**What it does:**
- Clears existing beds from database
- Creates 192 beds with specific IDs and ward assignments
- Sets all beds to "available" status initially

### Step 2: Run generateSyntheticData.js
```bash
node generateSyntheticData.js
```

**What it does:**
- Clears logs, users, requests, alerts (preserves beds)
- Fetches existing 192 beds from database
- Updates bed statuses (70% occupied, 20% available, 10% cleaning)
- Creates 17 users (admins, managers, ward staff, ER staff)
- Generates ~2,000 occupancy logs (historical patient stays)
- Generates ~2,800 cleaning logs (historical cleaning records)
- Generates ~35 emergency requests
- Generates ~25 alerts

## Quick Test Script

Use the provided test script to run both steps automatically:

```bash
chmod +x test_data_workflow.sh
./test_data_workflow.sh
```

This script will:
1. Run seedBeds.js
2. Wait 2 seconds
3. Run generateSyntheticData.js
4. Display success summary

## Verification

After running the workflow, verify the data:

```bash
node verifyBeds.js
```

**Expected output:**
- Total: 192 beds
- ICU: 24 beds (iA1-iA12, iB1-iB12)
- General: 84 beds (A1-A21, B1-B21, C1-C21, D1-D21)
- Emergency: 84 beds (E1-E21, F1-F21, G1-G21, H1-H21)
- Status distribution: ~70% occupied, ~20% available, ~10% cleaning

## Key Changes Made

### 1. generateSyntheticData.js Configuration
```javascript
const CONFIG = {
  wards: ["ICU", "General", "Emergency"], // Only 3 wards
  // Removed: bedsPerWard (no longer creating beds)
  bedPatterns: {
    ICU: ["iA1-iA12", "iB1-iB12"],
    General: ["A1-A21", "B1-B21", "C1-C21", "D1-D21"],
    Emergency: ["E1-E21", "F1-F21", "G1-G21", "H1-H21"]
  }
};
```

### 2. Realistic Stay Durations
```javascript
const LOS = {
  ICU: [72, 168],      // 3-7 days (critical care)
  General: [48, 120],  // 2-5 days (standard care)
  Emergency: [24, 72]  // 1-3 days (stabilization)
};
```

### 3. Database Clearing
```javascript
async function clearDatabase() {
  // Clears everything EXCEPT beds
  await Promise.all([
    // Bed.deleteMany({}), // ← REMOVED
    User.deleteMany({}),
    OccupancyLog.deleteMany({}),
    CleaningLog.deleteMany({}),
    EmergencyRequest.deleteMany({}),
    Alert.deleteMany({})
  ]);
}
```

### 4. Bed Fetching Instead of Creation
```javascript
async function fetchAndUpdateBeds() {
  // Fetch existing beds from database
  const beds = await Bed.find({}).lean();
  
  if (beds.length === 0) {
    throw new Error("No beds found! Run seedBeds.js first.");
  }
  
  // Update bed statuses without recreating them
  // ...
}
```

## Important Notes

⚠️ **Always run seedBeds.js before generateSyntheticData.js**

✅ **Benefits of this approach:**
- Consistent bed IDs across the system
- No duplicate or conflicting bed records
- Clear separation of concerns (beds vs. logs)
- Easier to maintain and debug

🔧 **For ML Model Training:**
The synthetic data provides realistic patterns for:
- Patient discharge prediction (based on ward and stay duration)
- Cleaning duration prediction (20-40 min per cleaning)
- Bed availability forecasting (24h/48h predictions)

## Files Modified

1. `backend/generateSyntheticData.js` - Updated to fetch beds instead of creating them
2. `backend/test_data_workflow.sh` - New test script for complete workflow
3. `backend/verifyBeds.js` - New verification script
4. `backend/DATA_GENERATION_WORKFLOW.md` - This documentation

## ML Service Integration

The synthetic data is designed to work with the ML service prediction models:

- **Discharge Prediction**: Uses occupancy logs with realistic stay durations
- **Cleaning Prediction**: Uses cleaning logs with 20-40 min durations
- **Availability Forecast**: Uses historical occupancy patterns

After running this workflow, the ML models can be trained with:
```bash
cd ml-service
python train/train_discharge_model.py
python train/train_cleaning_model.py
python train/train_availability_model.py
```
