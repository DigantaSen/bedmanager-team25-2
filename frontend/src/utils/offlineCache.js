/**
 * Offline Cache Utility for Ward Staff Dashboard
 * Provides localStorage-based caching for bed data when offline
 * Task 4.3: Mobile-Optimized UI - Offline Capability
 */

const CACHE_KEY = 'wardStaff_bedData';
const CACHE_TIMESTAMP_KEY = 'wardStaff_bedData_timestamp';
const CACHE_EXPIRY_MS = 5 * 60 * 1000; // 5 minutes cache validity

/**
 * Save bed data to localStorage cache
 * @param {Array} beds - Array of bed objects
 */
export const cacheBedData = (beds) => {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(beds));
    localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString());
  } catch (error) {
    console.warn('Failed to cache bed data:', error);
  }
};

/**
 * Retrieve cached bed data from localStorage
 * @returns {Array|null} - Cached bed data or null if not available/expired
 */
export const getCachedBedData = () => {
  try {
    const cached = localStorage.getItem(CACHE_KEY);
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    
    if (!cached || !timestamp) return null;
    
    // Check if cache is still valid
    const age = Date.now() - parseInt(timestamp, 10);
    if (age > CACHE_EXPIRY_MS) {
      clearBedCache();
      return null;
    }
    
    return JSON.parse(cached);
  } catch (error) {
    console.warn('Failed to retrieve cached bed data:', error);
    return null;
  }
};

/**
 * Clear bed cache
 */
export const clearBedCache = () => {
  try {
    localStorage.removeItem(CACHE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  } catch (error) {
    console.warn('Failed to clear bed cache:', error);
  }
};

/**
 * Check if device is currently online
 * @returns {boolean}
 */
export const isOnline = () => {
  return navigator.onLine;
};

/**
 * Get cache age in seconds
 * @returns {number|null}
 */
export const getCacheAge = () => {
  try {
    const timestamp = localStorage.getItem(CACHE_TIMESTAMP_KEY);
    if (!timestamp) return null;
    return Math.floor((Date.now() - parseInt(timestamp, 10)) / 1000);
  } catch (error) {
    return null;
  }
};
