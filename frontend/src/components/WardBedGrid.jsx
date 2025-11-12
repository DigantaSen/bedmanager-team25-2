import React, { useState } from 'react';
import SimpleStatusUpdateModal from './SimpleStatusUpdateModal';

const WardBedGrid = ({ beds, onStatusUpdate }) => {
  const [selectedBed, setSelectedBed] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleBedClick = (bed) => {
    setSelectedBed(bed);
    setIsModalOpen(true);
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'available':
        return 'bg-green-500/20 border-green-500 text-green-400';
      case 'cleaning':
        return 'bg-orange-500/20 border-orange-500 text-orange-400';
      case 'occupied':
        return 'bg-blue-500/20 border-blue-500 text-blue-400';
      default:
        return 'bg-slate-500/20 border-slate-500 text-slate-400';
    }
  };

  return (
    <>
      <div className="mb-4 p-3 bg-slate-800/50 border border-slate-700 rounded-lg">
        <p className="text-sm text-slate-400">
          💡 <span className="font-semibold">Tip:</span> Click on beds with{' '}
          <span className="text-orange-400 font-semibold">Cleaning</span> status to mark them as available after cleaning.
        </p>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
        {beds.map((bed) => {
          const canUpdate = bed.status === 'cleaning';
          return (
            <button
              key={bed._id}
              onClick={() => handleBedClick(bed)}
              className={`${getStatusColor(bed.status)} border-2 rounded-lg p-4 text-center transition-all ${
                canUpdate ? 'hover:scale-105 hover:shadow-lg cursor-pointer' : 'cursor-default opacity-75'
              } ${canUpdate ? 'ring-2 ring-orange-500/50 animate-pulse' : ''}`}
            >
              <div className="font-bold text-lg">{bed.bedId}</div>
              <div className="text-xs mt-1 capitalize">{bed.status}</div>
              {canUpdate && (
                <div className="text-xs mt-1 text-orange-300 font-semibold">✓ Can Update</div>
              )}
            </button>
          );
        })}
      </div>

      <SimpleStatusUpdateModal
        bed={selectedBed}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onUpdate={onStatusUpdate}
      />
    </>
  );
};

export default WardBedGrid;
