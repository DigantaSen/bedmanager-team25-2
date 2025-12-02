/**
 * ML Service Client
 * 
 * Service for communicating with the FastAPI ML microservice
 * Provides predictions for:
 * - Discharge time
 * - Bed availability
 * - Cleaning duration
 */

const axios = require('axios');

class MLService {
  constructor() {
    this.baseURL = process.env.ML_SERVICE_URL || 'http://localhost:8000';
    this.apiPrefix = '/api/ml';
    this.timeout = 10000; // 10 seconds
    
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
   * Predict discharge time for a patient
   * 
   * @param {string} ward - Ward name (ICU, Emergency, General, etc.)
   * @param {Date} admissionTime - Optional admission time (defaults to now)
   * @returns {Promise<Object>} Prediction with hours until discharge and estimated discharge time
   */
  async predictDischarge(ward, admissionTime = null) {
    try {
      const payload = {
        ward,
        admission_time: admissionTime ? admissionTime.toISOString() : null
      };

      const response = await this.client.post(
        `${this.apiPrefix}/predict/discharge`,
        payload
      );

      return {
        success: true,
        data: response.data
      };
    } catch (error) {
      console.error('Discharge prediction failed:', error.message);
      return {
        success: false,
        error: error.message,
        fallback: this._getFallbackDischargeEstimate(ward)
      };
    }
  }

  /**
   * Predict bed availability in the next N hours
   * 
   * @param {string} ward - Ward name
   * @param {number} horizonHours - Hours ahead to predict (default 6)
   * @param {Date} currentTime - Optional current time (defaults to now)
   * @returns {Promise<Object>} Prediction with probability of bed availability
   */
  async predictBedAvailability(ward, horizonHours = 6, currentTime = null) {
    try {
      const payload = {
        ward,
        current_time: currentTime ? currentTime.toISOString() : null,
        prediction_horizon_hours: horizonHours
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
      console.error('Bed availability prediction failed:', error.message);
      return {
        success: false,
        error: error.message,
        fallback: { will_be_available: false, probability: 0.5 }
      };
    }
  }

  /**
   * Predict cleaning duration for a bed
   * 
   * @param {string} ward - Ward name
   * @param {number} estimatedDuration - Initial estimate in minutes (default 30)
   * @param {Date} startTime - Optional start time (defaults to now)
   * @returns {Promise<Object>} Prediction with actual cleaning duration
   */
  async predictCleaningDuration(ward, estimatedDuration = 30, startTime = null) {
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
      console.error('Cleaning duration prediction failed:', error.message);
      return {
        success: false,
        error: error.message,
        fallback: this._getFallbackCleaningDuration(estimatedDuration)
      };
    }
  }

  /**
   * Fallback discharge estimate if ML service is unavailable
   * @private
   */
  _getFallbackDischargeEstimate(ward) {
    const defaults = {
      'ICU': 120,
      'Emergency': 48,
      'General': 72,
      'Pediatrics': 60,
      'Maternity': 96
    };
    return {
      hours_until_discharge: defaults[ward] || 72,
      estimated_discharge_time: new Date(Date.now() + (defaults[ward] || 72) * 3600000).toISOString(),
      note: 'Fallback estimate - ML service unavailable'
    };
  }

  /**
   * Fallback cleaning duration if ML service is unavailable
   * @private
   */
  _getFallbackCleaningDuration(estimatedDuration) {
    return {
      predicted_duration_minutes: estimatedDuration * 1.1, // Add 10% buffer
      note: 'Fallback estimate - ML service unavailable'
    };
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
