import React, { useState, useEffect, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { fetchBeds } from '@/features/beds/bedsSlice';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Lightbulb, TrendingUp, AlertTriangle, Clock } from 'lucide-react';
import api from '@/services/api';
import MLDischargePredictionCard from './MLDischargePredictionCard';
import MLCleaningPredictionCard from './MLCleaningPredictionCard';
import MLAvailabilityCard from './MLAvailabilityCard';

// Estimates count down as time passes, so the forecast also refreshes when no bed changes
const FORECAST_REFRESH_MS = 60 * 1000;

// Time left until an estimated or scheduled discharge
const formatRemaining = (discharge) => {
  const hours = discharge.hoursUntilDischarge;
  return hours < 24 ? `~${Math.round(hours)}h` : `~${Math.round(hours / 24)}d`;
};

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

// Recommendations from current occupancy and the discharge/cleaning estimates
const buildRecommendations = (forecast, cleaningPredictions, forecastMode) => {
  if (!forecast) return [];
  const recs = [];

  // Check for high occupancy wards
  (forecast.wardForecasts || []).forEach((ward) => {
    if (ward.occupancyPercentage >= 90) {
      recs.push({
        title: `${ward.ward} Critical Capacity`,
        description: `${ward.ward} is at ${ward.occupancyPercentage}% capacity (${ward.occupiedBeds}/${ward.totalBeds} beds occupied)`,
        priority: 'critical',
        action: 'Coordinate with nearby facilities for transfers'
      });
    } else if (ward.occupancyPercentage >= 85) {
      recs.push({
        title: `${ward.ward} High Occupancy`,
        description: `${ward.ward} is at ${ward.occupancyPercentage}% capacity with ${ward.expectedDischarges.next24Hours} discharge(s) expected in the next 24 hours`,
        priority: 'high',
        action: 'Schedule additional staff and prepare for admissions'
      });
    }
  });

  // Discharge recommendations based on selected mode
  if (forecastMode === 'ml') {
    const upcoming = forecast.aiDischarges?.next24Hours || 0;
    if (upcoming > 0) {
      recs.push({
        title: 'Upcoming Discharges Predicted',
        description: `${upcoming} bed(s) estimated to be discharged within 24 hours`,
        priority: 'medium',
        action: 'Prepare beds for new admissions and coordinate with ER'
      });
    }
  } else {
    const upcoming = forecast.manualDischarges?.next24Hours || 0;
    if (upcoming > 0) {
      recs.push({
        title: 'Scheduled Discharges (Manager)',
        description: `${upcoming} bed(s) scheduled for discharge within 24 hours`,
        priority: 'medium',
        action: 'Confirm discharge readiness and prepare beds for turnover'
      });
    }
  }

  // Cleaning recommendations
  const longCleaningBeds = cleaningPredictions.filter(c => c.predicted_cleaning_minutes > 30);
  if (longCleaningBeds.length > 0) {
    recs.push({
      title: 'Extended Cleaning Times Predicted',
      description: `${longCleaningBeds.length} bed(s) predicted to need more than 30 minutes of cleaning`,
      priority: 'medium',
      action: 'Allocate additional cleaning staff to priority areas'
    });
  }

  const occupancy = forecast.currentMetrics?.occupancyPercentage ?? 0;
  if (occupancy < 70) {
    recs.push({
      title: 'Maintenance Window Available',
      description: `Hospital-wide occupancy is at ${occupancy}%`,
      priority: 'low',
      action: 'Schedule routine maintenance and deep cleaning'
    });
  }

  if (occupancy >= 85) {
    recs.push({
      title: 'Prepare for Peak Demand',
      description: `Hospital-wide occupancy at ${occupancy}%`,
      priority: 'high',
      action: 'Ensure adequate staffing levels'
    });
  }

  return recs.slice(0, 4);
};

