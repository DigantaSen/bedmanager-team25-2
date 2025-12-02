// frontend/src/components/manager/NearbyHospitalsPanel.jsx
// Component for displaying nearby hospitals with bed availability for referrals

import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import { 
  Building2, 
  MapPin, 
  Phone, 
  Star, 
  ExternalLink,
  CheckCircle,
  RefreshCw,
  Filter
} from 'lucide-react';
import api from '@/services/api';

const NearbyHospitalsPanel = ({ ward }) => {
  const currentUser = useSelector((state) => state.auth.user);
  const [hospitals, setHospitals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isAdmin = currentUser?.role === 'hospital_admin';
  const [selectedWard, setSelectedWard] = useState(ward || currentUser?.ward || 'ICU');
  const [maxDistance, setMaxDistance] = useState(10);
  const [showFilters, setShowFilters] = useState(false);

  const fetchHospitals = async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      // Admin users don't filter by ward - they see all wards
      if (!isAdmin && selectedWard) params.append('ward', selectedWard);
      if (maxDistance) params.append('maxDistance', maxDistance);

      const response = await api.get(`/referrals/nearby-hospitals?${params.toString()}`);
      
      if (response.data.success) {
        setHospitals(response.data.data.hospitals);
      }
    } catch (err) {
      console.error('Error fetching nearby hospitals:', err);
      setError(err.response?.data?.message || 'Failed to fetch hospital data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHospitals();
    // Refresh every 5 minutes
    const interval = setInterval(fetchHospitals, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [selectedWard, maxDistance, isAdmin]);

  const getOccupancyColor = (rate) => {
    if (rate >= 90) return 'text-red-500';
    if (rate >= 75) return 'text-yellow-500';
    return 'text-green-500';
  };

  const getAvailabilityBadge = (available) => {
    if (available === 0) return { text: 'Full', color: 'bg-red-500/10 text-red-400 border-red-500/50' };
    if (available >= 5) return { text: `${available} beds`, color: 'bg-green-500/10 text-green-400 border-green-500/50' };
    return { text: `${available} beds`, color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/50' };
  };

  if (loading) {
    return (
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Building2 className="w-5 h-5 text-cyan-500" />
            Nearby Hospitals
          </h2>
        </div>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-zinc-800 rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-zinc-700 rounded w-3/4 mb-2"></div>
              <div className="h-3 bg-zinc-700 rounded w-1/2"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-6">
        <div className="text-center text-red-400">
          <p className="mb-3">{error}</p>
          <button
            onClick={fetchHospitals}
            className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 rounded-lg transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-cyan-500/10 to-purple-500/10 border-b border-neutral-700 p-4">
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-cyan-500" />
              Nearby Hospitals
            </h2>
            <p className="text-zinc-400 text-xs mt-1">
              {hospitals.length} hospitals {isAdmin ? 'with all ward types' : `with ${selectedWard} beds`}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`p-2 rounded-lg transition-colors ${
                showFilters 
                  ? 'bg-cyan-500/20 text-cyan-400' 
                  : 'bg-zinc-800 hover:bg-zinc-700 text-zinc-400'
              }`}
              title="Filter"
            >
              <Filter className="w-4 h-4" />
            </button>
            <button
              onClick={fetchHospitals}
              className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-400 rounded-lg transition-colors"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Filters */}
        {showFilters && (
          <div className="space-y-3 pt-3 border-t border-zinc-700">
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Ward Type</label>
              <select
                value={selectedWard}
                onChange={(e) => setSelectedWard(e.target.value)}
                className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:border-cyan-500"
                disabled={!isAdmin}
              >
                <option value="ICU">ICU</option>
                <option value="Emergency">Emergency</option>
                <option value="General">General</option>
                <option value="Pediatrics">Pediatrics</option>
              </select>
              {!isAdmin && (
                <p className="text-xs text-zinc-500 mt-1">Showing {selectedWard} beds only</p>
              )}
            </div>
            <div>
              <label className="block text-xs text-zinc-400 mb-1">Max Distance: {maxDistance} km</label>
              <input
                type="range"
                value={maxDistance}
                onChange={(e) => setMaxDistance(e.target.value)}
                min="1"
                max="20"
                className="w-full h-2 bg-zinc-700 rounded-lg appearance-none cursor-pointer accent-cyan-500"
              />
            </div>
          </div>
        )}
      </div>

      {/* Hospital List */}
      <div className="space-y-2 max-h-[calc(100vh-200px)] overflow-y-auto custom-scrollbar p-3"
        style={{
          scrollbarWidth: 'thin',
          scrollbarColor: '#3f3f46 #18181b'
        }}
      >
        {hospitals.length === 0 ? (
          <div className="text-center py-8 text-zinc-400">
            <Building2 className="w-10 h-10 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hospitals found</p>
            <p className="text-xs mt-1">Try adjusting filters</p>
          </div>
        ) : (
          hospitals.map((hospital) => {
            return (
              <div
                key={hospital.id}
                className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-3 hover:border-cyan-500/50 transition-all group"
              >
                {/* Hospital Header - Compact */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="text-white text-sm font-semibold flex items-center gap-1 group-hover:text-cyan-400 transition-colors truncate">
                      {hospital.name}
                      {hospital.acceptsReferrals && (
                        <CheckCircle className="w-3 h-3 text-green-500 flex-shrink-0" title="Accepts referrals" />
                      )}
                    </h3>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-zinc-400">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        {hospital.distance} km
                      </span>
                      {hospital.rating && (
                        <span className="flex items-center gap-1">
                          <Star className="w-3 h-3 fill-yellow-500 text-yellow-500" />
                          {hospital.rating}
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Ward Stats - Show all wards for admin, single ward for managers */}
                {isAdmin ? (
                  <div className="space-y-2">
                    {/* ICU */}
                    {hospital.wards.ICU && (
                      <div className="bg-zinc-900/50 rounded p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-cyan-400">ICU</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getAvailabilityBadge(hospital.wards.ICU.available).color}`}>
                            {getAvailabilityBadge(hospital.wards.ICU.available).text}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <p className="text-zinc-500">Avail</p>
                            <p className="font-bold text-green-400">{hospital.wards.ICU.available}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-zinc-500">Occ</p>
                            <p className="font-bold text-zinc-300">{hospital.wards.ICU.occupied}/{hospital.wards.ICU.total}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-zinc-500">Rate</p>
                            <p className={`font-bold ${getOccupancyColor(hospital.wards.ICU.occupancyRate)}`}>{hospital.wards.ICU.occupancyRate}%</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Emergency */}
                    {hospital.wards.Emergency && (
                      <div className="bg-zinc-900/50 rounded p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-red-400">Emergency</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getAvailabilityBadge(hospital.wards.Emergency.available).color}`}>
                            {getAvailabilityBadge(hospital.wards.Emergency.available).text}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <p className="text-zinc-500">Avail</p>
                            <p className="font-bold text-green-400">{hospital.wards.Emergency.available}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-zinc-500">Occ</p>
                            <p className="font-bold text-zinc-300">{hospital.wards.Emergency.occupied}/{hospital.wards.Emergency.total}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-zinc-500">Rate</p>
                            <p className={`font-bold ${getOccupancyColor(hospital.wards.Emergency.occupancyRate)}`}>{hospital.wards.Emergency.occupancyRate}%</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* General */}
                    {hospital.wards.General && (
                      <div className="bg-zinc-900/50 rounded p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-purple-400">General</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getAvailabilityBadge(hospital.wards.General.available).color}`}>
                            {getAvailabilityBadge(hospital.wards.General.available).text}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <p className="text-zinc-500">Avail</p>
                            <p className="font-bold text-green-400">{hospital.wards.General.available}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-zinc-500">Occ</p>
                            <p className="font-bold text-zinc-300">{hospital.wards.General.occupied}/{hospital.wards.General.total}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-zinc-500">Rate</p>
                            <p className={`font-bold ${getOccupancyColor(hospital.wards.General.occupancyRate)}`}>{hospital.wards.General.occupancyRate}%</p>
                          </div>
                        </div>
                      </div>
                    )}
                    {/* Pediatrics */}
                    {hospital.wards.Pediatrics && (
                      <div className="bg-zinc-900/50 rounded p-2">
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-xs font-semibold text-yellow-400">Pediatrics</span>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${getAvailabilityBadge(hospital.wards.Pediatrics.available).color}`}>
                            {getAvailabilityBadge(hospital.wards.Pediatrics.available).text}
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2 text-xs">
                          <div className="text-center">
                            <p className="text-zinc-500">Avail</p>
                            <p className="font-bold text-green-400">{hospital.wards.Pediatrics.available}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-zinc-500">Occ</p>
                            <p className="font-bold text-zinc-300">{hospital.wards.Pediatrics.occupied}/{hospital.wards.Pediatrics.total}</p>
                          </div>
                          <div className="text-center">
                            <p className="text-zinc-500">Rate</p>
                            <p className={`font-bold ${getOccupancyColor(hospital.wards.Pediatrics.occupancyRate)}`}>{hospital.wards.Pediatrics.occupancyRate}%</p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  hospital.wards[selectedWard] && (
                    <div className="grid grid-cols-3 gap-2 mb-2">
                      <div className="bg-zinc-900/50 rounded p-1.5 text-center">
                        <p className="text-xs text-zinc-500">Avail</p>
                        <p className="text-sm font-bold text-green-400">{hospital.wards[selectedWard].available}</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded p-1.5 text-center">
                        <p className="text-xs text-zinc-500">Occ</p>
                        <p className="text-sm font-bold text-zinc-300">{hospital.wards[selectedWard].occupied}/{hospital.wards[selectedWard].total}</p>
                      </div>
                      <div className="bg-zinc-900/50 rounded p-1.5 text-center">
                        <p className="text-xs text-zinc-500">Rate</p>
                        <p className={`text-sm font-bold ${getOccupancyColor(hospital.wards[selectedWard].occupancyRate)}`}>
                          {hospital.wards[selectedWard].occupancyRate}%
                        </p>
                      </div>
                    </div>
                  )
                )}

                {/* Contact - Compact */}
                <div className="flex items-center justify-between pt-2 border-t border-zinc-700">
                  <div className="flex items-center gap-2 text-xs">
                    {hospital.phone && (
                      <a
                        href={`tel:${hospital.phone}`}
                        className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300 transition-colors"
                      >
                        <Phone className="w-3 h-3" />
                        <span className="hidden sm:inline">Call</span>
                      </a>
                    )}
                    {hospital.website && (
                      <a
                        href={hospital.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-purple-400 hover:text-purple-300 transition-colors"
                      >
                        <ExternalLink className="w-3 h-3" />
                        <span className="hidden sm:inline">Web</span>
                      </a>
                    )}
                  </div>
                  <span className="text-xs text-zinc-500">
                    {new Date(hospital.lastUpdated).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Summary Footer */}
      {hospitals.length > 0 && (
        <div className="p-3 border-t border-zinc-700 bg-zinc-900/50">
          <div className="flex items-center justify-between text-xs">
            <span className="text-zinc-400">
              {isAdmin ? (
                <span>
                  Total Available:
                  <span className="text-green-400 font-semibold ml-1">
                    ICU: {hospitals.reduce((sum, h) => sum + (h.wards.ICU?.available || 0), 0)},
                    ER: {hospitals.reduce((sum, h) => sum + (h.wards.Emergency?.available || 0), 0)},
                    Gen: {hospitals.reduce((sum, h) => sum + (h.wards.General?.available || 0), 0)}
                  </span>
                </span>
              ) : (
                <span>
                  Total {selectedWard}: 
                  <span className="text-green-400 font-semibold ml-1">
                    {hospitals.reduce((sum, h) => sum + (h.wards[selectedWard]?.available || 0), 0)} beds
                  </span>
                </span>
              )}
            </span>
            <span className="text-zinc-500">
              Auto-refresh 5m
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NearbyHospitalsPanel;
