// backend/services/historicalAverages.js
// Ward averages from recorded history, used for estimates when the ML service is unavailable

const Bed = require('../models/Bed');
const CleaningLog = require('../models/CleaningLog');
const { DAY_MS, getStaysAndTurnarounds } = require('./occupancyHistory');

const LOOKBACK_DAYS = 90;

/**
 * @desc    Average length of completed stays (hours) in a ward over the last 90 days
 * @returns {Promise<{ hours: number, samples: number }|null>} null when no completed stays are recorded
 */
const getAverageStayHours = async (ward) => {
  const now = new Date();
  const beds = await Bed.find({ ward }).select('_id').lean();
  const { stayHours } = await getStaysAndTurnarounds(beds, new Date(now.getTime() - LOOKBACK_DAYS * DAY_MS), now);

  // Same range the ML training data uses (stays under 30 days)
  const stays = stayHours.filter((hours) => hours > 0 && hours < 720);
  if (stays.length === 0) return null;

  return {
    hours: stays.reduce((sum, hours) => sum + hours, 0) / stays.length,
    samples: stays.length
  };
};

/**
 * @desc    Average actual duration (minutes) of completed cleanings in a ward over the last 90 days
 * @returns {Promise<{ minutes: number, samples: number }|null>} null when no completed cleanings are recorded
 */
const getAverageCleaningMinutes = async (ward) => {
  const [result] = await CleaningLog.aggregate([
    {
      $match: {
        ward,
        status: 'completed',
        // Same range the ML training data uses
        actualDuration: { $gte: 1, $lte: 480 },
        endTime: { $gte: new Date(Date.now() - LOOKBACK_DAYS * DAY_MS) }
      }
    },
    { $group: { _id: null, minutes: { $avg: '$actualDuration' }, samples: { $sum: 1 } } }
  ]);

  return result ? { minutes: result.minutes, samples: result.samples } : null;
};

module.exports = {
  LOOKBACK_DAYS,
  getAverageStayHours,
  getAverageCleaningMinutes
};
