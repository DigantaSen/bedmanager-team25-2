import React from 'react';

const SimpleStatusUpdateModal = ({ bed, isOpen, onClose, onUpdate, isOffline = false }) => {
  if (!isOpen || !bed) return null;

  // Ward staff can only update beds that are in "cleaning" status
  const canUpdate = bed.status === 'cleaning' && !isOffline;

  // Ward staff can only mark cleaned beds as available
  const statuses = [
    {
      value: 'available',
      label: 'Mark as Available (Cleaned)',
      // Task 4.3: High-contrast colors with active states for mobile
      color: 'bg-green-600 hover:bg-green-700 active:bg-green-800'
    }
  ];

  const handleStatusUpdate = (newStatus) => {
    onUpdate(bed._id, newStatus);
    onClose();
  };

  return (
    // Task 4.3: Mobile-optimized modal with proper sizing and padding
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-3 sm:p-4">
      <div
        className="bg-neutral-900 rounded-lg p-4 sm:p-6 max-w-md w-full border border-neutral-700 max-h-[90vh] overflow-y-auto"
        // Task 4.3: Prevent modal from being too large on small screens
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
      >
        <h3
          id="modal-title"
          className="text-lg sm:text-xl font-bold text-white mb-2"
        >
          Update Bed Status
        </h3>
        <p className="text-sm sm:text-base text-slate-400 mb-2 sm:mb-4">
          Bed: <span className="font-semibold">{bed.bedId}</span> - {bed.ward}
        </p>
        <p className="text-xs sm:text-sm text-slate-500 mb-4 sm:mb-6">
          Current Status: <span className="capitalize font-semibold">{bed.status}</span>
        </p>

        {/* Task 4.3: Show offline warning if device is offline */}
        {isOffline && (
          <div className="p-3 sm:p-4 bg-yellow-500/10 border border-yellow-500/50 rounded-lg text-yellow-400 text-xs sm:text-sm mb-4">
            <p className="font-semibold mb-1">📡 Offline Mode</p>
            <p className="text-yellow-300">
              Cannot update bed status while offline. Please reconnect to update.
            </p>
          </div>
        )}

        {canUpdate ? (
          // Task 4.3: Large touch targets (min 48px height) with clear visual feedback
          <div className="grid grid-cols-1 gap-3 mb-4">
            {statuses.map((status) => (
              <button
                key={status.value}
                onClick={() => handleStatusUpdate(status.value)}
                // Task 4.3: Minimum 48px touch target with active state
                className={`${status.color} text-white py-3 sm:py-4 px-4 sm:px-6 rounded-lg font-medium transition-all text-base sm:text-lg min-h-[48px] touch-manipulation active:scale-95`}
                aria-label={status.label}
              >
                {status.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="p-3 sm:p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg text-blue-400 text-xs sm:text-sm mb-4">
            <p className="font-semibold mb-2">Cannot Update This Bed</p>
            <p className="text-blue-300">
              {bed.status === 'occupied' && 'This bed is currently occupied. Only managers can release occupied beds.'}
              {bed.status === 'available' && 'This bed is already available and does not need cleaning.'}
              {isOffline && 'Device is offline. Reconnect to make updates.'}
            </p>
          </div>
        )}

        {/* Task 4.3: Large cancel/close button with good touch target */}
        <button
          onClick={onClose}
          className="w-full bg-neutral-700 hover:bg-neutral-600 active:bg-neutral-500 text-white py-3 rounded-lg transition-all min-h-[48px] touch-manipulation text-sm sm:text-base"
          aria-label="Close modal"
        >
          {canUpdate ? 'Cancel' : 'Close'}
        </button>
      </div>
    </div>
  );
};

export default SimpleStatusUpdateModal;
