# Task 1.2: EmergencyRequest Model - Testing Guide

## ✅ Implementation Summary

### Files Created
1. ✅ `models/EmergencyRequest.js` - Mongoose model
2. ✅ `controllers/emergencyRequestController.js` - CRUD operations
3. ✅ `routes/emergencyRequestRoutes.js` - REST API routes

### Files Modified
1. ✅ `server.js` - Added route registration
2. ✅ `models/index.js` - Added EmergencyRequest export

---

## 📋 Model Schema

```javascript
EmergencyRequest {
  patientId: ObjectId (ref: "User", required)
  location: String (required)
  status: String (enum: ["pending", "approved", "rejected"], default: "pending")
  description: String (optional)
  createdAt: Date (auto-generated)
  updatedAt: Date (auto-generated)
}
```

### Indexes
- Single index on `status`
- Single index on `patientId`
- Compound index on `status + createdAt` (descending)

---

## 🔌 API Endpoints

### 1. Create Emergency Request
**POST** `/api/emergency-requests`

**Request Body:**
```json
{
  "patientId": "507f1f77bcf86cd799439011",
  "location": "Emergency Room - Bay 3",
  "description": "Patient requires immediate ICU admission"
}
```

**Response (201):**
```json
{
  "success": true,
  "message": "Emergency request created successfully",
  "data": {
    "emergencyRequest": {
      "_id": "...",
      "patientId": "507f1f77bcf86cd799439011",
      "location": "Emergency Room - Bay 3",
      "status": "pending",
      "description": "Patient requires immediate ICU admission",
      "createdAt": "2025-11-11T...",
      "updatedAt": "2025-11-11T..."
    }
  }
}
```

**Socket.io Event Emitted:** `emergencyRequestCreated`

---

### 2. Get All Emergency Requests
**GET** `/api/emergency-requests`

**Query Parameters:**
- `status` (optional): Filter by status (pending, approved, rejected)

**Example:** `GET /api/emergency-requests?status=pending`

**Response (200):**
```json
{
  "success": true,
  "count": 2,
  "data": {
    "emergencyRequests": [
      {
        "_id": "...",
        "patientId": {
          "_id": "...",
          "name": "John Doe",
          "email": "john@example.com"
        },
        "location": "Emergency Room - Bay 3",
        "status": "pending",
        "description": "...",
        "createdAt": "2025-11-11T...",
        "updatedAt": "2025-11-11T..."
      }
    ]
  }
}
```

---

### 3. Get Single Emergency Request
**GET** `/api/emergency-requests/:id`

**Response (200):**
```json
{
  "success": true,
  "data": {
    "emergencyRequest": {
      "_id": "...",
      "patientId": {
        "_id": "...",
        "name": "John Doe",
        "email": "john@example.com"
      },
      "location": "Emergency Room - Bay 3",
      "status": "pending",
      "description": "...",
      "createdAt": "2025-11-11T...",
      "updatedAt": "2025-11-11T..."
    }
  }
}
```

---

### 4. Update Emergency Request
**PUT** `/api/emergency-requests/:id`

**Request Body:**
```json
{
  "status": "approved",
  "location": "ICU - Bed A5",
  "description": "Patient moved to ICU"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Emergency request updated successfully",
  "data": {
    "emergencyRequest": {
      "_id": "...",
      "patientId": {...},
      "location": "ICU - Bed A5",
      "status": "approved",
      "description": "Patient moved to ICU",
      "createdAt": "2025-11-11T...",
      "updatedAt": "2025-11-11T..."
    }
  }
}
```

**Socket.io Events:**
- Status changed to `approved` → Emits `emergencyRequestApproved`
- Status changed to `rejected` → Emits `emergencyRequestRejected`

---

### 5. Delete Emergency Request
**DELETE** `/api/emergency-requests/:id`

**Response (200):**
```json
{
  "success": true,
  "message": "Emergency request deleted successfully",
  "data": {
    "emergencyRequest": {...}
  }
}
```

---

## 🔥 Socket.io Events

### Event: `emergencyRequestCreated`
**Emitted when:** New emergency request is created

**Payload:**
```json
{
  "requestId": "507f1f77bcf86cd799439011",
  "patientId": "507f191e810c19729de860ea",
  "location": "Emergency Room - Bay 3",
  "status": "pending",
  "createdAt": "2025-11-11T..."
}
```

---

### Event: `emergencyRequestApproved`
**Emitted when:** Request status is updated to "approved"

**Payload:**
```json
{
  "requestId": "507f1f77bcf86cd799439011",
  "patientId": {...},
  "location": "ICU - Bed A5",
  "status": "approved",
  "updatedAt": "2025-11-11T..."
}
```

---

### Event: `emergencyRequestRejected`
**Emitted when:** Request status is updated to "rejected"

