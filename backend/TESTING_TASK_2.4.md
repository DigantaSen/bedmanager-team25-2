# Testing Guide: Task 2.4 - Forecasting Data & Display

## Overview
Task 2.4 implements an enhanced forecasting system that calculates expected bed discharges based on historical occupancy data and displays this information in a timeline visualization.

## Backend Implementation

### Enhanced Forecasting Logic

The forecasting endpoint (`GET /api/analytics/forecasting`) now provides:

1. **Average Length of Stay Calculation**
   - Analyzes OccupancyLog entries from the last 30 days
   - Finds paired 'assigned' and 'released' events for each bed
   - Calculates actual stay duration in days
   - Provides average across all patient stays

2. **Expected Discharge Predictions**
   - Uses bed's `updatedAt` timestamp as admission time proxy
   - Calculates expected discharge time: admission time + average LOS
   - Counts discharges expected in next 24h, 48h, and 72h
   - Lists top 10 upcoming discharges with details

3. **Timeline Visualization Data**
   - Generates 6-hour interval buckets for next 72 hours
   - Groups expected discharges into each time bucket
   - Provides bed details for each discharge event

4. **Ward-Specific Forecasts**
   - Calculates forecast metrics per ward (ICU, General, Emergency)
   - Includes projected bed availability

5. **Intelligent Insights**
   - Automatic alerts for high occupancy (>90%)
   - Notifications for expected bed availability
   - Critical capacity warnings for specific wards

## API Testing

### Test Scenario 1: Get Forecasting Data

**Request:**
```bash
curl -X GET "http://localhost:5001/api/analytics/forecasting" \
  -H "Content-Type: application/json"
```

**Expected Response Structure:**
```json
{
  "success": true,
  "data": {
    "currentMetrics": {
      "totalBeds": 30,
      "occupiedBeds": 18,
      "availableBeds": 12,
      "occupancyPercentage": 60
    },
    "averageLengthOfStay": {
      "days": 3.5,
      "basedOnSamples": 25,
      "note": "Calculated from 25 patient stays in last 30 days"
    },
    "expectedDischarges": {
      "next24Hours": 5,
      "next48Hours": 9,
      "next72Hours": 12,
      "total": 18,
      "details": [
        {
          "bedId": "ICU-001",
          "ward": "ICU",
          "patientId": "P12345",
          "expectedDischargeTime": "2025-11-13T10:30:00.000Z",
          "hoursUntilDischarge": 8.5,
          "daysInBed": 2.8
        }
        // ... more discharges
      ]
    },
    "wardForecasts": [
      {
        "ward": "ICU",
        "totalBeds": 10,
        "occupiedBeds": 8,
        "availableBeds": 2,
        "occupancyPercentage": 80,
        "expectedDischarges": {
          "next24Hours": 2,
          "next48Hours": 4
        },
        "projectedAvailability": {
          "next24Hours": 4,
          "next48Hours": 6
        }
      }
      // ... more wards
    ],
    "timeline": [
      {
        "startTime": "2025-11-12T14:00:00.000Z",
        "endTime": "2025-11-12T20:00:00.000Z",
        "label": "0h - 6h",
        "expectedDischarges": 2,
        "beds": [
          { "bedId": "ICU-001", "ward": "ICU", "patientId": "P12345" },
          { "bedId": "GEN-005", "ward": "General", "patientId": "P67890" }
        ]
      }
      // ... 12 buckets for 72 hours
    ],
    "insights": [
      {
        "type": "warning",
        "message": "High occupancy alert: 90% of beds occupied",
        "priority": "high"
      },
      {
        "type": "info",
        "message": "5 beds expected to be available in next 24 hours",
        "priority": "medium"
      }
    ],
    "metadata": {
      "timestamp": "2025-11-12T14:00:00.000Z",
      "forecastHorizon": "72 hours",
      "calculationMethod": "Average length of stay based on historical occupancy logs",
      "disclaimer": "Forecasting is based on historical trends..."
    }
  }
}
```

### Test Scenario 2: Verify Average Length of Stay Calculation

**Prerequisites:**
- Need OccupancyLog entries with 'assigned' and 'released' events
- At least a few complete patient stays in the last 30 days

**Test Steps:**
1. Create test data with known stay durations:
```bash
# Example: Patient admitted for 3 days
# Day 1: Assigned to bed
# Day 4: Released from bed
```

2. Query forecasting endpoint
3. Verify `averageLengthOfStay.days` reflects the calculated average
4. Check `basedOnSamples` count matches number of complete stays

**Expected Behavior:**
- If no historical data exists, defaults to 3.5 days
- With data, calculates actual average from paired events

### Test Scenario 3: Timeline Buckets

**Verification Points:**
1. Timeline should have 12 buckets (72 hours ÷ 6-hour intervals)
2. Each bucket should show:
   - Start and end time
   - Label (e.g., "0h - 6h", "6h - 12h")
   - Count of expected discharges in that window
   - Array of bed details

