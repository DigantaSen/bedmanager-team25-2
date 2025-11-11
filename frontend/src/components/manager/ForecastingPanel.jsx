import React from 'react';
import { TrendingUp, Calendar, Users, Clock } from 'lucide-react';

const ForecastingPanel = ({ ward }) => {
  // This component will be populated with actual forecasting data from Task 2.4 (Shubham's backend task)
  // For now, displaying placeholder structure

  const forecastData = [
    {
      icon: Calendar,
      label: 'Expected Discharges (Next 24h)',
      value: '-',
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      icon: Users,
      label: 'Expected Admissions',
      value: '-',
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Clock,
      label: 'Avg. Length of Stay',
      value: '- days',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      icon: TrendingUp,
      label: 'Projected Occupancy',
      value: '-%',
      color: 'text-yellow-500',
      bgColor: 'bg-yellow-500/10',
    },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center gap-2 mb-6">
        <TrendingUp className="w-6 h-6 text-cyan-500" />
        <h2 className="text-2xl font-bold text-white">Forecasting & Insights</h2>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {forecastData.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={index}
              className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`${item.bgColor} p-3 rounded-lg`}>
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-zinc-400 text-sm">{item.label}</p>
                  <p className="text-white text-xl font-bold">{item.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
        <p className="text-zinc-400 text-sm mb-2 flex items-center gap-2">
          <Calendar className="w-4 h-4" />
          Upcoming Events Timeline
        </p>
        <div className="space-y-2">
          <div className="flex items-center gap-3 py-2">
            <div className="w-2 h-2 rounded-full bg-zinc-600"></div>
            <p className="text-zinc-500 text-sm">
              Forecasting data will be available after Task 2.4 implementation
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 text-xs text-zinc-500 italic">
        * Forecasting data integration pending (Task 2.4 - Backend)
      </div>
    </div>
  );
};

export default ForecastingPanel;
