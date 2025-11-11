# Task 2.2: Real-time Alert System

## Implementation Summary

This task implements a real-time alert system that detects high occupancy (>90%) and notifies managers and admins in real-time via Socket.io.

## Features Implemented

### 1. Backend Alert Detection Logic
- **Automatic Occupancy Monitoring**: Function `checkOccupancyAndCreateAlerts()` in `bedController.js`
- **Trigger Threshold**: Creates alert when occupancy exceeds 90%
- **Severity Levels**:
  - `high`: 90-94.9% occupancy
  - `critical`: 95%+ occupancy
- **Duplicate Prevention**: Checks for existing unread alerts before creating new ones
- **Ward-Specific**: Alerts are tagged with the specific ward (ICU, General, Emergency)

### 2. Socket.io Real-time Events
- **Event**: `occupancyAlert`
- **Payload**:
  ```javascript
  {
    alert: { /* Alert document */ },
    ward: "ICU",
    occupancyRate: "92.5",
    occupiedBeds: 37,
    totalBeds: 40,
    timestamp: Date
  }
  ```
- **Broadcast**: All authenticated users with manager or hospital_admin roles
- **Ward Rooms**: Users automatically join `ward-{wardName}` rooms for targeted broadcasts

### 3. Alert Model Enhancements
**File**: `backend/models/Alert.js`
- Added `ward` field for ward-specific filtering
- Updated `targetRole` enum to include: `manager`, `hospital_admin`, `ward_staff`, `er_staff`
- Added ward-based indexing for performance

### 4. Alert API Endpoints

