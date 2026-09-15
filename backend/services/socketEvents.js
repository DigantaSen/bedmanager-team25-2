// backend/services/socketEvents.js
// Who receives which real-time event.
//
// Socket.IO broadcasts reach every connected client unless they are aimed at a room, and a
// bed document carries patient name, patient id, notes and discharge notes. Events are
// therefore addressed to rooms that mirror the same rules the REST API applies in
// services/bedAccess: patient details only for the ward's own staff and hospital admins,
// and a stripped copy for roles that never see patient data.
const { toBedResponse } = require('./bedAccess');

// toBedResponse decides by role, so these stand in for "may see patients" and "may not"
// rather than repeating the field list here
const PATIENT_VIEWER = { role: 'hospital_admin' };
const NON_PATIENT_VIEWER = { role: 'er_staff' };

const ROOMS = {
  // A single user, for events that concern only them
  user: (id) => `user-${id}`,
  // Ward staff and the manager of one ward: may see patient details for that ward
  patients: (ward) => `patients-${ward}`,
  // Hospital admins: may see patient details everywhere
  patientsAll: 'patients-all',
  // The manager of one ward: audience for that ward's requests and alerts
  oversight: (ward) => `oversight-${ward}`,
  // Hospital admins: audience for every ward's requests and alerts
  oversightAll: 'oversight-all',
  role: (role) => `role-${role}`,
  ward: (ward) => `ward-${ward}`
};

// Roles that may see beds but never patient details
const NON_PATIENT_ROLES = ['er_staff', 'technical_team'];

/**
 * @desc    Put a freshly connected socket in the rooms its user's role allows
 */
const joinRooms = (socket, user) => {
  const { id, role, ward } = user;

  if (id) socket.join(ROOMS.user(id));
  if (role) socket.join(ROOMS.role(role));
  if (ward) socket.join(ROOMS.ward(ward));

  if (role === 'hospital_admin') {
    socket.join(ROOMS.patientsAll);
    socket.join(ROOMS.oversightAll);
    return;
  }

  if (role === 'manager') {
    // A manager without a ward oversees all of them, as in bedAccess.canSeePatients
    if (ward) {
      socket.join(ROOMS.patients(ward));
      socket.join(ROOMS.oversight(ward));
    } else {
      socket.join(ROOMS.patientsAll);
      socket.join(ROOMS.oversightAll);
    }
    return;
  }

  if (role === 'ward_staff' && ward) {
    socket.join(ROOMS.patients(ward));
  }
  // ER staff and the technical team stay out of the patient rooms: they receive the
  // stripped copy through their role room
};

/**
 * @desc    Send a bed event, with patient details only to those allowed to see them
 * @param   extra - event fields other than the bed itself; must not contain patient data
 */
const emitBedEvent = (io, event, bed, extra = {}) => {
  if (!io || !bed) return;

  const ward = bed.ward;

  io.to(ROOMS.patients(ward)).to(ROOMS.patientsAll).emit(event, {
    ...extra,
    bed: toBedResponse(bed, PATIENT_VIEWER)
  });

  // Same event, patient fields removed, for roles that only track bed availability
  let others = io.to(ROOMS.role(NON_PATIENT_ROLES[0]));
  for (const role of NON_PATIENT_ROLES.slice(1)) others = others.to(ROOMS.role(role));
  others.emit(event, {
    ...extra,
    bed: toBedResponse(bed, NON_PATIENT_VIEWER)
  });
};

/**
 * @desc    Send an emergency request event to the ward's manager, hospital admins and,
 *          when given, the member of staff who raised the request
 */
const emitRequestEvent = (io, event, payload, { ward, requestedBy } = {}) => {
  if (!io) return;

  let target = io.to(ROOMS.oversightAll);
  if (ward) target = target.to(ROOMS.oversight(ward));
  if (requestedBy) target = target.to(ROOMS.user(requestedBy));
  target.emit(event, payload);
};

/**
 * @desc    Send an alert to the audience named in its targetRole (manager, hospital admin),
 *          narrowed to the alert's ward when it has one
 */
const emitAlert = (io, alert) => {
  if (!io || !alert) return;

  let target = io.to(ROOMS.oversightAll);
  if (alert.ward) {
    target = target.to(ROOMS.oversight(alert.ward));
  } else {
    // A hospital-wide alert reaches every manager
    target = target.to(ROOMS.role('manager'));
  }
  target.emit('alertCreated', alert);
};

module.exports = { ROOMS, joinRooms, emitBedEvent, emitRequestEvent, emitAlert };
