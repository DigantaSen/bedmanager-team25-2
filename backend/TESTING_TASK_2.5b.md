# Testing Guide - Task 2.5b: Bed Cleaning Duration & Timeout Tracking

## Overview
Task 2.5b adds bed cleaning duration tracking with progress monitoring, timeout detection, and real-time updates via Socket.io.

## Backend Changes

### 1. Models Updated

#### Bed Model (`backend/models/Bed.js`)
**New Fields Added:**
- `cleaningStartTime` (Date): When cleaning started
- `estimatedCleaningDuration` (Number): Expected duration in minutes
- `estimatedCleaningEndTime` (Date): Calculated completion time

**Pre-save Middleware:**
- Auto-clears cleaning fields when status changes from 'maintenance'

#### CleaningLog Model (`backend/models/CleaningLog.js`) - NEW
**Schema Fields:**
- `bedId`: Reference to Bed
- `ward`: String (ICU, Emergency, General, Maternity, Pediatrics)
- `startTime`: Date (required)
- `endTime`: Date
- `estimatedDuration`: Number (minutes, required)
- `actualDuration`: Number (minutes, auto-calculated)
- `status`: Enum (in_progress, completed, overdue)
- `assignedTo`: Reference to User
- `completedBy`: Reference to User
- `notes`: String

**Virtual Fields:**
- `progressPercentage`: Calculates progress (0-100%)
- `timeRemaining`: Minutes remaining (0 if overdue)
- `isOverdue`: Boolean indicating if cleaning exceeded estimate

**Indexes:**
- Compound: `bedId` + `startTime`
- Single: `status`, `ward`, `startTime`

### 2. Controller Endpoints

#### `bedController.updateBedStatus` - ENHANCED
**New Request Body Field:**
```json
{
  "status": "maintenance",
  "cleaningDuration": 45  // minutes (optional)
}
```

**Behavior:**
- When status changes to 'maintenance' with cleaningDuration:
  1. Sets `cleaningStartTime` to current time
  2. Sets `estimatedCleaningDuration` from request
  3. Calculates `estimatedCleaningEndTime`
  4. Creates CleaningLog entry with status 'in_progress'
  5. Emits `bedCleaningStarted` Socket.io event to ward room

