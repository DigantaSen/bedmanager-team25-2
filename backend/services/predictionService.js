// backend/services/predictionService.js
// Discharge and cleaning estimates: ML predictions, or the ward's recorded averages when the ML service is unavailable

const mlService = require('./mlService');
const { LOOKBACK_DAYS, getAverageStayHours, getAverageCleaningMinutes } = require('./historicalAverages');

const HOUR_MS = 60 * 60 * 1000;
const MINUTE_MS = 60 * 1000;
const roundTo = (value, digits = 1) => Math.round(value * 10 ** digits) / 10 ** digits;

/**
 * @desc    Estimated discharge for a patient admitted at `admissionTime`
 * @param   options.getAverageStay - loader for a ward's average stay (pass a cached one when estimating many beds)
 * @returns {Promise<Object|null>} null when neither the ML service nor recorded stays can provide an estimate
 */
const estimateDischarge = async (ward, admissionTime, { now = new Date(), getAverageStay = getAverageStayHours } = {}) => {
  const result = await mlService.predictDischarge(ward, admissionTime);

  let stayHours;
  let basis;
  if (result.success) {
    // The ML model predicts the total length of stay, counted from admission
    stayHours = result.data.prediction.hours_until_discharge;
    basis = { source: 'ml', model_version: result.data.metadata?.model_version };
  } else {
    const average = await getAverageStay(ward);
    if (!average) return null;
    stayHours = average.hours;
    basis = { source: 'historical_average', samples: average.samples, lookback_days: LOOKBACK_DAYS };
  }

  const estimatedDischargeTime = new Date(admissionTime.getTime() + stayHours * HOUR_MS);
  return {
    admission_time: admissionTime,
    predicted_stay_hours: roundTo(stayHours),
    estimated_discharge_time: estimatedDischargeTime,
    hours_remaining: roundTo((estimatedDischargeTime - now) / HOUR_MS),
    ...basis
  };
};

/**
 * @desc    Estimated duration of a cleaning that started at `startTime` with the staff estimate `estimatedDuration` (minutes)
 * @returns {Promise<Object|null>} null when neither the ML service nor recorded cleanings can provide an estimate
 */
const estimateCleaning = async (ward, estimatedDuration, startTime, { now = new Date() } = {}) => {
  const result = await mlService.predictCleaningDuration(ward, estimatedDuration, startTime);

  let minutes;
  let basis;
  if (result.success) {
    minutes = result.data.prediction.predicted_duration_minutes;
    basis = { source: 'ml', model_version: result.data.metadata?.model_version };
  } else {
    const average = await getAverageCleaningMinutes(ward);
    if (!average) return null;
    minutes = average.minutes;
    basis = { source: 'historical_average', samples: average.samples, lookback_days: LOOKBACK_DAYS };
  }

  const estimatedEndTime = new Date(startTime.getTime() + minutes * MINUTE_MS);
  return {
    start_time: startTime,
    estimated_duration: estimatedDuration,
    predicted_duration_minutes: roundTo(minutes),
    estimated_end_time: estimatedEndTime,
    minutes_remaining: roundTo((estimatedEndTime - now) / MINUTE_MS),
    variance_from_estimate: roundTo(minutes - estimatedDuration),
    ...basis
  };
};

module.exports = {
  estimateDischarge,
  estimateCleaning
};
