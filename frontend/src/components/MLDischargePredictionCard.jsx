import React from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Clock, Activity } from 'lucide-react';

/**
 * MLDischargePredictionCard - Displays estimated discharge times for occupied beds
 *
 * @param {Array} predictions - Estimated discharges, soonest first (aiDischarges.details from /analytics/forecasting)
 * @param {string} predictions[].bedId - Bed identifier (e.g., "ICU-01")
 * @param {string} predictions[].ward - Ward name
 * @param {string} predictions[].expectedDischargeTime - ISO datetime of the estimated discharge
 * @param {number} predictions[].hoursUntilDischarge - Hours from now until the estimated discharge (0 once passed)
 * @param {boolean} predictions[].isOverdue - The patient is still in bed after the estimated discharge time
 * @param {string} predictions[].source - 'ml' (ML model) or 'historical_average' (ward's recorded average stay)
 * @param {number} maxDisplay - Maximum number of predictions to show (default: 5)
 */
const MLDischargePredictionCard = ({ predictions = [], maxDisplay = 5 }) => {
  // Filter out invalid predictions and limit display
  const validPredictions = predictions
    .filter(p => p && p.expectedDischargeTime && p.hoursUntilDischarge != null)
    .slice(0, maxDisplay);

  if (validPredictions.length === 0) {
    return (
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            Predicted Discharges
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-slate-400">
            <Activity className="w-12 h-12 mx-auto mb-3 text-slate-600" />
            <p className="text-sm">No discharge predictions available</p>
            <p className="text-xs text-slate-500 mt-1">
              Predictions will appear for occupied beds without a manager-set discharge time
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatRemaining = (prediction) => {
    if (prediction.isOverdue) return 'Past estimate';
    const hours = prediction.hoursUntilDischarge;
    if (hours < 24) {
      return `~${Math.round(hours)}h`;
    } else {
      const days = Math.round(hours / 24);
      return `~${days}d`;
    }
  };

  const formatDateTime = (isoString) => {
    if (!isoString) return 'N/A';
    try {
      const date = new Date(isoString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const getUrgencyColor = (prediction) => {
    if (prediction.isOverdue || prediction.hoursUntilDischarge < 6) return 'border-red-500/50 bg-red-500/10';
    if (prediction.hoursUntilDischarge < 24) return 'border-orange-500/50 bg-orange-500/10';
    return 'border-purple-500/30 bg-neutral-900/50';
  };

  const averageCount = validPredictions.filter(p => p.source === 'historical_average').length;
  const sourceBadge = averageCount === 0
    ? 'ML Model'
    : averageCount === validPredictions.length ? 'Ward averages' : 'ML + ward averages';

  return (
    <Card className="bg-neutral-900 border-neutral-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="w-5 h-5 text-purple-400" />
            Predicted Discharges
          </CardTitle>
          <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/40">
            {sourceBadge}
          </Badge>
        </div>
        <p className="text-xs text-slate-400 mt-1">
          Next {validPredictions.length} estimated discharge{validPredictions.length !== 1 ? 's' : ''}, counted from each patient's recorded admission
          {averageCount > 0 && ' (ward average stay used where the ML service was unavailable)'}
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {validPredictions.map((prediction) => {
            const hours = prediction.isOverdue ? 0 : prediction.hoursUntilDischarge;
            const urgencyClass = getUrgencyColor(prediction);

            return (
              <div
                key={prediction.bedId}
                className={`p-3 rounded-lg border ${urgencyClass} hover:border-purple-400/50 transition-all`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-white">
                      {prediction.ward}
                    </span>
                    <span className="text-slate-500">•</span>
                    <span className="text-slate-300 text-sm">
                      Bed {prediction.bedId}
                    </span>
                  </div>
                  <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/40 text-xs">
                    {formatRemaining(prediction)}
                  </Badge>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-400">
                  <Clock className="w-3 h-3" />
                  <span>
                    Estimated discharge: {formatDateTime(prediction.expectedDischargeTime)}
                  </span>
                </div>

                {/* Progress indicator based on time remaining */}
                <div className="mt-2 w-full bg-neutral-700 rounded-full h-1 overflow-hidden">
                  <div
                    className={`h-full transition-all ${hours < 6 ? 'bg-red-500' :
                        hours < 24 ? 'bg-orange-500' :
                          'bg-purple-500'
                      }`}
                    style={{
                      width: `${Math.min(100, Math.max(10, (hours / 72) * 100))}%`
                    }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary footer */}
        <div className="mt-4 pt-3 border-t border-purple-500/20">
          <div className="flex items-center justify-between text-xs text-slate-400">
            <div className="flex items-center gap-1">
              <Activity className="w-3 h-3" />
              <span>{validPredictions.length} active prediction{validPredictions.length !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-red-500" />
                <span>&lt;6h</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-orange-500" />
                <span>&lt;24h</span>
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 rounded-full bg-purple-500" />
                <span>&gt;24h</span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default MLDischargePredictionCard;
