// frontend/src/pages/Profile.jsx
import { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/card';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { User, Mail, Phone, MapPin, Calendar, Briefcase, FileText, Camera, Edit2, Save, X, Shield, ArrowLeft } from 'lucide-react';
import { updateUserProfile } from '../features/auth/authSlice';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001';

const Profile = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [profileData, setProfileData] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    address: '',
    dateOfBirth: '',
    bio: '',
    department: ''
  });
  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      console.log('Fetching profile...');
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      console.log('Token found:', !!token);
      
      if (!token) {
        setError('No authentication token found');
        setProfileData({}); // Set empty object to stop loading
        return;
      }
      
      console.log('Making request to:', `${API_URL}/api/profile`);
      const response = await axios.get(`${API_URL}/api/profile`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      console.log('Profile response:', response.data);
      
      if (response.data.success && response.data.data) {
        console.log('Setting profile data:', response.data.data);
        setProfileData(response.data.data);
        setFormData({
          name: response.data.data.name || '',
          phone: response.data.data.phone || '',
          address: response.data.data.address || '',
          dateOfBirth: response.data.data.dateOfBirth ? new Date(response.data.data.dateOfBirth).toISOString().split('T')[0] : '',
          bio: response.data.data.bio || '',
          department: response.data.data.department || ''
        });
        
        if (response.data.data.profilePicture) {
          setImagePreview(`${API_URL}${response.data.data.profilePicture}`);
        }
      } else {
        console.error('Invalid response format:', response.data);
        setError('Invalid response from server');
        setProfileData({}); // Set empty object to stop loading
      }
    } catch (err) {
      console.error('Failed to fetch profile:', err);
      console.error('Error response:', err.response?.data);
      console.error('Error status:', err.response?.status);
      setError(err.response?.data?.message || 'Failed to load profile data');
      setProfileData({}); // Set empty object to stop loading
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        setError('Image size must be less than 5MB');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        setError('Please select an image file');
        return;
      }
      
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found');
        setLoading(false);
        return;
      }
      
      console.log('Submitting profile update:', formData);
      
      const formDataToSend = new FormData();
      
      // Always send all fields, even if empty
      Object.keys(formData).forEach(key => {
        formDataToSend.append(key, formData[key] || '');
      });
      
      if (imageFile) {
        formDataToSend.append('profilePicture', imageFile);
      }

      console.log('Sending request to:', `${API_URL}/api/profile`);
      
      const response = await axios.put(`${API_URL}/api/profile`, formDataToSend, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

      console.log('Update response:', response.data);

      if (response.data.success && response.data.data) {
        setProfileData(response.data.data);
        
        // Update Redux store with new user data (including profile picture)
        dispatch(updateUserProfile(response.data.data));
        
        // Update form data with the response to ensure UI reflects saved data
        setFormData({
          name: response.data.data.name || '',
          phone: response.data.data.phone || '',
          address: response.data.data.address || '',
          dateOfBirth: response.data.data.dateOfBirth ? new Date(response.data.data.dateOfBirth).toISOString().split('T')[0] : '',
          bio: response.data.data.bio || '',
          department: response.data.data.department || ''
        });
        
        if (response.data.data.profilePicture) {
          setImagePreview(`${API_URL}${response.data.data.profilePicture}`);
        }
        
        setSuccess('Profile updated successfully!');
        setIsEditing(false);
        setImageFile(null);
        
        setTimeout(() => setSuccess(''), 3000);
      }
    } catch (err) {
      console.error('Failed to update profile:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
    setImageFile(null);
    setError('');
    setSuccess('');
    
    // Reset form data
    if (profileData) {
      setFormData({
        name: profileData.name || '',
        phone: profileData.phone || '',
        address: profileData.address || '',
        dateOfBirth: profileData.dateOfBirth ? new Date(profileData.dateOfBirth).toISOString().split('T')[0] : '',
        bio: profileData.bio || '',
        department: profileData.department || ''
      });
      
      if (profileData.profilePicture) {
        setImagePreview(`${API_URL}${profileData.profilePicture}`);
      }
    }
  };

  const handleDeletePicture = async () => {
    if (!window.confirm('Are you sure you want to delete your profile picture?')) {
      return;
    }

    try {
      const token = localStorage.getItem('authToken') || localStorage.getItem('token');
      if (!token) {
        setError('No authentication token found');
        return;
      }
      
      await axios.delete(`${API_URL}/api/profile/picture`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      setImagePreview(null);
      setImageFile(null);
      setSuccess('Profile picture deleted successfully');
      fetchProfile();
      
      setTimeout(() => setSuccess(''), 3000);
    } catch (err) {
      console.error('Failed to delete picture:', err);
      console.error('Error response:', err.response?.data);
      setError(err.response?.data?.message || 'Failed to delete profile picture');
    }
  };

  const getRoleBadgeColor = (role) => {
    const colors = {
      hospital_admin: 'bg-purple-100 text-purple-800',
      manager: 'bg-blue-100 text-blue-800',
      ward_staff: 'bg-green-100 text-green-800',
      er_staff: 'bg-red-100 text-red-800',
      technical_team: 'bg-gray-100 text-gray-800'
    };
    return colors[role] || 'bg-gray-100 text-gray-800';
  };

  const getRoleLabel = (role) => {
    const labels = {
      hospital_admin: 'Hospital Admin',
      manager: 'Manager',
      ward_staff: 'Ward Staff',
      er_staff: 'ER Staff',
      technical_team: 'Technical Team'
    };
    return labels[role] || role;
  };

  // Show loading only initially, not when profileData becomes an empty object
  if (profileData === null) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <div className="container mx-auto p-6 max-w-5xl">
        <div className="mb-6">
          <Button 
            onClick={() => navigate(-1)} 
            variant="outline" 
            className="flex items-center gap-2 bg-white dark:bg-neutral-900 hover:bg-neutral-100 dark:hover:bg-neutral-800 border-neutral-300 dark:border-neutral-700 shadow-sm"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
        </div>
        
        <Card className="bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 shadow-xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        <CardHeader className="bg-neutral-800 dark:bg-neutral-950 pb-20 pt-6 border-b border-neutral-700">
          <div className="relative">
            <div className="text-center">
              <CardTitle className="text-2xl md:text-3xl font-bold text-white">Your Profile</CardTitle>
              <CardDescription className="text-neutral-300 dark:text-neutral-400 mt-2">Manage your personal information and settings</CardDescription>
            </div>
            <div className="absolute top-0 right-0 flex gap-2">
              {!isEditing ? (
                <Button onClick={() => setIsEditing(true)} className="flex items-center gap-2 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700">
                  <Edit2 className="w-4 h-4" />
                  Edit Profile
                </Button>
              ) : (
                <>
                  <Button onClick={handleCancel} variant="outline" className="flex items-center gap-2 bg-white/10 dark:bg-neutral-800/50 text-white border-white/30 dark:border-neutral-700 hover:bg-white/20 dark:hover:bg-neutral-800/70">
                    <X className="w-4 h-4" />
                    Cancel
                  </Button>
                  <Button onClick={handleSubmit} disabled={loading} className="flex items-center gap-2 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-white hover:bg-neutral-100 dark:hover:bg-neutral-800 border border-neutral-300 dark:border-neutral-700">
                    <Save className="w-4 h-4" />
                    {loading ? 'Saving...' : 'Save Changes'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-0">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Profile Picture Section */}
            <div className="flex flex-col items-center space-y-4 pb-6 -mt-16">
              {error && (
                <div className="w-full max-w-md mt-20 p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 rounded-lg text-center">
                  {error}
                </div>
              )}
              
              {success && (
                <div className="w-full max-w-md mt-20 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900 text-green-700 dark:text-green-400 rounded-lg text-center">
                  {success}
                </div>
              )}
              <div className="relative">
                <div className="w-36 h-36 rounded-full overflow-hidden bg-neutral-700 dark:bg-neutral-800 flex items-center justify-center ring-4 ring-neutral-100 dark:ring-neutral-900 shadow-2xl">
                  {imagePreview ? (
                    <img src={imagePreview} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-20 h-20 text-white" />
                  )}
                </div>
                
                {isEditing && (
                  <label className="absolute bottom-0 right-0 bg-neutral-800 dark:bg-neutral-700 text-white p-3 rounded-full cursor-pointer hover:bg-neutral-900 dark:hover:bg-neutral-600 transition-all shadow-lg ring-4 ring-neutral-100 dark:ring-neutral-900">
                    <Camera className="w-5 h-5" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              
              {isEditing && imagePreview && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={handleDeletePicture}
                  className="text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 border-red-200 dark:border-red-900"
                >
                  Remove Picture
                </Button>
              )}
              
              <div className="text-center">
                <h3 className="text-2xl font-bold text-neutral-900 dark:text-neutral-100 mt-2">{profileData?.name || 'User'}</h3>
                <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-semibold mt-3 shadow-md ${getRoleBadgeColor(profileData?.role)}`}>
                  {getRoleLabel(profileData?.role)}
                </span>
              </div>
            </div>

            {/* Basic Information */}
            <div className="space-y-4 pt-6">
              <div className="flex items-center gap-3 pb-3 border-b-2 border-neutral-200 dark:border-neutral-800">
                <div className="p-2 bg-neutral-800 dark:bg-neutral-700 rounded-lg shadow-md">
                  <User className="w-5 h-5 text-white" />
                </div>
                <h4 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  Basic Information
                </h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Full Name *</Label>
                  {isEditing ? (
                    <Input
                      id="name"
                      name="name"
                      value={formData.name}
                      onChange={handleInputChange}
                      required
                      className="border-neutral-300 dark:border-neutral-700 focus:border-neutral-500 dark:focus:border-neutral-500 focus:ring-neutral-500 dark:bg-neutral-800 dark:text-neutral-100"
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                      <User className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                      <span className="text-neutral-900 dark:text-neutral-100 font-medium">{profileData?.name || 'Not provided'}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <div className="flex items-center gap-2 p-3 bg-neutral-200 dark:bg-neutral-800 rounded-lg border border-neutral-300 dark:border-neutral-700">
                    <Mail className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                    <span className="text-neutral-900 dark:text-neutral-100 font-medium">{profileData?.email || 'Not provided'}</span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 italic">Email cannot be changed</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone Number</Label>
                  {isEditing ? (
                    <Input
                      id="phone"
                      name="phone"
                      type="tel"
                      value={formData.phone}
                      onChange={handleInputChange}
                      placeholder="+1 (555) 123-4567"
                      className="border-neutral-300 dark:border-neutral-700 focus:border-neutral-500 dark:focus:border-neutral-500 focus:ring-neutral-500 dark:bg-neutral-800 dark:text-neutral-100"
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                      <Phone className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                      <span className="text-neutral-900 dark:text-neutral-100 font-medium">{profileData?.phone || 'Not provided'}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="dateOfBirth">Date of Birth</Label>
                  {isEditing ? (
                    <Input
                      id="dateOfBirth"
                      name="dateOfBirth"
                      type="date"
                      value={formData.dateOfBirth}
                      onChange={handleInputChange}
                      max={new Date().toISOString().split('T')[0]}
                      className="border-neutral-300 dark:border-neutral-700 focus:border-neutral-500 dark:focus:border-neutral-500 focus:ring-neutral-500 dark:bg-neutral-800 dark:text-neutral-100"
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                      <Calendar className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                      <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                        {profileData?.dateOfBirth 
                          ? new Date(profileData.dateOfBirth).toLocaleDateString()
                          : 'Not provided'
                        }
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Work Information */}
            <div className="space-y-4 pt-6 border-t-2 border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-3 pb-3">
                <div className="p-2 bg-neutral-800 dark:bg-neutral-700 rounded-lg shadow-md">
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <h4 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  Work Information
                </h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="role">Role</Label>
                  <div className="flex items-center gap-2 p-3 bg-neutral-200 dark:bg-neutral-800 rounded-lg border border-neutral-300 dark:border-neutral-700">
                    <Shield className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                    <span className="text-neutral-900 dark:text-neutral-100 font-medium">{getRoleLabel(profileData?.role)}</span>
                  </div>
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 italic">Role is assigned by admin</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="department">Department</Label>
                  {isEditing ? (
                    <Input
                      id="department"
                      name="department"
                      value={formData.department}
                      onChange={handleInputChange}
                      placeholder="e.g., Cardiology, Emergency"
                      className="border-neutral-300 dark:border-neutral-700 focus:border-neutral-500 dark:focus:border-neutral-500 focus:ring-neutral-500 dark:bg-neutral-800 dark:text-neutral-100"
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                      <Briefcase className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                      <span className="text-neutral-900 dark:text-neutral-100 font-medium">{profileData?.department || 'Not specified'}</span>
                    </div>
                  )}
                </div>

                {profileData?.ward && (
                  <div className="space-y-2">
                    <Label>Assigned Ward</Label>
                    <div className="flex items-center gap-2 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                      <MapPin className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                      <span className="text-neutral-900 dark:text-neutral-100 font-medium">{profileData?.ward}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4 pt-6 border-t-2 border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-3 pb-3">
                <div className="p-2 bg-neutral-800 dark:bg-neutral-700 rounded-lg shadow-md">
                  <FileText className="w-5 h-5 text-white" />
                </div>
                <h4 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  Additional Information
                </h4>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  {isEditing ? (
                    <Input
                      id="address"
                      name="address"
                      value={formData.address}
                      onChange={handleInputChange}
                      placeholder="Your address"
                      className="border-neutral-300 dark:border-neutral-700 focus:border-neutral-500 dark:focus:border-neutral-500 focus:ring-neutral-500 dark:bg-neutral-800 dark:text-neutral-100"
                    />
                  ) : (
                    <div className="flex items-center gap-2 p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                      <MapPin className="w-4 h-4 text-neutral-600 dark:text-neutral-400" />
                      <span className="text-neutral-900 dark:text-neutral-100 font-medium">{profileData?.address || 'Not provided'}</span>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  {isEditing ? (
                    <textarea
                      id="bio"
                      name="bio"
                      value={formData.bio}
                      onChange={handleInputChange}
                      placeholder="Tell us about yourself..."
                      rows="4"
                      maxLength="1000"
                      className="w-full p-2 border border-neutral-300 dark:border-neutral-700 rounded-md focus:outline-none focus:ring-2 focus:ring-neutral-500 dark:focus:ring-neutral-500 text-neutral-900 dark:text-neutral-100 dark:bg-neutral-800"
                    />
                  ) : (
                    <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200 min-h-[100px]">
                      <p className="text-gray-900 font-medium whitespace-pre-wrap">{profileData?.bio || 'No bio provided'}</p>
                    </div>
                  )}
                  {isEditing && (
                    <p className="text-xs text-neutral-600 dark:text-neutral-400">
                      {formData.bio.length}/1000 characters
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Account Information */}
            <div className="space-y-4 pt-6 border-t-2 border-neutral-200 dark:border-neutral-800">
              <div className="flex items-center gap-3 pb-3">
                <div className="p-2 bg-neutral-800 dark:bg-neutral-700 rounded-lg shadow-md">
                  <Mail className="w-5 h-5 text-white" />
                </div>
                <h4 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                  Account Information
                </h4>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">Member Since:</span>{' '}
                  <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                    {profileData?.createdAt ? new Date(profileData.createdAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
                <div className="p-3 bg-neutral-100 dark:bg-neutral-800 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <span className="font-semibold text-neutral-700 dark:text-neutral-300">Last Updated:</span>{' '}
                  <span className="text-neutral-900 dark:text-neutral-100 font-medium">
                    {profileData?.updatedAt ? new Date(profileData.updatedAt).toLocaleDateString() : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default Profile;
