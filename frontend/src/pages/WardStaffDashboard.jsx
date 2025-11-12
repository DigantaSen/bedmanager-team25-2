import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchBeds } from '@/features/beds/bedsSlice';
import WardBedGrid from '@/components/WardBedGrid';
import AvailableBedsList from '@/components/AvailableBedsList';
import api from '@/services/api';
import DashboardLayout from '@/components/DashboardLayout';

const WardStaffDashboard = () => {
  const dispatch = useDispatch();
  const { bedsList, status } = useSelector((state) => state.beds);
  const { user } = useSelector((state) => state.auth);
  const [assignedWard, setAssignedWard] = useState('');

  useEffect(() => {
    dispatch(fetchBeds());
  }, [dispatch]);

  useEffect(() => {
    // Set assigned ward from user data (check both ward and assignedWards fields)
    if (user && user.ward) {
      setAssignedWard(user.ward);
    } else if (user && user.assignedWards && user.assignedWards.length > 0) {
      setAssignedWard(user.assignedWards[0]);
    } else {
      // Default to first ward if no assignment
      const wards = [...new Set(bedsList.map(bed => bed.ward))];
      if (wards.length > 0) {
        setAssignedWard(wards[0]);
      }
    }
  }, [user, bedsList]);

  // Filter beds by assigned ward - show only beds from user's ward
  const wardBeds = bedsList.filter(bed => bed.ward === assignedWard);

  const handleStatusUpdate = async (bedId, newStatus) => {
    try {
      console.log('Updating bed status:', bedId, newStatus);
      await api.patch(`/beds/${bedId}/status`, { status: newStatus });
      console.log('Status updated successfully, refreshing beds...');
      await dispatch(fetchBeds());
      console.log('Beds refreshed');
    } catch (error) {
      console.error('Error updating bed status:', error);
      alert('Failed to update bed status: ' + (error.response?.data?.message || error.message));
    }
  };

  const stats = {
    total: wardBeds.length,
    available: wardBeds.filter(b => b.status === 'available').length,
    cleaning: wardBeds.filter(b => b.status === 'cleaning').length,
    occupied: wardBeds.filter(b => b.status === 'occupied').length
  };

  if (status === 'loading') {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-full">
          <div className="text-white text-xl">Loading beds...</div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2">
            Ward Staff Dashboard
          </h1>
          <p className="text-slate-400">
            {assignedWard || 'No ward assigned'} • Total Beds: {bedsList.length} • Ward Beds: {wardBeds.length}
          </p>
        </div>

        {/* Stats - Show Available, Cleaning, and Occupied */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
            <div className="text-slate-400 text-sm mb-1">Total Beds</div>
            <div className="text-2xl font-bold text-white">{stats.total}</div>
          </div>
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
            <div className="text-green-400 text-sm mb-1">Available</div>
            <div className="text-2xl font-bold text-green-400">{stats.available}</div>
          </div>
          <div className="bg-orange-500/10 border border-orange-500/30 rounded-lg p-4">
            <div className="text-orange-400 text-sm mb-1">Needs Cleaning</div>
            <div className="text-2xl font-bold text-orange-400">{stats.cleaning}</div>
          </div>
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <div className="text-blue-400 text-sm mb-1">Occupied</div>
            <div className="text-2xl font-bold text-blue-400">{stats.occupied}</div>
          </div>
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
          {/* Bed Grid */}
          <div className="lg:col-span-2">
            <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
              <h2 className="text-xl font-bold text-white mb-4">Bed Status</h2>
              <WardBedGrid beds={wardBeds} onStatusUpdate={handleStatusUpdate} />
            </div>
          </div>

          {/* Available Beds List */}
          <div className="lg:col-span-1">
            <AvailableBedsList beds={wardBeds} />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default WardStaffDashboard;
