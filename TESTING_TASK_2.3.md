# Testing Guide: Task 2.3 - Emergency Request Management Workflow

## Changes Summary

### Backend Changes:
1. **EmergencyRequest Model** - Added `ward`, `priority`, and `reason` fields
2. **EmergencyRequest Controller** - Enhanced with ward filtering and approve/reject endpoints
3. **Routes** - Added approve/reject routes with authentication

### Frontend Changes:
1. **requestsSlice** - Added `approveRequest` and `rejectRequest` actions
2. **EmergencyRequestsQueue** - Added functional approve/reject buttons

## Prerequisites
✅ Backend running on port 5001  
✅ Frontend running on port 5173  
✅ MongoDB connected  
✅ At least 2 users: 1 Manager (ICU ward) + 1 ER Staff or Admin

## How to Test Task 2.3

### Test 1: Create Emergency Request (ER Staff / Admin)

#### Via Postman/curl:

```bash
POST http://localhost:5001/api/emergency-requests
Headers:
  Authorization: Bearer YOUR_JWT_TOKEN
  Content-Type: application/json
Body:
{
  "patientId": "67336d10fbadfa0e5f6ff7e7",
  "location": "Emergency Room - Bed 5",
  "ward": "ICU",
  "priority": "high",
  "reason": "Patient requires immediate ICU care - respiratory distress",
  "description": "COVID-19 positive patient with severe breathing issues"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Emergency request created successfully",
  "data": {
    "emergencyRequest": {
      "_id": "...",
      "patientId": "...",
      "location": "Emergency Room - Bed 5",
      "ward": "ICU",
      "priority": "high",
      "status": "pending",
      "createdAt": "..."
    }
  }
}
```

**Expected Backend Console:**
```
✅ Socket event emitted: emergencyRequestCreated to ward-ICU
```

### Test 2: Manager Views Emergency Requests (Ward-Filtered)

#### Via Postman/curl:

```bash
GET http://localhost:5001/api/emergency-requests
Headers:
  Authorization: Bearer MANAGER_JWT_TOKEN
```

**Expected Behavior:**
- ICU Manager only sees ICU ward requests
- General Manager only sees General ward requests
- Hospital Admin sees ALL requests

**Expected Response:**
```json
{
  "success": true,
  "count": 2,
  "data": {
    "emergencyRequests": [
      {
        "_id": "...",
        "location": "Emergency Room - Bed 5",
        "ward": "ICU",
        "priority": "high",
        "status": "pending",
        ...
      }
    ]
  }
}
```

### Test 3: Manager Approves Request

#### Via Manager Dashboard UI:
1. Login as ICU Manager
2. Go to Manager Dashboard
3. Find "Emergency Requests" panel
4. Click **Approve** button on a pending request
5. Confirm the action

#### Via Postman/curl:

```bash
PATCH http://localhost:5001/api/emergency-requests/:id/approve
Headers:
  Authorization: Bearer MANAGER_JWT_TOKEN
  Content-Type: application/json
Body:
{
  "bedId": "BED-ICU-001"  // Optional
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Emergency request approved successfully",
  "data": {
    "emergencyRequest": {
      "_id": "...",
      "status": "approved",
      ...
    },
    "bedId": "BED-ICU-001"
  }
}
```

**Expected Backend Console:**
```
✅ Socket event emitted: emergencyRequestApproved for ward-ICU
```

**Expected UI Update:**
- Request status changes to "approved"
- Green checkmark icon appears
- Approve/Reject buttons disappear
- Alert message: "Emergency request approved successfully!"

### Test 4: Manager Rejects Request

#### Via Manager Dashboard UI:
1. Login as ICU Manager
2. Find a pending emergency request
3. Click **Reject** button
4. Enter rejection reason (optional)
5. Confirm

#### Via Postman/curl:

```bash
PATCH http://localhost:5001/api/emergency-requests/:id/reject
Headers:
  Authorization: Bearer MANAGER_JWT_TOKEN
  Content-Type: application/json
Body:
{
  "rejectionReason": "No available ICU beds at this time"
}
```

