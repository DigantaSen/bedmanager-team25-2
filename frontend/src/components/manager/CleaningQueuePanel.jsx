import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { Sparkles, Clock, AlertCircle, CheckCircle, Loader2, TrendingUp } from 'lucide-react';
import api from '@/services/api';
import { getSocket } from '@/services/socketService';

const CleaningQueuePanel = ({ ward }) => {
  const currentUser = useSelector(selectCurrentUser);
  const [queueData, setQueueData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [markingComplete, setMarkingComplete] = useState(null);

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

    // Join ward-specific room if user has a ward
    if (currentUser?.ward) {
      socket.emit('joinWard', currentUser.ward);
    }

    // Listen for cleaning events
    socket.on('bedCleaningStarted', handleCleaningStarted);
    socket.on('bedCleaningCompleted', handleCleaningCompleted);
    socket.on('bedUpdate', handleBedUpdate);

    return () => {
      socket.off('bedCleaningStarted', handleCleaningStarted);
      socket.off('bedCleaningCompleted', handleCleaningCompleted);
      socket.off('bedUpdate', handleBedUpdate);
    };
  }, [currentUser]);

  // Mark cleaning as complete
  const handleMarkComplete = async (bedId) => {
    try {
      setMarkingComplete(bedId);
      const response = await api.put(`/beds/${bedId}/cleaning/mark-complete`, {
        notes: 'Completed by manager'
      });
      
      if (response.data.success) {
        // Refetch queue
        await fetchCleaningQueue();
      }
    } catch (err) {
      console.error('Error marking cleaning complete:', err);
      alert(err.response?.data?.message || 'Failed to mark cleaning as complete');
    } finally {
      setMarkingComplete(null);
    }
  };

  // Get progress bar color based on status
  const getProgressColor = (progress) => {
    if (!progress) return 'bg-gray-600';
    if (progress.isOverdue) return 'bg-red-500';
    if (progress.percentage >= 75) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  // Get status badge
  const getStatusBadge = (progress) => {
    if (!progress) {
      return (
        <span className="px-2 py-1 rounded text-xs bg-gray-700 text-gray-300">
          No Data
        </span>
      );
    }
    
    if (progress.isOverdue) {
      return (
        <span className="px-2 py-1 rounded text-xs bg-red-900 text-red-200 flex items-center gap-1">
          <AlertCircle className="w-3 h-3" />
          Overdue
        </span>
      );
    }
    
    if (progress.percentage >= 75) {
      return (
        <span className="px-2 py-1 rounded text-xs bg-yellow-900 text-yellow-200 flex items-center gap-1">
          <Clock className="w-3 h-3" />
          Nearing Deadline
        </span>
      );
    }
    
    return (
      <span className="px-2 py-1 rounded text-xs bg-green-900 text-green-200 flex items-center gap-1">
        <TrendingUp className="w-3 h-3" />
        On Track
      </span>
    );
  };

  // Format time remaining
  const formatTimeRemaining = (minutes) => {
    if (minutes <= 0) return 'Overdue';
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (hours > 0) {
      return `${hours}h ${mins}m remaining`;
    }
    return `${mins}m remaining`;
  };

  if (loading && !queueData) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-6 h-6 text-purple-500" />
          <h2 className="text-2xl font-bold text-white">Cleaning Queue</h2>
        </div>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-6 h-6 text-purple-500" />
          <h2 className="text-2xl font-bold text-white">Cleaning Queue</h2>
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
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <div className="flex items-center gap-3 mb-4">
          <Sparkles className="w-6 h-6 text-purple-500" />
          <h2 className="text-2xl font-bold text-white">Cleaning Queue</h2>
        </div>
        <div className="text-center py-12">
          <CheckCircle className="w-12 h-12 text-green-500 mx-auto mb-2" />
          <p className="text-zinc-400">No beds currently need cleaning</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-6 h-6 text-purple-500" />
          <h2 className="text-2xl font-bold text-white">Cleaning Queue</h2>
        </div>
        <button
          onClick={fetchCleaningQueue}
          disabled={loading}
          className="px-3 py-1 bg-purple-600 hover:bg-purple-700 rounded text-sm transition-colors disabled:opacity-50"
        >
          {loading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="bg-zinc-800 rounded-lg p-4">
          <div className="text-zinc-400 text-sm mb-1">Total in Queue</div>
          <div className="text-2xl font-bold text-white">{queueData.summary.total}</div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4">
          <div className="text-zinc-400 text-sm mb-1">Overdue</div>
          <div className="text-2xl font-bold text-red-400">{queueData.summary.overdue}</div>
        </div>
        <div className="bg-zinc-800 rounded-lg p-4">
          <div className="text-zinc-400 text-sm mb-1">On Track</div>
          <div className="text-2xl font-bold text-green-400">{queueData.summary.onTrack}</div>
        </div>
      </div>

      {/* Cleaning Queue Items */}
      <div className="space-y-4">
        {queueData.beds.map((bed) => (
          <div
            key={bed._id}
            className="bg-zinc-800 border border-zinc-700 rounded-lg p-4 hover:border-purple-500 transition-colors"
          >
            <div className="flex items-start justify-between mb-3">
              <div>
                <h3 className="text-lg font-semibold text-white mb-1">
                  Bed {bed.bedId}
                </h3>
                <p className="text-sm text-zinc-400">Ward: {bed.ward}</p>
              </div>
              <div className="text-right">
                {getStatusBadge(bed.progress)}
                {bed.cleaningLog?.assignedTo && (
                  <p className="text-xs text-zinc-400 mt-1">
                    Assigned: {bed.cleaningLog.assignedTo.name || bed.cleaningLog.assignedTo.email}
                  </p>
                )}
              </div>
            </div>

            {bed.progress && (
              <>
                {/* Progress Bar */}
                <div className="mb-3">
                  <div className="flex justify-between text-xs text-zinc-400 mb-1">
                    <span>{bed.progress.percentage}% complete</span>
                    <span>{formatTimeRemaining(bed.progress.timeRemainingMinutes)}</span>
                  </div>
                  <div className="w-full bg-zinc-700 rounded-full h-2 overflow-hidden">
                    <div
                      className={`h-full ${getProgressColor(bed.progress)} transition-all duration-300`}
                      style={{ width: `${Math.min(bed.progress.percentage, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Time Details */}
                <div className="grid grid-cols-2 gap-4 text-sm mb-3">
                  <div>
                    <span className="text-zinc-400">Elapsed:</span>
                    <span className="ml-2 text-white font-medium">
                      {Math.floor(bed.progress.elapsedMinutes / 60)}h {bed.progress.elapsedMinutes % 60}m
                    </span>
                  </div>
                  <div>
                    <span className="text-zinc-400">Estimated:</span>
                    <span className="ml-2 text-white font-medium">
                      {Math.floor(bed.estimatedCleaningDuration / 60)}h {bed.estimatedCleaningDuration % 60}m
                    </span>
                  </div>
                </div>
              </>
            )}

            {/* Mark Complete Button */}
            <button
              onClick={() => handleMarkComplete(bed.bedId)}
              disabled={markingComplete === bed.bedId}
              className="w-full px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded text-white font-medium transition-colors flex items-center justify-center gap-2"
            >
              {markingComplete === bed.bedId ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Marking Complete...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Mark as Complete
                </>
              )}
            </button>
          </div>
        ))}
      </div>

      {/* Ward Breakdown (if multiple wards) */}
      {Object.keys(queueData.summary.byWard).length > 1 && (
        <div className="mt-6 pt-6 border-t border-zinc-700">
          <h3 className="text-lg font-semibold text-white mb-3">By Ward</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {Object.entries(queueData.summary.byWard).map(([wardName, stats]) => (
              <div key={wardName} className="bg-zinc-800 rounded p-3">
                <div className="text-sm text-zinc-400 mb-1">{wardName}</div>
                <div className="text-lg font-bold text-white">
                  {stats.total}
                  {stats.overdue > 0 && (
                    <span className="text-red-400 text-sm ml-2">({stats.overdue} overdue)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CleaningQueuePanel;
