import React, { useState } from 'react';
import ExecutiveSummary from '@/components/ExecutiveSummary';
import WardUtilizationReport from '@/components/WardUtilizationReport';
import OccupancyTrendsChart from '@/components/OccupancyTrendsChart';
import ForecastingInsights from '@/components/ForecastingInsights';
import ReportGenerator from '@/components/ReportGenerator';
import DashboardLayout from '@/components/DashboardLayout';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent mb-2">
            Admin Dashboard
          </h1>
          <p className="text-slate-400">Hospital-wide analytics and insights</p>
        </div>

        {/* Executive Summary - Always Visible */}
        <div className="mb-8">
          <ExecutiveSummary />
        </div>

        {/* Tabbed Navigation */}
        <div className="mb-6">
          <div className="grid w-full grid-cols-4 gap-2 bg-slate-800/50 border border-slate-700 rounded-lg p-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'overview'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('trends')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'trends'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              Trends
            </button>
            <button
              onClick={() => setActiveTab('forecasting')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'forecasting'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              Forecasting
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                activeTab === 'reports'
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-300 hover:bg-slate-700'
              }`}
            >
              Reports
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-6">
          {activeTab === 'overview' && <WardUtilizationReport />}
          {activeTab === 'trends' && <OccupancyTrendsChart />}
          {activeTab === 'forecasting' && <ForecastingInsights />}
          {activeTab === 'reports' && <ReportGenerator />}
        </div>
      </div>
    </DashboardLayout>
  );
};

export default AdminDashboard;
