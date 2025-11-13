import React, { useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { fetchBeds, selectAllBeds, selectBedsStatus } from '@/features/beds/bedsSlice';
import TimeRemaining from '../common/TimeRemaining';

const BedStatusGrid = ({ ward, onBedClick }) => {
  const dispatch = useDispatch();
  const beds = useSelector(selectAllBeds);
  const status = useSelector(selectBedsStatus);
  const currentUser = useSelector((state) => state.auth.user);
  const [filteredBeds, setFilteredBeds] = useState([]);

  useEffect(() => {
    dispatch(fetchBeds());
  }, [dispatch]);

  // Natural sort function for bed IDs (e.g., iA1, iA2, iA10, iA11)
  const naturalSort = (a, b) => {
    const bedIdA = a.bedId || '';
    const bedIdB = b.bedId || '';

    // Extract the letter part and number part
    const matchA = bedIdA.match(/^([a-zA-Z]+)(\d+)$/);
    const matchB = bedIdB.match(/^([a-zA-Z]+)(\d+)$/);

    if (!matchA || !matchB) {
      // Fallback to string comparison if pattern doesn't match
      return bedIdA.localeCompare(bedIdB);
    }

    const [, letterA, numA] = matchA;
    const [, letterB, numB] = matchB;

    // First compare the letter part
    const letterCompare = letterA.localeCompare(letterB);
    if (letterCompare !== 0) {
      return letterCompare;
    }

    // Then compare the number part numerically
    return parseInt(numA, 10) - parseInt(numB, 10);
  };

  useEffect(() => {
    if (beds && beds.length > 0) {
      const targetWard = ward || currentUser?.ward;
      if (targetWard) {
        const filtered = beds.filter((bed) => bed.ward === targetWard);
        // Sort beds naturally by bedId
        filtered.sort(naturalSort);
        setFilteredBeds(filtered);
      } else {
        // Sort all beds naturally by bedId
        const sorted = [...beds].sort(naturalSort);
        setFilteredBeds(sorted);
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

  // Group beds by their letter prefix (e.g., iA, iB)
  const groupBedsByPrefix = (beds) => {
    const groups = {};
    beds.forEach((bed) => {
      const match = bed.bedId?.match(/^([a-zA-Z]+)(\d+)$/);
      const prefix = match ? match[1] : 'Other';
      if (!groups[prefix]) {
        groups[prefix] = [];
      }
      groups[prefix].push(bed);
    });
    return groups;
  };

  const renderBedButton = (bed) => {
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
        {bed.status === 'occupied' && bed.estimatedDischargeTime && (
          <div className="mt-1">
            <TimeRemaining targetTime={bed.estimatedDischargeTime} compact={true} />
          </div>
        )}
        {isCleaningStatus && (
          <span className="text-xs mt-1">🧹</span>
        )}
      </button>
    );
  };

  const bedGroups = groupBedsByPrefix(filteredBeds);

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
        <h2 className="text-2xl font-bold text-white">Bed Status Grid</h2>
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 text-sm">
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

      <div className="space-y-6">
        {Object.keys(bedGroups).sort().map((prefix) => (
          <div key={`group-${prefix}`} className="space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold text-cyan-400">{prefix} Beds</h3>
              <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/50 to-transparent"></div>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-8 2xl:grid-cols-10 gap-3">
              {bedGroups[prefix].map((bed) => renderBedButton(bed))}
            </div>
          </div>
        ))}
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
