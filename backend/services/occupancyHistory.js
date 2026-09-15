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
 * @param   options.includeRetired - include retired beds (needed for history, where they count
 *                                   for the time they were in service)
 */
const getBedsInScope = (wards = [], { includeRetired = false } = {}) => {
  const query = wards.length > 0 ? { ward: { $in: wards } } : {};
  if (!includeRetired) query.retiredAt = null;
  return Bed.find(query).select('_id bedId ward status createdAt retiredAt').lean();
};

/**
 * @desc    Beds in service over time. A bed counts from when it was added (or its first recorded
 *          event, if that is earlier) until it was retired.
 * @returns {Array<{time: Date, capacity: number}>} first point at `start`
 */
const buildCapacityPoints = (beds, firstEventByBed, start, now) => {
  const changes = [];
  let capacity = 0;

  beds.forEach((bed) => {
    const firstEvent = firstEventByBed.get(bed._id.toString());
    const addedAt = bed.createdAt ? new Date(bed.createdAt) : new Date(0);
    const activeFrom = firstEvent && firstEvent < addedAt ? firstEvent : addedAt;
    const activeUntil = bed.retiredAt ? new Date(bed.retiredAt) : null;
    if (activeUntil && activeUntil <= activeFrom) return;

    if (activeFrom <= start && (!activeUntil || activeUntil > start)) capacity++;
    if (activeFrom > start && activeFrom <= now) changes.push({ time: activeFrom, delta: 1 });
    if (activeUntil && activeUntil > start && activeUntil <= now) changes.push({ time: activeUntil, delta: -1 });
  });

  changes.sort((a, b) => a.time - b.time);
  const points = [{ time: start, capacity }];
  changes.forEach(({ time, delta }) => {
    capacity += delta;
    points.push({ time, capacity });
  });
  return points;
};

/**
 * @desc    Occupancy step function from `start` until `now` for the given beds.
 *          Walks back from the current bed statuses through assigned/released events,
 *          so every point is derived from recorded history.
 * @returns {{ points, capacityPoints, historyStart }}
 *          points: [{time, occupied}] sorted by time (first point at `start`);
 *          capacityPoints: beds in service over the same range (see buildCapacityPoints);
 *          historyStart: the first recorded assignment/release for these beds (occupancy before it is unknown)
 */
const buildOccupancyPoints = async (beds, start, now = new Date()) => {
  const totalBeds = beds.length;
  const occupiedNow = beds.filter((bed) => bed.status === 'occupied').length;
  const scope = {
    bedId: { $in: beds.map((bed) => bed._id) },
    statusChange: { $in: Object.keys(OCCUPANCY_DELTA) }
  };

  const [events, firstEvents] = await Promise.all([
    OccupancyLog.find({ ...scope, timestamp: { $gte: start, $lte: now } })
      .select('timestamp statusChange')
      .sort({ timestamp: 1 })
      .lean(),
    OccupancyLog.aggregate([
      { $match: scope },
      { $group: { _id: '$bedId', first: { $min: '$timestamp' } } }
    ])
  ]);

  const clamp = (value) => Math.min(totalBeds, Math.max(0, value));
  const netChange = events.reduce((sum, event) => sum + OCCUPANCY_DELTA[event.statusChange], 0);

  let occupied = occupiedNow - netChange;
  const points = [{ time: start, occupied: clamp(occupied) }];
  events.forEach((event) => {
    occupied += OCCUPANCY_DELTA[event.statusChange];
    points.push({ time: event.timestamp, occupied: clamp(occupied) });
  });

  const firstEventByBed = new Map(firstEvents.map((event) => [event._id.toString(), event.first]));
  const historyStart = firstEvents.length > 0
    ? new Date(Math.min(...firstEvents.map((event) => event.first.getTime())))
    : null;

  return {
    points,
    capacityPoints: buildCapacityPoints(beds, firstEventByBed, start, now),
    historyStart
  };
};

// Reads a time-sorted step series forward in time
const createCursor = (series, key) => {
  let index = 0;
  let value = series[0][key];
  return {
    // Value at time t (t must not decrease between calls)
    at(t) {
      while (index < series.length && series[index].time.getTime() <= t) {
        value = series[index][key];
        index++;
      }
      return value;
    },
    // Time of the next change after t, or Infinity
    nextChange(t) {
      let i = index;
      while (i < series.length && series[i].time.getTime() <= t) i++;
      return i < series.length ? series[i].time.getTime() : Infinity;
    }
  };
};

/**
 * @desc    Time-weighted average, peak and lowest occupancy (%) for each period
 * @param   points       - points from buildOccupancyPoints (must start at or before the first period)
 * @param   periods      - [{ start: Date, end: Date }] in chronological order
 * @param   capacity     - beds in service: a number, or capacityPoints from buildOccupancyPoints
 * @param   historyStart - first recorded event (from buildOccupancyPoints); periods before it have
 *                         no data (null values) and partly covered periods start from it.
 *                         Omit to treat the whole range as covered.
 */
const summarizeOccupancy = (points, periods, capacity, historyStart) => {
  const capacityPoints = typeof capacity === 'number' ? [{ time: new Date(0), capacity }] : capacity;
  const toPercent = (share) => Math.round(share * 1000) / 10;
  const occupancy = createCursor(points, 'occupied');
  const beds = createCursor(capacityPoints, 'capacity');

  return periods.map(({ start: periodStart, end }) => {
    if (historyStart !== undefined && (historyStart === null || end <= historyStart)) {
      return { start: periodStart, end, averageOccupancy: null, peakOccupancy: null, lowOccupancy: null };
    }
    const start = historyStart && historyStart > periodStart ? historyStart : periodStart;
    const endMs = end.getTime();

    let t = start.getTime();
    let occupiedTime = 0;
    let capacityTime = 0;
    let peak = null;
    let low = null;
    do {
      const occupied = occupancy.at(t);
      const inService = beds.at(t);
      const next = Math.min(endMs, occupancy.nextChange(t), beds.nextChange(t));
      occupiedTime += occupied * (next - t);
      capacityTime += inService * (next - t);
      if (inService > 0) {
        const share = Math.min(1, occupied / inService);
        peak = peak === null ? share : Math.max(peak, share);
        low = low === null ? share : Math.min(low, share);
      }
      t = next;
    } while (t < endMs);

    return {
      start: periodStart,
      end,
      averageOccupancy: toPercent(capacityTime > 0 ? occupiedTime / capacityTime : 0),
      peakOccupancy: toPercent(peak ?? 0),
      lowOccupancy: toPercent(low ?? 0)
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
  buildCapacityPoints,
  buildOccupancyPoints,
  summarizeOccupancy,
  splitPeriods,
  getStaysAndTurnarounds
};
