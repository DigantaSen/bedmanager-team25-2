import React from 'react';

const AvailableBedsList = ({ beds }) => {
  const availableBeds = beds.filter(bed => bed.status === 'available');

  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-lg p-4">
      <h3 className="text-lg font-bold text-white mb-4">
        Available Beds ({availableBeds.length})
      </h3>
      
      {availableBeds.length === 0 ? (
        <p className="text-slate-400 text-center py-4">No available beds</p>
      ) : (
        <div className="space-y-2">
          {availableBeds.map((bed) => (
            <div
              key={bed._id}
              className="bg-green-500/10 border border-green-500/30 rounded-lg p-3 flex justify-between items-center"
            >
              <div>
                <div className="font-medium text-white">{bed.bedId}</div>
                <div className="text-sm text-slate-400">{bed.ward}</div>
              </div>
              <div className="text-green-400 font-medium text-sm">Available</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default AvailableBedsList;
