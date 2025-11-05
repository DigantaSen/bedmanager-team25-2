# Bed Manager - Stakeholder Implementation Roadmap

## What's New in This Version

### Recently Added to Phase 2 (ICU Manager Dashboard)

#### New Feature: Bed Occupant Details & Patient Status Dashboard

**Task 2.5** | Effort: Medium | Priority: High

A dedicated view showing all currently occupied beds with patient information, enabling quick operational decisions on patient care and discharge planning.

**Includes:**

- Table/card view of all occupied beds with patient details
- Searchable and filterable by ward, status, patient name
- Patient detail modal with full history and notes
- Occupancy timeline for audit trail tracking

#### New Feature: Bed Cleaning Duration & Timeout Tracking  

**Task 2.5b** | Effort: High | Priority: High

Real-time monitoring of bed cleaning operations with visual progress tracking and alerts when cleaning exceeds estimated time.

**Includes:**

- Cleaning queue panel with progress bars and countdown timers
- Color-coded status (🟢 on track / 🟡 behind / 🔴 overdue)
- Real-time WebSocket updates every 30 seconds
- Analytics on cleaning performance by ward
- New CleaningLog model for tracking actual vs. estimated duration

#### Updated Feature: Bed Metadata & Editing

**Task 2.5c** | Effort: Low | Priority: Medium

Enhanced bed details modal now includes cleaning status and time-in-bed information for comprehensive operational context.

---

## Executive Summary

This roadmap outlines the tasks required to implement customized views, permissions, and workflows for each stakeholder group. The current implementation provides a basic single-dashboard experience. This roadmap prioritizes development to deliver role-specific interfaces and capabilities.

**Phases:** 6 phases over ~13 weeks covering foundation, ICU Manager, Admin Analytics, Ward Staff, ER Staff, and integration/polish.

---

## Current State Analysis

### ✅ What's Implemented

- User authentication with 5 roles: `technical_team`, `hospital_admin`, `er_staff`, `ward_staff`, `icu_manager`
- Basic authorization middleware for route protection
- Bed model with status tracking (available, occupied, maintenance, reserved)
- OccupancyLog model for audit trails
- Real-time WebSocket updates via Socket.io
- Single unified dashboard showing all beds across all wards
- Simple bed booking interface for ward staff

### ❌ What's Missing

- Role-based dashboard routing (each stakeholder sees different interface)
- Ward assignment for staff users
- Emergency admission request workflow
- KPI/analytics components
- Real-time alert/notification system
- Forecasting/predictive features
- Role-specific read/write permissions at UI level
- Analytics/reporting views
- Request management system

---

## Phase 1: Foundation & Infrastructure (Weeks 1-2)

### Core Data Model Updates

#### Task 1.1: Extend User Model with Ward Assignment

**Stakeholders:** All  
**Effort:** Low  
**Priority:** Critical (Blocker for Phase 2-5)

**Current State:**

```javascript
User has: name, email, password, role, timestamps
```

**Required Changes:**

- Add `ward` field (reference to Ward or string: 'ICU', 'General', 'Emergency')
- Add `assignedWards` array (for ward staff who cover multiple wards)
- Add `department` field (for tracking which department user belongs to)

**Backend Changes:**

```javascript
// models/User.js - Add fields:
ward: {
  type: String,
  enum: ['ICU', 'General', 'Emergency', 'None'],
  default: 'None'
},
assignedWards: [{
  type: String,
  enum: ['ICU', 'General', 'Emergency']
}],
department: String
```

**Frontend Changes:**

- Update registration form to include ward/department selection
- Store ward info in Redux auth state

---

#### Task 1.2: Create EmergencyRequest Model

**Stakeholders:** ER Staff, ICU Manager  
**Effort:** Low  
**Priority:** Critical (Blocker for Phase 5)

**New Model:**

```javascript
// models/EmergencyRequest.js
{
  requestId: String (unique),
  requestedBy: ObjectId (ref: User - ER Staff),
  requestedWard: String (ICU, General),
  status: 'pending' | 'approved' | 'rejected' | 'fulfilled',
  allocatedBed: ObjectId (ref: Bed),
  priority: 'urgent' | 'high' | 'normal',
  reason: String,
  patientInfo: {
    name: String,
    age: Number,
    criticalConditions: [String]
  },
  approvedBy: ObjectId (ref: User - ICU Manager/Admin),
  timestamp: Date,
  resolvedAt: Date
}
```

