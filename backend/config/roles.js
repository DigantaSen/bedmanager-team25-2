// backend/config/roles.js
// Shared role and ward definitions

const ROLES = ['technical_team', 'hospital_admin', 'er_staff', 'ward_staff', 'manager'];

// Roles a user may request at sign-up, and the only roles the technical team can give when approving.
// hospital_admin and technical_team accounts are created from the command line (createAdmin.js).
const SELF_SIGNUP_ROLES = ['ward_staff', 'er_staff', 'manager'];

// Roles that must be assigned to a ward
const WARD_REQUIRED_ROLES = ['ward_staff', 'manager'];

const WARDS = ['ICU', 'General', 'Emergency'];

module.exports = {
  ROLES,
  SELF_SIGNUP_ROLES,
  WARD_REQUIRED_ROLES,
  WARDS
};