**Test Query:**
```bash
curl -X GET "http://localhost:5001/api/analytics/forecasting" | jq '.data.timeline'
```

**Expected:**
- Buckets cover next 72 hours from current time
- Discharges distributed across appropriate time windows
- No overlapping or missing time periods

### Test Scenario 4: Ward-Specific Forecasting

**Test with Manager Ward Filter:**

While the endpoint returns data for all wards, managers typically see ward-filtered data in their dashboard. The frontend `ForecastingPanel` component handles this filtering.

**Expected Ward Forecast Fields:**
- `ward`: Ward name (ICU, General, Emergency)
- `totalBeds`: Total beds in ward
- `occupiedBeds`: Currently occupied
- `availableBeds`: Currently available
- `occupancyPercentage`: Current occupancy rate
- `expectedDischarges.next24Hours`: Discharges in 24h
- `expectedDischarges.next48Hours`: Discharges in 48h
- `projectedAvailability`: Available beds after discharges

### Test Scenario 5: Insights Generation

**High Occupancy Alert:**
```bash
# When total occupancy > 90%
# Should generate insight:
{
  "type": "warning",
  "message": "High occupancy alert: 92% of beds occupied",
  "priority": "high"
}
```

**Expected Availability Alert:**
```bash
# When 3+ discharges expected in 24h
# Should generate insight:
{
  "type": "info",
  "message": "5 beds expected to be available in next 24 hours",
  "priority": "medium"
}
```

**Critical Ward Alert:**
```bash
# When any ward has >90% occupancy
# Should generate insight:
{
  "type": "warning",
  "message": "Critical capacity in ICU, Emergency",
  "priority": "high"
}
```

## Frontend Testing

### Test Scenario 6: ForecastingPanel Component

**Prerequisites:**
- Backend server running on port 5001
- Frontend running on port 5173
- User logged in as Manager

**Test Steps:**

1. **Navigate to Manager Dashboard**
   ```
   http://localhost:5173/manager
   ```

2. **Verify Metrics Display**
   - Check "Expected Discharges (Next 24h)" card shows number
   - Check "Expected Discharges (Next 48h)" card shows number
   - Check "Avg. Length of Stay" shows days (e.g., "3.5 days")
   - Check "Current Occupancy" shows percentage with color coding:
     - Red (>90%): High occupancy
     - Yellow (≤90%): Normal occupancy

3. **Verify Insights Section**
   - Should display if any insights exist
   - Warning insights (yellow border) for high occupancy
   - Info insights (blue border) for availability notifications

4. **Verify Timeline Visualization**
   - Timeline shows next 72 hours in 6-hour buckets
   - Each bucket shows:
     - Time range label (e.g., "0h - 6h")
     - Horizontal bar chart (cyan/blue gradient)
     - Number of expected discharges
   - Bar width scales with discharge count (max width at 5 discharges)
   - Empty buckets show "-" placeholder

5. **Verify Upcoming Discharges List**
   - Shows top 10 next expected discharges
   - Each row displays:
     - Bed ID (cyan, bold)
     - Ward name
     - Patient ID (if available)
     - Time until discharge (hours or days)
     - Days in bed
   - List scrollable if more than ~6 items

6. **Verify Auto-Refresh**
   - Component refreshes every 5 minutes automatically
   - "Refresh" button in header manually triggers update
   - Loading state shows during fetch

7. **Test Ward Filtering** (if ward prop passed)
   - Pass ward prop: `<ForecastingPanel ward="ICU" />`
   - Metrics should show ICU-specific data
   - Timeline shows only ICU discharges

### Test Scenario 7: Error Handling

**Test Error State:**
1. Stop backend server
2. Observe frontend error message: "Failed to load forecasting data"
3. Restart backend
4. Click "Refresh" button
5. Verify data loads successfully

## Performance Testing

### Test Scenario 8: Large Dataset Performance

**Setup:**
- Create 100+ beds with occupancy data
- Create 1000+ OccupancyLog entries over 30 days

**Expected Performance:**
- API response time: < 500ms
- Frontend render time: < 100ms
- No memory leaks on auto-refresh

**Monitor:**
```bash
# Check response time
curl -w "@curl-format.txt" -o /dev/null -s "http://localhost:5001/api/analytics/forecasting"

# curl-format.txt content:
# time_total: %{time_total}s
```

## Integration Testing

### Test Scenario 9: End-to-End Workflow

1. **Create Test Patient Stay:**
   ```bash
   # 1. Assign patient to bed
   curl -X PATCH "http://localhost:5001/api/beds/ICU-001/status" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{
       "status": "occupied",
       "patientName": "Test Patient",
       "patientId": "P99999"
     }'
   ```

2. **Verify OccupancyLog Entry Created:**
   ```bash
   # Check database for 'assigned' log entry
   ```

