import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchRequests, approveRequest, rejectRequest } from '@/features/requests/requestsSlice';
import { AlertOctagon, Clock, CheckCircle, XCircle } from 'lucide-react';

const EmergencyRequestsQueue = ({ ward }) => {
  const dispatch = useDispatch();
  const { requests, status } = useSelector((state) => state.requests);
  const currentUser = useSelector((state) => state.auth.user);
  const [processingId, setProcessingId] = useState(null);

  useEffect(() => {
    dispatch(fetchRequests());
  }, [dispatch]);

  const filteredRequests = ward || currentUser?.ward
    ? (Array.isArray(requests) ? requests : []).filter((req) => req.ward === (ward || currentUser?.ward))
    : (Array.isArray(requests) ? requests : []);

  const handleApprove = async (requestId) => {
    if (window.confirm('Are you sure you want to approve this emergency request?')) {
      setProcessingId(requestId);
      try {
        await dispatch(approveRequest({ id: requestId })).unwrap();
        alert('Emergency request approved successfully!');
      } catch (error) {
        alert(`Error: ${error.message || 'Failed to approve request'}`);
      } finally {
        setProcessingId(null);
      }
    }
  };

  const handleReject = async (requestId) => {
    const reason = window.prompt('Please provide a reason for rejection (optional):');
    if (reason !== null) { // User didn't cancel
      setProcessingId(requestId);
      try {
        await dispatch(rejectRequest({ id: requestId, rejectionReason: reason })).unwrap();
        alert('Emergency request rejected.');
      } catch (error) {
        alert(`Error: ${error.message || 'Failed to reject request'}`);
      } finally {
        setProcessingId(null);
      }
    }
  };

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical':
        return 'text-red-500 bg-red-500/10 border-red-500/50';
      case 'high':
        return 'text-orange-500 bg-orange-500/10 border-orange-500/50';
      case 'medium':
        return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/50';
      case 'low':
        return 'text-green-500 bg-green-500/10 border-green-500/50';
      default:
        return 'text-zinc-500 bg-zinc-500/10 border-zinc-500/50';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="w-5 h-5" />;
      case 'approved':
        return <CheckCircle className="w-5 h-5" />;
      case 'rejected':
        return <XCircle className="w-5 h-5" />;
      default:
        return <AlertOctagon className="w-5 h-5" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'text-yellow-500';
      case 'approved':
        return 'text-green-500';
      case 'rejected':
        return 'text-red-500';
      default:
        return 'text-zinc-500';
    }
  };

  if (status === 'loading') {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <h2 className="text-2xl font-bold text-white mb-4">Emergency Requests</h2>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-zinc-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-zinc-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-zinc-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-2xl font-bold text-white">Emergency Requests</h2>
        {filteredRequests.filter((r) => r.status === 'pending').length > 0 && (
          <span className="bg-red-500 text-white text-xs font-bold px-2 py-1 rounded-full">
            {filteredRequests.filter((r) => r.status === 'pending').length} Pending
          </span>
        )}
      </div>

      {filteredRequests.length === 0 ? (
        <div className="text-center py-8">
          <AlertOctagon className="w-12 h-12 text-zinc-600 mx-auto mb-3" />
          <p className="text-zinc-400">No emergency requests</p>
        </div>
      ) : (
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {filteredRequests.map((request) => (
            <div
              key={request._id}
              className={`
                border rounded-lg p-4
                ${getPriorityColor(request.priority)}
                transition-all duration-200 hover:shadow-lg
              `}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`font-bold uppercase text-xs px-2 py-1 rounded ${getPriorityColor(request.priority)}`}>
                      {request.priority}
                    </span>
                    <span className={`flex items-center gap-1 text-sm ${getStatusColor(request.status)}`}>
                      {getStatusIcon(request.status)}
                      {request.status}
                    </span>
                  </div>
                  <p className="text-white font-semibold mb-1">
                    Patient ID: {request.patientId}
                  </p>
                  <p className="text-zinc-300 text-sm mb-2">
                    {request.reason || request.description}
                  </p>
                  {request.location && (
                    <p className="text-zinc-400 text-xs">Location: {request.location}</p>
                  )}
                  <p className="text-zinc-500 text-xs mt-2">
                    {new Date(request.createdAt || Date.now()).toLocaleString()}
                  </p>
                </div>
              </div>

              {request.status === 'pending' && (
                <div className="mt-3 flex gap-2">
                  <button
                    className="flex-1 bg-green-500 hover:bg-green-600 text-white font-semibold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleApprove(request._id)}
                    disabled={processingId === request._id}
                  >
                    {processingId === request._id ? 'Processing...' : 'Approve'}
                  </button>
                  <button
                    className="flex-1 bg-red-500 hover:bg-red-600 text-white font-semibold py-2 px-4 rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    onClick={() => handleReject(request._id)}
                    disabled={processingId === request._id}
                  >
                    {processingId === request._id ? 'Processing...' : 'Reject'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default EmergencyRequestsQueue;
