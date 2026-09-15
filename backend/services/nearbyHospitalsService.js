// backend/services/nearbyHospitalsService.js
// Nearby hospital directory (maintained by hospital admins) and referral capacity lookups

const Hospital = require('../models/Hospital');

/**
 * Directory entry in the shape the frontend uses.
 * Occupied beds are derived from the admin-entered total and available counts.
 */
const formatHospital = (hospital) => ({
  id: hospital._id.toString(),
  name: hospital.name,
  address: hospital.address,
  location: hospital.location?.latitude != null && hospital.location?.longitude != null
    ? { latitude: hospital.location.latitude, longitude: hospital.location.longitude }
    : null,
  distance: hospital.distance,
  phone: hospital.contactNumber,
  emergencyContact: hospital.emergencyContact || null,
  isActive: hospital.isActive !== false,
  wards: (hospital.wards || []).reduce((acc, ward) => {
    const occupied = Math.max(0, ward.totalBeds - ward.availableBeds);
    acc[ward.wardType] = {
      total: ward.totalBeds,
      available: ward.availableBeds,
      occupied,
      occupancyRate: ward.totalBeds > 0 ? Math.round((occupied / ward.totalBeds) * 100) : null
    };
    return acc;
  }, {}),
  lastUpdated: hospital.lastUpdated || null,
  lastUpdatedBy: hospital.lastUpdatedBy?.name || null
});

const findHospitals = (query) =>
  Hospital.find(query).populate('lastUpdatedBy', 'name').sort({ distance: 1 }).lean();

// Hospitals with at least `minAvailableBeds` free beds in the same ward entry
const wardCapacityQuery = (ward, minAvailableBeds) => ({
  wards: { $elemMatch: { wardType: ward, availableBeds: { $gte: minAvailableBeds } } }
});

/**
 * Active hospitals, nearest first
 * @param {Object} filters - ward, maxDistance (km), minAvailableBeds (used with ward, default 1)
 */
const getNearbyHospitals = async ({ ward, maxDistance, minAvailableBeds } = {}) => {
  const query = { isActive: true };
  if (maxDistance !== undefined) {
    query.distance = { $lte: Number(maxDistance) };
  }
  if (ward) {
    Object.assign(query, wardCapacityQuery(ward, minAvailableBeds !== undefined ? Number(minAvailableBeds) : 1));
  }
  return (await findHospitals(query)).map(formatHospital);
};

/**
 * Every hospital in the directory, including inactive ones (for admins)
 */
const listHospitals = async () => (await findHospitals({})).map(formatHospital);

/**
 * A specific hospital by ID
 * @returns {Object|null}
 */
const getHospitalById = async (hospitalId) => {
  const hospital = await Hospital.findById(hospitalId).populate('lastUpdatedBy', 'name').lean();
  return hospital ? formatHospital(hospital) : null;
};

/**
 * Active hospitals with free beds in a ward, most available beds first
 */
const getHospitalsWithCapacity = async (ward, minAvailableBeds = 1) =>
  (await findHospitals({ isActive: true, ...wardCapacityQuery(ward, minAvailableBeds) }))
    .map(formatHospital)
    .sort((a, b) => b.wards[ward].available - a.wards[ward].available);

/**
 * Add a hospital with its wards; the bed counts are recorded as updated now by `userId`
 */
const createHospital = async (details, wards, userId) => {
  const hospital = await Hospital.create({ ...details, wards, lastUpdated: new Date(), lastUpdatedBy: userId });
  return getHospitalById(hospital._id);
};

/**
 * Update directory details (not bed counts)
 * @returns {Object|null} null when the hospital does not exist
 */
const updateHospitalDetails = async (hospitalId, details) => {
  const hospital = await Hospital.findById(hospitalId);
  if (!hospital) return null;
  hospital.set(details);
  await hospital.save();
  return getHospitalById(hospitalId);
};

/**
 * Replace ward bed counts, recording when and by whom
 * @returns {Object|null} null when the hospital does not exist
 */
const updateHospitalBeds = async (hospitalId, wards, userId) => {
  const hospital = await Hospital.findById(hospitalId);
  if (!hospital) return null;
  hospital.wards = wards;
  hospital.lastUpdated = new Date();
  hospital.lastUpdatedBy = userId;
  await hospital.save();
  return getHospitalById(hospitalId);
};

/**
 * Remove a hospital from the directory
 * @returns {boolean} whether a hospital was removed
 */
const deleteHospital = async (hospitalId) => Boolean(await Hospital.findByIdAndDelete(hospitalId));

module.exports = {
  getNearbyHospitals,
  listHospitals,
  getHospitalById,
  getHospitalsWithCapacity,
  createHospital,
  updateHospitalDetails,
  updateHospitalBeds,
  deleteHospital
};
