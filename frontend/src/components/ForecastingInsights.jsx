import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchBeds } from '@/features/beds/bedsSlice';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, TrendingUp, AlertTriangle, ArrowUp, ArrowDown } from 'lucide-react';
import api from '@/services/api';
import MLDischargePredictionCard from './MLDischargePredictionCard';
import MLCleaningPredictionCard from './MLCleaningPredictionCard';
import MLAvailabilityCard from './MLAvailabilityCard';

const ForecastingInsights = () => {
  const dispatch = useDispatch();
  const { bedsList, status } = useSelector((state) => state.beds);
  const [forecastPeriod, setForecastPeriod] = useState('7days');
  const [forecasts, setForecasts] = useState({});
  const [recommendations, setRecommendations] = useState([]);
  const [mlPredictions, setMlPredictions] = useState({
    discharges: [],
    cleaningTimes: [],
    bedAvailability: []
  });
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (status === 'idle') {
      dispatch(fetchBeds());
    }
  }, [dispatch, status]);

  // Fetch ML predictions for occupied beds
  useEffect(() => {
    const fetchMLPredictions = async () => {
      if (bedsList.length === 0) return;
      
      setIsLoading(true);
      try {
        const occupiedBeds = bedsList.filter(bed => bed.status === 'occupied');
        const cleaningBeds = bedsList.filter(bed => bed.status === 'maintenance');
        
        // Fetch discharge predictions for occupied beds
        const dischargePromises = occupiedBeds.slice(0, 10).map(async (bed) => {
          try {
            const response = await api.post(`/beds/${bed._id}/predict-discharge`);
            const prediction = response.data?.data?.prediction;
            return {
              bedId: bed._id,
              bedNumber: bed.bedId || bed.bedNumber, // Use bedId field (e.g., "ICU-01")
              ward: bed.ward,
              predicted_hours_until_discharge: prediction?.hours_until_discharge,
              estimated_discharge_time: prediction?.estimated_discharge_time
            };
          } catch (error) {
            console.error(`Failed to get discharge prediction for bed ${bed.bedId || bed.bedNumber}:`, error);
            return null;
          }
        });

        // Fetch cleaning duration predictions for maintenance beds
        const cleaningPromises = cleaningBeds.slice(0, 10).map(async (bed) => {
          try {
            const response = await api.post(`/beds/${bed._id}/predict-cleaning`, {
              estimatedDuration: 30
            });
            const prediction = response.data?.data?.prediction;
            return {
              bedId: bed._id,
              bedNumber: bed.bedId || bed.bedNumber, // Use bedId field (e.g., "ICU-01")
              ward: bed.ward,
              predicted_cleaning_minutes: prediction?.predicted_duration_minutes,
              predicted_end_time: prediction?.estimated_end_time
            };
          } catch (error) {
            console.error(`Failed to get cleaning prediction for bed ${bed.bedId || bed.bedNumber}:`, error);
            return null;
          }
        });

        const [dischargeResults, cleaningResults] = await Promise.all([
          Promise.all(dischargePromises),
          Promise.all(cleaningPromises)
        ]);

        setMlPredictions({
          discharges: dischargeResults.filter(r => r !== null),
          cleaningTimes: cleaningResults.filter(r => r !== null),
          bedAvailability: []
        });
      } catch (error) {
        console.error('Error fetching ML predictions:', error);
      } finally {
        setIsLoading(false);
      }
    };

    if (bedsList.length > 0) {
      fetchMLPredictions();
    }
  }, [bedsList]);

  useEffect(() => {
    const generateForecasts = () => {
      const totalBeds = bedsList.length;
      const occupiedBeds = bedsList.filter(bed => bed.status === 'occupied').length;
      const currentOccupancy = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

      // Calculate ward-specific data for recommendations
      const wardOccupancy = bedsList.reduce((acc, bed) => {
        if (!acc[bed.ward]) {
          acc[bed.ward] = { total: 0, occupied: 0 };
        }
        acc[bed.ward].total++;
        if (bed.status === 'occupied') acc[bed.ward].occupied++;
        return acc;
      }, {});

      // Use ML predictions to generate forecasts
      const forecast7Days = [];
      let previousPredicted7 = currentOccupancy;

      // Calculate expected discharges from ML predictions
      const avgDischargeTime = mlPredictions.discharges.length > 0
        ? mlPredictions.discharges.reduce((sum, d) => sum + (d.predicted_hours_until_discharge || 0), 0) / mlPredictions.discharges.length
        : 72;

      for (let i = 0; i < 7; i++) {
        // Estimate daily discharge rate based on ML predictions
        const dailyDischargeRate = avgDischargeTime > 0 ? (24 / avgDischargeTime) * occupiedBeds : 0;
        const expectedDischarges = Math.round(dailyDischargeRate * (i + 1));
        const expectedOccupancy = Math.max(30, occupiedBeds - expectedDischarges);
        const predicted = totalBeds > 0 ? Math.round((expectedOccupancy / totalBeds) * 100) : 0;

        forecast7Days.push({
          date: `In ${i + 1} day${i === 0 ? '' : 's'}`,
          predicted: Math.max(0, Math.min(100, predicted)),
          confidence: Math.max(70, 95 - i * 2),
          trend: predicted >= previousPredicted7 ? 'up' : 'down',
          mlBased: mlPredictions.discharges.length > 0
        });

        previousPredicted7 = predicted;
      }

      const forecast30Days = [];
      let previousPredicted30 = currentOccupancy;

      for (let i = 0; i < 4; i++) {
        const weeklyDischarges = Math.round((24 / avgDischargeTime) * occupiedBeds * 7 * (i + 1));
        const expectedOccupancy = Math.max(30, occupiedBeds - weeklyDischarges);
        const predicted = totalBeds > 0 ? Math.round((expectedOccupancy / totalBeds) * 100) : 0;

        forecast30Days.push({
          date: `Week ${i + 1}`,
          predicted: Math.max(0, Math.min(100, predicted)),
          confidence: Math.max(65, 90 - i * 5),
          trend: predicted >= previousPredicted30 ? 'up' : 'down',
          mlBased: mlPredictions.discharges.length > 0
        });

        previousPredicted30 = predicted;
      }

      setForecasts({
        '7days': forecast7Days,
        '30days': forecast30Days
      });

      // Generate ML-powered recommendations
      const recs = [];

      // Check for high occupancy wards
      Object.entries(wardOccupancy).forEach(([ward, data]) => {
        const rate = data.total > 0 ? (data.occupied / data.total) * 100 : 0;
        if (rate >= 90) {
          recs.push({
            title: `${ward} Critical Capacity`,
            description: `${ward} is at ${Math.round(rate)}% capacity`,
            priority: 'critical',
            action: 'Coordinate with nearby facilities for transfers'
          });
        } else if (rate >= 85) {
          recs.push({
            title: `${ward} High Occupancy`,
            description: `${ward} projected to reach 95% capacity soon`,
            priority: 'high',
            action: 'Schedule additional staff and prepare for admissions'
          });
        }
      });

      // ML-based discharge recommendations
      if (mlPredictions.discharges.length > 0) {
        const upcomingDischarges = mlPredictions.discharges.filter(
          d => d.predicted_hours_until_discharge && d.predicted_hours_until_discharge < 24
        );
        if (upcomingDischarges.length > 0) {
          recs.push({
            title: 'Upcoming Discharges Predicted',
            description: `${upcomingDischarges.length} bed(s) expected to be available within 24 hours`,
            priority: 'medium',
            action: 'Prepare beds for new admissions and coordinate with ER'
          });
        }
      }

      // ML-based cleaning recommendations
      if (mlPredictions.cleaningTimes.length > 0) {
        const longCleaningBeds = mlPredictions.cleaningTimes.filter(
          c => c.predicted_cleaning_minutes && c.predicted_cleaning_minutes > 30
        );
        if (longCleaningBeds.length > 0) {
          recs.push({
            title: 'Extended Cleaning Times Predicted',
            description: `${longCleaningBeds.length} bed(s) require >30 min cleaning`,
            priority: 'medium',
            action: 'Allocate additional cleaning staff to priority areas'
          });
        }
      }

      // Add general recommendations
      if (currentOccupancy < 70) {
        recs.push({
          title: 'Maintenance Window Available',
          description: 'Lower occupancy predicted for upcoming period',
          priority: 'low',
          action: 'Schedule routine maintenance and deep cleaning'
        });
      }

      if (currentOccupancy >= 85) {
        recs.push({
          title: 'Prepare for Peak Demand',
          description: `Hospital-wide occupancy at ${currentOccupancy}%`,
          priority: 'high',
          action: 'Ensure adequate staffing levels'
        });
      }

      setRecommendations(recs.slice(0, 4));
    };

    if (bedsList.length > 0) {
      generateForecasts();
    }
  }, [bedsList, mlPredictions]);

  const currentForecasts = forecasts[forecastPeriod] || [];

  const getPriorityColor = (priority) => {
    switch (priority) {
      case 'critical':
        return 'bg-red-500/20 border-red-500/50 text-red-400';
      case 'high':
        return 'bg-orange-500/20 border-orange-500/50 text-orange-400';
      case 'medium':
        return 'bg-yellow-500/20 border-yellow-500/50 text-yellow-400';
      case 'low':
        return 'bg-green-500/20 border-green-500/50 text-green-400';
      default:
        return 'bg-neutral-500/20 border-neutral-500/50 text-neutral-400';
    }
  };

  return (
    <div className="space-y-6">
      {isLoading && (
        <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
          <p className="text-blue-400 text-sm">Loading predictions...</p>
        </div>
      )}

      {/* NEW ML PREDICTION CARDS */}
      {/* Discharge Predictions */}
      <MLDischargePredictionCard 
        predictions={mlPredictions.discharges} 
        maxDisplay={5}
      />

      {/* Cleaning Predictions */}
      <MLCleaningPredictionCard 
        predictions={mlPredictions.cleaningTimes} 
        maxDisplay={5}
      />

      {/* Availability Forecast */}
      <MLAvailabilityCard 
        available24h={
          (bedsList.filter(b => b.status === 'available').length) + 
          (mlPredictions.discharges.filter(d => d.predicted_hours_until_discharge && d.predicted_hours_until_discharge < 24).length)
        }
        available48h={
          (bedsList.filter(b => b.status === 'available').length) + 
          (mlPredictions.discharges.filter(d => d.predicted_hours_until_discharge && d.predicted_hours_until_discharge < 48).length)
        }
        currentAvailable={bedsList.filter(b => b.status === 'available').length}
        totalBeds={bedsList.length}
        confidence24h={0.85}
        confidence48h={0.75}
      />

      {/* ML Predictions Summary */}
      {mlPredictions.discharges.length > 0 && (
        <Card className="bg-gradient-to-br from-purple-500/10 to-blue-500/10 border-purple-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <TrendingUp className="w-5 h-5 text-purple-400" />
              Discharge Predictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {mlPredictions.discharges.slice(0, 6).map((prediction, index) => (
                <div
                  key={index}
                  className="p-3 bg-neutral-900/50 rounded-lg border border-purple-500/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white">
                      {prediction.ward} - Bed {prediction.bedNumber}
                    </span>
                    <Badge className="bg-purple-500/20 text-purple-300">
                      {prediction.predicted_hours_until_discharge 
                        ? `~${Math.round(prediction.predicted_hours_until_discharge)}h`
                        : 'N/A'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400">
                    Estimated discharge: {prediction.predicted_hours_until_discharge 
                      ? `${Math.round(prediction.predicted_hours_until_discharge / 24)} days`
                      : 'Data insufficient'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cleaning Time Predictions */}
      {mlPredictions.cleaningTimes.length > 0 && (
        <Card className="bg-gradient-to-br from-green-500/10 to-teal-500/10 border-green-500/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <AlertTriangle className="w-5 h-5 text-green-400" />
              Cleaning Duration Predictions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3 md:grid-cols-2">
              {mlPredictions.cleaningTimes.slice(0, 6).map((prediction, index) => (
                <div
                  key={index}
                  className="p-3 bg-neutral-900/50 rounded-lg border border-green-500/30"
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-white">
                      {prediction.ward} - Bed {prediction.bedNumber}
                    </span>
                    <Badge className="bg-green-500/20 text-green-300">
                      {prediction.predicted_cleaning_minutes 
                        ? `~${Math.round(prediction.predicted_cleaning_minutes)} min`
                        : 'N/A'}
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-400">
                    {prediction.predicted_cleaning_minutes > 30 
                      ? '⚠️ Extended cleaning required'
                      : '✓ Standard cleaning time'}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Forecast Chart */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <CardTitle className="flex items-center gap-2 text-xl">
              <TrendingUp className="w-5 h-5 text-green-400" />
              Occupancy Forecast
            </CardTitle>
            <div className="flex gap-1 bg-neutral-900 rounded-lg p-1 border border-neutral-700">
              <Button
                size="sm"
                variant={forecastPeriod === '7days' ? 'default' : 'ghost'}
                onClick={() => setForecastPeriod('7days')}
                className="text-xs"
              >
                Next 7 Days
              </Button>
              <Button
                size="sm"
                variant={forecastPeriod === '30days' ? 'default' : 'ghost'}
                onClick={() => setForecastPeriod('30days')}
                className="text-xs"
              >
                Next 30 Days
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {currentForecasts.map((forecast, index) => {
              const isHighOccupancy = forecast.predicted >= 90;

              return (
                <div
                  key={index}
                  className="p-4 bg-neutral-900 rounded-lg border border-neutral-700 hover:border-neutral-600 transition-all"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium text-slate-300">{forecast.date}</span>
                      <Badge
                        variant="outline"
                        className={isHighOccupancy ? 'border-red-500/50 text-red-400' : 'border-blue-500/50 text-blue-400'}
                      >
                        {forecast.predicted}% predicted
                      </Badge>
                      {forecast.mlBased && (
                        <Badge className="bg-purple-500/20 text-purple-300 text-xs">
                          🤖 ML
                        </Badge>
                      )}
                      {forecast.trend === 'up' ? (
                        <ArrowUp className="w-4 h-4 text-red-400" />
                      ) : (
                        <ArrowDown className="w-4 h-4 text-green-400" />
                      )}
                    </div>
                    <span className="text-xs text-neutral-400">
                      {forecast.confidence}% confidence
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-neutral-700 rounded-full h-2 overflow-hidden">
                      <div
                        className={`h-full ${isHighOccupancy ? 'bg-red-500' : 'bg-blue-500'}`}
                        style={{ width: `${forecast.predicted}%` }}
                      />
                    </div>
                    <div className="w-24 bg-neutral-700 rounded-full h-2 overflow-hidden">
                      <div
                        className="h-full bg-green-500"
                        style={{ width: `${forecast.confidence}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Lightbulb className="w-5 h-5 text-yellow-400" />
              Recommendations
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recommendations.map((rec, index) => (
                <div
                  key={index}
                  className={`p-4 rounded-lg border ${getPriorityColor(rec.priority)}`}
                >
                  <div className="flex items-start justify-between mb-2">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-white">{rec.title}</h4>
                        <Badge variant="outline" className={getPriorityColor(rec.priority)}>
                          {rec.priority}
                        </Badge>
                      </div>
                      <p className="text-sm text-slate-300 mb-2">{rec.description}</p>
                      <div className="flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-medium">Action: {rec.action}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ForecastingInsights;
