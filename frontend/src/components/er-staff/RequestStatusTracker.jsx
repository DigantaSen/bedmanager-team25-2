import React, { useState, useEffect, useImperativeHandle, forwardRef } from 'react';
import { Clock, CheckCircle, XCircle, AlertCircle, RefreshCw } from 'lucide-react';
import api from '@/services/api';

const RequestStatusTracker = forwardRef((props, ref) => {
  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRequests = async () => {
    try {
      setLoading(true);
      setError(null);
      console.log('Fetching emergency requests...');
      const response = await api.get('/emergency-requests');
      console.log('Emergency requests response:', response);

      // Backend returns { data: { emergencyRequests: [...] } }
      const requestsData = response.data?.data?.emergencyRequests || response.data?.emergencyRequests || response.data || [];
      console.log('Requests data:', requestsData);
      console.log('Is array?', Array.isArray(requestsData));

      setRequests(Array.isArray(requestsData) ? requestsData : []);
    } catch (error) {
      console.error('Error fetching emergency requests:', error);
      setError(error.message);
      setRequests([]);
    } finally {
      setLoading(false);
    }
  };

  // Expose fetchRequests to parent component via ref
  useImperativeHandle(ref, () => ({
    refresh: fetchRequests
  }));

  useEffect(() => {
    fetchRequests();
    // Auto-refresh every 10 seconds
    const interval = setInterval(fetchRequests, 10000);
    return () => clearInterval(interval);
  }, []);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <AlertCircle className="w-5 h-5 text-slate-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-500/10 border-yellow-500/30 text-yellow-400';
      case 'approved':
        return 'bg-green-500/10 border-green-500/30 text-green-400';
      case 'rejected':
        return 'bg-red-500/10 border-red-500/30 text-red-400';
      default:
        return 'bg-neutral-700/50 border-neutral-600 text-slate-400';
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case 'critical':
        return 'text-red-500 font-bold';
      case 'high':
        return 'text-orange-500 font-semibold';
      case 'medium':
        return 'text-yellow-500';
      default:
        return 'text-slate-400';
    }
  };

  const formatDateTime = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  if (loading) {
    return (
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="w-6 h-6 text-slate-400 animate-spin" />
          <span className="ml-2 text-slate-400">Loading requests...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <Clock className="w-6 h-6" />
          Request Status Tracker
        </h2>
        <div className="bg-yellow-500/10 border border-yellow-500/50 rounded-lg p-4">
          <p className="text-yellow-400">Unable to load requests. This feature requires backend support.</p>
          <p className="text-yellow-300 text-sm mt-2">Error: {error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6">
      <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
        <Clock className="w-6 h-6" />
        Request Status Tracker
      </h2>

      {requests.length === 0 ? (
        <div className="text-center py-8 text-slate-400">
          <AlertCircle className="w-12 h-12 mx-auto mb-3 opacity-50" />
          <p>No emergency requests found</p>
          <p className="text-sm text-slate-500 mt-1">Submit a request to track its status here</p>
        </div>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <div
              key={request._id}
              className={`border rounded-lg p-4 ${getStatusColor(request.status)}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusIcon(request.status)}
                    <h3 className="font-semibold text-white">{request.patientName}</h3>
                    <span className={`text-xs uppercase px-2 py-0.5 rounded ${getUrgencyColor(request.priority || request.urgencyLevel)}`}>
                      {request.priority || request.urgencyLevel}
                    </span>
                  </div>

                  <div className="text-sm space-y-1">
                    <p className="text-slate-400">
                      Ward: <span className="text-white">{request.ward || request.requestedWard}</span>
                    </p>
                    <p className="text-slate-400">
                      Location: <span className="text-white">{request.location}</span>
                    </p>
                    {request.patientContact && (
                      <p className="text-slate-400">Contact: {request.patientContact}</p>
                    )}
                  </div>
                </div>

                <div className="text-right">
                  <span className={`inline-block px-3 py-1 rounded text-xs font-semibold uppercase ${getStatusColor(request.status)}`}>
                    {request.status}
                  </span>
                  <p className="text-xs text-slate-500 mt-2">
                    {formatDateTime(request.createdAt)}
                  </p>
                </div>
              </div>

              {(request.reason || request.description) && (
                <div className="mt-3 pt-3 border-t border-neutral-700 space-y-1">
                  {request.reason && (
                    <p className="text-sm text-slate-300">
                      <span className="text-slate-400">Reason:</span> {request.reason}
                    </p>
                  )}
                  {request.description && (
                    <p className="text-sm text-slate-300">
                      <span className="text-slate-400">Details:</span> {request.description}
                    </p>
                  )}
                </div>
              )}

              {request.assignedBed && (
                <div className="mt-3 pt-3 border-t border-green-500/20">
                  <p className="text-sm text-green-400">
                    ✓ Assigned to Bed: <span className="font-semibold">{request.assignedBed}</span>
                  </p>
                </div>
              )}

              {request.rejectionReason && (
                <div className="mt-3 pt-3 border-t border-red-500/20">
                  <p className="text-sm text-red-400">
                    Rejection Reason: {request.rejectionReason}
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

RequestStatusTracker.displayName = 'RequestStatusTracker';

export default RequestStatusTracker;
