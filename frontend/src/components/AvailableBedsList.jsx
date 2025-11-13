import React, { memo } from 'react';

// Task 4.3: Memoize BedListItem to optimize rendering performance on mobile
const BedListItem = memo(({ bed }) => (
  <div
    // Task 4.3: Larger touch targets with better spacing for mobile
    className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 sm:p-4 flex justify-between items-center min-h-[60px] transition-colors hover:bg-green-500/20"
  >
    <div>
      <div className="font-medium text-white text-sm sm:text-base">{bed.bedId}</div>
      <div className="text-xs sm:text-sm text-neutral-400">{bed.ward}</div>
    </div>
    <div className="text-green-400 font-medium text-xs sm:text-sm px-2 py-1 bg-green-500/20 rounded">
      Available
    </div>
  </div>
));

BedListItem.displayName = 'BedListItem';

const AvailableBedsList = ({ beds }) => {
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

  const availableBeds = beds
    .filter(bed => bed.status === 'available')
    .sort(naturalSort);

  return (
    // Task 4.3: Mobile-optimized container with responsive padding
    <div className="bg-neutral-900 border border-neutral-700 rounded-lg p-3 sm:p-4">
      <h3 className="text-base sm:text-lg font-bold text-white mb-3 sm:mb-4">
        Available Beds ({availableBeds.length})
      </h3>

      {availableBeds.length === 0 ? (
        // Task 4.3: Better empty state with icon
        <div className="text-neutral-400 text-center py-6 sm:py-8">
          <div className="text-3xl sm:text-4xl mb-2">🛏️</div>
          <p className="text-xs sm:text-sm">No available beds</p>
        </div>
      ) : (
        // Task 4.3: Optimized scrolling list with smaller gaps on mobile
        <div className="space-y-2 max-h-[400px] sm:max-h-[500px] overflow-y-auto overscroll-contain">
          {availableBeds.map((bed) => (
            <BedListItem key={bed._id} bed={bed} />
          ))}
        </div>
      )}
    </div>
  );
};

export default AvailableBedsList;
