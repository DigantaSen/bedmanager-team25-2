import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { selectCurrentUser } from '@/features/auth/authSlice';
import { Briefcase } from 'lucide-react';
import KPISummaryCard from '@/components/manager/KPISummaryCard';
import BedStatusGrid from '@/components/manager/BedStatusGrid';
import AlertNotificationPanel from '@/components/manager/AlertNotificationPanel';
import EmergencyRequestsQueue from '@/components/manager/EmergencyRequestsQueue';
import ForecastingPanel from '@/components/manager/ForecastingPanel';
import BedDetailsModal from '@/components/manager/BedDetailsModal';

const ManagerDashboard = () => {
  const currentUser = useSelector(selectCurrentUser);
  const [selectedBed, setSelectedBed] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleBedClick = (bed) => {
    setSelectedBed(bed);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedBed(null);
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
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

        {/* Forecasting Panel */}
        <ForecastingPanel ward={currentUser?.ward} />

        {/* Bed Details Modal */}
        <BedDetailsModal
          bed={selectedBed}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      </div>
    </div>
  );
};

export default ManagerDashboard;
