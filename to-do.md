# Bed Manager - Task Distribution

## Phase 1: Foundation & Infrastructure

### Task 1.1: Extend User Model with Ward Assignment

**Assignee:** Surjit (Backend)  
**Priority:** Critical  
**Dependencies:** None (Foundational)  
**Blocks:** Task 1.6, 2.5, 4.1, 5.1  
**Deliverables:**

- Update User model with `ward`, `assignedWards`, `department` fields
- Update registration form to include ward/department selection
- Store ward info in Redux auth state

---

### Task 1.2: Create EmergencyRequest Model

**Assignee:** Diganta (Backend)  
**Priority:** Critical  
**Dependencies:** None (Foundational)  
**Blocks:** Task 2.3, 2.6, 5.2, 5.3  
**Deliverables:**

- Create EmergencyRequest model with all fields
- Create CRUD routes and controller
- Add Socket.io events: `emergencyRequestCreated`, `emergencyRequestApproved`, `emergencyRequestRejected`

---

### Task 1.3: Create Alert/Notification Model

**Assignee:** Nilkanta (Backend)  
**Priority:** High  
**Dependencies:** None (Foundational)  
**Blocks:** Task 2.2, 2.6, 5.2  
**Deliverables:**

- Create Alert model with type, severity, message fields
- Create endpoints for fetching and dismissing alerts
- Wire up to Socket.io for real-time alert delivery

---

### Task 1.4: Add Role-Based Route Guards

**Assignee:** Shubham (Backend)  
**Priority:** High  
**Dependencies:** None (Foundational)  
**Blocks:** Task 2.x (all), 3.x (all), 4.x (all), 5.x (all)  
**Deliverables:**

- Implement `canReadBeds` middleware for different roles
- Implement `canUpdateBedStatus` middleware
- Add frontend permission checks before showing UI elements

---

### Task 1.5: Create Analytics/Reporting Backend Endpoints ✅

**Assignee:** Abhinav (Backend - Configuration)  
**Priority:** High  
**Dependencies:** None (Foundational)  
**Blocks:** Task 2.4, 3.1, 3.2  
**Deliverables:**

- Set up 5 analytics endpoints:
  - `GET /api/analytics/occupancy-summary`
  - `GET /api/analytics/occupancy-by-ward`
  - `GET /api/analytics/bed-history/:id`
  - `GET /api/analytics/occupancy-trends`
  - `GET /api/analytics/forecasting`
- Create helper functions (can delegate aggregation to others)
- Wire up to database queries

---

### Task 1.6: Create Redux Slices for Requests & Alerts

**Assignee:** Surjit (Frontend)  
**Priority:** High  
**Dependencies:** Task 1.1 (User Model)  
**Blocks:** Task 2.1, 2.2, 3.1, 5.1  
**Deliverables:**

- Create `requestsSlice.js` with actions for fetching/updating requests
- Create `alertsSlice.js` with actions for alerts
- Create `analyticsSlice.js` with KPI data structure
- Integrate with Redux store

---

### Task 1.7: Setup Role-Based Route Middleware (Frontend)

**Assignee:** Abhinav (Frontend)  
**Priority:** High  
**Dependencies:** Task 1.4 (Role Guards Backend)  
**Blocks:** Task 2.1, 3.1, 4.1, 5.1  
**Deliverables:**

- Create `ProtectedRoute` component
- Set up role-based route guards
- Implement route structure for different dashboards
- Handle unauthorized access redirects

---

## Phase 2: ICU Manager (Anuradha) Dashboard

### Task 2.1: Create ICU Manager Dashboard Layout

**Assignee:** Surjit (Frontend)  
**Priority:** Critical  
**Dependencies:** Task 1.6, 1.7  
**Blocks:** Task 2.2, 2.3, 2.4, 2.5, 2.5b, 2.5c, 2.6  
**Deliverables:**

- Build KPI Summary Card component
- Build Real-time Bed Status Grid
- Build Alert/Notification Panel
- Build Emergency Requests Queue
- Build Forecasting Panel
- Create BedDetailsModal component

---

### Task 2.2: Implement Real-time Alert System

**Assignee:** Diganta (Backend)  
**Priority:** High  
**Dependencies:** Task 1.3, 2.1  
**Blocks:** Task 2.6  
**Deliverables:**