**Payload:**
```json
{
  "requestId": "507f1f77bcf86cd799439011",
  "patientId": {...},
  "location": "Emergency Room - Bay 3",
  "status": "rejected",
  "updatedAt": "2025-11-11T..."
}
```

---

## 🧪 Testing with cURL

### 1. Create Emergency Request
```bash
curl -X POST http://localhost:5000/api/emergency-requests \
  -H "Content-Type: application/json" \
  -d '{
    "patientId": "673199c90195bb2bb0a57aa6",
    "location": "Emergency Room - Bay 3",
    "description": "Patient requires immediate ICU admission"
  }'
```

### 2. Get All Requests
```bash
curl http://localhost:5000/api/emergency-requests
```

### 3. Get All Pending Requests
```bash
curl http://localhost:5000/api/emergency-requests?status=pending
```

### 4. Get Single Request
```bash
curl http://localhost:5000/api/emergency-requests/{REQUEST_ID}
```

### 5. Update Request Status to Approved
```bash
curl -X PUT http://localhost:5000/api/emergency-requests/{REQUEST_ID} \
  -H "Content-Type: application/json" \
  -d '{
    "status": "approved"
  }'
```

### 6. Delete Request
```bash
curl -X DELETE http://localhost:5000/api/emergency-requests/{REQUEST_ID}
```

---

## 🧪 Testing with Postman

### Collection Setup

1. **Base URL:** `http://localhost:5000`
2. **Content-Type Header:** `application/json`

### Test Sequence

1. ✅ Create a test user (to get a valid patientId)
2. ✅ Create emergency request with user's ID
3. ✅ Get all emergency requests
4. ✅ Filter by status (pending)
5. ✅ Get single request by ID
6. ✅ Update status to "approved"
7. ✅ Verify Socket.io event received (use Socket.io client)
8. ✅ Delete emergency request

---

## ✅ Validation & Error Handling

### Request Validation
- ✅ `patientId` must be a valid MongoDB ObjectId
- ✅ `location` is required
- ✅ `status` must be one of: pending, approved, rejected
- ✅ Invalid status returns 400 error

### Error Responses

**400 Bad Request - Missing Fields:**
```json
{
  "success": false,
  "message": "Please provide patientId and location"
}
```

**400 Bad Request - Invalid ID Format:**
```json
{
  "success": false,
  "message": "Invalid patient ID format"
}
```

**404 Not Found:**
```json
{
  "success": false,
  "message": "Emergency request not found"
}
```

**500 Server Error:**
```json
{
  "success": false,
  "message": "Server error creating emergency request",
  "error": "Detailed error message (dev mode only)"
}
```

---

## 🎯 Features Implemented

✅ **CRUD Operations:**
- Create emergency request
- Get all emergency requests (with filtering)
- Get single emergency request by ID
- Update emergency request
- Delete emergency request

✅ **Socket.io Integration:**
- Emit `emergencyRequestCreated` on create
- Emit `emergencyRequestApproved` on status change to "approved"
- Emit `emergencyRequestRejected` on status change to "rejected"

✅ **Data Validation:**
- Required field validation
- ObjectId format validation
- Status enum validation
- Graceful error handling

✅ **Database Optimization:**
- Indexed queries for performance
- Populated patient details on read operations
- Timestamps for audit trail

---

## 📊 Database Queries

### Get Pending Requests
```javascript
EmergencyRequest.find({ status: 'pending' })
  .populate('patientId', 'name email')
  .sort({ createdAt: -1 });
```

### Get Requests by Patient
```javascript
EmergencyRequest.find({ patientId: '507f1f77bcf86cd799439011' })
  .sort({ createdAt: -1 });
```

### Count by Status
```javascript
EmergencyRequest.countDocuments({ status: 'pending' });
```

---

## 🚀 Integration with Existing System

### Socket.io Integration
- Uses existing `req.io` from server.js middleware
- Follows same pattern as bed status updates
- Events logged to console for debugging

### Consistent API Design
- Matches existing controller patterns (bedController, authController)
- Uses same error handling structure
- Follows RESTful conventions

### Model Consistency
- Uses timestamps like other models
- Follows same indexing strategy
- No versionKey (consistent with Bed model)

---

## ✅ Task 1.2 Completion Checklist

- [x] Create EmergencyRequest model with all required fields
- [x] Implement CRUD controller functions
- [x] Create REST API routes
- [x] Register routes in server.js
- [x] Add Socket.io event emissions
- [x] Implement error handling
- [x] Add validation for all inputs
- [x] Populate patient details on reads
- [x] Add database indexes for performance
- [x] Export model in models/index.js
- [x] Test model loading
- [x] Document API endpoints
- [x] No unrelated files modified

---

**Status:** ✅ **Task 1.2 Complete**  
**Date:** November 11, 2025  
**Assignee:** Diganta (Backend)