#### GET /api/alerts
- **Access**: Private (requires JWT)
- **Filtering**:
  - By user role (`targetRole`)
  - By ward for managers (shows only their ward's alerts + general alerts)
- **Response**: Array of alerts with populated bed/request data

#### PATCH /api/alerts/:id/dismiss
- **Access**: Private (requires JWT)
- **Action**: Marks alert as read
- **Socket Event**: Emits `alertDismissed` event
- **Response**: Updated alert object

### 5. Frontend Socket Subscription
**File**: `frontend/src/services/socketService.js`

Listens for:
- `occupancyAlert`: High occupancy alerts
- `alertCreated`: General alert creation
- `alertDismissed`: Alert dismissal events

Actions:
- Dispatches `addAlert` to Redux store
- Shows browser notification (if permission granted)
- Updates UI in real-time

### 6. Browser Notifications
- **Permission Request**: Automatic on Manager Dashboard mount
- **Notification Content**:
  - Title: "High Occupancy Alert"
  - Body: Alert message with occupancy details
  - Tag: Alert ID (prevents duplicates)

### 7. Redux Integration
**File**: `frontend/src/features/alerts/alertsSlice.js`

Enhanced:
- `addAlert` reducer for real-time additions
- `fetchAlerts` thunk with proper response handling
- `dismissAlert` thunk with proper response handling
- Automatic unread count calculation

## How It Works

### Flow Diagram
```
1. Ward Staff updates bed status → PATCH /api/beds/:id/status
2. bedController checks occupancy → checkOccupancyAndCreateAlerts()
3. If occupancy > 90% → Create Alert in DB
4. Socket.io emits 'occupancyAlert' → All managers + admins
5. Frontend receives event → Dispatches addAlert to Redux
6. AlertNotificationPanel updates → Shows new alert
7. Browser notification shown → User alerted
8. User dismisses alert → PATCH /api/alerts/:id/dismiss
9. Socket.io emits 'alertDismissed' → All users
10. Redux updates → Alert marked as read
```

## Files Modified

### Backend
1. `backend/controllers/bedController.js`
   - Added `Alert` import
   - Added `checkOccupancyAndCreateAlerts()` function
   - Integrated occupancy check after bed status update

2. `backend/models/Alert.js`
   - Added `ward` field
   - Updated `targetRole` enum

3. `backend/controllers/alertController.js`
   - Enhanced `getAlerts` with ward filtering
   - Added socket event emission in `dismissAlert`

4. `backend/socketHandler.js`
   - Added ward room joining on connection
   - Added role room joining on connection
   - Stored ward info in authenticated users

### Frontend
1. `frontend/src/services/socketService.js`
   - Added `addAlert` import
   - Added `occupancyAlert` event listener
   - Added `alertCreated` event listener
   - Added browser notification support

2. `frontend/src/features/alerts/alertsSlice.js`
   - Fixed response data extraction for `fetchAlerts`
   - Fixed response data extraction for `dismissAlert`

3. `frontend/src/pages/ManagerDashboard.jsx`
   - Added notification permission request on mount

### New Files
1. `backend/testOccupancyAlert.js`
   - Test script to simulate high occupancy scenarios

## Testing

### Manual Testing

#### Test High Occupancy Alert Creation
1. Start backend: `npm run dev` (in backend folder)
2. Start frontend: `npm run dev` (in frontend folder)
3. Login as a manager
4. Navigate to Manager Dashboard
5. Update multiple beds to "occupied" status until >90% occupancy
6. Verify alert appears in AlertNotificationPanel
7. Check console for socket event logs
8. Verify browser notification appears

#### Test Real-time Updates
1. Open Manager Dashboard in two browser windows
2. Update bed status in one window
3. Verify alert appears in both windows simultaneously

#### Test Ward Filtering
1. Login as ICU Manager
2. Trigger high occupancy in ICU ward
3. Verify alert shows in ICU Manager dashboard
4. Login as General Manager
5. Verify alert does NOT show (ward-specific filtering)

### Automated Testing Script
```bash
cd backend
node testOccupancyAlert.js
```

This will:
- Calculate current occupancy
- Update beds to exceed 90%
- Display final occupancy statistics
- Check for created alerts

**Note**: Direct DB updates won't trigger alerts. Use the API for actual alert creation.

## Socket.io Events Reference

### Emitted by Backend
| Event | Payload | Trigger |
|-------|---------|---------|
| `occupancyAlert` | `{ alert, ward, occupancyRate, occupiedBeds, totalBeds, timestamp }` | Occupancy exceeds 90% |
| `alertCreated` | `{ alert }` | Any alert created |
| `alertDismissed` | `{ alertId, timestamp }` | Alert marked as read |

### Listened by Frontend
| Event | Action |
|-------|--------|
| `occupancyAlert` | Add alert to Redux, show notification |
| `alertCreated` | Add alert to Redux |
| `alertDismissed` | Update alert in Redux |

## Configuration

### Environment Variables
No new environment variables required. Uses existing:
- `JWT_SECRET`: For socket authentication
- `MONGO_URI`: For database connection
- `PORT`: Backend server port (default: 5001)

### Browser Permissions
- Notification API permission required for browser alerts
- Automatically requested on Manager Dashboard load

## API Examples

### Get Alerts (Manager - ICU Ward)
```bash
GET /api/alerts
Authorization: Bearer <manager_jwt_token>

Response:
{
  "success": true,
  "count": 2,
  "data": {
    "alerts": [
      {
        "_id": "abc123",
        "type": "occupancy_high",
        "severity": "high",
        "message": "ICU ward occupancy at 92.5% (37/40 beds occupied)",
        "ward": "ICU",
        "targetRole": ["manager", "hospital_admin"],
        "read": false,
        "timestamp": "2025-11-12T10:30:00.000Z"
      }
    ]
  }
}
```

### Dismiss Alert
```bash
PATCH /api/alerts/abc123/dismiss
Authorization: Bearer <jwt_token>

Response:
{
  "success": true,
  "message": "Alert dismissed successfully",
  "data": {
    "alert": {
      "_id": "abc123",
      "read": true,
      ...
    }
  }
}
```

## Performance Considerations

1. **Duplicate Prevention**: Checks for existing alerts before creating new ones
2. **Indexed Queries**: Alert model has compound indexes on `{ targetRole, read, timestamp }`
3. **Ward-based Filtering**: Reduces unnecessary data transfer
4. **Socket Rooms**: Targeted broadcasts reduce network overhead

## Future Enhancements

1. **Alert Expiration**: Auto-dismiss alerts after occupancy drops below threshold
2. **Escalation**: Send email/SMS for critical alerts
3. **Alert History**: Dashboard to view dismissed alerts
4. **Custom Thresholds**: Allow admins to configure occupancy threshold per ward
5. **Alert Priorities**: Queue system for multiple simultaneous alerts

## Dependencies

No new dependencies required. Uses existing:
- `socket.io` (backend)
- `socket.io-client` (frontend)
- `mongoose` (backend)
- `@reduxjs/toolkit` (frontend)

## Troubleshooting

### Alerts not appearing
1. Check socket connection: Open browser console, look for "Socket connected" message
2. Verify JWT token is valid and not expired
3. Check user role is `manager` or `hospital_admin`
4. Verify ward assignment matches alert ward

### Browser notifications not showing
1. Check notification permission: `Notification.permission` should be "granted"
2. Check browser settings (notifications may be blocked)
3. Verify socket event is received (check console logs)

### Multiple duplicate alerts
1. Check alert deduplication logic in `checkOccupancyAndCreateAlerts()`
2. Verify `read: false` filter in alert query
3. Check for concurrent bed status updates

## Success Criteria ✅

- [x] Backend detects occupancy > 90%
- [x] Alerts created with correct severity
- [x] Socket.io events emitted on alert creation
- [x] Frontend subscribes to socket events
- [x] Alerts appear in real-time without page refresh
- [x] Ward-specific filtering works correctly
- [x] Alert dismissal updates all connected clients
- [x] Browser notifications shown (with permission)
- [x] No duplicate alerts created
- [x] API endpoints protected with authentication

## Task 2.2 Status: ✅ COMPLETE