- Logic to detect occupancy > 90% and create alerts
- Socket.io event emission for real-time alerts
- Alert update and dismissal endpoints
- Frontend subscription to socket events

---

### Task 2.3: Emergency Request Management Workflow

**Assignee:** Nilkanta (Backend)  
**Priority:** High  
**Dependencies:** Task 1.2, 2.1  
**Blocks:** Task 2.6, 5.3  
**Deliverables:**

- Implement `POST /api/emergency-requests` (ER Staff creates)
- Implement `GET /api/emergency-requests` (ICU Manager views)
- Implement `PATCH /api/emergency-requests/:id/approve`
- Implement `PATCH /api/emergency-requests/:id/reject`
- Create EmergencyRequestController with full logic

---

### Task 2.4: Forecasting Data & Display

**Assignee:** Shubham (Backend)  
**Priority:** Medium  
**Dependencies:** Task 1.5, 2.1  
**Blocks:** None (Standalone)  
**Deliverables:**

- Implement forecasting logic:
  - Query expected discharges from OccupancyLog
  - Integrate scheduled events data
  - Calculate average length of stay
- Build forecasting response structure
- Create frontend component for timeline visualization

---

### Task 2.5: Bed Occupant Details & Patient Status Dashboard

**Assignee:** Abhinav (Frontend - Dashboard Integration)  
**Priority:** High  
**Dependencies:** Task 1.1, 2.1, 1.7  
**Blocks:** None (Standalone)  
**Deliverables:**

- Create OccupantStatusDashboard component
- Create OccupantTable with sorting/filtering
- Create OccupantDetailsModal
- Create PatientTimelineCard
- Implement search and filter functionality
- Add backend endpoints:
  - `GET /api/beds/occupied` (Backend support from Surjit)
  - `GET /api/beds/:id/occupant-history` (Backend support from Surjit)

---

### Task 2.5b: Bed Cleaning Duration & Timeout Tracking

**Assignee:** Surjit (Backend & Frontend)  
**Priority:** High  
**Dependencies:** Task 2.1, 1.6  
**Blocks:** Task 2.6  
**Deliverables:**

- Update Bed model with cleaning fields: `cleaningStartTime`, `estimatedCleaningDuration`, `estimatedCleaningEndTime`
- Create CleaningLog model for analytics
- Implement `POST /api/beds/:id/status` with cleaning duration
- Implement `GET /api/beds/cleaning-queue` with progress calculation
- Implement `PUT /api/beds/:id/cleaning/mark-complete`
- Implement `GET /api/analytics/cleaning-performance`
- Create frontend CleaningQueuePanel component with progress bars
- Wire up Socket.io events: `bedCleaningStarted`, `bedCleaningProgress`, `bedCleaningCompleted`

---

### Task 2.5c: Bed Metadata & Editing

**Assignee:** Diganta (Frontend)  
**Priority:** Medium  
**Dependencies:** Task 2.1, 1.7  
**Blocks:** None (Standalone)  
**Deliverables:**

- Enhance BedDetailsModal to include:
  - Patient Name, ID, Admission time
  - Cleaning status and time remaining
  - Time in bed calculation
- Add edit functionality for ICU Manager
- Implement notes field
- Handle cleaning duration adjustment

---

### Task 2.6: WebSocket Events for Real-time Sync

**Assignee:** Nilkanta (Backend)  
**Priority:** High  
**Dependencies:** Task 1.2, 1.3, 2.2, 2.3, 2.5b  
**Blocks:** Task 6.1 (Testing)  
**Deliverables:**

- Emit events: `bedStatusChanged`, `emergencyRequestCreated`, `emergencyRequestApproved`, `occupancyAlert`, `bedMaintenanceNeeded`
- Implement event handlers on frontend
- Test real-time sync across all components
- Handle reconnection scenarios

---

## Phase 3: Hospital Administration Dashboard

### Task 3.1: Create Admin Analytics Dashboard

**Assignee:** Abhinav (Frontend - Clean UI Work)  
**Priority:** High  
**Dependencies:** Task 1.5, 1.6, 1.7  
**Blocks:** None (Standalone)  
**Deliverables:**

- Create AdminDashboard page
- Create ExecutiveSummary component (hospital-wide KPIs)
- Create WardUtilizationReport component (table/charts)
- Create OccupancyTrendsChart component (time series)
- Create ForecastingInsights component
- Create ReportGenerator component
- Style and polish all components
- No heavy backend integration needed (other team provides data)