**Backend Changes:**

- Create CRUD routes: `POST /api/emergency-requests`, `GET /api/emergency-requests`, `PATCH /api/emergency-requests/:id`
- Create controller with approval/rejection logic
- Add Socket.io events: `emergencyRequestCreated`, `emergencyRequestApproved`, `emergencyRequestRejected`

---

#### Task 1.3: Create Alert/Notification Model

**Stakeholders:** ICU Manager, Hospital Admin  
**Effort:** Low  
**Priority:** High

**New Model:**

```javascript
// models/Alert.js
{
  type: 'occupancy_high' | 'bed_emergency' | 'maintenance_needed' | 'request_pending',
  severity: 'low' | 'medium' | 'high' | 'critical',
  message: String,
  relatedBed: ObjectId (ref: Bed),
  relatedRequest: ObjectId (ref: EmergencyRequest),
  targetRole: ['icu_manager', 'hospital_admin'],
  read: Boolean,
  timestamp: Date
}
```

---

### Backend Infrastructure

#### Task 1.4: Add Role-Based Route Guards

**Stakeholders:** All  
**Effort:** Low  
**Priority:** High

**Current State:** Basic `protect` and `authorize` middleware exists

**Required Changes:**

```javascript
// middleware/authMiddleware.js - Add specific guards:

// For read operations (different by role)
exports.canReadBeds = (req, res, next) => {
  if (req.user.role === 'er_staff') {
    // Only see available beds summary
    req.query.statusFilter = 'available';
  }
  if (req.user.role === 'ward_staff') {
    // Only see their ward's beds
    req.query.wardFilter = req.user.ward;
  }
  // icu_manager and hospital_admin see all
  next();
};

// For write operations
exports.canUpdateBedStatus = (req, res, next) => {
  // ward_staff: can only update beds in their ward
  // icu_manager: can update any bed
  // hospital_admin, er_staff: cannot write
  next();
};
```

**Frontend Changes:**

- Add permission checks before showing UI elements
- Hide write operations for read-only roles

---

#### Task 1.5: Create Analytics/Reporting Backend Endpoints

**Stakeholders:** Hospital Admin, ICU Manager  
**Effort:** Medium  
**Priority:** High

**New Endpoints:**

```
GET /api/analytics/occupancy-summary
  Returns: { totalBeds, occupied, available, maintenance, occupancyPercentage }

GET /api/analytics/occupancy-by-ward
  Returns: Array of { ward, occupied, available, occupancyPercentage }

GET /api/analytics/bed-history/:id
  Returns: Complete history of bed status changes for reporting

GET /api/analytics/occupancy-trends
  Query: { startDate, endDate, granularity: 'hourly'|'daily'|'weekly' }
  Returns: Time series data for trend analysis

GET /api/analytics/forecasting
  Returns: Predicted discharges, maintenance slots, peak times
```

---

### Frontend Infrastructure

#### Task 1.6: Create Redux Slices for Requests & Alerts

**Stakeholders:** All  
**Effort:** Low  
**Priority:** High

**New Redux Slices:**

```javascript
// features/requests/requestsSlice.js
{
  requests: [],
  status: 'idle',
  error: null,
  selectedRequest: null
}

// features/alerts/alertsSlice.js
{
  alerts: [],
  unreadCount: 0,
  status: 'idle'
}

// features/analytics/analyticsSlice.js
{
  kpis: {},
  occupancyByWard: [],
  trends: [],
  status: 'idle'
}
```

---

#### Task 1.7: Setup Role-Based Route Middleware (Frontend)

**Stakeholders:** All  
**Effort:** Low  
**Priority:** High

**Frontend Changes:**

```javascript
// Create ProtectedRoute component
// components/ProtectedRoute.jsx
<ProtectedRoute 
  path="/icu-dashboard" 
  allowedRoles={['icu_manager', 'technical_team']}
  element={<IcuManagerDashboard />}
/>
```

---

## Phase 2: ICU Manager (Anuradha) Dashboard (Weeks 3-5)

### Overview: Full Operational Control

**User:** Anuradha (ICU Manager)  
**Permissions:** Full read/write across hospital  
**Key Need:** Real-time operational intelligence  

---

#### Task 2.1: Create ICU Manager Dashboard Layout

**Effort:** Medium  
**Priority:** Critical

**Components to Build:**

