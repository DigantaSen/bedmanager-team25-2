import React, { useState, useEffect, useRef } from 'react';
import { useSelector } from 'react-redux';
import { AlertCircle, RefreshCw } from 'lucide-react';
import AvailabilitySummary from '@/components/er-staff/AvailabilitySummary';
import EmergencyRequestForm from '@/components/er-staff/EmergencyRequestForm';
import RequestStatusTracker from '@/components/er-staff/RequestStatusTracker';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/services/api';

console.log('ErStaffDashboard module loaded');

const ErStaffDashboard = () => {
  console.log('ErStaffDashboard component executing');
  const { user } = useSelector((state) => state.auth);
  const [availabilityData, setAvailabilityData] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [error, setError] = useState(null);
  const requestTrackerRef = useRef(null);

  // Fetch availability data
  const fetchAvailability = async () => {
    try {
      setRefreshing(true);
      setError(null);
      console.log('Fetching beds data...');
      const response = await api.get('/beds');
      console.log('Beds response:', response);
      
      // Calculate availability by ward - handle multiple possible data structures
      let beds = response.data?.data?.beds || response.data?.beds || response.data?.data || response.data;
      console.log('Extracted beds:', beds);
      
      if (!Array.isArray(beds)) {
        console.error('Beds data is not an array:', beds);
        setError('Invalid data format received');
        return;
      }
      
      const wardSummary = {};
      
      beds.forEach(bed => {
        if (!wardSummary[bed.ward]) {
          wardSummary[bed.ward] = { total: 0, available: 0, occupied: 0, cleaning: 0 };
        }
        wardSummary[bed.ward].total++;
        if (bed.status) {
          wardSummary[bed.ward][bed.status] = (wardSummary[bed.ward][bed.status] || 0) + 1;
        }
      });
      
      console.log('Ward summary:', wardSummary);
      setAvailabilityData(wardSummary);
      setLastUpdated(new Date());
    } catch (error) {
      console.error('Error fetching availability:', error);
      setError(error.message || 'Failed to fetch bed data');
    } finally {
      setRefreshing(false);
    }
  };

  // Auto-refresh every 10 seconds
  useEffect(() => {
    fetchAvailability();
    const interval = setInterval(fetchAvailability, 10000);
    return () => clearInterval(interval);
  }, []);

  const handleRequestSuccess = () => {
    setShowRequestForm(false);
    // Trigger refresh of the request tracker
    console.log('Request submitted successfully, refreshing tracker...');
    if (requestTrackerRef.current) {
      requestTrackerRef.current.refresh();
    }
  };

  console.log('ErStaffDashboard rendering, user:', user);
  console.log('Availability data:', availabilityData);
  console.log('Error:', error);

  try {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto space-y-6 text-white">
          {/* Error Display */}
          {error && (
            <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertCircle className="w-5 h-5" />
                <span>Error: {error}</span>
              </div>
            </div>
          )}

          {/* Header */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white">ER Staff Dashboard</h1>
                <p className="text-slate-400 mt-1">
                  Emergency bed availability and request management
                </p>
              </div>
              <div className="flex items-center gap-2 text-sm text-slate-400">
                {lastUpdated && (
                  <>
                    <RefreshCw className={`w-4 h-4 ${refreshing ? 'animate-spin' : ''}`} />
                    <span>Updated {lastUpdated.toLocaleTimeString()}</span>
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Availability Summary */}
          {availabilityData ? (
            <AvailabilitySummary 
              data={availabilityData} 
              loading={refreshing} 
              lastUpdated={lastUpdated}
            />
          ) : (
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center">
              <RefreshCw className="w-8 h-8 text-slate-400 animate-spin mx-auto mb-2" />
              <p className="text-slate-400">Loading bed availability...</p>
            </div>
          )}

          {/* Emergency Request Button */}
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6 text-center">
            <button
              onClick={() => setShowRequestForm(!showRequestForm)}
              className="px-8 py-4 bg-red-600 hover:bg-red-700 text-white text-lg font-semibold rounded-lg transition-colors flex items-center gap-3 mx-auto"
            >
              <AlertCircle className="w-6 h-6" />
              {showRequestForm ? 'Cancel Request' : 'Request Emergency Admission'}
            </button>
          </div>

          {/* Emergency Request Form */}
          {showRequestForm && (
            <EmergencyRequestForm
              onClose={() => setShowRequestForm(false)}
              onSuccess={handleRequestSuccess}
            />
          )}

          {/* Request Status Tracker */}
          <RequestStatusTracker ref={requestTrackerRef} />
        </div>
      </DashboardLayout>
    );
  } catch (err) {
    console.error('ErStaffDashboard render error:', err);
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto p-8">
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6">
            <h2 className="text-xl font-bold text-red-400 mb-2">Dashboard Error</h2>
            <p className="text-red-300">Failed to render ER Staff Dashboard: {err.message}</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }
};

export default ErStaffDashboard;
