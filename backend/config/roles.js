// backend/config/roles.js
// Shared role and ward definitions

const ROLES = ['technical_team', 'hospital_admin', 'er_staff', 'ward_staff', 'manager'];

// Roles a user may request at sign-up (hospital_admin is only granted by an existing admin)
const SELF_SIGNUP_ROLES = ['ward_staff', 'er_staff', 'manager', 'technical_team'];

// Roles that must be assigned to a ward
const WARD_REQUIRED_ROLES = ['ward_staff', 'manager'];

const WARDS = ['ICU', 'General', 'Emergency'];

module.exports = {
  ROLES,
  SELF_SIGNUP_ROLES,
  WARD_REQUIRED_ROLES,
  WARDS
};