#### `bedController.getCleaningQueue` - NEW
**Route:** `GET /api/beds/cleaning-queue`  
**Access:** Manager, Hospital Admin  
**Query Params:**
- `ward` (optional): Filter by ward

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "total": 3,
      "overdue": 1,
      "onTrack": 2,
      "byWard": {
        "ICU": { "total": 2, "overdue": 1 },
        "Emergency": { "total": 1, "overdue": 0 }
      }
    },
    "beds": [
      {
        "_id": "...",
        "bedId": "ICU-001",
        "ward": "ICU",
        "status": "maintenance",
        "cleaningStartTime": "2024-01-15T10:00:00Z",
        "estimatedCleaningDuration": 45,
        "estimatedCleaningEndTime": "2024-01-15T10:45:00Z",
        "cleaningLog": {
          "assignedTo": { "name": "John Doe", "email": "john@example.com" },
          "status": "in_progress"
        },
        "progress": {
          "percentage": 67,
          "elapsedMinutes": 30,
          "timeRemainingMinutes": 15,
          "isOverdue": false
        }
      }
    ]
  }
}
```

**Features:**
- Sorts beds by urgency (overdue first, then by time remaining)
- Calculates real-time progress for each bed
- Returns summary statistics by ward

#### `bedController.markCleaningComplete` - NEW
**Route:** `PUT /api/beds/:id/cleaning/mark-complete`  
**Access:** Manager, Hospital Admin  
**Params:** `id` - Bed MongoDB ObjectId or bedId  
**Body:**
```json
{
  "notes": "Optional completion notes"
}
```

**Behavior:**
1. Finds bed and verifies status is 'maintenance'
2. Finds active CleaningLog entry
3. Updates CleaningLog:
   - Sets `endTime` to current time
   - Auto-calculates `actualDuration`
   - Sets status to 'completed' (or 'overdue' if exceeded estimate)
   - Sets `completedBy` to current user
4. Updates Bed status to 'available' (cleaning fields auto-cleared)
5. Creates OccupancyLog entry with 'maintenance_end'
6. Emits `bedCleaningCompleted` Socket.io event

**Response:**
```json
{
  "success": true,
  "message": "Cleaning marked as complete",
  "data": {
    "bed": { /* updated bed object */ },
    "cleaningLog": { /* completed log */ }
  }
}
```

#### `analyticsController.getCleaningPerformance` - NEW
**Route:** `GET /api/analytics/cleaning-performance`  
**Access:** Manager, Hospital Admin  
**Query Params:**
- `ward` (optional): Filter by ward
- `startDate` (optional): ISO date string
- `endDate` (optional): ISO date string
- `period` (optional): Number of days (default: 7)

**Response:**
```json
{
  "success": true,
  "data": {
    "summary": {
      "totalCleanings": 45,
      "totalCompleted": 40,
      "totalOverdue": 8,
      "totalInProgress": 5,
      "overdueRate": 20,
      "onTimeRate": 80,
      "avgActualDuration": 42,
      "avgEstimatedDuration": 45
    },
    "performance": {
      "fastestCleaning": {
        "bedId": "ICU-001",
        "ward": "ICU",
        "duration": 25,
        "completedBy": "Jane Smith"
      },
      "slowestCleaning": {
        "bedId": "General-015",
        "ward": "General",
        "duration": 75,
        "completedBy": "John Doe"
      }
    },
    "byWard": {
      "ICU": {
        "total": 20,
        "completed": 18,
        "overdue": 4,
        "inProgress": 2,
        "avgDuration": 40
      }
    },
    "staffPerformance": [
      {
        "name": "Jane Smith",
        "email": "jane@example.com",
        "totalCompleted": 15,
        "avgDuration": 38,
        "overdue": 2
      }
    ],
    "dailyBreakdown": [
      {
        "date": "2024-01-15",
        "total": 8,
        "completed": 7,
        "overdue": 1,
        "inProgress": 1
      }
    ],
    "recentCleanings": [ /* last 10 cleaning logs */ ]
  }
}
```

### 3. Routes Added

**bedRoutes.js:**
```javascript
router.get('/cleaning-queue', protect, authorize('manager', 'hospital_admin'), getCleaningQueue);
router.put('/:id/cleaning/mark-complete', protect, authorize('manager', 'hospital_admin'), markCleaningComplete);
```

**analyticsRoutes.js:**
```javascript
router.get('/cleaning-performance', protect, authorize('manager', 'hospital_admin'), getCleaningPerformance);
```

### 4. Socket.io Events

#### Emitted Events

**bedCleaningStarted:**
```javascript
{
  bed: { /* bed object */ },
  estimatedDuration: 45,
  estimatedEndTime: "2024-01-15T10:45:00Z",
  timestamp: "2024-01-15T10:00:00Z"
}
```
- Emitted to: Ward-specific room
- Trigger: When bed status changes to 'maintenance' with cleaningDuration

**bedCleaningCompleted:**
```javascript
{
  bed: { /* bed object */ },
  cleaningLog: {
    duration: 42,
    wasOverdue: false,
    completedBy: "Jane Smith"
  },
  timestamp: "2024-01-15T10:42:00Z"
}
```
- Emitted to: Ward-specific room
- Trigger: When cleaning is marked as complete

## Frontend Changes

### 1. CleaningQueuePanel Component

**Location:** `frontend/src/components/manager/CleaningQueuePanel.jsx`

**Features:**
- Displays all beds in maintenance status
- Real-time progress bars with color coding:
  - **Green**: On track (< 75% complete)
  - **Yellow**: Nearing deadline (75-100%)
  - **Red**: Overdue (> 100%)
- Shows elapsed time, estimated time, time remaining
- "Mark as Complete" button for each bed
- Auto-refresh every 30 seconds
- Socket.io real-time updates
- Summary statistics (total, overdue, on track)
- Ward breakdown if multiple wards

**Socket.io Integration:**
- Listens for `bedCleaningStarted`
- Listens for `bedCleaningCompleted`
- Listens for `bedUpdate` (refetches if maintenance status changed)
- Joins ward-specific room on mount

### 2. ManagerDashboard Integration

**Changes:**
- Imported CleaningQueuePanel
- Added component between Emergency Requests and Forecasting Panel
- Passes `ward` prop from currentUser

## Testing Instructions

### Prerequisites
1. Backend server running on port 5001
2. Frontend dev server running on port 5173
3. MongoDB running with test data
4. Logged in as Manager or Hospital Admin

### Test Scenario 1: Start Cleaning with Duration

**Using API (Postman/cURL):**
```bash
# Login as manager
curl -X POST http://localhost:5001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "manager@hospital.com",
    "password": "your_password"
  }'

# Copy the token from response

# Update bed to maintenance with cleaning duration
curl -X PATCH http://localhost:5001/api/beds/ICU-001/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "status": "maintenance",
    "cleaningDuration": 45
  }'
