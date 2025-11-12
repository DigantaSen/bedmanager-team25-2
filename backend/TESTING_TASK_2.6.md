# Task 2.6: WebSocket Events - Testing Guide

## Overview
This guide covers testing all real-time Socket.io events implemented in Task 2.6, including ward-specific filtering, reconnection scenarios, and cross-component synchronization.

## Prerequisites
- Backend server running on port 5001
- Frontend server running on port 5173
- Database seeded with beds (use `node backend/seedBeds.js`)
- Multiple browser windows/tabs for testing real-time sync
- Browser console open for monitoring socket events

## Events Implemented

### 1. `bedStatusChanged` (replaces `bedUpdate`)
- **Emitted when:** Any bed status changes (available → occupied, occupied → maintenance, etc.)
- **Ward-specific:** Yes (emitted to `ward-{wardName}` room and globally)
- **Payload:**
  ```json
  {
    "bed": { /* bed object */ },
    "previousStatus": "available",
    "newStatus": "occupied",
    "timestamp": "2025-11-12T10:30:00.000Z"
  }
  ```

### 2. `bedMaintenanceNeeded`
- **Emitted when:** Bed is marked for maintenance
- **Ward-specific:** Yes (emitted to `ward-{wardName}` room)
- **Payload:**
  ```json
  {
    "bed": { /* bed object */ },
    "cleaningDuration": 45,
    "priority": "normal",
    "timestamp": "2025-11-12T10:30:00.000Z"
  }
  ```

### 3. `emergencyRequestCreated`
- **Emitted when:** ER staff creates a new emergency request
- **Ward-specific:** Yes (emitted to `ward-{wardName}` and `role-hospital_admin`)
- **Payload:**
  ```json
  {
    "request": { /* request object */ },
    "ward": "ICU",
    "timestamp": "2025-11-12T10:30:00.000Z"
  }
  ```

### 4. `emergencyRequestApproved`
- **Emitted when:** Manager approves emergency request
- **Ward-specific:** Yes (emitted to requesting ward)
- **Payload:**
  ```json
  {
    "request": { /* request object */ },
    "allocatedBed": { /* bed object */ },
    "timestamp": "2025-11-12T10:30:00.000Z"
  }
  ```

### 5. `emergencyRequestRejected`
- **Emitted when:** Manager rejects emergency request
- **Ward-specific:** Yes (emitted to requesting ward)
- **Payload:**
  ```json
  {
    "request": { /* request object */ },
    "rejectionReason": "No available beds",
    "timestamp": "2025-11-12T10:30:00.000Z"
  }
  ```

### 6. `occupancyAlert`
- **Emitted when:** Ward occupancy exceeds 90%
- **Ward-specific:** No (emitted globally to managers and admins)
- **Payload:**
  ```json
  {
    "alert": { /* alert object */ },
    "ward": "ICU",
    "occupancyRate": "92.5",
    "occupiedBeds": 23,
    "totalBeds": 24,
    "timestamp": "2025-11-12T10:30:00.000Z"
  }
  ```

### 7. Additional Events (from previous tasks)
- `bedCleaningStarted` - When maintenance starts
- `bedCleaningCompleted` - When maintenance ends
- `alertCreated` - General alert creation
- `alertDismissed` - Alert dismissal

---

## Test Scenarios

### Scenario 1: Ward-Specific Event Filtering

**Objective:** Verify managers only receive events for their assigned ward

**Setup:**
1. Open 3 browser windows
2. Login as:
   - Window 1: `mm@gmail.com` (ICU Manager)
   - Window 2: Manager for General ward (create if needed)
   - Window 3: `admin@example.com` (Hospital Admin)

**Test Steps:**

#### Step 1.1: Test ICU Bed Status Change
```bash
# In Postman or terminal
curl -X PATCH http://localhost:5001/api/beds/{ICU_BED_ID}/status \
  -H "Authorization: Bearer {ICU_MANAGER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "occupied",
    "patientName": "John Doe",
    "patientId": "P12345"
  }'
```

**Expected Results:**
- ✅ Window 1 (ICU Manager): Receives `bedStatusChanged` event, bed updates in real-time
- ❌ Window 2 (General Manager): Does NOT receive event (different ward)
- ✅ Window 3 (Admin): Receives event (global broadcast)