const ForecastingInsights = () => {
  const dispatch = useDispatch();
  const { bedsList } = useSelector((state) => state.beds);
  const [forecastMode, setForecastMode] = useState('ml'); // 'ml' or 'manager'
  const [forecast, setForecast] = useState(null);
  const [forecastError, setForecastError] = useState(null);
  const [cleaningPredictions, setCleaningPredictions] = useState([]);
  const [isLoadingCleaning, setIsLoadingCleaning] = useState(false);
  // Beds the current cleaning predictions were fetched for (skip refetching when unchanged)
  const predictedBedsKeyRef = useRef('');

  useEffect(() => {
    // Always fetch beds when component mounts to get latest data
    dispatch(fetchBeds());
  }, [dispatch]);

  // Refresh beds data every 30 seconds to get updated discharge times
  useEffect(() => {
    const interval = setInterval(() => {
      dispatch(fetchBeds());
    }, 30000); // 30 seconds

    return () => clearInterval(interval);
  }, [dispatch]);

  // Refetch the forecast whenever occupied beds or their manager-set discharge times change
  const occupiedBedsKey = bedsList
    .filter(bed => bed.status === 'occupied')
    .map(bed => `${bed._id}:${bed.estimatedDischargeTime || ''}`)
    .join(',');

  // Discharge forecast for all occupied beds: manager-set times, otherwise estimates from each admission time
  useEffect(() => {
    const fetchForecast = async () => {
      try {
        const response = await api.get('/analytics/forecasting');
        setForecast(response.data.data);
        setForecastError(null);
      } catch (error) {
        console.error('Error fetching discharge forecast:', error);
        setForecastError(error.response?.data?.message || 'Failed to load discharge forecast');
      }
    };

    fetchForecast();
    const interval = setInterval(fetchForecast, FORECAST_REFRESH_MS);
    return () => clearInterval(interval);
  }, [occupiedBedsKey]);

  // Cleaning duration predictions for beds being cleaned (from each bed's recorded start time and estimate)
  useEffect(() => {
    const cleaningBeds = bedsList.filter(bed => bed.status === 'cleaning').slice(0, 10);

    // The beds list is refreshed every 30 seconds; only refetch predictions when these beds change
    const bedsKey = cleaningBeds.map(bed => `${bed._id}:${bed.cleaningStartTime}`).join(',');
    if (bedsKey === predictedBedsKeyRef.current) return;
    predictedBedsKeyRef.current = bedsKey;

    if (cleaningBeds.length === 0) {
      setCleaningPredictions([]);
      return;
    }

    const fetchCleaningPredictions = async () => {
      setIsLoadingCleaning(true);
      const results = await Promise.all(cleaningBeds.map(async (bed) => {
        try {
          const response = await api.post(`/beds/${bed._id}/predict-cleaning`);
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
      }));

      // Failed predictions are retried on the next beds refresh
      if (results.includes(null)) {
        predictedBedsKeyRef.current = null;
      }
      setCleaningPredictions(results.filter(r => r !== null));
      setIsLoadingCleaning(false);
    };

    fetchCleaningPredictions();
  }, [bedsList]);

  const managerDischarges = forecast?.manualDischarges?.details || [];
  const estimatedDischarges = forecast?.aiDischarges?.details || [];
  const metrics = forecast?.currentMetrics;
  const timeline = forecast?.timeline || [];
  const maxBucketDischarges = Math.max(1, ...timeline.map(bucket => bucket.expectedDischarges));
  const recommendations = buildRecommendations(forecast, cleaningPredictions, forecastMode);
  const isLoading = (!forecast && !forecastError) || isLoadingCleaning;

  return (
    <div className="space-y-6">
      {/* Forecast Mode Toggle */}
      <Card className="bg-neutral-900 border-neutral-700">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-xl">
            <TrendingUp className="w-5 h-5 text-blue-400" />
            Forecasting Method
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-3">
            <Button
              onClick={() => setForecastMode('ml')}
              variant={forecastMode === 'ml' ? 'default' : 'outline'}
              className={`flex-1 ${forecastMode === 'ml'
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'border-purple-500/50 text-purple-300 hover:bg-purple-500/20'
                }`}
            >
              🤖 ML Model Predictions
            </Button>
            <Button
              onClick={() => setForecastMode('manager')}
              variant={forecastMode === 'manager' ? 'default' : 'outline'}
              className={`flex-1 ${forecastMode === 'manager'
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'border-blue-500/50 text-blue-300 hover:bg-blue-500/20'
                }`}
            >
              👤 Manager Assigned Times
            </Button>
          </div>
          <p className="text-sm text-slate-400 mt-3">
            {forecastMode === 'ml'
              ? 'Discharge times predicted by the ML model from each patient\'s recorded admission time (the ward\'s recorded average stay is used if the ML service is unavailable).'
              : 'Using discharge times manually assigned by managers for scheduled patient releases.'}
          </p>
        </CardContent>
      </Card>

      {forecastError && (
        <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4">
          <p className="text-red-400 text-sm">{forecastError}</p>
        </div>
      )}

      {isLoading && (
        <div className="bg-blue-500/20 border border-blue-500/50 rounded-lg p-4">
          <p className="text-blue-400 text-sm">Loading predictions...</p>
        </div>
      )}

      {/* Conditional Rendering Based on Mode */}
      {forecastMode === 'ml' ? (
        <>
          {/* ML PREDICTION CARDS */}
          {/* Discharge Predictions */}
          <MLDischargePredictionCard
            predictions={estimatedDischarges}
            maxDisplay={5}
          />

          {/* Cleaning Predictions */}
          <MLCleaningPredictionCard
            predictions={cleaningPredictions}
            maxDisplay={5}
          />

          {/* Availability Forecast */}
          {metrics && (
            <MLAvailabilityCard
              available24h={metrics.availableBeds + (forecast.expectedDischarges?.next24Hours || 0)}
              available48h={metrics.availableBeds + (forecast.expectedDischarges?.next48Hours || 0)}
              currentAvailable={metrics.availableBeds}
              totalBeds={metrics.totalBeds}
              discharges24h={forecast.expectedDischarges?.next24Hours || 0}
              discharges48h={forecast.expectedDischarges?.next48Hours || 0}
            />
          )}

          {/* ML Predictions Summary */}
          {estimatedDischarges.length > 0 && (
            <Card className="bg-neutral-900 border-neutral-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <TrendingUp className="w-5 h-5 text-purple-400" />
                  ML Discharge Predictions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {estimatedDischarges.slice(0, 6).map((discharge) => (
                    <div
                      key={discharge.bedId}
                      className="p-3 bg-neutral-900/50 rounded-lg border border-purple-500/30"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-white">
                          {discharge.ward} - Bed {discharge.bedId}
                        </span>
                        <Badge className="bg-purple-500/20 text-purple-300">
                          {discharge.isOverdue ? 'Past estimate' : formatRemaining(discharge)}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400">
                        Estimated discharge: {new Date(discharge.expectedDischargeTime).toLocaleString()}
                      </p>
                      <p className="text-xs text-slate-500">
                        {discharge.daysInBed}d in bed · {discharge.source === 'historical_average' ? 'ward average stay' : 'ML model'}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Cleaning Time Predictions */}
          {cleaningPredictions.length > 0 && (
            <Card className="bg-neutral-900 border-neutral-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <AlertTriangle className="w-5 h-5 text-green-400" />
                  ML Cleaning Duration Predictions
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {cleaningPredictions.slice(0, 6).map((prediction) => (
                    <div
                      key={prediction.bedId}
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
        </>
      ) : (
        <>
          {/* Manager Assigned Discharge Times */}
          {managerDischarges.length > 0 ? (
            <Card className="bg-neutral-900 border-neutral-700">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-xl">
                  <TrendingUp className="w-5 h-5 text-blue-400" />
                  Manager Assigned Discharge Schedule
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 md:grid-cols-2">
                  {managerDischarges.slice(0, 8).map((discharge) => (
                    <div
                      key={discharge.bedId}
                      className="p-3 bg-neutral-900/50 rounded-lg border border-blue-500/30"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="font-semibold text-white">
                          {discharge.ward} - Bed {discharge.bedId}
                        </span>
                        <Badge className="bg-blue-500/20 text-blue-300">
                          {discharge.isOverdue ? 'Past scheduled time' : formatRemaining(discharge)}
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400">
                        Patient: {discharge.patientName || 'N/A'}
                      </p>
                      <p className="text-xs text-slate-500">
                        Scheduled: {new Date(discharge.expectedDischargeTime).toLocaleString()}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card className="bg-neutral-900 border-neutral-700">
              <CardContent className="p-8 text-center">
                <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">No Discharge Times Assigned</h3>
                <p className="text-slate-400">
                  Managers have not assigned expected discharge dates for occupied beds yet.
                </p>
              </CardContent>
            </Card>
          )}
        </>
      )}

      {/* Expected Discharges Timeline */}
      {timeline.length > 0 && (
        <Card className="bg-neutral-900 border-neutral-700">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <Clock className="w-5 h-5 text-green-400" />
              Expected Discharges (Next 72 Hours)
            </CardTitle>
            <p className="text-xs text-slate-400 mt-1">
              Manager-set discharge times where available, otherwise estimated discharge times
            </p>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {timeline.map((bucket) => (
                <div key={bucket.label} className="flex items-center gap-3">
                  <span className="w-24 text-sm text-slate-300">{bucket.label}</span>
                  <div className="flex-1 bg-neutral-700 rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-green-500"
                      style={{ width: `${(bucket.expectedDischarges / maxBucketDischarges) * 100}%` }}
                    />
                  </div>
                  <span className="w-16 text-right text-xs text-neutral-400">
                    {bucket.expectedDischarges} bed{bucket.expectedDischarges !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

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