**Expected Response:**
```json
{
  "success": true,
  "message": "Emergency request rejected successfully",
  "data": {
    "emergencyRequest": {
      "_id": "...",
      "status": "rejected",
      ...
    }
  }
}
```

**Expected Backend Console:**
```
✅ Socket event emitted: emergencyRequestRejected for ward-ICU
```

### Test 5: Ward Authorization (Security Test)

#### Test: ICU Manager tries to approve General ward request

```bash
# Create a General ward request first
POST http://localhost:5001/api/emergency-requests
Body:
{
  "patientId": "...",
  "location": "...",
  "ward": "General",
  "priority": "high"
}

# Try to approve with ICU Manager token
PATCH http://localhost:5001/api/emergency-requests/:generalRequestId/approve
Headers:
  Authorization: Bearer ICU_MANAGER_TOKEN
```

**Expected Response (403 Forbidden):**
```json
{
  "success": false,
  "message": "Not authorized: You can only approve requests for ICU ward"
}
```

**This should FAIL** - proving ward-based authorization works! ✅

### Test 6: Real-time Socket Events

#### Setup:
1. Open two browser windows
2. Window 1: Login as ICU Manager
3. Window 2: Login as ER Staff or Admin

#### Steps:
1. In Window 2 (ER Staff): Create an ICU emergency request via Postman
2. In Window 1 (ICU Manager): Watch the "Emergency Requests" panel

**Expected:**
- New request appears in Manager Dashboard WITHOUT refresh
- Real-time update via Socket.io

#### Approval Test:
1. In Window 1 (ICU Manager): Click Approve
2. Check backend console for socket event

**Expected:**
- Socket event emitted: `emergencyRequestApproved`
- Status updates in real-time

### Test 7: Filter by Status

```bash
GET http://localhost:5001/api/emergency-requests?status=pending
Headers:
  Authorization: Bearer MANAGER_TOKEN
```

**Expected:**
- Only returns pending requests
- Combined with ward filter for managers

### Test 8: Cannot Re-approve/Re-reject

#### Try to approve an already approved request:

```bash
PATCH http://localhost:5001/api/emergency-requests/:approvedId/approve
Headers:
  Authorization: Bearer MANAGER_TOKEN
```

**Expected Response (400 Bad Request):**
```json
{
  "success": false,
  "message": "Request is already approved"
}
```

## Expected Results Summary

### Backend Console Logs:
```
✅ Socket event emitted: emergencyRequestCreated to ward-ICU
✅ Socket event emitted: emergencyRequestApproved for ward-ICU
✅ Socket event emitted: emergencyRequestRejected for ward-ICU
```

### Manager Dashboard UI:
- Emergency Requests panel shows ward-filtered requests
- Pending requests have Approve/Reject buttons
- Approved requests show green checkmark
- Rejected requests show red X
- Buttons disabled during processing
- Real-time updates without page refresh

### Database:
```javascript
// Emergency Request Document
{
  _id: ObjectId("..."),
  patientId: ObjectId("..."),
  location: "Emergency Room - Bed 5",
  ward: "ICU",
  priority: "high",
  reason: "Patient requires immediate ICU care",
  status: "pending" | "approved" | "rejected",
  description: "...",
  createdAt: Date,
  updatedAt: Date
}
```

## Troubleshooting

### Issue: "Not authorized" error

**Check:**
1. Is the user a manager?
2. Does the manager's ward match the request's ward?
3. Is the JWT token valid?

**Solution:**
```javascript
// Check user in localStorage
const token = localStorage.getItem('token');
const decoded = jwt_decode(token);
console.log('User role:', decoded.role);
console.log('User ward:', decoded.ward);
```

### Issue: Request not appearing in Manager Dashboard

**Check:**
1. Does request ward match manager ward?
2. Is socket connected? Check browser console for "Socket connected"
3. Are requests being filtered correctly?

**Debug:**
```javascript
// In browser console
console.log('Requests:', store.getState().requests);
console.log('Current User:', store.getState().auth.user);
```

### Issue: Buttons not working

**Check:**
1. Is `processingId` state blocking?
2. Check browser console for errors
3. Verify API endpoints return correct data structure

**Expected Redux action response:**
```javascript
// For approveRequest.fulfilled
action.payload = { 
  _id: "...",
  status: "approved",
  ...
}
```