**Console Verification:**
```javascript
// Window 1 (ICU Manager) should show:
🛏️ Bed status changed: { bed: {...}, previousStatus: "available", newStatus: "occupied" }

// Window 2 (General Manager) should NOT show the event

// Window 3 (Admin) should show:
🛏️ Bed status changed: { bed: {...}, previousStatus: "available", newStatus: "occupied" }
```

#### Step 1.2: Test General Ward Bed Status Change
```bash
curl -X PATCH http://localhost:5001/api/beds/{GENERAL_BED_ID}/status \
  -H "Authorization: Bearer {GENERAL_MANAGER_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "occupied",
    "patientName": "Jane Smith"
  }'
```

**Expected Results:**
- ❌ Window 1 (ICU Manager): Does NOT receive event
- ✅ Window 2 (General Manager): Receives event, bed updates
- ✅ Window 3 (Admin): Receives event

---

### Scenario 2: Bed Maintenance Events

**Objective:** Test `bedMaintenanceNeeded` and cleaning lifecycle events

**Setup:**
- Login as ICU Manager (`mm@gmail.com`)
- Open browser console

**Test Steps:**

#### Step 2.1: Mark Bed for Maintenance
1. Navigate to Manager Dashboard
2. Click on an available bed
3. Change status to "Maintenance"
4. Set cleaning duration to 30 minutes
5. Click "Update Bed"

**Expected Events (Console):**
```javascript
// Event 1: bedStatusChanged
🛏️ Bed status changed: { bed: {...}, previousStatus: "available", newStatus: "maintenance" }

// Event 2: bedMaintenanceNeeded
🔧 Bed maintenance needed: { bed: {...}, cleaningDuration: 30, priority: "normal" }

// Event 3: bedCleaningStarted
🧹 Bed cleaning started: { bed: {...}, estimatedDuration: 30, estimatedEndTime: "..." }
```

**UI Verification:**
- ✅ Bed status badge changes to yellow "Maintenance"
- ✅ CleaningQueuePanel shows new bed with progress bar
- ✅ Progress bar starts at 0%, gradually increases
- ✅ Estimated end time displayed

#### Step 2.2: Complete Maintenance
1. Go to Cleaning Queue Panel
2. Click "Mark Complete" on the bed

**Expected Events (Console):**
```javascript
// Event 1: bedCleaningCompleted
✅ Bed cleaning completed: { bed: {...}, cleaningLog: { duration: 28, wasOverdue: false } }

// Event 2: bedStatusChanged
🛏️ Bed status changed: { bed: {...}, previousStatus: "maintenance", newStatus: "available" }
```

**UI Verification:**
- ✅ Bed removed from Cleaning Queue Panel
- ✅ Bed status badge changes to green "Available"
- ✅ Bed appears in available beds grid
- ✅ Browser notification: "Cleaning Completed"

---

### Scenario 3: Occupancy Alerts

**Objective:** Test high occupancy alert emission and ward-specific filtering

**Setup:**
- Login as ICU Manager
- ICU ward should have 24 beds (from seeding)

**Test Steps:**

#### Step 3.1: Trigger High Occupancy Alert
1. Occupy beds until > 90% occupancy
   - 24 beds × 90% = 21.6 beds
   - Need to occupy at least 22 beds

2. Use bulk update script:
```bash
# In a terminal
cd backend
node -e "
const mongoose = require('mongoose');
const Bed = require('./models/Bed');
require('dotenv').config();

mongoose.connect(process.env.MONGO_URI).then(async () => {
  const icuBeds = await Bed.find({ ward: 'ICU', status: 'available' }).limit(22);
  let count = 0;
  
  for (const bed of icuBeds) {
    bed.status = 'occupied';
    bed.patientName = \`Patient \${++count}\`;
    await bed.save();
  }
  
  console.log(\`Occupied \${count} ICU beds\`);
  process.exit(0);
});
"
```

