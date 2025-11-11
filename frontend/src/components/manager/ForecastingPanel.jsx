import React, { useEffect, useState } from 'react';
import { TrendingUp, Calendar, Users, Clock, AlertCircle, Info } from 'lucide-react';
import api from '../../services/api';

const ForecastingPanel = ({ ward }) => {
  const [forecastData, setForecastData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchForecastData();
    // Refresh every 5 minutes
    const interval = setInterval(fetchForecastData, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const fetchForecastData = async () => {
    try {
      setLoading(true);
      const response = await api.get('/analytics/forecasting');
      setForecastData(response.data.data);
      setError(null);
    } catch (err) {
      console.error('Error fetching forecast data:', err);
      setError('Failed to load forecasting data');
    } finally {
      setLoading(false);
    }
  };

  if (loading && !forecastData) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-6 h-6 text-cyan-500" />
          <h2 className="text-2xl font-bold text-white">Forecasting & Insights</h2>
        </div>
        <div className="text-center py-8 text-zinc-400">Loading forecasting data...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
        <div className="flex items-center gap-2 mb-6">
          <TrendingUp className="w-6 h-6 text-cyan-500" />
          <h2 className="text-2xl font-bold text-white">Forecasting & Insights</h2>
        </div>
        <div className="text-center py-8 text-red-400">{error}</div>
      </div>
    );
  }

  // Filter data for specific ward if provided
  const wardForecast = ward 
    ? forecastData?.wardForecasts?.find(w => w.ward === ward)
    : null;

  const displayMetrics = wardForecast 
    ? {
        expectedDischarges24h: wardForecast.expectedDischarges.next24Hours,
        expectedDischarges48h: wardForecast.expectedDischarges.next48Hours,
        avgLengthOfStay: forecastData?.averageLengthOfStay?.days,
        projectedOccupancy: wardForecast.occupancyPercentage,
      }
    : {
        expectedDischarges24h: forecastData?.expectedDischarges?.next24Hours,
        expectedDischarges48h: forecastData?.expectedDischarges?.next48Hours,
        avgLengthOfStay: forecastData?.averageLengthOfStay?.days,
        projectedOccupancy: forecastData?.currentMetrics?.occupancyPercentage,
      };

  const metrics = [
    {
      icon: Calendar,
      label: 'Expected Discharges (Next 24h)',
      value: displayMetrics.expectedDischarges24h || 0,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
    },
    {
      icon: Users,
      label: 'Expected Discharges (Next 48h)',
      value: displayMetrics.expectedDischarges48h || 0,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
    },
    {
      icon: Clock,
      label: 'Avg. Length of Stay',
      value: displayMetrics.avgLengthOfStay ? `${displayMetrics.avgLengthOfStay} days` : '-',
      color: 'text-purple-500',
      bgColor: 'bg-purple-500/10',
    },
    {
      icon: TrendingUp,
      label: 'Current Occupancy',
      value: `${displayMetrics.projectedOccupancy}%`,
      color: displayMetrics.projectedOccupancy > 90 ? 'text-red-500' : 'text-yellow-500',
      bgColor: displayMetrics.projectedOccupancy > 90 ? 'bg-red-500/10' : 'bg-yellow-500/10',
    },
  ];

  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-cyan-500" />
          <h2 className="text-2xl font-bold text-white">Forecasting & Insights</h2>
        </div>
        <button
          onClick={fetchForecastData}
          className="text-xs text-zinc-400 hover:text-cyan-500 transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {metrics.map((item, index) => {
          const Icon = item.icon;
          return (
            <div
              key={index}
              className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 hover:border-zinc-600 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className={`${item.bgColor} p-3 rounded-lg`}>
                  <Icon className={`w-5 h-5 ${item.color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-zinc-400 text-sm">{item.label}</p>
                  <p className="text-white text-xl font-bold">{item.value}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Insights Section */}
      {forecastData?.insights && forecastData.insights.length > 0 && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mb-6">
          <p className="text-zinc-400 text-sm mb-3 flex items-center gap-2 font-semibold">
            <AlertCircle className="w-4 h-4" />
            Key Insights
          </p>
          <div className="space-y-2">
            {forecastData.insights.map((insight, index) => (
              <div
                key={index}
                className={`flex items-start gap-3 p-2 rounded ${
                  insight.type === 'warning'
                    ? 'bg-yellow-500/10 border-l-2 border-yellow-500'
                    : 'bg-blue-500/10 border-l-2 border-blue-500'
                }`}
              >
                <Info
                  className={`w-4 h-4 mt-0.5 ${
                    insight.type === 'warning' ? 'text-yellow-500' : 'text-blue-500'
                  }`}
                />
                <p className="text-zinc-300 text-sm">{insight.message}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Timeline Section */}
      <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4">
        <p className="text-zinc-400 text-sm mb-3 flex items-center gap-2 font-semibold">
          <Calendar className="w-4 h-4" />
          Expected Discharge Timeline (Next 72 Hours)
        </p>
        <div className="space-y-2">
          {forecastData?.timeline?.slice(0, 8).map((bucket, index) => {
            const hasDischarges = bucket.expectedDischarges > 0;
            return (
              <div key={index} className="flex items-center gap-3 py-2">
                <div className="w-20 text-zinc-400 text-xs font-mono">{bucket.label}</div>
                <div className="flex-1 bg-zinc-900 rounded-full h-6 overflow-hidden relative">
                  {hasDischarges && (
                    <div
                      className="bg-gradient-to-r from-cyan-500 to-blue-500 h-full flex items-center justify-center transition-all"
                      style={{
                        width: `${Math.min(100, (bucket.expectedDischarges / 5) * 100)}%`,
                      }}
                    >
                      <span className="text-white text-xs font-bold">
                        {bucket.expectedDischarges}
                      </span>
                    </div>
                  )}
                  {!hasDischarges && (
                    <div className="flex items-center justify-center h-full">
                      <span className="text-zinc-600 text-xs">-</span>
                    </div>
                  )}
                </div>
                <div className="w-16 text-zinc-400 text-xs text-right">
                  {hasDischarges ? `${bucket.expectedDischarges} bed${bucket.expectedDischarges > 1 ? 's' : ''}` : ''}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Discharges List */}
      {forecastData?.expectedDischarges?.details && forecastData.expectedDischarges.details.length > 0 && (
        <div className="bg-zinc-800/50 border border-zinc-700 rounded-lg p-4 mt-6">
          <p className="text-zinc-400 text-sm mb-3 flex items-center gap-2 font-semibold">
            <Users className="w-4 h-4" />
            Next Expected Discharges
          </p>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {forecastData.expectedDischarges.details.map((discharge, index) => (
              <div
                key={index}
                className="flex items-center justify-between py-2 px-3 bg-zinc-900/50 rounded border border-zinc-800 hover:border-zinc-700 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="text-cyan-500 font-bold text-sm">{discharge.bedId}</div>
                  <div className="text-zinc-500 text-xs">|</div>
                  <div className="text-zinc-400 text-sm">{discharge.ward}</div>
                  {discharge.patientId && (
                    <>
                      <div className="text-zinc-500 text-xs">|</div>
                      <div className="text-zinc-400 text-xs">{discharge.patientId}</div>
                    </>
                  )}
                </div>
                <div className="text-right">
                  <div className="text-zinc-300 text-sm font-semibold">
                    {discharge.hoursUntilDischarge < 24
                      ? `${Math.round(discharge.hoursUntilDischarge)}h`
                      : `${Math.round(discharge.hoursUntilDischarge / 24)}d`}
                  </div>
                  <div className="text-zinc-500 text-xs">
                    {discharge.daysInBed.toFixed(1)} days in bed
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Footer with metadata */}
      <div className="mt-4 pt-4 border-t border-zinc-800">
        <div className="flex items-center justify-between text-xs text-zinc-500">
          <div>
            Based on {forecastData?.averageLengthOfStay?.basedOnSamples || 0} patient stays
          </div>
          <div>
            Updated: {forecastData?.metadata?.timestamp 
              ? new Date(forecastData.metadata.timestamp).toLocaleTimeString() 
              : 'N/A'}
          </div>
        </div>
        <p className="text-xs text-zinc-600 italic mt-2">
          {forecastData?.metadata?.disclaimer}
        </p>
      </div>
    </div>
  );
};

export default ForecastingPanel;
