# Testing Guide: Task 2.5 - Bed Occupant Details & Patient Status Dashboard

## Overview
Task 2.5 implements a comprehensive occupant status dashboard that displays all occupied beds with patient details, search/filter functionality, and detailed bed occupancy history visualization.

## Backend Implementation

### New Endpoints

#### 1. GET /api/beds/occupied
Returns all occupied beds with enriched patient and time-in-bed information.

**Features:**
- Ward-based filtering (managers see only their ward)
- Time in bed calculations (hours, days, formatted)
- Summary statistics by ward
- Admission time tracking

#### 2. GET /api/beds/:id/occupant-history
Returns complete occupancy history for a specific bed from OccupancyLog.

**Features:**
- All status change logs with timestamps
- Calculated occupancy periods (assigned → released pairs)
- Duration calculations for each stay
- Statistics (total occupancies, average duration)
- Current ongoing occupancy tracking

## API Testing

### Test Scenario 1: Get All Occupied Beds

**Request:**
```bash
curl -X GET "http://localhost:5001/api/beds/occupied" \
  -H "Authorization: Bearer YOUR_MANAGER_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "count": 5,
  "data": {
    "beds": [
      {
        "_id": "673123abc...",
        "bedId": "ICU-001",
        "status": "occupied",
        "ward": "ICU",
        "patientName": "John Doe",
        "patientId": "P12345",
        "createdAt": "2025-11-10T10:00:00.000Z",
        "updatedAt": "2025-11-10T15:30:00.000Z",
        "admissionTime": "2025-11-10T15:30:00.000Z",
        "timeInBed": {
          "hours": 42.5,
          "days": 1.8,
          "formatted": "1d 18h"
        }
      }
      // ... more beds
    ],
    "summary": [
      {
        "ward": "ICU",
        "occupiedCount": 3,
        "patients": [
          { "bedId": "ICU-001", "patientName": "John Doe", "patientId": "P12345" }
          // ... more patients
        ]
      }
      // ... more wards
    ]
  }
}
```

**Test Cases:**
1. **Manager Access**: Token with `role: 'manager'` and `ward: 'ICU'` should only see ICU beds
2. **Admin Access**: Token with `role: 'hospital_admin'` should see all wards
3. **Ward Filter**: Query param `?ward=ICU` should filter to ICU only (admin only)
4. **Empty Result**: If no beds occupied, should return empty array with count 0

### Test Scenario 2: Get Bed Occupant History

**Request:**
```bash
# By bedId string
curl -X GET "http://localhost:5001/api/beds/ICU-001/occupant-history" \
  -H "Authorization: Bearer YOUR_MANAGER_TOKEN" \
  -H "Content-Type: application/json"

# By MongoDB ObjectId
curl -X GET "http://localhost:5001/api/beds/673123abc.../occupant-history" \
  -H "Authorization: Bearer YOUR_MANAGER_TOKEN" \
  -H "Content-Type: application/json"
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "bed": {
      "_id": "673123abc...",
      "bedId": "ICU-001",
      "ward": "ICU",
      "status": "occupied",
      "currentPatient": {
        "patientName": "John Doe",
        "patientId": "P12345"
      }
    },
    "history": {
      "allLogs": [
        {
          "_id": "log123...",
          "bedId": "673123abc...",
          "userId": {
            "_id": "user123...",
            "name": "Dr. Smith",
            "email": "smith@hospital.com",
            "role": "manager"
          },
          "timestamp": "2025-11-10T15:30:00.000Z",
          "statusChange": "assigned",
          "createdAt": "2025-11-10T15:30:00.000Z"
        }
        // ... more logs (most recent first)
      ],
      "occupancyPeriods": [
        {
          "startTime": "2025-11-10T15:30:00.000Z",
          "startLog": { /* log object */ },
          "status": "ongoing",
          "duration": {
            "hours": 42.5,
            "days": 1.8,
            "formatted": "1d 18h",
            "ongoing": true
          }
        },
        {
          "startTime": "2025-11-08T10:00:00.000Z",
          "startLog": { /* log object */ },
          "endTime": "2025-11-09T14:00:00.000Z",
          "endLog": { /* log object */ },
          "status": "completed",
          "duration": {
            "hours": 28.0,
            "days": 1.2,
            "formatted": "1d 4h"
          }
        }
        // ... more periods (most recent first)
      ],
      "statistics": {
        "totalOccupancies": 5,
        "averageDuration": 2.3,
        "currentlyOccupied": true,
        "totalLogs": 12
      }
    }
  }
}
```