**Expected Events (Console):**
```javascript
// After 22nd bed is occupied (>90%)
🚨 Occupancy alert received: {
  alert: {
    type: "occupancy_high",
    severity: "high",
    message: "ICU ward occupancy at 91.7% (22/24 beds occupied)",
    ward: "ICU"
  },
  occupancyRate: "91.7",
  occupiedBeds: 22,
  totalBeds: 24
}
```

**UI Verification:**
- ✅ Alert appears in AlertPanel
- ✅ Alert badge shows severity (yellow or red)
- ✅ Browser notification: "High Occupancy Alert"
- ✅ KPI Summary shows updated occupancy percentage

#### Step 3.2: Verify Ward Isolation
1. Open second browser window
2. Login as General Manager (different ward)

**Expected:**
- ❌ General Manager does NOT see ICU occupancy alert (different ward)
- ✅ ICU Manager continues to see alert

---

### Scenario 4: Emergency Request Workflow

**Objective:** Test emergency request creation, approval, and rejection events

**Setup:**
- Window 1: Login as ER Staff
- Window 2: Login as ICU Manager
- Window 3: Login as Hospital Admin

**Test Steps:**

#### Step 4.1: Create Emergency Request (ER Staff)
1. In Window 1 (ER Staff), navigate to Emergency Request Form
2. Fill in:
   - Ward: ICU
   - Reason: "Critical patient admission"
   - Priority: High
   - Location: "ER Room 3"
3. Submit request

**Expected Events:**

**Window 2 (ICU Manager) Console:**
```javascript
🚑 Emergency request created: {
  request: {
    _id: "...",
    ward: "ICU",
    reason: "Critical patient admission",
    priority: "high",
    status: "pending"
  }
}
```

