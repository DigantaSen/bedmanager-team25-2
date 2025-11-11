# Testing Guide: Task 2.2 - Real-time Alert System

## Prerequisites
✅ Backend running on port 5001  
✅ Frontend running on port 5173  
✅ MongoDB connected  
✅ Database seeded with beds (run `node backend/seedBeds.js` if needed)

## Important Notes

### Dependencies
**Task 2.2 has NO blocking dependencies!** ✅ You can test it independently.

**However, to fully test the alert system, you need:**
- Task 1.1 ✅ (User model with ward) - COMPLETE
- Task 1.3 ✅ (Alert model) - COMPLETE  
- Task 2.1 ✅ (Manager Dashboard) - COMPLETE

**What you CANNOT do yet:**
❌ **Bed booking/allocation from Manager Dashboard** - This is Task 2.5c (Diganta's task)
- The "Edit Details" button in BedDetailsModal is a placeholder
- Managers can only VIEW beds, not update them yet
- Bed status updates must be done via API or Ward Staff Dashboard (Task 4.1 - not yet implemented)

## How to Test Task 2.2

### Test 1: Manual Bed Status Update via API (Postman/curl)

This is the ONLY way to update beds and trigger alerts right now since:
- Manager edit functionality (Task 2.5c) is not implemented
- Ward Staff Dashboard (Task 4.1) is not implemented

#### Step 1: Get your JWT token
1. Login at http://localhost:5173
2. Open browser DevTools → Application → Local Storage
3. Copy the value of `token`

#### Step 2: Get bed IDs
```bash
GET http://localhost:5001/api/beds?ward=ICU
```

Or in Postman:
- Method: GET
- URL: `http://localhost:5001/api/beds?ward=ICU`
- Headers: `Authorization: Bearer YOUR_JWT_TOKEN`

#### Step 3: Update multiple beds to occupied
```bash
PATCH http://localhost:5001/api/beds/:bedId/status
Headers: 
  Authorization: Bearer YOUR_JWT_TOKEN
  Content-Type: application/json
Body:
{
  "status": "occupied",
  "patientName": "Test Patient 1",
  "patientId": "TEST-001"
}
```

**Repeat this for 90%+ of ICU beds to trigger the alert!**

Example with curl:
```bash
# Get your token first
TOKEN="your_jwt_token_here"

# Update bed 1
curl -X PATCH http://localhost:5001/api/beds/BED-ICU-001/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"occupied","patientName":"Patient 1","patientId":"P001"}'

# Update bed 2
curl -X PATCH http://localhost:5001/api/beds/BED-ICU-002/status \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"status":"occupied","patientName":"Patient 2","patientId":"P002"}'

# Continue until you reach 90%+ occupancy...
```

#### Step 4: Watch the Manager Dashboard
1. Go to http://localhost:5173/manager/dashboard
2. Watch the "Alerts & Notifications" panel
3. You should see a new alert appear in real-time!
4. Check your browser notifications (if permission granted)

### Test 2: Automated Script

Use the test script I created:

```bash
cd backend
node testOccupancyAlert.js
```

**Note:** This script only sets up the beds but won't trigger alerts because alerts are only created via API calls. After running it, use the API to update one more bed.

### Test 3: Real-time Socket Events

#### Step 1: Open Browser Console
1. Go to Manager Dashboard
2. Open DevTools → Console
3. Look for socket connection messages:
   ```
   ✅ Socket connected: xxxxx
   ```

#### Step 2: Update a bed via API
Use Postman/curl to update a bed status

#### Step 3: Watch Console
You should see:
```javascript
🚨 Occupancy alert received: {
  alert: { ... },
  ward: "ICU",
  occupancyRate: "92.5",
  occupiedBeds: 37,
  totalBeds: 40,
  timestamp: "..."
}
```

#### Step 4: Verify UI Updates
- Alert appears in AlertNotificationPanel automatically
- No page refresh needed
- Red badge shows alert count

### Test 4: Multi-User Real-time Sync

#### Step 1: Open two browser windows
- Window 1: http://localhost:5173/manager/dashboard
- Window 2: http://localhost:5173/manager/dashboard (incognito or different browser)

#### Step 2: Login as manager in both windows

#### Step 3: Update bed via API or third window

#### Step 4: Verify both dashboards receive alert simultaneously

### Test 5: Alert Dismissal

#### Step 1: Click the X button on an alert
In the Manager Dashboard, click the X icon on any alert

#### Step 2: Watch backend logs
```
✅ alertDismissed event emitted via socket.io
```

#### Step 3: Check if alert is marked as read
The alert should disappear or change appearance

### Test 6: Ward Filtering

#### Step 1: Login as ICU Manager
- User must have `role: "manager"` and `ward: "ICU"`

#### Step 2: Trigger ICU high occupancy
Update ICU beds to 90%+ via API

#### Step 3: Verify ICU alert shows

#### Step 4: Login as General Manager (different browser/incognito)
- User must have `role: "manager"` and `ward: "General"`

#### Step 5: Verify ICU alert does NOT show
General Manager should only see General ward alerts

## Expected Results

### When Occupancy > 90%

✅ **Backend Console:**
```
📊 ICU occupancy: 92.5% (37/40)
🚨 Alert created: ICU occupancy high (92.5%)
✅ occupancyAlert event emitted via socket.io
```

✅ **Frontend Console:**
```
🚨 Occupancy alert received: { alert: {...}, ward: "ICU", ... }
```

✅ **Manager Dashboard:**
- New alert appears in "Alerts & Notifications" panel
- Red badge shows count
- Alert shows severity icon (⚠️ for high, 🔴 for critical)
- Browser notification (if permission granted)

✅ **Database:**
```javascript
// New Alert document created
{
  type: "occupancy_high",
  severity: "high" | "critical",
  message: "ICU ward occupancy at 92.5% (37/40 beds occupied)",
  ward: "ICU",
  targetRole: ["manager", "hospital_admin"],
  read: false,
  timestamp: Date
}
```

## Troubleshooting

### Problem: No alerts appearing

**Check 1: Is occupancy actually > 90%?**
```bash
# Count ICU beds
GET http://localhost:5001/api/beds?ward=ICU

# Check how many are occupied
# If you have 40 beds, you need 37+ occupied (92.5%)
```

**Check 2: Is socket connected?**
- Open browser console
- Look for "✅ Socket connected" message
- If not connected, check JWT token validity

**Check 3: Backend logs**
- Check backend terminal for:
  ```
  📊 ICU occupancy: XX%
  ```
- If occupancy is calculated but no alert, check for existing unread alert:
  ```
  ℹ️ Alert already exists for ICU ward high occupancy
  ```

**Check 4: User role and ward**
- Manager must have correct ward assignment
- Check: `localStorage.getItem('token')` → decode JWT → check `ward` field

### Problem: Alerts created but not appearing in UI

**Check 1: Redux state**
Open Redux DevTools and check `alerts` state

**Check 2: Alert filtering**
Alerts are filtered by ward. If you're ICU Manager, you won't see General ward alerts.

**Check 3: API response**
```bash
GET http://localhost:5001/api/alerts
Authorization: Bearer YOUR_TOKEN
```
Check if alerts are in the response

### Problem: Cannot update bed status

**This is EXPECTED!** ✅

Bed booking/editing from Manager Dashboard is **Task 2.5c** (not implemented yet).

**Workarounds:**
1. Use Postman/curl to call API directly
2. Wait for Task 4.1 (Ward Staff Dashboard) - allows bed updates
3. Wait for Task 2.5c (Bed editing for managers)

### Problem: Browser notifications not showing

**Check 1: Permission**
```javascript
// In browser console
console.log(Notification.permission);
// Should be "granted"
```

**Check 2: Request permission**
The Manager Dashboard requests permission on mount, but you can manually trigger:
```javascript
Notification.requestPermission();
```

**Check 3: Browser settings**
Some browsers block notifications. Check browser settings.

## What Works Now vs. What Doesn't

### ✅ What Works (Task 2.2)
- Occupancy monitoring (automatic on bed status change)
- Alert creation when occupancy > 90%
- Socket.io real-time event emission
- Frontend receives alerts in real-time
- Alerts appear in Manager Dashboard instantly
- Alert dismissal functionality
- Ward-based filtering
- Browser notifications
- Multi-user sync

### ❌ What Doesn't Work Yet (Future Tasks)
- **Bed booking from Manager UI** (Task 2.5c - Diganta)
- **Emergency request approval** (Task 2.3 - Nilkanta)
- **Ward Staff bed updates** (Task 4.1 - Diganta)
- **Forecasting data** (Task 2.4 - Shubham - your next task!)
- **Cleaning tracking** (Task 2.5b - Surjit)

## Testing Checklist

Use this checklist to verify Task 2.2:

- [ ] Backend starts without errors on port 5001
- [ ] Frontend connects to socket successfully
- [ ] Can login as manager with ICU ward
- [ ] Manager Dashboard displays correctly
- [ ] Can fetch beds via API
- [ ] Can update bed status via API (Postman/curl)
- [ ] Backend calculates occupancy after bed update
- [ ] Alert created when occupancy > 90%
- [ ] `occupancyAlert` socket event emitted
- [ ] Frontend receives socket event
- [ ] Alert appears in UI without refresh
- [ ] Alert shows correct severity (high/critical)
- [ ] Alert shows correct occupancy percentage
- [ ] Browser notification appears (if permission granted)
- [ ] Can dismiss alert by clicking X
- [ ] `alertDismissed` event emitted
- [ ] Alert marked as read in database
- [ ] Ward filtering works (ICU manager only sees ICU alerts)
- [ ] Multi-user real-time sync works
- [ ] No duplicate alerts created
- [ ] No console errors

## Quick Test Script

Here's a quick bash script to test the full flow:

```bash
#!/bin/bash

# Set your JWT token here
TOKEN="your_jwt_token_here"
BASE_URL="http://localhost:5001/api"

echo "🧪 Testing Task 2.2: Real-time Alert System"
echo "=========================================="

# Get ICU beds
echo -e "\n📋 Step 1: Getting ICU beds..."
BEDS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/beds?ward=ICU")
echo "Beds retrieved: $(echo $BEDS | jq '.count')"

# Update first 37 beds to occupied (for 40 bed ward = 92.5%)
echo -e "\n🛏️  Step 2: Updating beds to occupied..."
for i in {1..37}; do
  BED_ID="BED-ICU-$(printf "%03d" $i)"
  echo "  Updating $BED_ID..."
  curl -s -X PATCH \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"status\":\"occupied\",\"patientName\":\"Patient $i\",\"patientId\":\"P$(printf "%03d" $i)\"}" \
    "$BASE_URL/beds/$BED_ID/status" > /dev/null
done

echo -e "\n🚨 Step 3: Checking for alerts..."
ALERTS=$(curl -s -H "Authorization: Bearer $TOKEN" "$BASE_URL/alerts")
echo "Alerts found: $(echo $ALERTS | jq '.count')"
echo "$ALERTS" | jq '.data.alerts[0].message'

echo -e "\n✅ Test complete! Check Manager Dashboard for real-time alert."
```

Save as `test-task-2.2.sh`, make executable with `chmod +x test-task-2.2.sh`, then run!

## Summary

Task 2.2 is **fully functional** but requires API calls to update beds since the UI editing features are in future tasks. This is by design - the task distribution separates concerns:

- **Task 2.2 (Complete)**: Alert detection & real-time broadcasting
- **Task 2.5c (Future)**: Manager UI for bed editing  
- **Task 4.1 (Future)**: Ward Staff UI for bed updates

For now, use Postman/curl to test the alert system! 🚀
