import React, { useState } from 'react';
import { X, BedDouble, Loader2 } from 'lucide-react';
import api from '@/services/api';

const BedUpdateModal = ({ bed, isOpen, onClose, onSuccess }) => {
  const [status, setStatus] = useState(bed?.status || 'available');
  const [patientName, setPatientName] = useState(bed?.patientName || '');
  const [patientId, setPatientId] = useState(bed?.patientId || '');
  const [cleaningDuration, setCleaningDuration] = useState('45');
  const [isUpdating, setIsUpdating] = useState(false);
  const [error, setError] = useState(null);

  if (!isOpen || !bed) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    
    // Validation
    if (status === 'occupied' && !patientName.trim()) {
      setError('Patient name is required for occupied status');
      return;
    }
    
    if (status === 'maintenance' && (!cleaningDuration || cleaningDuration <= 0)) {
      setError('Cleaning duration is required for maintenance status');
      return;
    }
    
    setIsUpdating(true);
    
    try {
      const payload = {
        status,
        ...(status === 'occupied' && {
          patientName: patientName.trim(),
          patientId: patientId.trim() || null
        }),
        ...(status === 'maintenance' && {
          cleaningDuration: parseInt(cleaningDuration)
        })
      };
      
      const response = await api.patch(`/beds/${bed.bedId}/status`, payload);
      
      if (response.data.success) {
        onSuccess && onSuccess(response.data.data);
        onClose();
      }
    } catch (err) {
      console.error('Error updating bed:', err);
      setError(err.response?.data?.message || 'Failed to update bed');
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg max-w-md w-full">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <BedDouble className="w-6 h-6 text-cyan-500" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">Update Bed {bed.bedId}</h2>
              <p className="text-zinc-400 text-sm">Change status and details</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/50 rounded text-red-400 text-sm">
              {error}
            </div>
          )}

          {/* Status Dropdown */}
          <div>
            <label className="block text-sm text-zinc-400 mb-2">Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:border-cyan-500"
              disabled={isUpdating}
            >
              <option value="available">Available</option>
              <option value="occupied">Occupied</option>
              <option value="maintenance">Maintenance</option>
              <option value="reserved">Reserved</option>
            </select>
          </div>

          {/* Patient Info - Only for Occupied */}
          {status === 'occupied' && (
            <>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">
                  Patient Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={patientName}
                  onChange={(e) => setPatientName(e.target.value)}
                  placeholder="Enter patient name"
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                  disabled={isUpdating}
                  required
                />
              </div>
              <div>
                <label className="block text-sm text-zinc-400 mb-2">Patient ID (Optional)</label>
                <input
                  type="text"
                  value={patientId}
                  onChange={(e) => setPatientId(e.target.value)}
                  placeholder="Enter patient ID"
                  className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                  disabled={isUpdating}
                />
              </div>
            </>
          )}

          {/* Cleaning Duration - Only for Maintenance */}
          {status === 'maintenance' && (
            <div>
              <label className="block text-sm text-zinc-400 mb-2">
                Cleaning Duration (minutes) <span className="text-red-400">*</span>
              </label>
              <input
                type="number"
                value={cleaningDuration}
                onChange={(e) => setCleaningDuration(e.target.value)}
                placeholder="Enter duration in minutes"
                min="1"
                className="w-full px-4 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:border-cyan-500"
                disabled={isUpdating}
                required
              />
              <p className="text-xs text-zinc-500 mt-1">
                Estimated time to complete cleaning
              </p>
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-white transition-colors"
              disabled={isUpdating}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-cyan-600 hover:bg-cyan-700 rounded-lg text-white font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              disabled={isUpdating}
            >
              {isUpdating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Status'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BedUpdateModal;