1. **KPI Summary Card**
   - ICU occupancy %
   - Total available beds
   - Beds under maintenance
   - Emergency requests pending

2. **Real-time Bed Status Grid** (Enhanced from current Dashboard)
   - All beds across all wards
   - Color-coded status (available=green, occupied=red, maintenance=yellow, reserved=blue)
   - Click to view/edit bed details
   - Drag-to-assign functionality

3. **Alert/Notification Panel**
   - Real-time alerts when occupancy > 90%
   - Maintenance alerts
   - Emergency request notifications
   - Mark as read/dismiss

4. **Emergency Requests Queue**
   - List of pending requests
   - Approve/Reject buttons
   - Auto-suggest available beds
   - Status tracking

5. **Forecasting Panel**
   - Expected discharges (next 24h, 48h, 7 days)
   - Estimated cleaning times
   - Scheduled surgeries
   - Peak demand times

**Files to Create:**

```
frontend/src/pages/
  IcuManagerDashboard.jsx
  
frontend/src/components/icu-manager/
  KpiSummary.jsx
  EnhancedBedGrid.jsx
  AlertPanel.jsx
  EmergencyRequestsQueue.jsx
  ForecastingPanel.jsx
  BedDetailsModal.jsx
```

---

#### Task 2.2: Implement Real-time Alert System

**Effort:** Medium  
**Priority:** High

**Backend:**

```javascript
// When bed occupancy is updated, check if ward occupancy > 90%
if (wardOccupancy > 90) {
  // Create alert
  await Alert.create({
    type: 'occupancy_high',
    severity: 'critical',
    message: `${ward} occupancy at ${occupancy}%`,
    targetRole: ['icu_manager']
  });
  
  // Emit socket event
  io.emit('alertCreated', { type: 'occupancy_high', ward, occupancy });
}
```

**Frontend:**

```javascript
// Subscribe to real-time alerts
socket.on('alertCreated', (alert) => {
  dispatch(addAlert(alert));
  // Show toast notification
});
```

---

#### Task 2.3: Emergency Request Management Workflow

**Effort:** Medium  
**Priority:** High

**Backend Endpoints:**

```
POST /api/emergency-requests (ER Staff creates)
GET /api/emergency-requests (ICU Manager views)
PATCH /api/emergency-requests/:id/approve (ICU Manager approves)
PATCH /api/emergency-requests/:id/reject (ICU Manager rejects)
```

**Logic:**

1. ER Staff submits emergency request → Request created with status='pending'
2. ICU Manager sees notification + alert
3. ICU Manager can approve (allocate bed) or reject
4. On approval: Bed marked as 'reserved', notification sent to ER Staff
5. Socket.io updates in real-time

**Files:**

```
backend/controllers/emergencyRequestController.js
backend/routes/emergencyRequestRoutes.js
```

---

#### Task 2.4: Forecasting Data & Display

**Effort:** High  
**Priority:** Medium

**Backend Forecasting Endpoint:**

```javascript
// GET /api/analytics/forecasting
// Query expected discharges from:
// 1. OccupancyLog - identify patterns
// 2. Scheduled events (surgeries, appointments)
// 3. Average length of stay by ward

Returns: {
  expectedDischarges: [
    { bed: 'iA5', estimatedTime: '2025-11-05T14:00:00', confidence: 0.85 },
    ...
  ],
  cleaningQueue: [
    { bed: 'A10', estimatedCleaningTime: 30 },
    ...
  ],
  scheduledSurgeries: [
    { time: '2025-11-05T10:00', expectedDischarge: '2025-11-10', ward: 'ICU' },
    ...
  ]
}
```

**Frontend Component:**

- Timeline view of expected discharges
- Predicted available beds
- Peak demand indicator

---

#### Task 2.5: Bed Occupant Details & Patient Status Dashboard

**Effort:** Medium  
**Priority:** High

**Overview:**
A dedicated view showing all currently occupied beds with detailed patient information and status tracking. This allows the ICU Manager to quickly see who is occupying which beds and their current status.

**Component: Occupant Status Dashboard**

**Features:**

1. **Occupied Beds Table/Card View**
   - Bed ID
   - Patient Name
   - Patient ID
   - Ward
   - Admission Time
   - Estimated Discharge Time (if available)
   - Current Status (stable, critical, monitoring, etc.) - if integrated with EMR
   - Duration in bed (calculated)
   - Last status update time
   - Edit/Notes button

