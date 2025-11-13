import React, { useState, useEffect } from 'react';
import { X, Bed, User, Clock, Calendar, MapPin, Loader } from 'lucide-react';
import api from '@/services/api';
import PatientTimelineCard from './PatientTimelineCard';

const OccupantDetailsModal = ({ bed, onClose }) => {
  const [history, setHistory] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (bed) {
      fetchBedHistory();
    }
  }, [bed]);

  const fetchBedHistory = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get(`/beds/${bed._id}/occupant-history`);
      setHistory(response.data.data.history);
    } catch (err) {
      console.error('Error fetching bed history:', err);
      setError('Failed to load bed history');
    } finally {
      setLoading(false);
    }
  };

  if (!bed) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-neutral-900 border border-zinc-800 rounded-lg max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-zinc-800">
          <div>
            <h2 className="text-2xl font-bold text-white flex items-center gap-3">
              <Bed className="w-6 h-6 text-cyan-500" />
              Bed Details: <span className="text-cyan-500">{bed.bedId}</span>
            </h2>
            <p className="text-zinc-400 text-sm mt-1">Complete occupancy information and history</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-zinc-800 rounded-lg transition-colors"
          >
            <X className="w-6 h-6 text-zinc-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Current Bed Information */}
          <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
            <h3 className="text-white text-lg font-bold mb-4">Current Status</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-start gap-3">
                <div className="bg-blue-500/10 p-2 rounded-lg">
                  <MapPin className="w-5 h-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-zinc-400 text-sm">Ward</p>
                  <p className="text-white font-semibold">{bed.ward}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className="bg-cyan-500/10 p-2 rounded-lg">
                  <Bed className="w-5 h-5 text-cyan-500" />
                </div>
                <div>
                  <p className="text-zinc-400 text-sm">Bed ID</p>
                  <p className="text-white font-semibold font-mono">{bed.bedId}</p>
                </div>
              </div>

              <div className="flex items-start gap-3">
                <div className={`${bed.status === 'occupied' ? 'bg-green-500/10' : 'bg-neutral-900/10'} p-2 rounded-lg`}>
                  <User className={`w-5 h-5 ${bed.status === 'occupied' ? 'text-green-500' : 'text-zinc-500'}`} />
                </div>
                <div>
                  <p className="text-zinc-400 text-sm">Status</p>
                  <p className={`font-semibold ${bed.status === 'occupied' ? 'text-green-500' : 'text-zinc-400'}`}>
                    {bed.status.charAt(0).toUpperCase() + bed.status.slice(1)}
                  </p>
                </div>
              </div>

              {bed.patientName && (
                <div className="flex items-start gap-3">
                  <div className="bg-purple-500/10 p-2 rounded-lg">
                    <User className="w-5 h-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-zinc-400 text-sm">Patient Name</p>
                    <p className="text-white font-semibold">{bed.patientName}</p>
                  </div>
                </div>
              )}

              {bed.patientId && (
                <div className="flex items-start gap-3">
                  <div className="bg-yellow-500/10 p-2 rounded-lg">
                    <Calendar className="w-5 h-5 text-yellow-500" />
                  </div>
                  <div>
                    <p className="text-zinc-400 text-sm">Patient ID</p>
                    <p className="text-white font-semibold font-mono">{bed.patientId}</p>
                  </div>
                </div>
              )}

              {bed.admissionTime && (
                <div className="flex items-start gap-3">
                  <div className="bg-green-500/10 p-2 rounded-lg">
                    <Clock className="w-5 h-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-zinc-400 text-sm">Admission Time</p>
                    <p className="text-white font-semibold">
                      {new Date(bed.admissionTime).toLocaleString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              )}

              {bed.timeInBed && (
                <div className="flex items-start gap-3">
                  <div className="bg-red-500/10 p-2 rounded-lg">
                    <Clock className="w-5 h-5 text-red-500" />
                  </div>
                  <div>
                    <p className="text-zinc-400 text-sm">Time in Bed</p>
                    <p className="text-white font-semibold">{bed.timeInBed.formatted}</p>
                    <p className="text-zinc-500 text-xs mt-1">
                      {bed.timeInBed.days.toFixed(1)} days / {bed.timeInBed.hours.toFixed(1)} hours
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Patient Timeline */}
          {loading ? (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-12 flex flex-col items-center justify-center">
              <Loader className="w-8 h-8 text-cyan-500 animate-spin mb-4" />
              <p className="text-zinc-400">Loading bed history...</p>
            </div>
          ) : error ? (
            <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 text-center">
              <p className="text-red-400">{error}</p>
              <button
                onClick={fetchBedHistory}
                className="mt-4 px-4 py-2 bg-cyan-500/10 text-cyan-500 rounded-lg hover:bg-cyan-500/20 transition-colors"
              >
                Retry
              </button>
            </div>
          ) : (
            <PatientTimelineCard history={history} />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 p-6 border-t border-zinc-800">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors font-semibold"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default OccupantDetailsModal;