**Browser Notification (Window 2):**
- ✅ "New Emergency Request: Critical patient admission - high priority"
- ✅ Notification requires interaction (doesn't auto-dismiss)

**Window 3 (Admin) Console:**
```javascript
🚑 Emergency request created: { request: {...} }
```

**UI Verification (Window 2):**
- ✅ Emergency Request Queue shows new request
- ✅ Request shows "High" priority badge (red)
- ✅ "Approve" and "Reject" buttons visible

#### Step 4.2: Approve Request (ICU Manager)
1. In Window 2, click "Approve" on the request
2. Select an available bed
3. Confirm approval

**Expected Events:**

**Window 1 (ER Staff) Console:**
```javascript
✅ Emergency request approved: {
  request: { _id: "...", status: "approved" },
  allocatedBed: { bedId: "ICU-001", ward: "ICU" }
}
```

**Browser Notification (Window 1):**
- ✅ "Emergency Request Approved: Bed ICU-001 in ICU"

**All Windows:**
- ✅ Bed status changes to "occupied"
- ✅ Request removed from queue or marked approved

#### Step 4.3: Reject Request
1. Create another emergency request
2. In Window 2, click "Reject"
3. Enter rejection reason: "No available beds currently"
4. Confirm rejection

**Expected Events (Window 1):**
```javascript
❌ Emergency request rejected: {
  request: { _id: "...", status: "rejected" },
  rejectionReason: "No available beds currently"
}
```

**Browser Notification (Window 1):**
- ✅ "Emergency Request Rejected: No available beds currently"

---

### Scenario 5: Reconnection Handling

**Objective:** Test automatic reconnection and data re-synchronization

**Setup:**
- Login as ICU Manager
- Open browser console

**Test Steps:**

#### Step 5.1: Simulate Network Disconnection
```javascript
// In browser console
const socket = window.socketService?.getSocket();
if (socket) {
  console.log('Disconnecting socket manually...');
  socket.disconnect();
}
```

**Expected Console Output:**
```javascript
🔌 Socket disconnected: io client disconnect
```

**UI Verification:**
- ✅ Connection status indicator shows disconnected (if implemented)
- ❌ Real-time updates stop arriving

#### Step 5.2: Reconnect
```javascript
// Wait 2-3 seconds, then reconnect
if (socket) {
  console.log('Reconnecting socket...');
  socket.connect();
}
```

**Expected Console Output:**
```javascript
✅ Socket connected: ABC123XYZ
🔄 Socket reconnected after 1 attempts
🔄 Re-syncing data after reconnection...
```

**UI Verification:**
- ✅ Bed data re-fetched automatically (fetchBeds dispatched)
- ✅ Dashboard shows latest bed statuses
- ✅ Real-time updates resume

#### Step 5.3: Test During Network Outage
1. Open DevTools → Network tab
2. Set throttling to "Offline"
3. Try to update a bed status
4. Set throttling back to "No throttling"

**Expected Behavior:**
- ⏳ Socket attempts reconnection (up to 10 times)
- ✅ Auto-reconnects when network restored
- ✅ Data re-synced after reconnection
- ✅ Console shows: "Socket reconnected after X attempts"

**Error Handling:**
```javascript
// If max reconnection attempts reached
❌ Max reconnection attempts reached. Please refresh the page.
```

---

### Scenario 6: Cross-Component Synchronization

**Objective:** Verify all dashboard components update simultaneously

**Setup:**
- Login as ICU Manager
- Ensure all dashboard panels visible:
  - BedStatusGrid
  - CleaningQueuePanel
  - EmergencyRequestQueue
  - AlertPanel
  - KPI Summary

**Test Steps:**

#### Step 6.1: Update Bed Status
1. Open a bed in BedUpdateModal
2. Change status from "available" to "occupied"
3. Add patient name and ID
4. Click "Update Bed"

**Real-time UI Updates (within 1 second):**
- ✅ BedStatusGrid: Bed badge changes to red "Occupied"
- ✅ KPI Summary: Occupied count increments
- ✅ KPI Summary: Available count decrements
- ✅ KPI Summary: Occupancy percentage updates

#### Step 6.2: Start Maintenance
1. Change occupied bed to "maintenance"
2. Set cleaning duration

**Real-time UI Updates:**
- ✅ BedStatusGrid: Bed badge changes to yellow "Maintenance"
- ✅ CleaningQueuePanel: New bed appears with progress bar
- ✅ KPI Summary: Maintenance count increments
- ✅ KPI Summary: Occupied count decrements

#### Step 6.3: Multiple Browser Tabs
1. Open 2 tabs with ICU Manager logged in
2. In Tab 1, update a bed status
3. Check Tab 2 (without refreshing)

**Expected:**
- ✅ Tab 2 shows updated bed status immediately
- ✅ All components in Tab 2 synchronized
- ✅ No page refresh needed

---

## Testing Checklist

### Backend Events
- [ ] `bedStatusChanged` emitted on all status updates
- [ ] `bedMaintenanceNeeded` emitted when maintenance starts
- [ ] `emergencyRequestCreated` emitted to correct ward
- [ ] `emergencyRequestApproved` emitted to requester
- [ ] `emergencyRequestRejected` emitted to requester
- [ ] `occupancyAlert` emitted at >90% occupancy
- [ ] `bedCleaningStarted` emitted with duration
- [ ] `bedCleaningCompleted` emitted with logs
- [ ] `alertDismissed` emitted on dismissal

### Ward-Specific Filtering
- [ ] ICU Manager receives only ICU ward events
- [ ] General Manager receives only General ward events
- [ ] Emergency Manager receives only Emergency ward events
- [ ] Hospital Admin receives all events (globally)
- [ ] Cross-ward events properly isolated

### Frontend Event Handlers
- [ ] `bedStatusChanged` updates Redux store
- [ ] `bedMaintenanceNeeded` shows notification
- [ ] `emergencyRequestCreated` shows notification
- [ ] `emergencyRequestApproved` shows success notification
- [ ] `emergencyRequestRejected` shows error notification
- [ ] `occupancyAlert` adds alert to AlertPanel
- [ ] `alertDismissed` removes alert from UI

### Reconnection Scenarios
- [ ] Auto-reconnect after disconnect
- [ ] Data re-sync after reconnection (fetchBeds called)
- [ ] Max reconnection attempts respected (10)
- [ ] Reconnection delay increments properly
- [ ] UI shows connection status
- [ ] No duplicate event handlers after reconnect

### Cross-Component Sync
- [ ] BedStatusGrid updates in real-time
- [ ] CleaningQueuePanel updates in real-time
- [ ] EmergencyRequestQueue updates in real-time
- [ ] AlertPanel updates in real-time
- [ ] KPI Summary updates in real-time
- [ ] Multiple tabs synchronized

### Browser Notifications
- [ ] Notifications requested on first load
- [ ] High occupancy alerts show notification
- [ ] Emergency requests show notification
- [ ] Maintenance alerts show notification
- [ ] Notifications properly tagged (no duplicates)

---

## Troubleshooting

### Issue: Events not received in frontend

**Check:**
1. Socket connected?
   ```javascript
   // Browser console
   window.socketService?.isSocketConnected()
   ```

2. JWT token valid?
   ```javascript
   localStorage.getItem('token')
   ```

3. User joined correct room?
   ```javascript
   // Backend logs should show:
   ✅ User mm@gmail.com joined ward room: ward-ICU
   ```

4. Event listener registered?
   ```javascript
   // Check frontend console for:
   ✅ Socket connected: ABC123XYZ
   ```

### Issue: Manager receives events from wrong ward

**Check:**
1. User's ward assignment in database:
   ```javascript
   // In MongoDB or backend logs
   User: mm@gmail.com, Ward: ICU
   ```

2. Room join logic in socketHandler.js:
   ```javascript
   socket.join(`ward-${socket.user.ward}`);
   ```

3. Event emission uses correct room:
   ```javascript
   req.io.to(`ward-${bed.ward}`).emit('bedStatusChanged', {...});
   ```

### Issue: Reconnection fails

**Check:**
1. Reconnection config:
   ```javascript
   // frontend/src/services/socketService.js
   reconnection: true,
   reconnectionAttempts: 10,
   reconnectionDelay: 1000,
   ```

2. Token still valid after reconnect?
   - JWT might have expired during disconnection
   - User needs to re-login if token expired

3. Backend accepts reconnection?
   - Check backend logs for authentication errors

---

## Performance Considerations

### Event Throttling
- Rapid bed updates (< 100ms apart) may need throttling
- Consider debouncing progress bar updates in CleaningQueuePanel

### Memory Leaks
- Always remove event listeners on component unmount:
  ```javascript
  useEffect(() => {
    return () => {
      disconnectSocket();
    };
  }, []);
  ```

### Network Optimization
- Socket.io automatically batches events
- Prefer websocket transport over polling
- Monitor network tab for excessive reconnections

---

## Success Criteria

Task 2.6 is complete when:

1. ✅ All 5 required events implemented and emitting correctly
2. ✅ Ward-specific filtering works for all manager roles
3. ✅ Frontend handlers update Redux store and UI
4. ✅ Reconnection logic works with data re-sync
5. ✅ Multiple browser tabs stay synchronized
6. ✅ No console errors during normal operation
7. ✅ All components update in real-time (<1 second delay)
8. ✅ Browser notifications work for critical events
9. ✅ Testing checklist 100% complete
10. ✅ Documentation complete with examples

---

## Next Steps After Testing

1. **Code Review:** Team review of socket event structure
2. **Performance Testing:** Load test with 100+ concurrent users
3. **Security Audit:** Verify JWT authentication on all events
4. **Documentation:** Update API docs with event schemas
5. **Integration Testing:** Full workflow testing (Task 6.1)

---

## Appendix: Event Payload Reference

### Complete Event Schemas

```typescript
// bedStatusChanged
{
  bed: Bed,
  previousStatus: 'available' | 'occupied' | 'maintenance' | 'reserved',
  newStatus: 'available' | 'occupied' | 'maintenance' | 'reserved',
  timestamp: Date
}

// bedMaintenanceNeeded
{
  bed: Bed,
  cleaningDuration: number, // minutes
  priority: 'normal' | 'urgent',
  timestamp: Date
}

// emergencyRequestCreated
{
  request: EmergencyRequest,
  ward: string,
  timestamp: Date
}

// emergencyRequestApproved
{
  request: EmergencyRequest,
  allocatedBed: Bed | null,
  timestamp: Date
}

// emergencyRequestRejected
{
  request: EmergencyRequest,
  rejectionReason: string,
  timestamp: Date
}

// occupancyAlert
{
  alert: Alert,
  ward: string,
  occupancyRate: string, // percentage
  occupiedBeds: number,
  totalBeds: number,
  timestamp: Date
}
```

---

## End of Testing Guide
