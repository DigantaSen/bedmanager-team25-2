import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { fetchBeds } from '@/features/beds/bedsSlice';
import { Briefcase } from 'lucide-react';
import KPISummaryCard from '@/components/manager/KPISummaryCard';
import BedStatusGrid from '@/components/manager/BedStatusGrid';
import AlertNotificationPanel from '@/components/manager/AlertNotificationPanel';
import EmergencyRequestsQueue from '@/components/manager/EmergencyRequestsQueue';
import ForecastingPanel from '@/components/manager/ForecastingPanel';
import CleaningQueuePanel from '@/components/manager/CleaningQueuePanel';
import BedUpdateModal from '@/components/manager/BedUpdateModal';
import DashboardLayout from '@/components/DashboardLayout';

const ManagerDashboard = () => {
  const currentUser = useSelector(selectCurrentUser);
  const dispatch = useDispatch();
  const [selectedBed, setSelectedBed] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Request notification permission on mount
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().then((permission) => {
        console.log('Notification permission:', permission);
      });
    }
  }, []);

  const handleBedClick = (bed) => {
    setSelectedBed(bed);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedBed(null);
  };

  const handleUpdateSuccess = () => {
    // Refresh beds after successful update
    dispatch(fetchBeds());
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
            {/* Header */}
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <Briefcase className="w-8 h-8 text-purple-500" />
                <h1 className="text-4xl font-bold">Manager Dashboard</h1>
              </div>
              <p className="text-zinc-400">
                Welcome, <span className="text-cyan-400">{currentUser?.name}</span>
                {currentUser?.ward && (
                  <span className="ml-2">
                    | Ward: <span className="text-purple-400 font-semibold">{currentUser.ward}</span>
                  </span>
                )}
              </p>
            </div>

            {/* KPI Summary Cards */}
            <KPISummaryCard ward={currentUser?.ward} />

            {/* Bed Status Grid */}
            <BedStatusGrid ward={currentUser?.ward} onBedClick={handleBedClick} />

            {/* Two Column Layout for Alerts and Emergency Requests */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <AlertNotificationPanel ward={currentUser?.ward} />
              <EmergencyRequestsQueue ward={currentUser?.ward} />
            </div>

            {/* Cleaning Queue Panel - Task 2.5b */}
            <CleaningQueuePanel ward={currentUser?.ward} />

            {/* Forecasting Panel */}
        <ForecastingPanel ward={currentUser?.ward} />

        {/* Bed Update Modal */}
        <BedUpdateModal
          bed={selectedBed}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
          onSuccess={handleUpdateSuccess}
        />
      </div>
    </DashboardLayout>
  );
};

export default ManagerDashboard;
