import React, { useState, useEffect } from 'react';
import { Users, Bed, RefreshCw, TrendingUp, AlertCircle } from 'lucide-react';
import api from '@/services/api';
import OccupantTable from '@/components/manager/OccupantTable';
import OccupantDetailsModal from '@/components/manager/OccupantDetailsModal';
import DashboardLayout from '@/components/DashboardLayout';

const OccupantStatusDashboard = () => {
  const [occupiedBeds, setOccupiedBeds] = useState([]);
  const [summary, setSummary] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedBed, setSelectedBed] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);

  useEffect(() => {
    fetchOccupiedBeds();
    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchOccupiedBeds, 30000);
    return () => clearInterval(interval);
  }, []);

  const fetchOccupiedBeds = async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await api.get('/beds/occupied');
      setOccupiedBeds(response.data.data.beds);
      setSummary(response.data.data.summary);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Error fetching occupied beds:', err);
      setError('Failed to load occupied beds data');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    fetchOccupiedBeds();
  };

  const handleSelectBed = (bed) => {
    setSelectedBed(bed);
  };

  const handleCloseModal = () => {
    setSelectedBed(null);
  };

  // Calculate overall statistics
  const totalOccupied = occupiedBeds.length;
  const averageTimeInBed = totalOccupied > 0
    ? occupiedBeds.reduce((sum, bed) => sum + (bed.timeInBed?.days || 0), 0) / totalOccupied
    : 0;
  const longestStay = totalOccupied > 0
    ? Math.max(...occupiedBeds.map(bed => bed.timeInBed?.days || 0))
    : 0;

  if (loading && occupiedBeds.length === 0) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-12 flex items-center justify-center">
            <div className="text-center">
              <RefreshCw className="w-12 h-12 text-cyan-500 animate-spin mx-auto mb-4" />
              <p className="text-zinc-400">Loading occupant data...</p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white flex items-center gap-3">
              <Users className="w-8 h-8 text-cyan-500" />
              Bed Occupant Status Dashboard
            </h1>
            <p className="text-zinc-400 mt-2">
              Monitor all occupied beds, patient details, and occupancy history
            </p>
          </div>
          <button
            onClick={handleRefresh}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-cyan-500/10 text-cyan-500 rounded-lg hover:bg-cyan-500/20 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="bg-cyan-500/10 p-3 rounded-lg">
                <Bed className="w-6 h-6 text-cyan-500" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Total Occupied Beds</p>
                <p className="text-white text-3xl font-bold">{totalOccupied}</p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="bg-blue-500/10 p-3 rounded-lg">
                <TrendingUp className="w-6 h-6 text-blue-500" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Avg. Time in Bed</p>
                <p className="text-white text-3xl font-bold">
                  {averageTimeInBed.toFixed(1)}<span className="text-xl">d</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="bg-yellow-500/10 p-3 rounded-lg">
                <AlertCircle className="w-6 h-6 text-yellow-500" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Longest Stay</p>
                <p className="text-white text-3xl font-bold">
                  {longestStay.toFixed(1)}<span className="text-xl">d</span>
                </p>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <div className="flex items-center gap-3">
              <div className="bg-purple-500/10 p-3 rounded-lg">
                <Users className="w-6 h-6 text-purple-500" />
              </div>
              <div>
                <p className="text-zinc-400 text-sm">Wards with Patients</p>
                <p className="text-white text-3xl font-bold">{summary.length}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Ward Summary */}
        {summary.length > 0 && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
            <h2 className="text-white text-xl font-bold mb-4">Ward Summary</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {summary.map((ward) => (
                <div
                  key={ward.ward}
                  className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 hover:border-zinc-600 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-semibold">{ward.ward}</h3>
                    <span className="px-3 py-1 bg-cyan-500/10 text-cyan-500 rounded-full text-sm font-bold">
                      {ward.occupiedCount}
                    </span>
                  </div>
                  <p className="text-zinc-400 text-sm">
                    {ward.occupiedCount} {ward.occupiedCount === 1 ? 'patient' : 'patients'} currently admitted
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Error Message */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/50 rounded-lg p-4 flex items-center gap-3">
            <AlertCircle className="w-5 h-5 text-red-500" />
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Occupant Table */}
        <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-white text-xl font-bold">All Occupied Beds</h2>
            {lastUpdated && (
              <p className="text-zinc-500 text-sm">
                Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            )}
          </div>
          
          {occupiedBeds.length === 0 ? (
            <div className="text-center py-12">
              <Bed className="w-16 h-16 text-zinc-700 mx-auto mb-4" />
              <p className="text-zinc-400 text-lg">No occupied beds found</p>
              <p className="text-zinc-500 text-sm mt-2">
                All beds are currently available or in maintenance
              </p>
            </div>
          ) : (
            <OccupantTable beds={occupiedBeds} onSelectBed={handleSelectBed} />
          )}
        </div>
      </div>

      {/* Details Modal */}
      {selectedBed && (
        <OccupantDetailsModal bed={selectedBed} onClose={handleCloseModal} />
      )}
    </DashboardLayout>
  );
};

export default OccupantStatusDashboard;