2. **Filters & Search**
   - Filter by ward (ICU, General, Emergency)
   - Filter by status
   - Search by patient name or ID
   - Sort by admission time, estimated discharge, duration

3. **Patient Detail Modal**
   - Full patient info
   - Medical history notes
   - Current vitals/status (if available)
   - Next check-up/discharge plan
   - Linked to OccupancyLog for history

**Backend Changes:**

```javascript
// GET /api/beds/occupied (ICU Manager only)
// Returns all occupied beds with patient details and metadata
// Includes: bedId, patientName, patientId, admissionTime, estimatedDischarge, ward

// GET /api/beds/:id/occupant-history
// Returns timeline of bed occupants (audit trail)
```

**Files to Create:**

```
frontend/src/components/icu-manager/
  OccupantStatusDashboard.jsx
  OccupantDetailsModal.jsx
  OccupantTable.jsx
  PatientTimelineCard.jsx
```

---

#### Task 2.5b: Bed Cleaning Duration & Timeout Tracking

**Effort:** High  
**Priority:** High

**Overview:**
When a bed is marked as "Cleaning", the system tracks cleaning duration and shows a real-time countdown/timeout to the ICU Manager. This helps monitor bed turnaround time and ensures efficient cleaning operations.

**Features:**

1. **Cleaning Status Tracking**
   - When ward staff marks bed as "Cleaning", they specify estimated cleaning duration (default: 30 mins)
   - System records: cleaning start time, estimated end time
   - Bed status shows: "Cleaning (15 mins remaining)"

2. **ICU Manager Cleaning Queue View**
   - Shows all beds currently being cleaned
   - Progress bar for each bed (time remaining)
   - Time started, estimated completion
   - Color changes: Green (on track) → Yellow (running behind) → Red (overdue)
   - "Mark as Available" button to override if cleaning complete

3. **Real-time Progress Display**

   ```
   Bed A10: Cleaning
   ████████░░░░░░░░░░░ 40% (8 mins remaining)
   Started: 14:20  |  Est. Done: 14:50
   ```

4. **Alerts & Notifications**
   - Alert when cleaning exceeds expected time (e.g., after 35 mins for 30-min estimate)
   - Notification when bed cleaning completes
   - Socket.io event: `bedCleaningProgress` (real-time update every 30 seconds)

5. **Analytics**
   - Average cleaning time per ward
   - Cleaning time vs. estimate variance
   - Identify beds that consistently take longer
   - Historical cleaning duration trends

**Data Model Changes:**

```javascript
// Update Bed model:
{
  bedId: String,
  status: String, // 'available', 'occupied', 'cleaning', 'maintenance', 'reserved'
  
  // NEW: Cleaning tracking fields
  cleaningStartTime: Date (null if not cleaning),
  estimatedCleaningDuration: Number (minutes, default 30),
  estimatedCleaningEndTime: Date,
  
  // Keep existing patient fields...
}

// NEW: Create CleaningLog model for analytics
{
  bedId: ObjectId (ref: Bed),
  startTime: Date,
  endTime: Date,
  estimatedDuration: Number,
  actualDuration: Number,
  performedBy: ObjectId (ref: User - ward staff),
  ward: String,
  notes: String,
  timestamp: Date
}
```

**Backend Changes:**

```javascript
// POST /api/beds/:id/status with body: { status: 'cleaning', estimatedDuration: 30 }
// Validates duration is reasonable (5-60 mins)
// Records cleaningStartTime and estimatedCleaningEndTime
// Creates CleaningLog entry

// GET /api/beds/cleaning-queue
// Returns all beds being cleaned with progress info
// Calculated fields:
// - timeRemaining = estimatedCleaningEndTime - now
// - percentageComplete = (now - cleaningStartTime) / estimatedDuration * 100
// - isOverdue = now > estimatedCleaningEndTime

// PUT /api/beds/:id/cleaning/mark-complete
// Called when cleaning finishes early
// Ends CleaningLog, marks bed as available

// GET /api/analytics/cleaning-performance
// Returns average cleaning times by ward
// Variance from estimates
// Trends over time
```

**Frontend Changes:**

```javascript
// components/icu-manager/CleaningQueuePanel.jsx
// Real-time progress bars for each bed being cleaned
// Updates every 30 seconds via WebSocket

// Socket events:
socket.on('bedCleaningStarted', (bed) => {
  // Add to cleaning queue
});

socket.on('bedCleaningProgress', (bed) => {
  // Update progress: timeRemaining, percentageComplete, isOverdue
  // Change color if overdue
});

socket.on('bedCleaningCompleted', (bed) => {
  // Remove from queue, show notification
});
```

