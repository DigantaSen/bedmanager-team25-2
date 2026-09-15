// How long ago a manually updated value was last changed

// Manually entered values older than this are flagged as possibly out of date
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export const formatTimeAgo = (date, now = Date.now()) => {
  const seconds = Math.max(0, Math.round((now - new Date(date).getTime()) / 1000));
  const units = [
    ['day', 86400],
    ['hour', 3600],
    ['minute', 60]
  ];
  for (const [unit, size] of units) {
    const value = Math.floor(seconds / size);
    if (value >= 1) return `${value} ${unit}${value !== 1 ? 's' : ''} ago`;
  }
  return 'just now';
};

export const isStale = (date, now = Date.now()) => !date || now - new Date(date).getTime() > STALE_AFTER_MS;
