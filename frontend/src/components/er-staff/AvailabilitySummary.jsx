import React from 'react';
import { BedDouble, Activity, AlertTriangle } from 'lucide-react';

const AvailabilitySummary = ({ data, loading }) => {
  console.log('AvailabilitySummary rendering with data:', data);
  
  if (!data) {
    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <div className="flex items-center justify-center">
          <Activity className="w-6 h-6 text-slate-400 animate-spin" />
          <span className="ml-2 text-slate-400">Loading availability...</span>
        </div>
      </div>
    );
  }

  try {
    const wards = Object.keys(data).map(wardName => ({
      name: wardName,
      total: data[wardName]?.total || 0,
      available: data[wardName]?.available || 0,
      occupied: data[wardName]?.occupied || 0,
      cleaning: data[wardName]?.cleaning || 0
    }));
    
    console.log('Wards array:', wards);

    return (
      <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-6">
        <h2 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
          <BedDouble className="w-6 h-6" />
          Available Beds by Ward (Read-Only)
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {wards.map((ward) => {
          const availabilityRate = ward.total > 0 ? (ward.available / ward.total) * 100 : 0;
          const isLowAvailability = availabilityRate < 20;
          
          return (
            <div
              key={ward.name}
              className={`border rounded-lg p-4 ${
                isLowAvailability 
                  ? 'bg-red-500/10 border-red-500/30' 
                  : 'bg-slate-700/50 border-slate-600'
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-semibold text-white">{ward.name}</h3>
                {isLowAvailability && (
                  <AlertTriangle className="w-5 h-5 text-red-400" />
                )}
              </div>
              
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Total Beds:</span>
                  <span className="text-sm font-semibold text-white">{ward.total}</span>
                </div>
                
                <div className="flex justify-between items-center">
                  <span className="text-sm text-slate-400">Available:</span>
                  <span className={`text-lg font-bold ${
                    ward.available === 0 ? 'text-red-400' : 
                    ward.available < 3 ? 'text-orange-400' : 
                    'text-green-400'
                  }`}>
                    {ward.available}
                  </span>
                </div>
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Occupied:</span>
                  <span className="text-blue-400">{ward.occupied}</span>
                </div>
                
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500">Cleaning:</span>
                  <span className="text-orange-400">{ward.cleaning}</span>
                </div>
                
                {/* Availability Bar */}
                <div className="mt-3">
                  <div className="w-full bg-slate-600 rounded-full h-2">
                    <div
                      className={`h-full rounded-full transition-all ${
                        availabilityRate < 20 ? 'bg-red-500' :
                        availabilityRate < 50 ? 'bg-orange-500' :
                        'bg-green-500'
                      }`}
                      style={{ width: `${availabilityRate}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-1 text-center">
                    {availabilityRate.toFixed(0)}% Available
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      
        {wards.length === 0 && (
          <div className="text-center py-8 text-slate-400">
            No ward data available
          </div>
        )}
      </div>
    );
  } catch (error) {
    console.error('AvailabilitySummary error:', error);
    return (
      <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-6">
        <div className="text-red-400">
          Error displaying availability: {error.message}
        </div>
      </div>
    );
  }
};

export default AvailabilitySummary;