### Issue: Socket events not received

**Check:**
1. Backend socket.io emitting to correct rooms
2. Frontend socket connected and listening
3. User joined correct ward room

**Backend check:**
```javascript
// In socketHandler.js
console.log('User joined room:', `ward-${socket.user.ward}`);
```

## API Endpoints Reference

| Method | Endpoint | Access | Description |
|--------|----------|--------|-------------|
| POST | `/api/emergency-requests` | ER Staff, Admin | Create new request |
| GET | `/api/emergency-requests` | All (ward-filtered) | Get all requests |
| GET | `/api/emergency-requests/:id` | All | Get single request |
| PATCH | `/api/emergency-requests/:id/approve` | Manager (ward-specific) | Approve request |
| PATCH | `/api/emergency-requests/:id/reject` | Manager (ward-specific) | Reject request |
| PUT | `/api/emergency-requests/:id` | All | Update request |
| DELETE | `/api/emergency-requests/:id` | All | Delete request |

## Socket Events

| Event | Trigger | Payload | Room |
|-------|---------|---------|------|
| `emergencyRequestCreated` | New request created | `{ requestId, ward, priority, ... }` | `ward-{wardName}`, `role-hospital_admin` |
| `emergencyRequestApproved` | Manager approves | `{ requestId, status, approvedBy, ... }` | `ward-{wardName}`, broadcast |
| `emergencyRequestRejected` | Manager rejects | `{ requestId, status, rejectedBy, ... }` | `ward-{wardName}`, broadcast |

## Success Criteria Checklist

- [ ] ER Staff can create emergency requests via API
- [ ] Requests include ward, priority, and reason fields
- [ ] Managers see only their ward's requests
- [ ] Hospital Admin sees all requests
- [ ] Managers can approve pending requests
- [ ] Managers can reject pending requests
- [ ] Ward authorization enforced (manager can't approve other ward's requests)
- [ ] Cannot re-approve/re-reject already processed requests
- [ ] Socket.io events emitted on create/approve/reject
- [ ] Frontend receives real-time updates
- [ ] UI buttons functional with loading states
- [ ] Approved/rejected requests show correct status icons
- [ ] No errors in browser console or backend logs

## Quick Test Script

```bash
#!/bin/bash

# Set tokens
MANAGER_TOKEN="your_icu_manager_token"
ER_TOKEN="your_er_staff_token"
BASE_URL="http://localhost:5001/api"

echo "🧪 Testing Task 2.3: Emergency Request Management"
echo "================================================"

# Create request
echo -e "\n📝 Step 1: Creating emergency request..."
REQUEST_ID=$(curl -s -X POST \
  -H "Authorization: Bearer $ER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "patientId":"67336d10fbadfa0e5f6ff7e7",
    "location":"ER-5",
    "ward":"ICU",
    "priority":"high",
    "reason":"Respiratory distress"
  }' \
  "$BASE_URL/emergency-requests" | jq -r '.data.emergencyRequest._id')

echo "Created request ID: $REQUEST_ID"

# Get requests
echo -e "\n📋 Step 2: Fetching requests as manager..."
curl -s -H "Authorization: Bearer $MANAGER_TOKEN" \
  "$BASE_URL/emergency-requests" | jq '.data.emergencyRequests | length'

# Approve request
echo -e "\n✅ Step 3: Approving request..."
curl -s -X PATCH \
  -H "Authorization: Bearer $MANAGER_TOKEN" \
  -H "Content-Type: application/json" \
  "$BASE_URL/emergency-requests/$REQUEST_ID/approve" | jq '.message'

echo -e "\n✅ Test complete!"
```

## Task 2.3 Status: ✅ COMPLETE

All deliverables implemented:
- ✅ POST /api/emergency-requests (with ward, priority, reason)
- ✅ GET /api/emergency-requests (ward-filtered for managers)
- ✅ PATCH /api/emergency-requests/:id/approve (ward authorization)
- ✅ PATCH /api/emergency-requests/:id/reject (ward authorization)
- ✅ Socket.io events for real-time notifications
- ✅ Frontend approve/reject functionality
- ✅ Ward-based access control enforced
