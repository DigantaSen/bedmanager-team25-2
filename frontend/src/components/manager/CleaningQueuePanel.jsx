import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { Sparkles, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';
import api from '@/services/api';
import { getSocket } from '@/services/socketService';

const CleaningQueuePanel = ({ ward }) => {
  const currentUser = useSelector(selectCurrentUser);
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check if user is ward staff (can mark beds clean)
  const isWardStaff = currentUser?.role === 'ward_staff';

  // Fetch cleaning queue
  const fetchCleaningQueue = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/beds/cleaning-queue', {
        params: ward ? { ward } : {}
      });

      if (response.data.success) {
        setQueueData(response.data.data);
      }
    } catch (err) {
      console.error('Error fetching cleaning queue:', err);
      setError(err.response?.data?.message || 'Failed to fetch cleaning queue');
    } finally {
      setLoading(false);
    }
  };

  // Initial fetch
  useEffect(() => {
    fetchCleaningQueue();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchCleaningQueue, 30000);

    return () => clearInterval(interval);
  }, [ward]);

  // Socket.io listeners for real-time updates
  useEffect(() => {
    const socket = getSocket();

    if (!socket) {
      console.warn('Socket not available for CleaningQueuePanel');
      return;
    }

    const handleCleaningStarted = (data) => {
      console.log('Cleaning started:', data);
      fetchCleaningQueue();
    };

    const handleCleaningCompleted = (data) => {
      console.log('Cleaning completed:', data);
      fetchCleaningQueue();
    };

    const handleBedUpdate = (data) => {
      // Refetch if any bed status changed to/from cleaning
      if (data.bed.status === 'cleaning' || data.previousStatus === 'cleaning') {
        fetchCleaningQueue();
      }
    };

    const handleBedStatusChanged = (data) => {
      // Also listen to bedStatusChanged events for cleaning transitions
      if (data.bed.status === 'cleaning' || data.previousStatus === 'cleaning') {
        fetchCleaningQueue();
      }
    };

    // Join ward-specific room if user has a ward
    if (currentUser?.ward) {
      socket.emit('joinWard', currentUser.ward);
    }

    // Listen for cleaning events
    socket.on('bedCleaningStarted', handleCleaningStarted);
    socket.on('bedCleaningCompleted', handleCleaningCompleted);
    socket.on('bedUpdate', handleBedUpdate);
    socket.on('bedStatusChanged', handleBedStatusChanged);

    return () => {
      socket.off('bedCleaningStarted', handleCleaningStarted);
      socket.off('bedCleaningCompleted', handleCleaningCompleted);
      socket.off('bedUpdate', handleBedUpdate);
      socket.off('bedStatusChanged', handleBedStatusChanged);
    };
  }, [currentUser]);

  if (status === 'loading') {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-6 h-6 text-purple-500" />
          <h2 className="text-xl sm:text-2xl font-bold text-white">Cleaning Queue</h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-6 h-6 text-purple-500" />
          <h2 className="text-xl sm:text-2xl font-bold text-white">Cleaning Queue</h2>
        </div>
        <div className="text-red-400 text-center py-8">
          <AlertCircle className="w-12 h-12 mx-auto mb-2" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  if (!queueData || queueData.beds.length === 0) {
    return (
      <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <Sparkles className="w-6 h-6 text-purple-500" />
            <h2 className="text-2xl font-bold text-white">Cleaning Queue</h2>
          </div>
          <span className="text-2xl font-bold text-green-400">0</span>
        </div>
        <div className="text-center py-8">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="text-zinc-400">No beds currently need cleaning</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6">
      {/* Header with bed count */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-purple-500" />
          <h2 className="text-2xl font-bold text-white">Cleaning Queue</h2>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-2xl font-bold text-orange-400">{queueData.summary.total}</span>
          <button
            onClick={fetchCleaningQueue}
            disabled={loading}
            className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* Simple list of beds needing cleaning */}
      <div className="space-y-3">
        {queueData.beds.map((bed) => (
          <div
            key={bed._id}
            className="bg-neutral-800 border border-neutral-700 rounded-lg p-4 hover:border-purple-500 transition-colors"
          >
            <div className="flex items-center justify-between">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white">
                  Bed {bed.bedId}
                </h3>
                <p className="text-sm text-zinc-400">Ward: {bed.ward}</p>
              </div>

              {/* Show status badge for managers (view-only) */}
              {!isWardStaff && (
                <span className="px-4 py-2 bg-orange-500/20 border border-orange-500/50 rounded text-orange-400 font-medium">
                  Needs Cleaning
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CleaningQueuePanel;
