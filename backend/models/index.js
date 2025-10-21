// backend/models/index.js
// Central export file for all models

const User = require('./User');
const Bed = require('./Bed');
const OccupancyLog = require('./OccupancyLog');

module.exports = {
  User,
  Bed,
  OccupancyLog
};
