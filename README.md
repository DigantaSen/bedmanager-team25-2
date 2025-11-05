# bedmanager-team25

- run backend/seedBeds.js to populate the db with beds

## Stakeholders

### 1. Anuradha (ICU Manager)

Anuradha is the "power user" of this system, requiring the most comprehensive view and control.

**Dashboard Layout & Key Views:**
    ***Main View:** A detailed, real-time dashboard of all wards, with a special focus on the ICU.
    * **KPIs:** Prominent display of summary statistics like "ICU occupancy is 87% (35 of 40 beds in use)".
    ***Bed Status:** A granular view of all bed metadata, including status (occupied, available, cleaning, reserved) and equipment type.
    * **Alerts:** A dedicated module for real-time alerts and notifications, such as when occupancy crosses 90%.
    ***Forecasting:** Access to the full forecasting report, showing expected discharges, cleaning times, and scheduled surgeries.
    * **Actionable Lists:** Queues for pending patient transfers and emergency admission requests.
- **Permissions (Read/Write):**
  - **Read:** Full, hospital-wide read access to all bed statuses, patient details (department, estimated stay), and reports.
  - **Write:** Full control over operational tasks. This includes:
    - Allocating beds and managing patient transfers.
    - Responding to and approving emergency admission requests.
    - (Likely) Manually overriding bed statuses if needed.

#### Example User Flow: Responding to an Emergency Request

1. **Alert Received:** Anuradha is monitoring her dashboard when a real-time alert appears: "Emergency Admission Request from ER (ICU)".
2. **Review Request:** She navigates to her "Actionable Lists" queue and sees the new request.
3. **Assess Availability:** The system automatically recommends the "nearest available bed based on urgency and equipment" (e.g., Bed ICU-104).
4. **Allocate Bed:** Anuradha confirms the system's suggestion and clicks "Allocate".
5. **Confirmation:** The system updates the bed's status to "reserved" and sends an automatic confirmation to the ER Staff. The bed count on her dashboard updates instantly (e.g., "1 available").

---

### 2. Hospital Administration

This stakeholder needs a high-level, strategic view for long-term planning, not real-time operations.

- **Dashboard Layout & Key Views:**
  - **Main View:** A high-level executive dashboard showing hospital-wide utilization trends over time.
  - **Key Reports:** The primary focus would be on "utilization reports for planning" and "Forecasting report".
  - **Analytics:** Views focused on metrics like average bed occupancy, underutilization of specific wards, and capacity needs.
  - **No Real-Time Alerts:** They would likely not see real-time operational alerts (like "bed available").

- **Permissions (Read-Only):**
  - **Read:** Full, read-only access to all historical data, summary reports, and forecasting reports.
  - **Write:** No write permissions. They do not update bed statuses, manage transfers, or handle admissions. Their role is to "review" reports.

#### Example User Flow: Reviewing Monthly Utilization

1. **Login:** The administrator logs into the BedManager portal.
2. **Navigate:** They select the "Reports" or "Analytics" tab, bypassing the real-time operational dashboard.
3. **Generate Report:** They choose the "Ward Utilization Report," filter by "ICU," and set the date range to "Last 30 Days."
4. **Review:** The system generates a report with charts showing average occupancy, peak demand times, and average patient stay duration.
5. **Action:** The administrator uses this "utilization report" for long-term capacity and staffing planning.

---

### 3. Ward/Unit Staff

This stakeholder is the primary source of real-time, on-the-ground data. Their interface must be simple and task-oriented.

- **Dashboard Layout & Key Views:**
  - **Main View:** A simplified view showing *only* the beds in their assigned ward or unit.
  - **Task Interface:** The main feature would be a simple list or map of their beds, allowing them to tap a bed and change its status.
  - **No Clutter:** This view would remove all forecasting reports, hospital-wide analytics, and complex allocation suggestions.

- **Permissions (Limited Write):**
  - **Read:** Read access limited to their own ward's bed status.
  - **Write:** A very specific and crucial write permission: the ability to "update bed statuses (available, cleaning, occupied)". This is their primary function.
  - They cannot allocate beds or manage transfers—they only update the status of the bed they are physically managing.

#### Example User Flow: Updating Bed Status After Discharge

1. **Patient Discharged:** A patient is discharged from "Bed 10A".
2. **Login:** The ward staff logs into the system (e.g., on a hallway tablet or mobile device).
3. **Select Bed:** They see the simple map of their ward, tap on "Bed 10A" (currently "occupied").
4. **Update Status:** A simple modal pops up with status options. They tap "Cleaning".
5. **System Update:** The system instantly updates this bed's status. On Anuradha's dashboard, "Bed 10A" now shows as "under cleaning".
6. (Later) Once clean, the staff taps "Bed 10A" again and selects "Available".

---

### 4. ER Staff

This stakeholder has a single, high-urgency need: find a bed for a critical patient.

- **Dashboard Layout & Key Views:**
  - **Main View:** An extremely simplified, "request-focused" interface.
  - **Key Info:** A clear, simple display of "available" beds, likely filtered by ICU and other critical wards.
  - **Action Button:** A prominent button to "Request bed availability for emergencies".
  - **Notifications:** They would receive alerts when beds are freed.

- **Permissions (Request-Only):**
  - **Read:** Read-only access to bed *availability* (e.g., "2 ICU beds available") but likely not the full granular dashboard Anuradha sees.
  - **Write/Action:** No permission to *allocate* a bed themselves. Their sole "write" action is to "send emergency admission request", which then goes to the system and Anuradha for allocation.

#### Example User Flow: Requesting an Emergency Bed

1. **Patient Arrives:** A critical patient arrives in the ER.
2. **Login:** ER Staff logs into the BedManager dashboard.
3. **Check Availability:** The dashboard immediately shows "ICU Available: 2".
4. **Request Bed:** The staff clicks the "Request Emergency Admission" button and selects "ICU".
5. **Wait for Allocation:** Their dashboard updates to "Request Pending".
6. **Confirmation Received:** A few moments later, a real-time notification appears: "Request Approved. Patient allocated to Bed ICU-104." The ER staff can now prepare the patient for transfer.
