import React from 'react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils'; // Assumes shadcn/ui's utility function

// !SECTION

// --- Sub-components ---

// (Screen removed) The curved screen header and "SCREEN" label were removed per request.

const Bed = React.memo(({
  bed,
  status,
  onBedSelect
}) => {
  // Render a spacer div if the bed is a spacer
  if (bed.isSpacer) {
    return <div className="w-8 h-8 md:w-10 md:h-10" aria-hidden="true" />;
  }

  const isOccupied = status === 'occupied';

  return (
    <motion.button
      onClick={() => !isOccupied && onBedSelect(bed.id)}
      disabled={isOccupied}
      aria-label={`Bed ${bed.id}, ${status}`}
      aria-pressed={status === 'selected'}
      className={cn(
        // vertical rounded rectangle for beds: narrow width, taller height
        'w-8 h-14 md:w-10 md:h-16 rounded-2xl border flex items-center justify-center text-sm font-semibold transition-all duration-300 ease-in-out focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring focus-visible:ring-offset-background',
        {
          // available -> green
          'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700 cursor-pointer': status === 'available',
          // selected -> keep primary token (unchanged)
          'bg-primary text-primary-foreground border-primary cursor-pointer': status === 'selected',
          // occupied -> red
          'bg-red-600 text-white border-red-600 cursor-not-allowed opacity-90': isOccupied,
        }
      )}
      // Animation props for visual feedback
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      whileHover={{ scale: isOccupied ? 1 : 1.03, y: isOccupied ? 0 : -3 }}
      whileTap={{ scale: isOccupied ? 1 : 0.97 }}
      transition={{ type: 'spring', stiffness: 300, damping: 25 }}>
      {bed.number}
    </motion.button>
  );
});
Bed.displayName = 'Bed';

// --- Main Component ---

const BedSelection = ({
  layout,
  selectedBeds,
  occupiedBeds,
  onBedSelect,
  className
}) => {
  // Framer Motion variants for staggered animations
  const containerVariants = {
    hidden: {},
    visible: { transition: { staggerChildren: 0.05 } },
  };

  const rowVariants = {
    hidden: { opacity: 0, x: -20 },
    visible: { opacity: 1, x: 0, transition: { staggerChildren: 0.02 } },
  };

  return (
    <div
      className={cn('w-full flex flex-col items-center gap-12 p-4 bg-background', className)}>
      {/* Screen removed — seat layout starts immediately here */}
      <motion.div
        className="w-full flex flex-col gap-6"
        variants={containerVariants}
        initial="hidden"
        animate="visible">
        {layout.map((category) => (
          <div key={category.categoryName} className="flex flex-col items-center gap-3">
            <h3 className="text-sm font-semibold text-foreground">{category.categoryName}</h3>
            <div
              className="w-full bg-card p-2 sm:p-4 rounded-lg border flex flex-col gap-2">
              {category.rows.map((row, rowIndex) => (
                <React.Fragment key={row.rowId}>
                  <motion.div
                    className="flex items-center justify-center gap-2"
                    variants={rowVariants}
                    key={row.rowId}>
                    <div className="w-6 text-sm font-medium text-muted-foreground select-none">{row.rowId}</div>
                    <div
                      className="flex-1 flex justify-center items-center gap-1.5 sm:gap-2 flex-wrap">
                      {row.beds.map((bed) => (
                        <Bed
                          key={bed.id}
                          bed={bed}
                          onBedSelect={onBedSelect}
                          status={
                            occupiedBeds.includes(bed.id)
                              ? 'occupied'
                              : selectedBeds.includes(bed.id)
                                ? 'selected'
                                : 'available'
                          } />
                      ))}
                    </div>
                    <div className="w-6 text-sm font-medium text-muted-foreground select-none">{row.rowId}</div>
                  </motion.div>

                  {/* Divider between rows (not before first, not after last) */}
                  {rowIndex < category.rows.length - 1 && (
                    <div className="w-full border-t border-neutral-200/6 my-2" aria-hidden="true" />
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  );
};

// Export both BedSelection (primary) and SeatSelection (alias) for backwards compatibility
export { BedSelection };
export const SeatSelection = BedSelection;