**Test Cases:**
1. **Valid Bed**: Should return complete history
2. **Invalid Bed ID**: Should return 404 "Bed not found"
3. **Manager Authorization**: Manager should only access beds in their ward (403 for other wards)
4. **Admin Access**: Hospital admin should access any bed
5. **No History**: New bed with no logs should return empty arrays with zero statistics

### Test Scenario 3: Authorization Checks

**Manager Accessing Own Ward:**
```bash
# Manager with ward='ICU' accessing ICU bed - SHOULD SUCCEED
curl -X GET "http://localhost:5001/api/beds/ICU-001/occupant-history" \
  -H "Authorization: Bearer ICU_MANAGER_TOKEN"
```
Expected: 200 OK with data

**Manager Accessing Different Ward:**
```bash
# Manager with ward='ICU' accessing General bed - SHOULD FAIL
curl -X GET "http://localhost:5001/api/beds/GEN-001/occupant-history" \
  -H "Authorization: Bearer ICU_MANAGER_TOKEN"
```
Expected: 403 Forbidden "Access denied: You can only view beds in your assigned ward"

**Admin Accessing Any Ward:**
```bash
# Hospital admin accessing any bed - SHOULD SUCCEED
curl -X GET "http://localhost:5001/api/beds/GEN-001/occupant-history" \
  -H "Authorization: Bearer ADMIN_TOKEN"
```
Expected: 200 OK with data

## Frontend Testing

### Test Scenario 4: Occupant Status Dashboard Page

**Prerequisites:**
- Backend running on port 5001
- Frontend running on port 5173
- Logged in as Manager or Hospital Admin
- At least some beds occupied with patient data

**Test Steps:**

1. **Navigate to Occupant Dashboard**
   ```
   http://localhost:5173/manager/occupants
   ```

2. **Verify Page Load**
   - Page should display without errors
   - Header: "Bed Occupant Status Dashboard"
   - Summary cards show:
     - Total Occupied Beds (count)
     - Avg. Time in Bed (days)
     - Longest Stay (days)
     - Wards with Patients (count)

3. **Verify Ward Summary Section**
   - Grid of cards showing each ward
   - Each card displays:
     - Ward name
     - Occupied count badge
     - Patient count text

4. **Verify Auto-Refresh**
   - Data refreshes automatically every 30 seconds
   - "Refresh" button in header manually triggers update
   - "Last updated" timestamp updates on refresh

### Test Scenario 5: Occupant Table Features

**Search Functionality:**
1. Type "ICU" in search box
   - Should filter to show only ICU beds
   - Results count updates
2. Type patient name (e.g., "John")
   - Should filter to show beds with matching patient names
3. Type patient ID (e.g., "P12345")
   - Should filter to show bed with that patient ID
4. Clear search
   - Should show all beds again

**Ward Filter:**
1. Select "ICU" from dropdown
   - Should show only ICU beds
2. Select "General" from dropdown
   - Should show only General ward beds
3. Select "All Wards"
   - Should show all beds

**Column Sorting:**
1. Click "Bed ID" header
   - First click: Sort ascending (A→Z)
   - Second click: Sort descending (Z→A)
   - Arrow icon indicates sort direction
2. Click "Ward" header
   - Should sort alphabetically by ward
3. Click "Patient Name" header
   - Should sort alphabetically by patient name
4. Click "Time in Bed" header
   - Should sort numerically by days in bed

**Table Display:**
- Bed ID: Cyan color, monospace font
- Ward: Badge with blue background
- Patient Name: White text (or "N/A" if missing)
- Patient ID: Monospace font (or "N/A" if missing)
- Time in Bed: Bold formatted (e.g., "1d 18h"), subtitle shows days
- Admission Time: Date formatted (e.g., "Nov 10, 03:30 PM")
- "View Details" button: Cyan on hover

### Test Scenario 6: Occupant Details Modal

**Open Modal:**
1. Click "View Details" button on any bed row
2. Modal should open with bed details

**Current Status Section:**
- Displays: Ward, Bed ID, Status, Patient Name, Patient ID, Admission Time, Time in Bed
- Icons with colored backgrounds for each field
- All information properly formatted

**Statistics Cards:**
1. Total Occupancies: Number of complete stays
2. Avg. Stay Duration: Average in days (e.g., "2.3d")
3. Current Status: "Occupied" (green) or "Available" (grey)

**Occupancy Timeline:**
- Shows periods newest first
- Each period displays:
  - Period number
  - Duration (formatted, e.g., "1d 18h")
  - Start event with timestamp and user info
  - End event (if completed) with timestamp and user info