```

**Expected Results:**
1. Bed status changes to 'maintenance'
2. Bed document has:
   - `cleaningStartTime`: Current timestamp
   - `estimatedCleaningDuration`: 45
   - `estimatedCleaningEndTime`: Current time + 45 minutes
3. CleaningLog entry created with status 'in_progress'
4. Socket.io event `bedCleaningStarted` emitted
5. Frontend CleaningQueuePanel shows the bed with progress bar

**Using Frontend:**
1. Go to Manager Dashboard
2. Click on an available bed
3. In BedDetailsModal, change status to "Maintenance"
4. Enter cleaning duration (e.g., 45 minutes)
5. Click "Update Status"
6. Observe bed appears in CleaningQueuePanel

### Test Scenario 2: View Cleaning Queue

**API Test:**
```bash
curl -X GET http://localhost:5001/api/beds/cleaning-queue \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
- Summary with total, overdue, onTrack counts
- Array of beds with progress calculations
- Each bed shows:
  - Progress percentage
  - Elapsed time
  - Time remaining
  - Overdue status

**Frontend Test:**
1. Navigate to Manager Dashboard
2. Scroll to CleaningQueuePanel section
3. Verify:
   - Summary cards show correct counts
   - Each bed card displays:
     - Bed ID and ward
     - Status badge (On Track/Nearing Deadline/Overdue)
     - Assigned staff member
     - Progress bar with percentage
     - Elapsed time and estimated time
     - "Mark as Complete" button
   - Progress bars update color based on status

### Test Scenario 3: Progress Monitoring

**Simulate Time Passage:**
```javascript
// In MongoDB shell or Compass
db.beds.updateOne(
  { bedId: 'ICU-001' },
  { $set: { cleaningStartTime: new Date(Date.now() - 40 * 60 * 1000) } }
);
// This sets start time to 40 minutes ago for a 45-minute cleaning
```

**Expected Results:**
1. Progress bar shows ~89% (40/45)
2. Status badge shows "Nearing Deadline" (yellow)
3. Time remaining shows ~5 minutes
4. Auto-refresh updates progress every 30 seconds

**Test Overdue:**
```javascript
// Set start time to 50 minutes ago for 45-minute cleaning
db.beds.updateOne(
  { bedId: 'ICU-001' },
  { $set: { cleaningStartTime: new Date(Date.now() - 50 * 60 * 1000) } }
);
```

**Expected Results:**
1. Progress bar shows 100% (red)
2. Status badge shows "Overdue" (red)
3. Time remaining shows "Overdue"
4. Bed appears first in queue (sorted by urgency)

### Test Scenario 4: Mark Cleaning as Complete

**API Test:**
```bash
curl -X PUT http://localhost:5001/api/beds/ICU-001/cleaning/mark-complete \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"notes": "Cleaning completed successfully"}'
```

**Expected Results:**
1. Bed status changes to 'available'
2. Cleaning fields cleared (startTime, duration, endTime)
3. CleaningLog updated:
   - `endTime`: Current timestamp
   - `actualDuration`: Calculated (endTime - startTime in minutes)
   - `status`: 'completed' or 'overdue'
   - `completedBy`: Current user ID
4. OccupancyLog entry created with 'maintenance_end'
5. Socket.io event `bedCleaningCompleted` emitted
6. Frontend removes bed from CleaningQueuePanel

**Frontend Test:**
1. In CleaningQueuePanel, find a bed card
2. Click "Mark as Complete" button
3. Button shows loading spinner
4. Bed disappears from queue after completion
5. Summary statistics update (total decreases)

### Test Scenario 5: Real-time Updates

**Setup:**
1. Open Manager Dashboard in two browser windows
2. Login as manager in both

**Test:**
1. In Window 1: Start cleaning on a bed
2. In Window 2: Observe bed appears in CleaningQueuePanel without manual refresh
3. In Window 1: Mark cleaning as complete
4. In Window 2: Observe bed disappears from queue automatically

**Expected Behavior:**
- Socket.io events propagate to all connected clients
- CleaningQueuePanel updates automatically
- No manual refresh needed

### Test Scenario 6: Cleaning Performance Analytics

