import React from 'react';
import { X, BedDouble, User, Calendar, Clock, MapPin } from 'lucide-react';

const BedDetailsModal = ({ bed, isOpen, onClose }) => {
  if (!isOpen || !bed) return null;

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'text-green-500 bg-green-500/10 border-green-500/50';
      case 'occupied':
        return 'text-red-500 bg-red-500/10 border-red-500/50';
      case 'cleaning':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/50';
      default:
        return 'text-zinc-500 bg-neutral-900/10 border-zinc-500/50';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div className="bg-neutral-900 border border-zinc-800 rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10">
              <BedDouble className="w-6 h-6 text-cyan-500" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Bed {bed.bedId}</h2>
              <p className="text-zinc-400 text-sm">Detailed Information</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-400 hover:text-white"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Status */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 block">Status</label>
            <span className={`inline-block px-4 py-2 rounded-lg border font-semibold ${getStatusColor(bed.status)}`}>
              {bed.status.charAt(0).toUpperCase() + bed.status.slice(1)}
            </span>
          </div>

          {/* Ward */}
          <div>
            <label className="text-sm text-zinc-400 mb-2 flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Ward
            </label>
            <p className="text-white text-lg font-semibold">{bed.ward}</p>
          </div>

          {/* Patient Information */}
          {bed.patientName && (
            <div className="border-t border-zinc-800 pt-6">
              <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-cyan-500" />
                Patient Information
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-zinc-400">Patient Name</label>
                  <p className="text-white font-semibold">{bed.patientName}</p>
                </div>
                {bed.patientId && (
                  <div>
                    <label className="text-sm text-zinc-400">Patient ID</label>
                    <p className="text-white font-semibold">{bed.patientId}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="border-t border-zinc-800 pt-6">
            <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
              <Clock className="w-5 h-5 text-cyan-500" />
              Timestamps
            </h3>
            <div className="space-y-3">
              {bed.createdAt && (
                <div>
                  <label className="text-sm text-zinc-400">Created At</label>
                  <p className="text-white">{new Date(bed.createdAt).toLocaleString()}</p>
                </div>
              )}
              {bed.updatedAt && (
                <div>
                  <label className="text-sm text-zinc-400">Last Updated</label>
                  <p className="text-white">{new Date(bed.updatedAt).toLocaleString()}</p>
                </div>
              )}
            </div>
          </div>

          {/* Additional Details Placeholder */}
          <div className="border-t border-zinc-800 pt-6">
            <p className="text-zinc-500 text-sm italic">
              * Additional details (cleaning status, notes) will be added in Task 2.5c
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-zinc-800 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg border border-zinc-700 text-white hover:bg-zinc-800 transition-colors"
          >
            Close
          </button>
          <button
            className="px-4 py-2 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-white font-semibold transition-colors"
            onClick={() => {
              // Edit functionality will be added in Task 2.5c (Diganta's task)
              console.log('Edit bed:', bed._id);
            }}
          >
            Edit Details
          </button>
        </div>
      </div>
    </div>
  );
};

export default BedDetailsModal;