3. **Check Forecasting Includes New Patient:**
   ```bash
   curl -X GET "http://localhost:5001/api/analytics/forecasting"
   # Verify occupiedBeds count increased
   # Verify new discharge appears in expectedDischarges.details
   ```

4. **Simulate Discharge (after some time):**
   ```bash
   curl -X PATCH "http://localhost:5001/api/beds/ICU-001/status" \
     -H "Authorization: Bearer YOUR_TOKEN" \
     -H "Content-Type: application/json" \
     -d '{ "status": "available" }'
   ```

5. **Verify Average LOS Updated:**
   ```bash
   # Query forecasting again
   # averageLengthOfStay.basedOnSamples should increase
   # averageLengthOfStay.days should reflect new data
   ```

## Troubleshooting

### Issue: "Based on 0 patient stays"

**Cause:** No complete stays (assigned → released pairs) in OccupancyLog

**Solution:**
1. Check OccupancyLog collection:
   ```javascript
   db.occupancylogs.find({ statusChange: { $in: ['assigned', 'released'] } })
   ```
2. Create test data by assigning and releasing beds
3. Ensure bed status changes trigger OccupancyLog creation

### Issue: All Discharges Show "0h" Until Discharge

**Cause:** Beds recently occupied, expected discharge in past

**Solution:**
- This is expected if beds were occupied before average LOS was calculated
- Wait for real patient stays or adjust test data timestamps

### Issue: Timeline Shows No Discharges

**Cause:** 
1. No occupied beds, or
2. All expected discharges beyond 72-hour window

**Solution:**
- Assign patients to beds
- Verify `expectedDischarges.total > 0` in API response
- Check `expectedDischarges.details` for discharge times

### Issue: Frontend Shows "Loading..." Indefinitely

**Causes:**
1. Backend not running
2. CORS issues
3. Network error

**Debug Steps:**
```bash
# 1. Check backend is running
curl http://localhost:5001/api/analytics/forecasting

# 2. Check browser console for errors
# Open DevTools → Console → Network tab

# 3. Verify API base URL in frontend
# Check frontend/src/services/api.js
```

## Quick Test Script

```bash
#!/bin/bash
# Quick test for Task 2.4 forecasting

echo "=== Testing Forecasting Endpoint ==="

# Test 1: Basic forecasting query
echo "\n1. Testing GET /api/analytics/forecasting"
curl -s http://localhost:5001/api/analytics/forecasting | jq '.success'

# Test 2: Check response structure
echo "\n2. Checking response structure..."
curl -s http://localhost:5001/api/analytics/forecasting | jq 'has("data")'

# Test 3: Verify key fields exist
echo "\n3. Verifying key fields..."
curl -s http://localhost:5001/api/analytics/forecasting | \
  jq '.data | has("currentMetrics", "averageLengthOfStay", "expectedDischarges", "timeline", "wardForecasts")'

# Test 4: Count timeline buckets
echo "\n4. Counting timeline buckets (should be 12)..."
curl -s http://localhost:5001/api/analytics/forecasting | jq '.data.timeline | length'

# Test 5: Check average length of stay
echo "\n5. Average length of stay calculation..."
curl -s http://localhost:5001/api/analytics/forecasting | jq '.data.averageLengthOfStay'

echo "\n=== Tests Complete ==="
```

## Success Criteria

✅ **Backend:**
- Average length of stay calculated from actual OccupancyLog data
- Expected discharges predicted based on admission times
- Timeline data structured in 6-hour buckets
- Ward-specific forecasts generated
- Intelligent insights provided
- Response time < 500ms

✅ **Frontend:**
- All metrics display correctly
- Timeline visualizes discharges in horizontal bars
- Upcoming discharges list shows details
- Insights section displays alerts
- Auto-refresh works every 5 minutes
- Manual refresh button functional
- Ward filtering works when prop provided

✅ **Integration:**
- Complete patient stay workflow tracked
- Forecasting updates as beds occupied/released
- Real-time accuracy maintained

## Notes

- **Average Length of Stay**: Requires historical data. Initially may default to 3.5 days if no complete patient stays exist.
- **Discharge Predictions**: Based on bed's `updatedAt` timestamp. For production, consider adding explicit `admissionTime` field to Bed model.
- **Scheduled Events**: Not yet integrated (would require separate ScheduledEvent model). Current implementation focuses on historical trend analysis.
- **Timeline Granularity**: 6-hour intervals provide good balance between detail and clarity. Can be adjusted if needed.

## Related Files

**Backend:**
- `backend/controllers/analyticsController.js` - getForecasting function
- `backend/models/OccupancyLog.js` - Historical data source
- `backend/models/Bed.js` - Current occupancy data

**Frontend:**
- `frontend/src/components/manager/ForecastingPanel.jsx` - Main component
- `frontend/src/services/api.js` - API service

**Documentation:**
- `to-do.md` - Task 2.4 requirements
- `TESTING_TASK_2.4.md` - This file
