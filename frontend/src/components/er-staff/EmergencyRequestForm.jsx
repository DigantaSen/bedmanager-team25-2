import React, { useState } from 'react';
import { X, AlertCircle, Loader2, User, FileText, Phone } from 'lucide-react';
import api from '@/services/api';

const EmergencyRequestForm = ({ onClose, onSuccess }) => {
  const [formData, setFormData] = useState({
    patientName: '',
    patientContact: '',
    location: '',
    priority: 'high',
    requestedWard: '',
    reason: '',
    description: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const priorityLevels = [
    { value: 'critical', label: 'Critical', color: 'text-red-500' },
    { value: 'high', label: 'High', color: 'text-orange-500' },
    { value: 'medium', label: 'Medium', color: 'text-yellow-500' },
    { value: 'low', label: 'Low', color: 'text-green-500' }
  ];

  const wards = ['ICU', 'General', 'Emergency'];

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    setError(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    console.log('Form submitted, data:', formData);
    
    // Validation
    if (!formData.patientName || !formData.patientName.trim()) {
      setError('Patient name is required');
      return;
    }
    
    if (!formData.location || !formData.location.trim()) {
      setError('Location is required');
      return;
    }
    
    if (!formData.requestedWard) {
      setError('Please select a ward');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      console.log('Sending emergency request...');
      const requestData = {
        patientName: formData.patientName.trim(),
        location: formData.location.trim(),
        ward: formData.requestedWard,
        priority: formData.priority
      };
      
      // Only include optional fields if they have values
      if (formData.patientContact && formData.patientContact.trim()) {
        requestData.patientContact = formData.patientContact.trim();
      }
      if (formData.reason && formData.reason.trim()) {
        requestData.reason = formData.reason.trim();
      }
      if (formData.description && formData.description.trim()) {
        requestData.description = formData.description.trim();
      }
      
      console.log('Request data:', requestData);
      
      const response = await api.post('/emergency-requests', requestData);
      console.log('Response:', response);

      if (response.data.success || response.status === 200 || response.status === 201) {
        alert('Emergency request submitted successfully!');
        onSuccess && onSuccess(response.data.data || response.data);
        // Reset form
        setFormData({
          patientName: '',
          patientContact: '',
          location: '',
          priority: 'high',
          requestedWard: '',
          reason: '',
          description: ''
        });
      }
    } catch (err) {
      console.error('Error submitting emergency request:', err);
      console.error('Error response:', err.response);
      
      // Show user-friendly error
      if (err.response?.status === 404) {
        setError('Emergency request feature not yet available on the server. Please contact the administrator.');
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to submit emergency request');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <AlertCircle className="w-6 h-6 text-red-500" />
          Emergency Admission Request
        </h2>
        <button
          onClick={onClose}
          className="p-1 rounded hover:bg-slate-700 transition-colors text-slate-400 hover:text-white"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {error && (
          <div className="p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm flex items-start gap-2">
            <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Patient Name */}
        <div>
          <label className="block text-sm text-slate-400 mb-2 flex items-center gap-2">
            <User className="w-4 h-4" />
            Patient Name <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.patientName}
            onChange={(e) => handleChange('patientName', e.target.value)}
            placeholder="Enter patient's full name"
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            disabled={isSubmitting}
            required
          />
        </div>

        {/* Patient Contact */}
        <div>
          <label className="block text-sm text-slate-400 mb-2 flex items-center gap-2">
            <Phone className="w-4 h-4" />
            Patient Contact (Optional)
          </label>
          <input
            type="tel"
            value={formData.patientContact}
            onChange={(e) => handleChange('patientContact', e.target.value)}
            placeholder="Enter contact number"
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            disabled={isSubmitting}
          />
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm text-slate-400 mb-2">
            Location <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={formData.location}
            onChange={(e) => handleChange('location', e.target.value)}
            placeholder="e.g., Emergency Room, Trauma Unit, etc."
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            disabled={isSubmitting}
            required
          />
        </div>

        {/* Priority Level and Ward - Two columns */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Priority Level <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.priority}
              onChange={(e) => handleChange('priority', e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              disabled={isSubmitting}
            >
              {priorityLevels.map(level => (
                <option key={level.value} value={level.value}>
                  {level.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm text-slate-400 mb-2">
              Requested Ward <span className="text-red-400">*</span>
            </label>
            <select
              value={formData.requestedWard}
              onChange={(e) => handleChange('requestedWard', e.target.value)}
              className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              disabled={isSubmitting}
              required
            >
              <option value="">Select ward</option>
              {wards.map(ward => (
                <option key={ward} value={ward}>
                  {ward}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Reason */}
        <div>
          <label className="block text-sm text-slate-400 mb-2">
            Reason (Optional)
          </label>
          <input
            type="text"
            value={formData.reason}
            onChange={(e) => handleChange('reason', e.target.value)}
            placeholder="Brief reason for emergency admission"
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
            disabled={isSubmitting}
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm text-slate-400 mb-2 flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Description (Optional)
          </label>
          <textarea
            value={formData.description}
            onChange={(e) => handleChange('description', e.target.value)}
            placeholder="Add any relevant medical information or special requirements..."
            rows="3"
            maxLength="500"
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500 resize-none"
            disabled={isSubmitting}
          />
          <p className="text-xs text-slate-500 mt-1">
            {formData.description.length}/500 characters
          </p>
        </div>

        {/* Buttons */}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-white transition-colors"
            disabled={isSubmitting}
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Submitting...
              </>
            ) : (
              'Submit Request'
            )}
          </button>
        </div>
      </form>
    </div>
  );
};

export default EmergencyRequestForm;
