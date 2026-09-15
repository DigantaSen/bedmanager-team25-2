import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Target, TrendingUp, Calendar, BedDouble, Info, ArrowRight } from 'lucide-react';

/**
 * MLAvailabilityCard - Displays projected bed availability
 *
 * Projection = beds available now + occupied beds expected to be discharged within the window
 * (manager-set discharge times, otherwise estimates from each patient's admission time)
 *
 * @param {number} available24h - Projected beds available in 24 hours
 * @param {number} available48h - Projected beds available in 48 hours
 * @param {number} currentAvailable - Current available beds (optional)
 * @param {number} totalBeds - Total beds in system (optional)
 * @param {number} discharges24h - Expected discharges within 24 hours (optional)
 * @param {number} discharges48h - Expected discharges within 48 hours (optional)
 */
const MLAvailabilityCard = ({
  available24h = 0,
  available48h = 0,
  currentAvailable = null,
  totalBeds = null,
  discharges24h = null,
  discharges48h = null
}) => {
  // Calculate net change
  const change24h = currentAvailable !== null ? available24h - currentAvailable : null;
  const change48h = currentAvailable !== null ? available48h - currentAvailable : null;

  const getTrendIcon = (change) => {
    if (change === null) return null;
    if (change > 0) return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (change < 0) return <TrendingUp className="w-4 h-4 text-red-400 rotate-180" />;
    return <ArrowRight className="w-4 h-4 text-slate-400" />;
  };

  const getTrendText = (change) => {
    if (change === null) return '';
    if (change > 0) return `+${change}`;
    if (change < 0) return `${change}`;
    return 'No change';
  };

  const getAvailabilityStatus = (available, total) => {
    if (total === null || total === 0) return 'unknown';
    const percentage = (available / total) * 100;
    if (percentage >= 25) return 'good';
    if (percentage >= 15) return 'moderate';
    return 'critical';
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'good': return 'text-green-400 border-green-500/30 bg-green-500/10';
      case 'moderate': return 'text-yellow-400 border-yellow-500/30 bg-yellow-500/10';
      case 'critical': return 'text-red-400 border-red-500/30 bg-red-500/10';
      default: return 'text-slate-400 border-slate-500/30 bg-slate-500/10';
    }
  };

  const forecasts = [
    { label: '24-Hour Forecast', available: available24h, change: change24h, discharges: discharges24h },
    { label: '48-Hour Forecast', available: available48h, change: change48h, discharges: discharges48h }
  ];

  return (
    <Card className="bg-neutral-900 border-neutral-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <Target className="w-5 h-5 text-blue-400" />
            Bed Availability Forecast
          </CardTitle>
          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40">
            Forecast
          </Badge>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Beds available now plus expected discharges (manager-set times, otherwise estimated discharge times)
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {/* Current Status (if provided) */}
          {currentAvailable !== null && (
            <div className="bg-neutral-900/50 border border-blue-500/20 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-slate-400">Current Available</span>
                <BedDouble className="w-4 h-4 text-blue-400" />
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-white">{currentAvailable}</span>
                {totalBeds !== null && (
                  <span className="text-sm text-slate-400">/ {totalBeds} beds</span>
                )}
              </div>
            </div>
          )}

          {forecasts.map((forecast) => (
            <div
              key={forecast.label}
              className={`border rounded-lg p-4 ${getStatusColor(getAvailabilityStatus(forecast.available, totalBeds))}`}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  <span className="font-semibold text-white">{forecast.label}</span>
                </div>
                {getTrendIcon(forecast.change)}
              </div>

              <div className="flex items-baseline gap-2 mb-2">
                <span className="text-4xl font-bold text-white">{forecast.available}</span>
                <span className="text-lg text-slate-300">beds</span>
                {forecast.change !== null && (
                  <Badge
                    variant="outline"
                    className={`ml-2 ${forecast.change > 0 ? 'border-green-500/50 text-green-400' :
                        forecast.change < 0 ? 'border-red-500/50 text-red-400' :
                          'border-slate-500/50 text-slate-400'
                      }`}
                  >
                    {getTrendText(forecast.change)}
                  </Badge>
                )}
              </div>

              {forecast.discharges !== null && (
                <div className="text-xs text-slate-400">
                  Includes {forecast.discharges} expected discharge{forecast.discharges !== 1 ? 's' : ''}
                </div>
              )}

              {totalBeds !== null && totalBeds > 0 && (
                <div className="mt-2 text-xs text-slate-400">
                  Projected availability: {((forecast.available / totalBeds) * 100).toFixed(1)}%
                </div>
              )}
            </div>
          ))}

          {/* Capacity Planning Insight */}
          {totalBeds !== null && totalBeds > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <Info className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
                <div className="text-xs text-slate-300">
                  {available24h < totalBeds * 0.15 ? (
                    <span className="text-yellow-400 font-semibold">
                      ⚠️ Low projected availability (&lt;15%). Consider delaying non-urgent admissions.
                    </span>
                  ) : available24h >= totalBeds * 0.25 ? (
                    <span className="text-green-400 font-semibold">
                      ✓ Good capacity outlook. System has adequate availability projected.
                    </span>
                  ) : (
                    <span>
                      Moderate capacity expected. Monitor closely for changes.
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="mt-4 pt-3 border-t border-blue-500/20">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <Target className="w-3 h-3" />
              <span>Available now + expected discharges</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-green-500" />
                <span>&gt;25%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-yellow-500" />
                <span>15-25%</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span>&lt;15%</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MLAvailabilityCard;
