import React, { useState, useEffect, useCallback } from 'react';
import ExecutiveSummary from '@/components/ExecutiveSummary';
import WardUtilizationReport from '@/components/WardUtilizationReport';
import AlertNotificationPanel from '@/components/manager/AlertNotificationPanel';
import DashboardLayout from '@/components/DashboardLayout';
import api from '@/services/api';

const AdminDashboard = () => {
  const [backendConnected, setBackendConnected] = useState(true);

  // Check backend connectivity
  const checkBackendConnection = useCallback(async () => {
    try {
      await api.get('/health');
      setBackendConnected(true);
    } catch (error) {
      console.error('Backend connection check failed:', error);
      setBackendConnected(false);
    }
  }, []);

  // Periodic backend health check
  useEffect(() => {
    checkBackendConnection();
    const interval = setInterval(checkBackendConnection, 5000);
    return () => clearInterval(interval);
  }, [checkBackendConnection]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h1 className="text-4xl font-bold">Admin Dashboard</h1>
          </div>
          <p className="text-zinc-400">
            Hospital-wide analytics and insights
            {backendConnected ? (
              <span className="ml-2 text-green-400">● Live</span>
            ) : (
              <span className="ml-2 text-red-400">● Disconnected</span>
            )}
          </p>
        </div>

        {/* Executive Summary - Always Visible */}
        <div className="mb-8">
          <ExecutiveSummary />
        </div>

        {/* Active Alerts */}
        <div className="mb-8">
          <AlertNotificationPanel />
        </div>

        {/* Ward Utilization Report */}
        <div className="space-y-6">
          <WardUtilizationReport />
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
