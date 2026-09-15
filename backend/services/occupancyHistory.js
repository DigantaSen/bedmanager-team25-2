// backend/services/occupancyHistory.js
// Reconstructs bed occupancy over time from recorded OccupancyLog events

const Bed = require('../models/Bed');
const OccupancyLog = require('../models/OccupancyLog');

const HOUR_MS = 60 * 60 * 1000;
const DAY_MS = 24 * HOUR_MS;

// How each occupancy log event changes the number of occupied beds
const OCCUPANCY_DELTA = { assigned: 1, released: -1 };

/**
 * @desc    Beds in scope (all beds, or only the given wards)
 */
const getBedsInScope = (wards = []) => {
  const query = wards.length > 0 ? { ward: { $in: wards } } : {};
  return Bed.find(query).select('_id bedId ward status').lean();
};

/**
 * @desc    Occupancy step function from `start` until `now` for the given beds.
 *          Walks back from the current bed statuses through assigned/released events,
 *          so every point is derived from recorded history.
 * @returns {{ points: Array<{time: Date, occupied: number}>, historyStart: Date|null }}
 *          points sorted by time (first point at `start`); historyStart is the first recorded
 *          assignment/release for these beds - occupancy before it is unknown
 */
const buildOccupancyPoints = async (beds, start, now = new Date()) => {
  const totalBeds = beds.length;
  const occupiedNow = beds.filter((bed) => bed.status === 'occupied').length;
  const scope = {
    bedId: { $in: beds.map((bed) => bed._id) },
    statusChange: { $in: Object.keys(OCCUPANCY_DELTA) }
  };

  const [events, firstEvent] = await Promise.all([
    OccupancyLog.find({ ...scope, timestamp: { $gte: start, $lte: now } })
      .select('timestamp statusChange')
      .sort({ timestamp: 1 })
      .lean(),
    OccupancyLog.findOne(scope).select('timestamp').sort({ timestamp: 1 }).lean()
  ]);

  const clamp = (value) => Math.min(totalBeds, Math.max(0, value));
  const netChange = events.reduce((sum, event) => sum + OCCUPANCY_DELTA[event.statusChange], 0);

  let occupied = occupiedNow - netChange;
  const points = [{ time: start, occupied: clamp(occupied) }];
  events.forEach((event) => {
    occupied += OCCUPANCY_DELTA[event.statusChange];
    points.push({ time: event.timestamp, occupied: clamp(occupied) });
  });

  return { points, historyStart: firstEvent ? firstEvent.timestamp : null };
};

/**
 * @desc    Time-weighted average, peak and lowest occupancy (%) for each period
 * @param   points       - points from buildOccupancyPoints (must start at or before the first period)
 * @param   periods      - [{ start: Date, end: Date }] in chronological order
 * @param   totalBeds    - number of beds in scope
 * @param   historyStart - first recorded event (from buildOccupancyPoints); periods before it have
 *                         no data (null values) and partly covered periods start from it.
 *                         Omit to treat the whole range as covered.
 */
const summarizeOccupancy = (points, periods, totalBeds, historyStart) => {
  const toPercent = (beds) => (totalBeds > 0 ? Math.round((beds / totalBeds) * 1000) / 10 : 0);
  let index = 0;
  let current = points[0].occupied;

  return periods.map(({ start: periodStart, end }) => {
    if (historyStart !== undefined && (historyStart === null || end <= historyStart)) {
      return { start: periodStart, end, averageOccupancy: null, peakOccupancy: null, lowOccupancy: null };
    }
    const start = historyStart && historyStart > periodStart ? historyStart : periodStart;

    while (index < points.length && points[index].time <= start) {
      current = points[index].occupied;
      index++;
    }

    let weightedSum = 0;
    let cursor = start;
    let peak = current;
    let low = current;
    while (index < points.length && points[index].time < end) {
      weightedSum += current * (points[index].time - cursor);
      cursor = points[index].time;
      current = points[index].occupied;
      peak = Math.max(peak, current);
      low = Math.min(low, current);
      index++;
    }
    weightedSum += current * (end - cursor);
    const duration = end - start;

    return {
      start: periodStart,
      end,
      averageOccupancy: toPercent(duration > 0 ? weightedSum / duration : current),
      peakOccupancy: toPercent(peak),
      lowOccupancy: toPercent(low)
    };
  });
};

/**
 * @desc    Split [start, end) into `count` equal consecutive periods
 */
const splitPeriods = (start, end, count) => {
  const length = (end - start) / count;
  return Array.from({ length: count }, (_, i) => ({
    start: new Date(start.getTime() + i * length),
    end: new Date(start.getTime() + (i + 1) * length)
  }));
};

/**
 * @desc    Completed stays (assigned -> released) and turnarounds (released -> next assigned)
 *          whose release happened within [from, to]
 * @returns {{ stayHours: number[], turnaroundHours: number[] }}
 */
const getStaysAndTurnarounds = async (beds, from, to, lookbackDays = 90) => {
  const logs = await OccupancyLog.find({
    bedId: { $in: beds.map((bed) => bed._id) },
    statusChange: { $in: Object.keys(OCCUPANCY_DELTA) },
    timestamp: { $gte: new Date(from.getTime() - lookbackDays * DAY_MS), $lte: new Date() }
  })
    .select('bedId timestamp statusChange')
    .sort({ bedId: 1, timestamp: 1 })
    .lean();

  const stayHours = [];
  const turnaroundHours = [];
  const inRange = (time) => time >= from && time <= to;
  let bedKey = null;
  let admittedAt = null;
  let releasedAt = null;

  logs.forEach((log) => {
    const key = log.bedId.toString();
    if (key !== bedKey) {
      bedKey = key;
      admittedAt = null;
      releasedAt = null;
    }

    if (log.statusChange === 'assigned') {
      if (releasedAt && inRange(releasedAt)) {
        turnaroundHours.push((log.timestamp - releasedAt) / HOUR_MS);
      }
      admittedAt = log.timestamp;
      releasedAt = null;
    } else {
      if (admittedAt && inRange(log.timestamp)) {
        stayHours.push((log.timestamp - admittedAt) / HOUR_MS);
      }
      admittedAt = null;
      releasedAt = log.timestamp;
    }
  });

  return { stayHours, turnaroundHours };
};

module.exports = {
  DAY_MS,
  getBedsInScope,
  buildOccupancyPoints,
  summarizeOccupancy,
  splitPeriods,
  getStaysAndTurnarounds
};
