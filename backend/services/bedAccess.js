// backend/services/bedAccess.js
// Which beds a user may see or act on, and which bed fields they may see

const mongoose = require('mongoose');
const Bed = require('../models/Bed');

// Beds in service. Retired beds keep their history but are left out of current views and counts.
const ACTIVE_BEDS = { retiredAt: null };

// Roles that manage the bed inventory (and can see retired beds)
const INVENTORY_ROLES = ['technical_team'];

// Bed fields that identify or describe a patient
const PATIENT_FIELDS = ['patientName', 'patientId', 'notes', 'dischargeNotes'];

/**
 * @desc    Whether the user may see patient details for a bed
 *          (ER staff and the technical team never do; managers only for their own ward)
 */
const canSeePatients = (user, bed) => {
  switch (user.role) {
    case 'hospital_admin':
      return true;
    case 'manager':
      return !user.ward || bed.ward === user.ward;
    case 'ward_staff':
      return bed.ward === user.ward;
    default:
      return false;
  }
};

/**
 * @desc    Bed as a plain object, without the patient fields the user may not see
 */
const toBedResponse = (bed, user) => {
  const plain = typeof bed.toObject === 'function' ? bed.toObject() : { ...bed };
  if (!canSeePatients(user, plain)) {
    PATIENT_FIELDS.forEach((field) => delete plain[field]);
  }
  return plain;
};

/**
 * @desc    Find a bed (by MongoDB ID or bed ID) that the user may use
 * @param   options.action       - acting on the bed (not just viewing it): managers are limited to
 *                                 their own ward and retired beds are refused
 * @param   options.allowRetired - allow acting on a retired bed (reactivation)
 * @returns {Promise<{ bed } | { error: { status, message } }>}
 */
const findBedForUser = async (user, id, { action = true, allowRetired = false } = {}) => {
  const bed = mongoose.Types.ObjectId.isValid(id)
    ? await Bed.findById(id)
    : await Bed.findOne({ bedId: id });

  // Retired beds only exist for the technical team and admins
  if (!bed || (bed.retiredAt && !INVENTORY_ROLES.includes(user.role))) {
    return { error: { status: 404, message: 'Bed not found' } };
  }
  if (action && bed.retiredAt && !allowRetired) {
    return { error: { status: 409, message: `Bed ${bed.bedId} is retired` } };
  }

  // Ward staff only work with their own ward; managers act on their own ward's beds
  const outsideWard = (user.role === 'ward_staff' && bed.ward !== user.ward) ||
    (action && user.role === 'manager' && user.ward && bed.ward !== user.ward);
  if (outsideWard) {
    return { error: { status: 403, message: 'Not authorized for beds in this ward' } };
  }

  return { bed };
};

module.exports = {
  ACTIVE_BEDS,
  INVENTORY_ROLES,
  canSeePatients,
  toBedResponse,
  findBedForUser
};
