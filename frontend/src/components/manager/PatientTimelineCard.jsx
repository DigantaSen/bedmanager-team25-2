import React from 'react';
import { Calendar, Clock, User, Activity } from 'lucide-react';

const PatientTimelineCard = ({ history }) => {
  if (!history || !history.occupancyPeriods || history.occupancyPeriods.length === 0) {
    return (
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6 text-center text-zinc-500">
        No occupancy history available for this bed
      </div>
    );
  }

  const { occupancyPeriods, statistics } = history;

  const getStatusColor = (statusChange) => {
    switch (statusChange) {
      case 'assigned':
        return 'bg-green-500';
      case 'released':
        return 'bg-blue-500';
      case 'maintenance_start':
        return 'bg-yellow-500';
      case 'maintenance_end':
        return 'bg-cyan-500';
      case 'reserved':
        return 'bg-purple-500';
      case 'reservation_cancelled':
        return 'bg-red-500';
      default:
        return 'bg-neutral-900';
    }
  };

  const getStatusLabel = (statusChange) => {
    switch (statusChange) {
      case 'assigned':
        return 'Patient Admitted';
      case 'released':
        return 'Patient Discharged';
      case 'maintenance_start':
        return 'Maintenance Started';
      case 'maintenance_end':
        return 'Maintenance Completed';
      case 'reserved':
        return 'Bed Reserved';
      case 'reservation_cancelled':
        return 'Reservation Cancelled';
      default:
        return statusChange;
    }
  };

  return (
    <div className="space-y-6">
      {/* Statistics Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="bg-cyan-500/10 p-3 rounded-lg">
              <Activity className="w-5 h-5 text-cyan-500" />
            </div>
            <div>
              <p className="text-zinc-400 text-sm">Total Occupancies</p>
              <p className="text-white text-2xl font-bold">{statistics.totalOccupancies}</p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/10 p-3 rounded-lg">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-zinc-400 text-sm">Avg. Stay Duration</p>
              <p className="text-white text-2xl font-bold">
                {statistics.averageDuration ? `${statistics.averageDuration}d` : 'N/A'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
          <div className="flex items-center gap-3">
            <div className={`${statistics.currentlyOccupied ? 'bg-green-500/10' : 'bg-neutral-900/10'} p-3 rounded-lg`}>
              <User className={`w-5 h-5 ${statistics.currentlyOccupied ? 'text-green-500' : 'text-zinc-500'}`} />
            </div>
            <div>
              <p className="text-zinc-400 text-sm">Current Status</p>
              <p className="text-white text-xl font-bold">
                {statistics.currentlyOccupied ? 'Occupied' : 'Available'}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-6">
        <h3 className="text-white text-lg font-bold mb-4 flex items-center gap-2">
          <Calendar className="w-5 h-5 text-cyan-500" />
          Occupancy Timeline
        </h3>

        <div className="space-y-4">
          {occupancyPeriods.map((period, index) => (
            <div key={index} className="relative pl-8 pb-6 last:pb-0">
              {/* Timeline line */}
              {index < occupancyPeriods.length - 1 && (
                <div className="absolute left-2 top-6 bottom-0 w-0.5 bg-zinc-700"></div>
              )}

              {/* Timeline dot */}
              <div className={`absolute left-0 top-2 w-4 h-4 rounded-full ${getStatusColor(period.startLog.statusChange)}`}></div>

              <div className="bg-neutral-900/50 border border-zinc-800 rounded-lg p-4 hover:border-zinc-700 transition-colors">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <div>
                    <h4 className="text-white font-semibold flex items-center gap-2">
                      {period.status === 'ongoing' && (
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                      )}
                      Occupancy Period #{occupancyPeriods.length - index}
                      {period.status === 'ongoing' && (
                        <span className="text-xs text-green-500 font-normal">(Ongoing)</span>
                      )}
                    </h4>
                    <p className="text-sm text-zinc-400 mt-1">
                      Duration: <span className="text-white font-semibold">{period.duration.formatted}</span>
                      {period.duration.ongoing && <span className="text-green-500 ml-2">(and counting)</span>}
                    </p>
                  </div>

                  {period.duration.days >= 0 && (
                    <div className="text-right">
                      <div className="text-xs text-zinc-500">{period.duration.days.toFixed(1)} days</div>
                      <div className="text-xs text-zinc-500">{period.duration.hours.toFixed(1)} hours</div>
                    </div>
                  )}
                </div>

                <div className="space-y-2">
                  {/* Start Event */}
                  <div className="flex items-start gap-3 text-sm">
                    <div className={`w-2 h-2 rounded-full mt-1.5 ${getStatusColor(period.startLog.statusChange)}`}></div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-white font-semibold">{getStatusLabel(period.startLog.statusChange)}</span>
                        <span className="text-zinc-500">•</span>
                        <span className="text-zinc-400">
                          {new Date(period.startLog.timestamp).toLocaleString('en-US', {
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {period.startLog.userId && (
                        <div className="text-zinc-500 text-xs mt-1">
                          By: {period.startLog.userId.name} ({period.startLog.userId.role})
                        </div>
                      )}
                    </div>
                  </div>

                  {/* End Event (if completed) */}
                  {period.status === 'completed' && period.endLog && (
                    <div className="flex items-start gap-3 text-sm">
                      <div className={`w-2 h-2 rounded-full mt-1.5 ${getStatusColor(period.endLog.statusChange)}`}></div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white font-semibold">{getStatusLabel(period.endLog.statusChange)}</span>
                          <span className="text-zinc-500">•</span>
                          <span className="text-zinc-400">
                            {new Date(period.endLog.timestamp).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {period.endLog.userId && (
                          <div className="text-zinc-500 text-xs mt-1">
                            By: {period.endLog.userId.name} ({period.endLog.userId.role})
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* All Logs (Collapsible) */}
      <details className="bg-zinc-800/50 border border-zinc-700 rounded-lg">
        <summary className="cursor-pointer p-4 text-white font-semibold hover:bg-zinc-800/70 transition-colors rounded-lg">
          View All Status Changes ({statistics.totalLogs} logs)
        </summary>
        <div className="p-4 pt-0 space-y-2 max-h-96 overflow-y-auto">
          {history.allLogs.map((log, index) => (
            <div
              key={index}
              className="flex items-center justify-between py-2 px-3 bg-neutral-900/50 rounded border border-zinc-800 text-sm"
            >
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${getStatusColor(log.statusChange)}`}></div>
                <span className="text-white">{getStatusLabel(log.statusChange)}</span>
              </div>
              <div className="text-zinc-400 text-xs">
                {new Date(log.timestamp).toLocaleString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          ))}
        </div>
      </details>
    </div>
  );
};

export default PatientTimelineCard;