- Ongoing periods show green pulsing dot and "(Ongoing)" badge
- Timeline line connects periods visually
- Color-coded status changes:
  - Green: assigned
  - Blue: released
  - Yellow: maintenance_start
  - Cyan: maintenance_end
  - Purple: reserved
  - Red: reservation_cancelled

**All Status Changes (Collapsible):**
- Click to expand
- Shows all logs in chronological order
- Each log: status label, timestamp, color dot
- Scrollable if many logs (max-height with overflow)

**Modal Actions:**
- "Close" button at bottom
- X button at top-right
- Clicking outside modal (overlay) should NOT close it (by design)

### Test Scenario 7: Responsive Design

**Desktop (>1024px):**
- Summary cards in 4-column grid
- Ward summary in 3-column grid
- Table shows all columns
- Modal full width but max-width 4xl

**Tablet (768px - 1024px):**
- Summary cards in 2-column grid
- Ward summary in 2-column grid
- Table scrollable horizontally

**Mobile (<768px):**
- Summary cards stack vertically
- Search bar and ward filter stack vertically
- Table scrollable horizontally
- Modal takes full screen with padding

## Integration Testing

### Test Scenario 8: Complete Workflow

**Setup:**
1. Create a test patient admission
2. Wait a few hours or manually update timestamps
3. Release the patient
4. Re-admit another patient to same bed

**Test Flow:**
1. Navigate to Manager Dashboard
2. Observe bed shows as occupied
3. Navigate to Occupant Dashboard (`/manager/occupants`)
4. Verify bed appears in table
5. Verify time in bed is calculated correctly
6. Click "View Details"
7. Verify current status shows correct patient
8. Verify timeline shows current ongoing stay
9. Verify timeline shows previous completed stay
10. Verify statistics show 2 total occupancies
11. Verify average duration is calculated
12. Close modal
13. Use search to find the bed by patient ID
14. Use ward filter to filter by ward
15. Sort by "Time in Bed" - bed should appear in correct position

### Test Scenario 9: Real-Time Updates

**Setup:**
- Open Occupant Dashboard in browser
- Have another user/window with ability to admit/discharge patients

**Test:**
1. In Dashboard, note current occupied count
2. In another window, admit a patient to an available bed
3. Wait 30 seconds (auto-refresh) or click "Refresh"
4. Verify:
   - Occupied count increases
   - New bed appears in table
   - Ward summary updates
5. Discharge a patient
6. Refresh dashboard
7. Verify:
   - Occupied count decreases
   - Bed removed from table
   - Ward summary updates

## Performance Testing

### Test Scenario 10: Large Dataset

**Setup:**
- Create 50+ occupied beds
- Create 500+ occupancy log entries

**Expected Performance:**
- GET /api/beds/occupied: < 300ms
- GET /api/beds/:id/occupant-history: < 500ms
- Frontend table render: < 200ms
- Search/filter operations: < 50ms (instant)
- Modal open: < 100ms

**Monitor:**
```bash
# Test occupied beds endpoint
curl -w "@curl-format.txt" -o /dev/null -s \
  -H "Authorization: Bearer YOUR_TOKEN" \
  "http://localhost:5001/api/beds/occupied"

# curl-format.txt:
# time_total: %{time_total}s
```

## Error Handling

### Test Scenario 11: Error States

**Backend Down:**
1. Stop backend server
2. Refresh Occupant Dashboard
3. Should show error message: "Failed to load occupied beds data"
4. Table should show previous data (if any) or empty state

**Network Error:**
1. Throttle network to slow 3G
2. Click "View Details"
3. Should show loading spinner
4. Eventually load or show error with "Retry" button

**No Occupied Beds:**
1. Release all patients (all beds available)
2. Refresh Occupant Dashboard
3. Should show:
   - All summary cards with 0 values
   - Empty state with bed icon and message: "No occupied beds found"
   - "All beds are currently available or in maintenance"

**Invalid Bed Access:**
1. As ICU Manager, try to access General ward bed history directly via API
2. Should return 403 Forbidden

## Troubleshooting

### Issue: "No occupied beds" but beds are actually occupied

**Causes:**
1. Beds in database have `status: 'occupied'` but API not finding them
2. Manager's ward doesn't match any occupied beds
3. Authentication token missing or invalid

**Debug:**
```bash
# Check database directly
mongosh bedmanager
db.beds.find({ status: 'occupied' })

# Check API response
curl -X GET "http://localhost:5001/api/beds/occupied" \
  -H "Authorization: Bearer YOUR_TOKEN" -v

# Check user's role and ward in token
# Decode JWT at jwt.io
```

### Issue: Timeline shows no occupancy periods

