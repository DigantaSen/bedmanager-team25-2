// backend/controllers/userController.js
// Admin-only user account management (sign-up approval workflow)

const User = require('../models/User');
const { WARD_REQUIRED_ROLES } = require('../config/roles');

const ACCOUNT_STATUSES = ['pending', 'approved', 'rejected'];

// Fields safe to return to the admin UI
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

/**
 * @desc    List user accounts, optionally filtered by status
 * @route   GET /api/users?status=pending
 * @access  Private (hospital_admin)
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
 * @access  Private (hospital_admin)
 * @body    role (optional), ward (optional)
 */
exports.approveUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user._id.equals(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change the status of your own account'
      });
    }

    const role = req.body.role || user.role;
    const ward = req.body.ward || user.ward;

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
 * @access  Private (hospital_admin)
 */
exports.rejectUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (user._id.equals(req.user._id)) {
      return res.status(400).json({
        success: false,
        message: 'You cannot change the status of your own account'
      });
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
