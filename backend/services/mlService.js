/**
 * ML Service Client
 *
 * Service for communicating with the FastAPI ML microservice
 * Provides predictions for:
 * - Discharge time
 * - Bed availability
 * - Cleaning duration
 *
 * Failed calls return { success: false, error } - no estimates are made up here.
 * services/predictionService.js falls back to recorded ward averages instead.
 */

const axios = require('axios');

// A discharge prediction only depends on the ward and admission time, so frequent
// forecasting refreshes reuse it for a few minutes
const DISCHARGE_CACHE_TTL_MS = 5 * 60 * 1000;
const DISCHARGE_CACHE_MAX_ENTRIES = 1000;

class MLService {
  constructor() {
    this.baseURL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    this.apiPrefix = '/api/ml';
    this.timeout = 10000; // 10 seconds
    this.dischargeCache = new Map();

    this.client = axios.create({
      baseURL: this.baseURL,
      timeout: this.timeout,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }

  /**
   * Check if ML service is healthy and models are loaded
   */
  async healthCheck() {
    try {
      const response = await this.client.get('/health');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('ML Service health check failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Predict length of stay for a patient
   *
   * @param {string} ward - Ward name (ICU, Emergency, General)
   * @param {Date} admissionTime - Admission time (the ML service uses now if omitted)
   * @returns {Promise<Object>} ML response: prediction.hours_until_discharge is the predicted total
   *          stay in hours from admission; prediction.estimated_discharge_time is admission + that
   */
  async predictDischarge(ward, admissionTime = null) {
    const cacheKey = admissionTime ? `${ward}|${admissionTime.toISOString()}` : null;
    const cached = cacheKey && this.dischargeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    try {
      const payload = {
        ward,
        admission_time: admissionTime ? admissionTime.toISOString() : null
      };

      const response = await this.client.post(
        `${this.apiPrefix}/predict/discharge`,
        payload
      );

      const result = {
        success: true,
        data: response.data
      };
      if (cacheKey) {
        this._cacheDischargePrediction(cacheKey, result);
      }
      return result;
    } catch (error) {
      const message = this._errorMessage(error);
      console.error('Discharge prediction failed:', message);
      return {
        success: false,
        error: message
      };
    }
  }

  /**
   * Predict whether a bed will be released within the model's horizon (6 hours)
   *
   * @param {string} ward - Ward name
   * @param {string} bedStatus - Current bed status (available, cleaning, occupied)
   * @param {Date} currentTime - Optional current time (defaults to now)
   * @returns {Promise<Object>} Prediction with probability of the bed becoming available
   */
  async predictBedAvailability(ward, bedStatus, currentTime = null) {
    try {
      const payload = {
        ward,
        bed_status: bedStatus,
        current_time: currentTime ? currentTime.toISOString() : null
      };

      const response = await this.client.post(
        `${this.apiPrefix}/predict/bed-availability`,
        payload
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      const message = this._errorMessage(error);
      console.error('Bed availability prediction failed:', message);
      return {
        success: false,
        error: message
      };
    }
  }

  /**
   * Predict cleaning duration for a bed
   *
   * @param {string} ward - Ward name
   * @param {number} estimatedDuration - Staff estimate in minutes
   * @param {Date} startTime - Cleaning start time (defaults to now)
   * @returns {Promise<Object>} Prediction with actual cleaning duration
   */
  async predictCleaningDuration(ward, estimatedDuration, startTime = null) {
    try {
      const payload = {
        ward,
        estimated_duration: estimatedDuration,
        start_time: startTime ? startTime.toISOString() : null
      };

      const response = await this.client.post(
        `${this.apiPrefix}/predict/cleaning-duration`,
        payload
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      const message = this._errorMessage(error);
      console.error('Cleaning duration prediction failed:', message);
      return {
        success: false,
        error: message
      };
    }
  }

  /**
   * Error detail from the ML service when it responded, otherwise the connection error
   * @private
   */
  _errorMessage(error) {
    return error.response?.data?.detail || error.message;
  }

  /**
   * Store a successful discharge prediction, dropping expired entries when the cache is full
   * @private
   */
  _cacheDischargePrediction(key, result) {
    const now = Date.now();
    if (this.dischargeCache.size >= DISCHARGE_CACHE_MAX_ENTRIES) {
      for (const [cachedKey, entry] of this.dischargeCache) {
        if (entry.expiresAt <= now) this.dischargeCache.delete(cachedKey);
      }
      if (this.dischargeCache.size >= DISCHARGE_CACHE_MAX_ENTRIES) this.dischargeCache.clear();
    }
    this.dischargeCache.set(key, { result, expiresAt: now + DISCHARGE_CACHE_TTL_MS });
  }

  /**
   * Get service status and model information
   */
  async getModelsStatus() {
    try {
      const response = await this.client.get('/models/status');
      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Models status check failed:', error.message);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

// Export singleton instance
module.exports = new MLService();