**Causes:**
1. OccupancyLog has no entries for the bed
2. Logs exist but no paired assigned→released events
3. Logs are older than expected

**Debug:**
```bash
# Check occupancy logs for bed
mongosh bedmanager
db.occupancylogs.find({ bedId: ObjectId("...") }).sort({ timestamp: -1 })

# Should see entries with statusChange: 'assigned' and 'released'
```

### Issue: Time in bed shows very large numbers

**Cause:** Bed's `updatedAt` is very old (bed was occupied long ago and never updated)

**Solution:** This is expected behavior - time calculation uses `updatedAt` as admission time. For production, consider adding explicit `admissionTime` field to Bed model.

### Issue: Search not working

**Causes:**
1. Search is case-sensitive (it shouldn't be - check implementation)
2. Searching for wrong field
3. JavaScript error in console

**Debug:**
```javascript
// Open browser console
// Check for errors
// Test search function directly
console.log(filteredBeds)
```

## Quick Test Script

```bash
#!/bin/bash
# Quick test for Task 2.5 endpoints

echo "=== Testing Occupied Beds Endpoint ==="

# Test 1: Get occupied beds
echo "\n1. GET /api/beds/occupied"
curl -s -H "Authorization: Bearer $MANAGER_TOKEN" \
  http://localhost:5001/api/beds/occupied | jq '.success, .count'

# Test 2: Get specific bed history
echo "\n2. GET /api/beds/:id/occupant-history"
BED_ID="ICU-001"
curl -s -H "Authorization: Bearer $MANAGER_TOKEN" \
  "http://localhost:5001/api/beds/$BED_ID/occupant-history" | jq '.success'

# Test 3: Check response structure
echo "\n3. Checking response structure..."
curl -s -H "Authorization: Bearer $MANAGER_TOKEN" \
  http://localhost:5001/api/beds/occupied | \
  jq '.data | has("beds", "summary")'

# Test 4: Verify time calculations exist
echo "\n4. Verifying time in bed calculations..."
curl -s -H "Authorization: Bearer $MANAGER_TOKEN" \
  http://localhost:5001/api/beds/occupied | \
  jq '.data.beds[0].timeInBed'

echo "\n=== Tests Complete ==="
```

## Success Criteria

✅ **Backend:**
- GET /api/beds/occupied returns all occupied beds with time calculations
- Ward-based filtering works for managers
- GET /api/beds/:id/occupant-history returns complete timeline
- Occupancy periods calculated correctly from logs
- Authorization enforced (managers only see their ward)
- Response time < 500ms

✅ **Frontend:**
- Occupant Dashboard loads without errors
- Summary cards display correct statistics
- Table shows all occupied beds with proper formatting
- Search works across bed ID, patient name, patient ID
- Ward filter works correctly
- Column sorting works for all sortable columns
- "View Details" opens modal with complete bed information
- Timeline visualizes occupancy periods correctly
- Modal shows statistics and all logs
- Auto-refresh works every 30 seconds
- Responsive design works on mobile/tablet/desktop

✅ **Integration:**
- Real-time updates reflect bed status changes
- Modal fetches fresh history data on open
- Authorization properly restricts ward access
- Error states handled gracefully

## Related Files

**Backend:**
- `backend/controllers/bedController.js` - getOccupiedBeds, getOccupantHistory
- `backend/routes/bedRoutes.js` - Route definitions
- `backend/models/Bed.js` - Bed model
- `backend/models/OccupancyLog.js` - Historical data source

**Frontend:**
- `frontend/src/pages/OccupantStatusDashboard.jsx` - Main dashboard page
- `frontend/src/components/manager/OccupantTable.jsx` - Table with search/sort/filter
- `frontend/src/components/manager/OccupantDetailsModal.jsx` - Details modal
- `frontend/src/components/manager/PatientTimelineCard.jsx` - Timeline visualization
- `frontend/src/App.jsx` - Route configuration

**Documentation:**
- `to-do.md` - Task 2.5 requirements
- `TESTING_TASK_2.5.md` - This file

## Notes

- **Admission Time**: Currently uses bed's `updatedAt` timestamp as proxy. For production, consider adding explicit `admissionTime` field.
- **Manager Ward Filtering**: Automatically applied on backend - managers cannot override this.
- **Occupancy Periods**: Calculated by pairing 'assigned' with next 'released' log entry. Ongoing periods use current time as end.
- **Performance**: With proper indexing on OccupancyLog (bedId, timestamp), queries remain fast even with thousands of logs.
- **Real-time**: No WebSocket integration for this dashboard - uses polling (auto-refresh every 30s). Can be enhanced with Socket.io later.