**API Test:**
```bash
# Get performance for last 7 days
curl -X GET "http://localhost:5001/api/analytics/cleaning-performance?period=7" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get performance for specific ward
curl -X GET "http://localhost:5001/api/analytics/cleaning-performance?ward=ICU" \
  -H "Authorization: Bearer YOUR_TOKEN"

# Get performance for date range
curl -X GET "http://localhost:5001/api/analytics/cleaning-performance?startDate=2024-01-01&endDate=2024-01-15" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected Response:**
- Summary statistics (total, completed, overdue, rates)
- Fastest and slowest cleanings
- Ward breakdown
- Staff performance rankings
- Daily breakdown
- Recent cleanings (last 10)

**Verify Calculations:**
1. Overdue rate = (totalOverdue / totalCompleted) * 100
2. On-time rate = ((totalCompleted - totalOverdue) / totalCompleted) * 100
3. Average actual duration = sum of all actualDurations / totalCompleted
4. Staff sorted by total completed (descending)

### Test Scenario 7: Ward Filtering (Manager Role)

**Setup:**
1. Login as manager with ward='ICU'

**Test:**
```bash
# Manager should only see ICU beds
curl -X GET http://localhost:5001/api/beds/cleaning-queue \
  -H "Authorization: Bearer MANAGER_TOKEN"
```

**Expected Results:**
- Response only includes beds from manager's ward (ICU)
- Beds from other wards filtered out
- Summary statistics only for ICU

**Hospital Admin Test:**
```bash
# Admin should see all wards
curl -X GET http://localhost:5001/api/beds/cleaning-queue \
  -H "Authorization: Bearer ADMIN_TOKEN"
```

**Expected Results:**
- Response includes beds from all wards
- Summary includes byWard breakdown for all wards

### Test Scenario 8: Edge Cases

#### 8.1: Start cleaning without duration
```bash
curl -X PATCH http://localhost:5001/api/beds/ICU-001/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"status": "maintenance"}'
```

**Expected:**
- Bed status changes to 'maintenance'
- Cleaning fields remain null
- No CleaningLog entry created
- No bedCleaningStarted event emitted

#### 8.2: Mark complete on non-maintenance bed
```bash
curl -X PUT http://localhost:5001/api/beds/ICU-001/cleaning/mark-complete \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Expected:**
- 400 Bad Request
- Message: "Bed is not currently in maintenance"

#### 8.3: Invalid cleaning duration
```bash
curl -X PATCH http://localhost:5001/api/beds/ICU-001/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"status": "maintenance", "cleaningDuration": -10}'
```

**Expected:**
- 400 Bad Request
- Message: "cleaningDuration must be a positive number (in minutes)"

#### 8.4: Status change from maintenance to occupied
```bash
# First set to maintenance
curl -X PATCH http://localhost:5001/api/beds/ICU-001/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"status": "maintenance", "cleaningDuration": 45}'

# Then change to occupied
curl -X PATCH http://localhost:5001/api/beds/ICU-001/status \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{"status": "occupied", "patientName": "John Doe"}'
```

**Expected:**
- Bed status changes to 'occupied'
- Cleaning fields auto-cleared by pre-save middleware
- CleaningLog remains 'in_progress' (orphaned - consider this acceptable or implement cleanup)

### Test Scenario 9: Frontend Auto-Refresh

**Test:**
1. Open Manager Dashboard with CleaningQueuePanel visible
2. Wait 30 seconds (auto-refresh interval)
3. Check browser network tab
4. Verify GET request to `/api/beds/cleaning-queue` is made

**Expected:**
- Request every 30 seconds
- Progress bars update automatically
- No page flicker or UI disruption

### Test Scenario 10: Concurrent Completions

**Test:**
1. Start cleaning on multiple beds (ICU-001, ICU-002, ICU-003)
2. Mark all three as complete within a few seconds
3. Observe CleaningQueuePanel

**Expected:**
- All beds removed from queue
- No race conditions
- Summary statistics update correctly
- No duplicate requests

## Database Verification

### Check CleaningLog Collection

```javascript
// MongoDB shell
db.cleaninglogs.find().pretty()

// Verify fields
db.cleaninglogs.findOne({
  bedId: ObjectId("..."),
  status: "completed"
})

// Check virtuals (won't appear in DB, only in API responses)
// Must query via API to see virtuals
```

### Check Bed Document

```javascript
db.beds.findOne({ bedId: "ICU-001" })

// When in maintenance, should have:
// - cleaningStartTime: Date
// - estimatedCleaningDuration: Number
// - estimatedCleaningEndTime: Date

// When not in maintenance, should have:
// - cleaningStartTime: null
// - estimatedCleaningDuration: null
// - estimatedCleaningEndTime: null
```

### Check Indexes

```javascript
db.cleaninglogs.getIndexes()

// Should include:
// - { bedId: 1, startTime: 1 }
// - { status: 1 }
// - { ward: 1, startTime: 1 }
// - { startTime: -1 }
```

## Performance Testing

### Load Test Cleaning Queue

