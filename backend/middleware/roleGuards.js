// backend/middleware/roleGuards.js

/**
 * @desc    Role-based read access control for beds
 * @access  Private (requires protect middleware first)
 * @note    Express 5 re-parses req.query on every read, so the scope is stored on req.bedScope
 *          (applied in getAllBeds). Patient fields are removed per role when beds are returned.
 */
exports.canReadBeds = (req, res, next) => {
  const { role, ward } = req.user;

  // Ward staff → only their assigned ward
  if (role === 'ward_staff') {
    if (!ward) {
      return res.status(403).json({
        success: false,
        message: 'No ward is assigned to your account. Ask an administrator to assign one.'
      });
    }
    req.bedScope = { ward };
    return next();
  }

  // Manager, hospital admin, ER staff and technical team → all beds
  // (ER staff and the technical team without patient details)
  req.bedScope = {};
  return next();
};

/**
 * @desc    Role-based write access control for bed status updates
 * @access  Private (requires protect middleware first)
 * @note    Only ward_staff and manager can update bed status; the ward check happens when the
 *          bed is loaded (services/bedAccess.findBedForUser)
 */
exports.canUpdateBedStatus = (req, res, next) => {
  if (!['ward_staff', 'manager'].includes(req.user.role)) {
    return res.status(403).json({
      success: false,
      message: 'You do not have permission to update bed status.'
    });
  }
  return next();
};
