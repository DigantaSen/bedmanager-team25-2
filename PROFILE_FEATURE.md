# Profile Feature Documentation

## Overview
The Profile feature allows all authenticated users to view and edit their personal information, including uploading a profile picture.

## Features

### 1. **View Profile**
- Display user's basic information (name, email, phone, date of birth)
- Show work information (role, department, assigned ward)
- Display profile picture
- Show account creation and last update dates

### 2. **Edit Profile**
- Update name, phone, address, date of birth
- Add or update bio (max 1000 characters)
- Update department information
- Upload/change profile picture (JPEG, PNG, GIF, WEBP - max 5MB)
- Delete profile picture

### 3. **Read-Only Fields**
- Email (cannot be changed)
- Role (assigned by admin)
- Assigned Ward (for ward_staff and manager)

## API Endpoints

### GET /api/profile
Get current user's profile information
- **Auth Required**: Yes
- **Response**: User object without password

### PUT /api/profile
Update user profile
- **Auth Required**: Yes
- **Content-Type**: multipart/form-data
- **Body Parameters**:
  - name (string)
  - phone (string)
  - address (string)
  - dateOfBirth (date)
  - bio (string, max 1000 chars)
  - department (string)
  - profilePicture (file, optional - max 5MB)
- **Response**: Updated user object

### DELETE /api/profile/picture
Delete profile picture
- **Auth Required**: Yes
- **Response**: Updated user object without profile picture

## Database Schema Updates

### User Model
Added fields:
```javascript
profilePicture: String (URL path)
phone: String (validated phone format)
address: String (max 500 chars)
dateOfBirth: Date (must be in past)
bio: String (max 1000 chars)
```

## File Upload
- **Storage**: `backend/uploads/profiles/`
- **Filename Format**: `user-{userId}-{timestamp}-{random}.{ext}`
- **Allowed Types**: JPEG, JPG, PNG, GIF, WEBP
- **Size Limit**: 5MB
- **Access**: Static files served at `/uploads/*`

## Frontend Routes
- `/profile` - Profile page (accessible to all authenticated users)

## Navigation
Profile link added to sidebar navigation in all dashboards:
- Hospital Admin Dashboard
- Manager Dashboard
- Ward Staff Dashboard
- ER Staff Dashboard
- Technical Team Dashboard

## Security
- All profile endpoints require authentication
- Users can only view/edit their own profile
- File upload validation (type, size)
- Old profile pictures are deleted when uploading new ones

## Usage

### Access Profile
1. Log in to any dashboard
2. Click "Profile" in the sidebar
3. View your profile information

### Edit Profile
1. Click "Edit Profile" button
2. Update desired fields
3. Optionally upload a new profile picture
4. Click "Save Changes"

### Upload Profile Picture
1. Click "Edit Profile"
2. Click the camera icon on profile picture
3. Select an image file (max 5MB)
4. Click "Save Changes"

### Delete Profile Picture
1. Click "Edit Profile"
2. Click "Remove Picture" button
3. Confirm deletion

## Testing
Test the profile feature for all user roles:
- ✅ Hospital Admin
- ✅ Manager
- ✅ Ward Staff
- ✅ ER Staff
- ✅ Technical Team

## Dependencies
### Backend
- `multer` - File upload handling

### Frontend
- Existing dependencies (React, Axios, Lucide icons)

## Notes
- Profile pictures are stored on the server filesystem
- Consider using cloud storage (S3, Cloudinary) for production
- Implement image compression/optimization for better performance
- Add image cropping functionality for better UX