**WebSocket Events:**

```javascript
// New events for cleaning tracking:
'bedCleaningStarted' - Ward staff marked bed as cleaning
'bedCleaningProgress' - Real-time updates (emit every 30 seconds)
'bedCleaningCompleted' - Bed marked as available again
'cleaningOverdue' - Cleaning exceeded estimated time
'cleaningQueueUpdated' - Queue state changed
```

**UI Mockup:**

```
┌─ CLEANING QUEUE (3 beds) ─────────────────────────┐
│                                                   │
│ Bed A10: Ward A                                   │
│ ████████░░░░░░░░░░░ 40% - 8 mins remaining       │
│ Started 14:20 | Est. 14:50 | ⚠️ Running slightly behind │
│                                                   │
│ Bed B5: Ward B                                    │
│ ██████████████░░░░░ 70% - 3 mins remaining       │
│ Started 14:15 | Est. 14:45 | ✓ On track         │
│                                                   │
│ Bed C7: Ward A                                    │
│ █████░░░░░░░░░░░░░░░ 25% - 15 mins remaining     │
│ Started 14:35 | Est. 15:05 | ✓ On track         │
│                                                   │
│ [Avg Duration: 28 min] [Max: 35 min] [Min: 22 min] │
└───────────────────────────────────────────────────┘
```

**Implementation Priority:**
This feature is HIGH priority for operational efficiency. Cleaning turnaround time directly impacts bed availability and patient admission capacity.

---

#### Task 2.5c: Bed Metadata & Editing

**Effort:** Low  
**Priority:** Medium

**Modal to Display:**

- Bed ID
- Status
- Current patient (if occupied)
  - Patient Name
  - Patient ID
  - Admission time
- Ward
- Last updated
- Cleaning status (if applicable)
  - Time remaining (if cleaning)
  - Time in bed (if occupied)
- Edit button (for ICU Manager only)

**Edit Permissions:**

- Change status
- Update patient info
- Add notes
- Adjust cleaning duration estimate (if cleaning)

---

#### Task 2.6: WebSocket Events for Real-time Sync

**Effort:** Low  
**Priority:** High

**Events to Emit:**

```javascript
// From server
'bedStatusChanged' - Real-time bed update
'emergencyRequestCreated' - New ER request
'emergencyRequestApproved' - Request approved
'occupancyAlert' - Occupancy threshold breached
'bedMaintenanceNeeded' - New maintenance request

// From client
socket.emit('requestApproval', { requestId, approved: true, allocatedBed: 'iA5' })
```

---

## Phase 3: Hospital Administration Dashboard (Weeks 6-7)

### Overview: Strategic Analytics & Reporting

**User:** Hospital Administration  
**Permissions:** Read-only across hospital  
**Key Need:** Historical data, trends, capacity planning  

---

#### Task 3.1: Create Admin Analytics Dashboard

**Effort:** High  
**Priority:** High

**Dashboard Components:**

1. **Executive Summary**
   - Hospital-wide occupancy % (ICU, General, Emergency)
   - Average bed utilization over time
   - Current vs. historical comparison

2. **Ward Utilization Report**
   - Table: Ward name, Beds available, Occupied, In maintenance
   - Charts: Utilization trend per ward

3. **Occupancy Trends**
   - Time series graph: Last 30/90 days
   - By hour, day, or week granularity
   - Peak vs. low demand periods

4. **Forecasting Insights**
   - Predicted capacity needs
   - Recommended staffing levels
   - Maintenance scheduling suggestions

5. **Report Generation**
   - Export to PDF/CSV
   - Schedule automated reports
   - Email delivery

**Files:**

```
frontend/src/pages/
  AdminDashboard.jsx
  
frontend/src/components/admin/
  ExecutiveSummary.jsx
  WardUtilizationReport.jsx
  OccupancyTrendsChart.jsx
  ForecastingInsights.jsx
  ReportGenerator.jsx
```

---

#### Task 3.2: Implement Historical Data Queries

**Effort:** Medium  
**Priority:** High

**Backend Endpoints:**

