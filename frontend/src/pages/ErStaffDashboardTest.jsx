import React from 'react';
import DashboardLayout from '@/components/DashboardLayout';

const ErStaffDashboardTest = () => {
  return (
    <DashboardLayout>
      <div className="p-8">
        <h1 className="text-4xl font-bold text-white mb-4">ER Staff Dashboard - Test</h1>
        <p className="text-slate-400">If you can see this, the routing and basic layout work.</p>
        <div className="mt-8 bg-slate-800 border border-slate-700 rounded-lg p-6">
          <p className="text-white">This is a test version of the ER Staff Dashboard.</p>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default ErStaffDashboardTest;
