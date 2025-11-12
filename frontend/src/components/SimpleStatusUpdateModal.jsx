import React from 'react';

const SimpleStatusUpdateModal = ({ bed, isOpen, onClose, onUpdate }) => {
  if (!isOpen || !bed) return null;

  // Ward staff can only update beds that are in "cleaning" status
  const canUpdate = bed.status === 'cleaning';

  // Ward staff can only mark cleaned beds as available
  const statuses = [
    { value: 'available', label: 'Mark as Available (Cleaned)', color: 'bg-green-600 hover:bg-green-700' }
  ];

  const handleStatusUpdate = (newStatus) => {
    onUpdate(bed._id, newStatus);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-slate-800 rounded-lg p-6 max-w-md w-full border border-slate-700">
        <h3 className="text-xl font-bold text-white mb-2">Update Bed Status</h3>
        <p className="text-slate-400 mb-4">
          Bed: {bed.bedId} - {bed.ward}
        </p>
        <p className="text-sm text-slate-500 mb-6">
          Current Status: <span className="capitalize font-semibold">{bed.status}</span>
        </p>
        
        {canUpdate ? (
          <div className="grid grid-cols-1 gap-3 mb-4">
            {statuses.map((status) => (
              <button
                key={status.value}
                onClick={() => handleStatusUpdate(status.value)}
                className={`${status.color} text-white py-4 px-6 rounded-lg font-medium transition-colors text-lg`}
              >
                {status.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="p-4 bg-blue-500/10 border border-blue-500/50 rounded-lg text-blue-400 text-sm mb-4">
            <p className="font-semibold mb-2">Cannot Update This Bed</p>
            <p className="text-blue-300">
              {bed.status === 'occupied' && 'This bed is currently occupied. Only managers can release occupied beds.'}
              {bed.status === 'available' && 'This bed is already available and does not need cleaning.'}
            </p>
          </div>
        )}

        <button
          onClick={onClose}
          className="w-full bg-slate-700 hover:bg-slate-600 text-white py-2 rounded-lg"
        >
          {canUpdate ? 'Cancel' : 'Close'}
        </button>
      </div>
    </div>
  );
};

export default SimpleStatusUpdateModal;