---

### Task 3.2: Implement Historical Data Queries

**Assignee:** Shubham (Backend)  
**Priority:** High  
**Dependencies:** Task 1.5  
**Blocks:** Task 3.3  
**Deliverables:**

- Implement `GET /api/analytics/occupancy-history` with date range and granularity
- Implement `GET /api/analytics/ward-utilization` with detailed metrics
- Implement `GET /api/analytics/peak-demand-analysis`
- Aggregate data from OccupancyLog
- Calculate seasonal patterns and projections

---

### Task 3.3: Report Generation & Scheduling

**Assignee:** Surjit (Backend)  
**Priority:** Medium  
**Dependencies:** Task 3.2  
**Blocks:** None (Standalone)  
**Deliverables:**

- Implement PDF/CSV report generation (use `puppeteer`)
- Implement scheduled report generation (cron jobs)
- Set up email delivery system
- Create report archive/history
- Frontend: Implement report download UI

---

## Phase 4: Ward/Unit Staff Interface

### Task 4.1: Create Ward Staff Dashboard

**Assignee:** Diganta (Frontend)  
**Priority:** High  
**Dependencies:** Task 1.1, 1.7  
**Blocks:** Task 4.3  
**Deliverables:**

- Create WardStaffDashboard page
- Create WardBedGrid component (filtered by assigned ward)
- Create SimpleStatusUpdateModal with 4 status buttons
- Create AvailableBedsList component
- Implement mobile-optimized layout
- No complex features - straightforward UI

---

### Task 4.2: Backend Ward Staff Authorization

**Assignee:** Nilkanta (Backend)  
**Priority:** High  
**Dependencies:** Task 1.4  
**Blocks:** None (Standalone)  
**Deliverables:**

- Create `wardStaffAuth` middleware
- Implement `canAccessWard` permission check
- Restrict bed status updates to assigned wards
- Add route protection for ward-specific endpoints
- Test authorization at multiple levels

---

### Task 4.3: Mobile-Optimized UI

**Assignee:** Shubham (Frontend - Minor)  
**Priority:** Medium  
**Dependencies:** Task 4.1  
**Blocks:** None (Standalone)  
**Deliverables:**

- Add large touch targets for status buttons
- Implement responsive design for tablets/phones
- Add offline capability with local caching
- Test on multiple device sizes
- Performance optimization for mobile

---

## Phase 5: ER Staff Request System

### Task 5.1: Create ER Staff Dashboard

**Assignee:** Abhinav (Frontend - Simpler Dashboard)  
**Priority:** High  
**Dependencies:** Task 1.7, 1.1  
**Blocks:** Task 5.4  
**Deliverables:**

- Create ErStaffDashboard page
- Create AvailabilitySummary component (read-only beds by ward)
- Create EmergencyRequestForm component
- Create RequestStatusTracker component
- Implement auto-refresh every 10 seconds
- Simple, focused UI with minimal complexity

---

### Task 5.2: Emergency Request Submission Flow

**Assignee:** Surjit (Backend - Integration)  
**Priority:** High  
**Dependencies:** Task 1.2, 1.3  
**Blocks:** Task 5.3  
**Deliverables:**

- Implement `POST /api/emergency-requests` for ER Staff only
- Validate ward type, reason, priority
- Emit Socket.io event to ICU Manager
- Create request in pending state
- Wire up to Alert system

---

### Task 5.3: Real-time Notification System

**Assignee:** Diganta (Backend)  
**Priority:** High  
**Dependencies:** Task 1.2, 2.3, 5.2  
**Blocks:** None (Standalone)  
**Deliverables:**

- Implement WebSocket events: `requestApproved`, `requestRejected`
- Emit events with bed allocation details
- Handle disconnection and reconnection
- Test notification delivery across roles
- Frontend: Implement toast notifications

---

### Task 5.4: Availability Auto-refresh

**Assignee:** Nilkanta (Frontend - Minor)  
**Priority:** Low  
**Dependencies:** Task 5.1  
**Blocks:** None (Standalone)  
**Deliverables:**

- Implement 10-second polling for available beds
- Update AvailabilitySummary component in real-time
- Show "Last updated: X seconds ago"
- Optimize for performance (no unnecessary re-renders)

---

## Phase 6: Integration & Polish

### Task 6.1: Cross-Role Testing & Workflow