```
GET /api/analytics/occupancy-history
  Query: { startDate, endDate, wardFilter, granularity }
  
GET /api/analytics/ward-utilization
  Query: { startDate, endDate, ward }
  Returns: Detailed metrics for capacity planning
  
GET /api/analytics/peak-demand-analysis
  Returns: Times when demand peaks, patterns
```

**Data Aggregation:**

- Query OccupancyLog for historical changes
- Calculate average length of stay
- Identify seasonal patterns
- Project future capacity needs

---

#### Task 3.3: Report Generation & Scheduling

**Effort:** Medium  
**Priority:** Medium

**Features:**

- Generate PDF/CSV reports on-demand
- Schedule automated weekly/monthly reports
- Email delivery to admin group
- Archive past reports

**Tools:** Consider using `puppeteer` for PDF generation

---

## Phase 4: Ward/Unit Staff Interface (Weeks 8-9)

### Overview: Simplified Operational Interface

**User:** Ward Staff  
**Permissions:** Limited to assigned ward, write status only  
**Key Need:** Quick bed status updates  

---

#### Task 4.1: Create Ward Staff Dashboard

**Effort:** Medium  
**Priority:** High

**Dashboard Features:**

1. **Ward Filter** (Always Applied)
   - Automatically show only beds in `req.user.assignedWards`
   - Simple toggle if assigned to multiple wards

2. **Simplified Bed View**
   - Remove forecasting, alerts, analytics
   - Show: Bed ID, Status, Patient name (if occupied)
   - Large, easy-to-tap status buttons

3. **Status Update Form**
   - Simple modal with 3-4 buttons:
     - Mark as Available
     - Mark as Cleaning
     - Mark as Occupied (with patient name)
     - Mark as Maintenance

4. **No Write Permission** for:
   - Allocating beds to other wards
   - Approving emergency requests
   - Viewing forecasting data

**Files:**

```
frontend/src/pages/
  WardStaffDashboard.jsx
  
frontend/src/components/ward-staff/
  WardBedGrid.jsx
  SimpleStatusUpdateModal.jsx
  AvailableBedsList.jsx
```

---

#### Task 4.2: Backend Ward Staff Authorization

**Effort:** Low  
**Priority:** High

**Middleware:**

```javascript
// middleware/wardStaffAuth.js
exports.canAccessWard = (req, res, next) => {
  // Ward staff can only update beds in their assigned wards
  const bedWard = req.body.ward;
  if (!req.user.assignedWards.includes(bedWard)) {
    return res.status(403).json({ 
      success: false, 
      message: 'Not authorized for this ward' 
    });
  }
  next();
};
```

**Route Protection:**

```javascript
router.patch('/:id/status', 
  protect, 
  authorize('ward_staff'),
  canAccessWard,
  validateUpdateBedStatus,
  updateBedStatus
);
```

---

#### Task 4.3: Mobile-Optimized UI

**Effort:** Low  
**Priority:** Medium

**Considerations:**

- Large touch targets for bed status buttons
- Minimal scrolling required
- Responsive design for tablet/phone use
- Offline capability (cache bed list locally)

---

## Phase 5: ER Staff Request System (Weeks 10-11)

### Overview: Emergency-Focused Request Interface

**User:** ER Staff  
**Permissions:** View availability only, submit requests only  
**Key Need:** Quick bed requests  

---

#### Task 5.1: Create ER Staff Dashboard

**Effort:** Medium  
**Priority:** High

**Dashboard Features:**

1. **Availability Summary** (Read-only)
   - ICU Available: X beds
   - General Available: X beds
   - Emergency Available: X beds
   - Auto-refresh every 10 seconds

2. **Emergency Request Button**
   - Prominent button: "Request Emergency Admission"
   - Opens form to:
     - Select ward type (ICU, General, Emergency)
     - Enter reason
     - Enter patient priority (urgent, high, normal)

