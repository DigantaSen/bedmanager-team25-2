// backend/models/index.js
// Central export file for all models

const User = require('./User');
const Bed = require('./Bed');
const OccupancyLog = require('./OccupancyLog');
const EmergencyRequest = require('./EmergencyRequest');
const Alert = require('./Alert');
const Hospital = require('./Hospital');

module.exports = {
  User,
  Bed,
  OccupancyLog,
  EmergencyRequest,
  Alert,
  Hospital
};