**Assignee:** Surjit (Testing Lead)  
**Priority:** High  
**Dependencies:** Task 2.6, 3.3, 4.2, 5.3 (All Phase 2-5 major tasks)  
**Blocks:** Task 6.4  
**Deliverables:**

- Test complete workflows for each role
- Verify permissions are correctly enforced
- Test role-switching scenarios
- Document test cases
- Create test report

---

### Task 6.2: Performance Optimization

**Assignee:** Shubham (Backend & Database)  
**Priority:** High  
**Dependencies:** Task 3.2, 2.5b (All Phase 2-5 implementation tasks)  
**Blocks:** Task 6.4  
**Deliverables:**

- Implement pagination for large bed lists
- Add database indexes for common queries
- Cache frequently accessed data
- Optimize Socket.io events (batch updates)
- Monitor and profile performance

---

### Task 6.3: Documentation

**Assignee:** Nilkanta (Documentation)  
**Priority:** High  
**Dependencies:** Task 3.2, 2.6, 4.2 (All Phase 2-5 implementation tasks)  
**Blocks:** Task 6.4  
**Deliverables:**

- Update API documentation (Swagger/Postman)
- Create user guides per role (PDF)
- Document permission matrix
- Create deployment guide
- Add inline code comments

---

### Task 6.4: Bug Fixes & Polish

**Assignee:** Abhinav (Final Polish & QA)  
**Priority:** High  
**Dependencies:** Task 6.1, 6.2, 6.3  
**Blocks:** None (Final task)  
**Deliverables:**

- Fix all reported bugs
- UI refinements and consistency checks
- Error handling improvements
- Loading state optimization
- Final testing and sign-off

---

## Summary by Person

### Abhinav

**Total Tasks:** 7 tasks  
**Focus:** Strategic work with architectural responsibilities

- Phase 1: Analytics endpoints setup (configuration) + Frontend routing
- Phase 2: Occupant dashboard (existing features) + Task coordination
- Phase 3: Admin analytics dashboard UI (focused, no backend)
- Phase 5: ER Staff dashboard (simple, focused dashboard)
- Phase 6: Final polish and quality assurance

**Rationale:** Mix of important architectural work (Phase 1), high-visibility dashboard (Phase 3), and quality assurance. Lighter on backend complexity. Your tasks don't require heavy lifting from other team members.

---

### Surjit

**Total Tasks:** 8 tasks  
**Focus:** Frontend & full-stack integration

- Phase 1: User model + Redux slices
- Phase 2: ICU Manager dashboard (comprehensive) + Cleaning tracking backend & frontend
- Phase 3: Report generation
- Phase 6: Testing lead

**Rationale:** Strong frontend work with backend integration on complex feature (cleaning). Balanced mix of frontend and backend.

---

### Diganta

**Total Tasks:** 7 tasks  
**Focus:** Backend architecture & frontend UI

- Phase 1: EmergencyRequest model
- Phase 2: Real-time alerts + Bed metadata modal
- Phase 3: Analytics dashboard query implementation
- Phase 4: Ward staff dashboard UI
- Phase 5: Real-time notification system

**Rationale:** Core business logic (emergency requests) + UI development. Good mix of responsibilities.

---

### Nilkanta

**Total Tasks:** 8 tasks  
**Focus:** Backend services & real-time systems

- Phase 1: Alert model
- Phase 2: Emergency request workflow + WebSocket events
- Phase 3: (No tasks - light phase)
- Phase 4: Ward staff authorization
- Phase 5: Availability auto-refresh
- Phase 6: Documentation

**Rationale:** Real-time and security-focused work. Complex backend tasks with lighter load in Phase 3.

---

### Shubham

**Total Tasks:** 7 tasks  
**Focus:** Backend data & mobile optimization

- Phase 1: Role-based guards
- Phase 2: Forecasting implementation
- Phase 3: Historical data queries
- Phase 4: Mobile optimization (minor)
- Phase 6: Performance optimization

**Rationale:** Data-heavy backend work with performance focus. Strategic phases for database optimization.

---

## Notes

- **Dependencies:** Phase 1 must complete before others start
- **Parallel Work:** Phases 3, 4, 5 can run in parallel after Phase 2
- **Communication:** Weekly sync-ups recommended
- **Review:** Code review between team members before merge
- **Quality:** Phase 6 includes cross-validation by Surjit and documentation by Nilkanta