3. **Request Status Tracker**
   - List of user's recent requests
   - Status: Pending, Approved (with bed #), Rejected
   - Timestamp

4. **Real-time Notifications**
   - Toast notification when request is approved/rejected
   - Approved notification shows allocated bed

**Files:**

```
frontend/src/pages/
  ErStaffDashboard.jsx
  
frontend/src/components/er-staff/
  AvailabilitySummary.jsx
  EmergencyRequestForm.jsx
  RequestStatusTracker.jsx
```

---

#### Task 5.2: Emergency Request Submission Flow

**Effort:** Medium  
**Priority:** High

**Flow:**

1. ER Staff clicks "Request Emergency Admission"
2. Form opens:
   - Ward type dropdown
   - Reason (multi-select: Trauma, Sepsis, Cardiac, etc.)
   - Priority level
   - Optional: Patient age, critical conditions
3. Submit → Request created with status='pending'
4. System notifies ICU Manager
5. ER Staff sees "Pending" status
6. On approval: Toast shows allocated bed
7. ER Staff can prepare patient transfer

**Backend:**

```javascript
// POST /api/emergency-requests (ER Staff only)
// Validates: ward type, reason, priority
// Creates request in pending state
// Emits socket event to ICU Manager
```

---

#### Task 5.3: Real-time Notification System

**Effort:** Medium  
**Priority:** High

**WebSocket Events:**

```javascript
// Server → ER Staff
socket.on('requestApproved', (data) => {
  // { requestId, allocatedBed, wardStaff: 'Anuradha' }
  showToast('Request approved! Bed: iA5');
  dispatch(updateRequestStatus({ requestId, status: 'approved', bed: 'iA5' }));
});

socket.on('requestRejected', (data) => {
  // { requestId, reason }
  showToast('Request rejected. No available beds.');
});
```

---

#### Task 5.4: Availability Auto-refresh

**Effort:** Low  
**Priority:** Low

**Implementation:**

- Fetch available beds every 10 seconds
- Use polling (simpler) or WebSocket subscribe event
- Update UI automatically
- Show "Last updated: 5 seconds ago"

---

## Phase 6: Integration & Polish (Weeks 12-13)

#### Task 6.1: Cross-Role Testing & Workflow

- Test complete workflows for each role
- Verify permissions are correctly enforced
- Test role-switching (if admin wants to test as ward staff)

#### Task 6.2: Performance Optimization

- Implement pagination for large bed lists
- Cache frequently accessed data
- Optimize database queries with indexes

#### Task 6.3: Documentation

- Update API documentation
- Create user guides per role
- Document permission matrix

#### Task 6.4: Bug Fixes & Polish

- UI refinements
- Error handling improvements
- Loading state optimization

---

## Summary by Stakeholder

### Anuradha (ICU Manager) - Full Dashboard

**Phases:** 1, 2  
**Key Features:**

- ✅ Real-time KPI dashboard
- ✅ All beds across all wards
- ✅ Emergency request approval
- ✅ Alert system
- ✅ Forecasting insights
- ✅ Full read/write permissions

### Hospital Administration - Analytics

**Phases:** 1, 3  
**Key Features:**

- ✅ Analytics dashboard
- ✅ Historical reports
- ✅ Trend analysis
- ✅ Forecasting for planning
- ✅ Read-only access
- ✅ Report generation/export

### Ward Staff - Simplified Operations

**Phases:** 1, 4  
**Key Features:**

- ✅ Ward-filtered bed view
- ✅ Simple status updates
- ✅ Mobile-optimized UI
- ✅ Limited to assigned ward
- ✅ Write: bed status only

### ER Staff - Emergency Requests

**Phases:** 1, 5  
**Key Features:**

- ✅ Availability view only
- ✅ Emergency request form
- ✅ Real-time notifications
- ✅ Request status tracker
- ✅ Write: requests only

---

## Technical Debt & Considerations

### Data Privacy

- Ensure ward staff cannot view other wards' patient info
- Implement field-level permissions for sensitive data
- Log all access to patient information

### Performance

- Implement pagination for bed lists (hundreds of beds)
- Cache occupancy summaries
- Use database indexes effectively

### Real-time Sync

- WebSocket reconnection handling
- Graceful degradation if socket fails
- Fallback to polling

### Testing

- Unit tests for authorization middleware
- Integration tests for workflows
- Load testing for real-time updates

---

## Estimated Timeline

- **Phase 1:** 2 weeks (Foundation)
- **Phase 2:** 3 weeks (ICU Manager)
- **Phase 3:** 2 weeks (Admin Analytics)
- **Phase 4:** 2 weeks (Ward Staff)
- **Phase 5:** 2 weeks (ER Staff)
- **Phase 6:** 2 weeks (Integration & Polish)

**Total: ~13 weeks** (assuming 1 developer or parallel streams)

---

## Dependencies & Blockers

1. **Phase 1 must complete** before any other phases (architecture foundation)
2. **Phase 2 must complete** before Phase 5 (ER staff needs approval mechanism)
3. **Phases 3, 4, 5 can progress in parallel** once Phase 1 is done
