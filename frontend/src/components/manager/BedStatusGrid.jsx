import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchBeds, selectAllBeds, selectBedsStatus } from '@/features/beds/bedsSlice';

const BedStatusGrid = ({ ward, onBedClick }) => {
  const dispatch = useDispatch();
  const beds = useSelector(selectAllBeds);
  const status = useSelector(selectBedsStatus);
  const currentUser = useSelector((state) => state.auth.user);
  const [filteredBeds, setFilteredBeds] = useState([]);

  useEffect(() => {
    dispatch(fetchBeds());
  }, [dispatch]);

  useEffect(() => {
    if (beds && beds.length > 0) {
      const targetWard = ward || currentUser?.ward;
      if (targetWard) {
        const filtered = beds.filter((bed) => bed.ward === targetWard);
        setFilteredBeds(filtered);
      } else {
        setFilteredBeds(beds);
      }
    }
  }, [beds, ward, currentUser?.ward]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'bg-green-500 hover:bg-green-600';
      case 'occupied':
        return 'bg-red-500 hover:bg-red-600';
      case 'cleaning':
        return 'bg-orange-500 hover:bg-orange-600';
      default:
        return 'bg-zinc-500 hover:bg-zinc-600';
    }
  };

  const getStatusLabel = (status) => {
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  if (status === 'loading') {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-cyan-500"></div>
        </div>
      </div>
    );
  }

  if (filteredBeds.length === 0) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <p className="text-zinc-400 text-center">No beds found for this ward.</p>
      </div>
    );
  }

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-white">Bed Status Grid</h2>
        <div className="flex gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-500"></div>
            <span className="text-zinc-400">Available</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-orange-500"></div>
            <span className="text-zinc-400">Cleaning</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-red-500"></div>
            <span className="text-zinc-400">Occupied</span>
          </div>
        </div>
      </div>

      <div className="mb-4 p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg">
        <p className="text-sm text-zinc-400">
          ℹ️ <span className="font-semibold">Note:</span> Beds with{' '}
          <span className="text-orange-400 font-semibold">Cleaning</span> status are being cleaned by ward staff and cannot be updated by managers.
        </p>
      </div>

      <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 lg:grid-cols-10 gap-3">
        {filteredBeds.map((bed) => {
          const isCleaningStatus = bed.status === 'cleaning';
          return (
            <button
              key={bed._id}
              onClick={() => onBedClick && onBedClick(bed)}
              className={`
                ${getStatusColor(bed.status)}
                text-white font-semibold rounded-lg p-4
                transition-all duration-200 transform hover:scale-105
                focus:outline-none focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:ring-offset-zinc-900
                flex flex-col items-center justify-center
                ${isCleaningStatus ? 'opacity-60 cursor-default' : ''}
              `}
              title={`${bed.bedId} - ${getStatusLabel(bed.status)}${isCleaningStatus ? ' (Ward Staff Only)' : ''}`}
            >
              <span className="text-lg">{bed.bedId}</span>
              {bed.patientName && (
                <span className="text-xs mt-1 truncate w-full text-center opacity-80">
                  {bed.patientName}
                </span>
              )}
              {isCleaningStatus && (
                <span className="text-xs mt-1">🧹</span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-6 text-sm text-zinc-400">
        <p>
          Showing {filteredBeds.length} beds for ward: <span className="text-cyan-400 font-semibold">{ward || currentUser?.ward || 'All'}</span>
        </p>
      </div>
    </div>
  );
};

export default BedStatusGrid;
