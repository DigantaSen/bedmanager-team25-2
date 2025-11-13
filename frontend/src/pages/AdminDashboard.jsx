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
          <div className="flex items-center gap-3 mb-2">
            <svg className="w-8 h-8 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            <h1 className="text-4xl font-bold">Admin Dashboard</h1>
          </div>
          <p className="text-zinc-400">Hospital-wide analytics and insights</p>
        </div>

        {/* Executive Summary - Always Visible */}
        <div className="mb-8">
          <ExecutiveSummary />
        </div>

        {/* Tabbed Navigation */}
        <div className="mb-6">
          <div className="grid w-full grid-cols-4 gap-2 bg-neutral-900 border border-neutral-700 rounded-lg p-2">
            <button
              onClick={() => setActiveTab('overview')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'overview'
                ? 'bg-blue-500 text-white'
                : 'text-slate-300 hover:bg-neutral-700'
                }`}
            >
              Overview
            </button>
            <button
              onClick={() => setActiveTab('trends')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'trends'
                ? 'bg-blue-500 text-white'
                : 'text-slate-300 hover:bg-neutral-700'
                }`}
            >
              Trends
            </button>
            <button
              onClick={() => setActiveTab('forecasting')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'forecasting'
                ? 'bg-blue-500 text-white'
                : 'text-slate-300 hover:bg-neutral-700'
                }`}
            >
              Forecasting
            </button>
            <button
              onClick={() => setActiveTab('reports')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${activeTab === 'reports'
                ? 'bg-blue-500 text-white'
                : 'text-slate-300 hover:bg-neutral-700'
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
