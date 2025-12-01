// backend/controllers/authController.js
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const { AppError } = require('../middleware/errorHandler');

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
exports.register = async (req, res) => {
  try {
    const { email, password, name, role, ward, assignedWards, department } = req.body;
    
    // Debug log
    console.log('📝 Register request body:', { 
      email, 
      password: password ? '***' : undefined, 
      name, 
      role,
      ward,
      assignedWards,
      department
    });

    // Validate required fields
    if (!email || !password || !name) {
      console.log('❌ Validation failed: Missing required fields');
      return res.status(400).json({
        success: false,
        message: 'Please provide email, password, and name'
      });
    }

    // Validate ward requirement for specific roles
    if ((role === 'ward_staff' || role === 'manager') && !ward) {
      return res.status(400).json({
        success: false,
        message: 'Ward is required for ward_staff and manager roles'
      });
    }

    // Validate password length
    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: 'Password must be at least 6 characters long'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Email already registered'
      });
    }

    // Prepare user data
    const userData = {
      name,
      email: email.toLowerCase(),
      password,
      role: role || 'ward_staff'
    };

    // Add optional fields if provided
    if (ward) userData.ward = ward;
    if (assignedWards && Array.isArray(assignedWards) && assignedWards.length > 0) {
      userData.assignedWards = assignedWards;
    }
    if (department) userData.department = department;

    // Create user (password will be hashed by model pre-save hook)
    const user = await User.create(userData);

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email, 
        role: user.role,
        ward: user.ward,
        assignedWards: user.assignedWards,
        department: user.department
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          ward: user.ward,
          assignedWards: user.assignedWards,
          department: user.department,
          profilePicture: user.profilePicture,
          phone: user.phone,
          address: user.address,
          dateOfBirth: user.dateOfBirth,
          bio: user.bio
        },
        token
      }
    });
  } catch (error) {
    console.error('Register error:', error);
    if (error.code === 11000) {
      return res.status(409).json({
        success: false,
        message: 'Email already in use'
      });
    }
    res.status(500).json({
      success: false,
      message: 'Server error during registration',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: 'Please provide email and password'
      });
    }

    // Find user by email and include password field
    const user = await User.findOne({ email: email.toLowerCase() }).select(
      '+password'
    );

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Compare passwords
    const isPasswordMatch = await user.matchPassword(password);

    if (!isPasswordMatch) {
      return res.status(401).json({
        success: false,
        message: 'Invalid email or password'
      });
    }

    // Generate JWT token
    const token = jwt.sign(
      { 
        id: user._id, 
        email: user.email, 
        role: user.role,
        ward: user.ward,
        assignedWards: user.assignedWards,
        department: user.department
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '7d' }
    );

    res.status(200).json({
      success: true,
      message: 'Login successful',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          ward: user.ward,
          assignedWards: user.assignedWards,
          department: user.department,
          profilePicture: user.profilePicture,
          phone: user.phone,
          address: user.address,
          dateOfBirth: user.dateOfBirth,
          bio: user.bio
        },
        token
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error during login',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
exports.getMe = async (req, res) => {
  try {
    const user = await User.findById(req.user.id);

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.status(200).json({
      success: true,
      message: 'Current user fetched successfully',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role,
          ward: user.ward,
          assignedWards: user.assignedWards,
          department: user.department,
          createdAt: user.createdAt
        }
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error fetching user data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};
