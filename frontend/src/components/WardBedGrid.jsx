import React, { useState, useCallback, memo } from 'react';
import SimpleStatusUpdateModal from './SimpleStatusUpdateModal';

// Task 4.3: Memoize BedCard component to optimize re-renders on mobile
const BedCard = memo(({ bed, onBedClick, canUpdate, statusColor }) => (
  <button
    onClick={() => onBedClick(bed)}
    // Task 4.3: Larger touch targets (min 48x48px), active state for tactile feedback
    className={`${statusColor} border-2 rounded-lg p-4 sm:p-5 text-center transition-all min-h-[80px] sm:min-h-[90px] ${canUpdate
      ? 'hover:scale-105 active:scale-95 hover:shadow-lg cursor-pointer touch-manipulation'
      : 'cursor-default opacity-75'
      } ${canUpdate ? 'ring-2 ring-orange-500/50 animate-pulse' : ''}`}
    // Task 4.3: Improve touch responsiveness on mobile
    aria-label={`Bed ${bed.bedId}, status: ${bed.status}${canUpdate ? ', can update' : ''}`}
  >
    <div className="font-bold text-lg sm:text-xl">{bed.bedId}</div>
    <div className="text-xs sm:text-sm mt-1 capitalize">{bed.status}</div>
    {canUpdate && (
      <div className="text-xs sm:text-sm mt-1 text-orange-300 font-semibold">✓ Can Update</div>
    )}
  </button>
));

BedCard.displayName = 'BedCard';

const WardBedGrid = ({ beds, onStatusUpdate, isOffline = false }) => {
  const [selectedBed, setSelectedBed] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Natural sort function for bed IDs (e.g., iA1, iA2, iA10, iA11)
  const naturalSort = useCallback((a, b) => {
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
  }, []);

  // Sort beds naturally
  const sortedBeds = [...beds].sort(naturalSort);

  // Group beds by their letter prefix (e.g., iA, iB)
  const groupBedsByPrefix = useCallback((beds) => {
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
  }, []);

  const bedGroups = groupBedsByPrefix(sortedBeds);

  // Task 4.3: Memoize click handler to prevent unnecessary re-renders
  const handleBedClick = useCallback((bed) => {
    setSelectedBed(bed);
    setIsModalOpen(true);
  }, []);

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'bg-green-500/20 border-green-500 text-green-400';
      case 'cleaning':
        return 'bg-orange-500/20 border-orange-500 text-orange-400';
      case 'occupied':
        return 'bg-blue-500/20 border-blue-500 text-blue-400';
      default:
        return 'bg-neutral-500/20 border-neutral-500 text-slate-400';
    }
  };

  return (
    <>
      {/* Task 4.3: Mobile-optimized info banner with better responsive text */}
      <div className="mb-3 sm:mb-4 p-3 sm:p-4 bg-neutral-900 border border-neutral-700 rounded-lg">
        <p className="text-xs sm:text-sm text-slate-400">
          💡 <span className="font-semibold">Tip:</span> Tap beds with{' '}
          <span className="text-orange-400 font-semibold">Cleaning</span> status to mark available after cleaning.
        </p>
      </div>

      {/* Grouped beds with dividers */}
      <div className="space-y-4 sm:space-y-6">
        {Object.keys(bedGroups).sort().map((prefix) => (
          <div key={`group-${prefix}`} className="space-y-2 sm:space-y-3">
            <div className="flex items-center gap-3">
              <h3 className="text-base sm:text-lg font-semibold text-cyan-400">{prefix} Beds</h3>
              <div className="flex-1 h-px bg-gradient-to-r from-cyan-500/50 to-transparent"></div>
            </div>
            {/* Task 4.3: Responsive grid - 2 cols mobile (360px+), 3 cols tablet, 4-5 cols desktop */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 sm:gap-3">
              {bedGroups[prefix].map((bed) => {
                const canUpdate = bed.status === 'cleaning';
                const statusColor = getStatusColor(bed.status);
                return (
                  <BedCard
                    key={bed._id}
                    bed={bed}
                    onBedClick={handleBedClick}
                    canUpdate={canUpdate}
                    statusColor={statusColor}
                  />
                );
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Task 4.3: Pass offline status to modal for user feedback */}
      <SimpleStatusUpdateModal
        bed={selectedBed}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdate={onStatusUpdate}
        isOffline={isOffline}
      />
    </>
  );
};

export default WardBedGrid;
