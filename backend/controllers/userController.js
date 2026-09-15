// backend/controllers/userController.js
// User account management for the technical team (sign-up approval workflow)

const User = require('../models/User');
const { SELF_SIGNUP_ROLES, WARD_REQUIRED_ROLES } = require('../config/roles');

const ACCOUNT_STATUSES = ['pending', 'approved', 'rejected'];

// Technical team and hospital admin accounts are only created from the command line (createAdmin.js),
// so reviewers can only give, or revoke, the roles people can sign up for
const REVIEWABLE_ROLES = SELF_SIGNUP_ROLES;

// Fields safe to return to the approvals UI
const toPublicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  ward: user.ward,
  department: user.department,
  status: user.status,
  reviewedBy: user.reviewedBy,
  reviewedAt: user.reviewedAt,
  createdAt: user.createdAt
});

// Checks shared by approve and reject; returns an error response, or null when the review may go ahead
const getReviewError = (req, user) => {
  if (!user) {
    return { status: 404, message: 'User not found' };
  }
  if (user._id.equals(req.user._id)) {
    return { status: 400, message: 'You cannot change the status of your own account' };
  }
  // Pending sign-ups can always be reviewed; existing technical team and admin accounts cannot
  if (user.status !== 'pending' && !REVIEWABLE_ROLES.includes(user.role)) {
    return { status: 403, message: 'Technical team and hospital admin accounts are managed from the server command line' };
  }
  return null;
};

/**
 * @desc    List user accounts, optionally filtered by status
 * @route   GET /api/users?status=pending
 * @access  Private (technical_team)
 */
exports.getUsers = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = {};

    if (status) {
      if (!ACCOUNT_STATUSES.includes(status)) {
        return res.status(400).json({
          success: false,
          message: `Invalid status. Must be one of: ${ACCOUNT_STATUSES.join(', ')}`
        });
      }
      filter.status = status;
    }

    const users = await User.find(filter)
      .populate('reviewedBy', 'name email')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      count: users.length,
      data: { users: users.map(toPublicUser) }
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching users',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Approve a user account, optionally adjusting the requested role/ward
 * @route   PATCH /api/users/:id/approve
 * @access  Private (technical_team)
 * @body    role (optional), ward (optional)
 */
exports.approveUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    const reviewError = getReviewError(req, user);
    if (reviewError) {
      return res.status(reviewError.status).json({ success: false, message: reviewError.message });
    }

    const role = req.body.role || user.role;
    const ward = req.body.ward || user.ward;

    if (!REVIEWABLE_ROLES.includes(role)) {
      return res.status(400).json({
        success: false,
        message: `Accounts can only be approved as: ${REVIEWABLE_ROLES.join(', ')}`
      });
    }

    if (WARD_REQUIRED_ROLES.includes(role) && !ward) {
      return res.status(400).json({
        success: false,
        message: 'Ward is required for ward_staff and manager roles'
      });
    }

    user.role = role;
    user.ward = ward;
    user.status = 'approved';
    user.reviewedBy = req.user._id;
    user.reviewedAt = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: `${user.name} approved as ${user.role}`,
      data: { user: toPublicUser(user) }
    });
  } catch (error) {
    console.error('Approve user error:', error);

    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error approving user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Reject a pending account (or revoke access for an approved one)
 * @route   PATCH /api/users/:id/reject
 * @access  Private (technical_team)
 */
exports.rejectUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    const reviewError = getReviewError(req, user);
    if (reviewError) {
      return res.status(reviewError.status).json({ success: false, message: reviewError.message });
    }

    user.status = 'rejected';
    user.reviewedBy = req.user._id;
    user.reviewedAt = new Date();
    await user.save();

    res.status(200).json({
      success: true,
      message: `${user.name}'s account was rejected`,
      data: { user: toPublicUser(user) }
    });
  } catch (error) {
    console.error('Reject user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error rejecting user',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
