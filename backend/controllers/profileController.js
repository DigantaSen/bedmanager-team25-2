// backend/controllers/profileController.js
const User = require('../models/User');
const path = require('path');
const fs = require('fs').promises;

// @desc    Get current user profile
// @route   GET /api/profile
// @access  Private
exports.getProfile = async (req, res) => {
  try {
    console.log('GET /api/profile - User ID:', req.user?._id);
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    const user = await User.findById(req.user._id).select('-password');
    
    if (!user) {
      console.error('User not found in database:', req.user._id);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('Profile fetched successfully for user:', user.email);
    res.status(200).json({
      success: true,
      data: user
    });
  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile',
      error: error.message
    });
  }
};

// @desc    Update user profile
// @route   PUT /api/profile
// @access  Private
exports.updateProfile = async (req, res) => {
  try {
    console.log('PUT /api/profile - User ID:', req.user?._id);
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    
    const { name, phone, address, dateOfBirth, bio, department } = req.body;
    
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: 'User not authenticated'
      });
    }
    
    const user = await User.findById(req.user._id);
    
    if (!user) {
      console.error('User not found in database:', req.user._id);
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    console.log('Updating user:', user.email);
    console.log('Before update:', { name: user.name, phone: user.phone, address: user.address });

    // Update allowed fields
    if (name && name.trim()) user.name = name.trim();
    if (phone !== undefined) user.phone = phone || null;
    if (address !== undefined) user.address = address || null;
    if (dateOfBirth !== undefined) user.dateOfBirth = dateOfBirth || null;
    if (bio !== undefined) user.bio = bio || null;
    if (department !== undefined) user.department = department || null;
    
    console.log('After update:', { name: user.name, phone: user.phone, address: user.address });

    // Handle profile picture upload
    if (req.file) {
      // Delete old profile picture if exists
      if (user.profilePicture) {
        const oldImagePath = path.join(__dirname, '..', user.profilePicture);
        try {
          await fs.unlink(oldImagePath);
        } catch (err) {
          console.log('Error deleting old profile picture:', err.message);
        }
      }
      
      // Save new profile picture path
      user.profilePicture = `/uploads/profiles/${req.file.filename}`;
    }

    await user.save();
    console.log('User saved successfully');

    // Return user without password
    const updatedUser = await User.findById(user._id).select('-password');
    console.log('Returning updated user:', updatedUser.email);

    res.status(200).json({
      success: true,
      message: 'Profile updated successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile',
      error: error.message
    });
  }
};

// @desc    Delete profile picture
// @route   DELETE /api/profile/picture
// @access  Private
exports.deleteProfilePicture = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    if (!user.profilePicture) {
      return res.status(400).json({
        success: false,
        message: 'No profile picture to delete'
      });
    }

    // Delete the file
    const imagePath = path.join(__dirname, '..', user.profilePicture);
    try {
      await fs.unlink(imagePath);
    } catch (err) {
      console.log('Error deleting profile picture file:', err.message);
    }

    // Update user
    user.profilePicture = null;
    await user.save();

    const updatedUser = await User.findById(user._id).select('-password');

    res.status(200).json({
      success: true,
      message: 'Profile picture deleted successfully',
      data: updatedUser
    });
  } catch (error) {
    console.error('Delete profile picture error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete profile picture',
      error: error.message
    });
  }
};