```bash
# Install Apache Bench
# Test 1000 requests with 50 concurrent
ab -n 1000 -c 50 -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5001/api/beds/cleaning-queue
```

**Expected:**
- Response time < 200ms for 95th percentile
- No errors
- Consistent response times

### Load Test Analytics

```bash
ab -n 500 -c 25 -H "Authorization: Bearer YOUR_TOKEN" \
  http://localhost:5001/api/analytics/cleaning-performance?period=30
```

**Expected:**
- Response time < 500ms (more complex aggregation)
- No memory leaks
- Query optimized with indexes

## Troubleshooting

### Issue: Bed not appearing in cleaning queue

**Checks:**
1. Verify bed status is 'maintenance': `db.beds.findOne({ bedId: "ICU-001" })`
2. Check if cleaningStartTime and estimatedCleaningDuration are set
3. Verify user has correct role (manager/hospital_admin)
4. Check ward filtering (manager only sees their ward)
5. Review backend logs for errors

### Issue: Progress not updating

**Checks:**
1. Verify cleaningStartTime is set correctly
2. Check browser time vs server time (timezone issues)
3. Confirm auto-refresh is working (network tab)
4. Check Socket.io connection status
5. Review console for JavaScript errors

### Issue: Socket.io events not received

**Checks:**
1. Verify Socket.io connection in browser console: `socket.connected`
2. Check if user joined ward room: Look for `joinWard` emit
3. Verify backend emits to correct room
4. Check CORS settings
5. Test with Socket.io client debugger

### Issue: CleaningLog not created

**Checks:**
1. Verify cleaningDuration was provided in request
2. Check backend logs for errors
3. Verify CleaningLog model is properly imported
4. Check MongoDB connection
5. Review validation errors

### Issue: Analytics showing incorrect data

**Checks:**
1. Verify date filters are applied correctly
2. Check timezone handling in date queries
3. Ensure CleaningLog entries have correct data
4. Test with smaller date ranges
5. Review aggregation pipeline logic

## Success Criteria

✅ **Backend:**
- Bed model has cleaning fields that auto-clear
- CleaningLog model with virtuals and middleware
- updateBedStatus accepts cleaningDuration and creates log
- getCleaningQueue returns sorted, enriched data
- markCleaningComplete updates bed and log correctly
- getCleaningPerformance returns comprehensive analytics
- Socket.io events emitted for cleaning lifecycle

✅ **Frontend:**
- CleaningQueuePanel displays all beds in maintenance
- Progress bars with color coding (green/yellow/red)
- Real-time updates via Socket.io
- Mark complete functionality works
- Auto-refresh every 30 seconds
- Ward breakdown for multi-ward views
- Responsive design

✅ **Integration:**
- Start cleaning → appears in queue immediately
- Progress updates automatically
- Mark complete → disappears from queue
- Events propagate to all connected clients
- Analytics endpoint returns accurate metrics
- Ward filtering works for managers

## API Endpoints Summary

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| PATCH | `/api/beds/:id/status` | Manager, Admin, Receptionist | Enhanced to accept cleaningDuration |
| GET | `/api/beds/cleaning-queue` | Manager, Admin | Get all beds in maintenance with progress |
| PUT | `/api/beds/:id/cleaning/mark-complete` | Manager, Admin | Mark cleaning as complete |
| GET | `/api/analytics/cleaning-performance` | Manager, Admin | Get cleaning performance analytics |

## Socket.io Events Summary

| Event | Room | Data | Trigger |
|-------|------|------|---------|
| `bedCleaningStarted` | Ward-specific | bed, estimatedDuration, estimatedEndTime | Status → maintenance with duration |
| `bedCleaningCompleted` | Ward-specific | bed, cleaningLog, completedBy | Mark cleaning complete |
| `bedUpdate` | Global | bed, previousStatus | Any bed status change |

## Next Steps

After testing Task 2.5b:
1. Consider adding email/push notifications for overdue cleanings
2. Implement cleaning duration estimation based on historical data
3. Add cleaning task assignment workflow
4. Create mobile-optimized cleaning checklist
5. Add QR code scanning for cleaning verification
6. Implement recurring maintenance schedules

## Notes

- CleaningLog virtuals (progressPercentage, timeRemaining, isOverdue) are only available via API responses, not in direct MongoDB queries
- Pre-save middleware auto-calculates actualDuration and updates status
- Ward filtering is automatically applied for managers based on their ward assignment
- Socket.io events are emitted to ward-specific rooms for targeted updates
- Auto-refresh interval is 30 seconds to balance real-time updates with server load
