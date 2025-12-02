// backend/services/nearbyHospitalsService.js
// Service for managing nearby hospital data and availability from MongoDB

const Hospital = require('../models/Hospital');

// Legacy hardcoded data (kept for reference, not used)
const nearbyHospitalsLegacy = [
  {
    id: 'hosp_001',
    name: 'City General Hospital',
    address: '123 Medical Center Drive, Downtown',
    distance: 2.3, // km
    phone: '+1 (555) 123-4567',
    emergencyContact: '+1 (555) 123-4568',
    website: 'https://citygeneralhospital.com',
    specialties: ['Cardiology', 'Neurology', 'Orthopedics', 'Emergency Care'],
    wards: {
      ICU: {
        total: 20,
        available: 3,
        occupied: 15,
        cleaning: 2,
        occupancyRate: 75
      },
      Emergency: {
        total: 30,
        available: 8,
        occupied: 20,
        cleaning: 2,
        occupancyRate: 67
      },
      General: {
        total: 50,
        available: 12,
        occupied: 35,
        cleaning: 3,
        occupancyRate: 70
      },
      Pediatrics: {
        total: 25,
        available: 5,
        occupied: 18,
        cleaning: 2,
        occupancyRate: 72
      }
    },
    rating: 4.5,
    acceptsReferrals: true,
    lastUpdated: new Date()
  },
  {
    id: 'hosp_002',
    name: "St. Mary's Medical Center",
    address: '456 Healthcare Avenue, Midtown',
    distance: 3.8,
    phone: '+1 (555) 234-5678',
    emergencyContact: '+1 (555) 234-5679',
    website: 'https://stmarysmedical.com',
    specialties: ['Oncology', 'Pediatrics', 'Maternity', 'Surgery'],
    wards: {
      ICU: {
        total: 15,
        available: 2,
        occupied: 12,
        cleaning: 1,
        occupancyRate: 80
      },
      Emergency: {
        total: 25,
        available: 6,
        occupied: 17,
        cleaning: 2,
        occupancyRate: 68
      },
      General: {
        total: 60,
        available: 15,
        occupied: 42,
        cleaning: 3,
        occupancyRate: 70
      },
      Pediatrics: {
        total: 30,
        available: 8,
        occupied: 20,
        cleaning: 2,
        occupancyRate: 67
      }
    },
    rating: 4.7,
    acceptsReferrals: true,
    lastUpdated: new Date()
  },
  {
    id: 'hosp_003',
    name: 'Metropolitan Health Institute',
    address: '789 Wellness Boulevard, Uptown',
    distance: 5.1,
    phone: '+1 (555) 345-6789',
    emergencyContact: '+1 (555) 345-6790',
    website: 'https://metrohealthinstitute.com',
    specialties: ['Trauma Care', 'Burns Unit', 'Neurosurgery', 'ICU'],
    wards: {
      ICU: {
        total: 25,
        available: 5,
        occupied: 18,
        cleaning: 2,
        occupancyRate: 72
      },
      Emergency: {
        total: 35,
        available: 10,
        occupied: 23,
        cleaning: 2,
        occupancyRate: 66
      },
      General: {
        total: 45,
        available: 10,
        occupied: 32,
        cleaning: 3,
        occupancyRate: 71
      },
      Pediatrics: {
        total: 20,
        available: 4,
        occupied: 15,
        cleaning: 1,
        occupancyRate: 75
      }
    },
    rating: 4.6,
    acceptsReferrals: true,
    lastUpdated: new Date()
  },
  {
    id: 'hosp_004',
    name: 'Riverside Community Hospital',
    address: '321 River Road, Westside',
    distance: 4.5,
    phone: '+1 (555) 456-7890',
    emergencyContact: '+1 (555) 456-7891',
    website: 'https://riversidecommunityhospital.com',
    specialties: ['Family Medicine', 'General Surgery', 'Rehabilitation'],
    wards: {
      ICU: {
        total: 12,
        available: 1,
        occupied: 10,
        cleaning: 1,
        occupancyRate: 83
      },
      Emergency: {
        total: 20,
        available: 4,
        occupied: 14,
        cleaning: 2,
        occupancyRate: 70
      },
      General: {
        total: 40,
        available: 8,
        occupied: 30,
        cleaning: 2,
        occupancyRate: 75
      },
      Pediatrics: {
        total: 15,
        available: 3,
        occupied: 11,
        cleaning: 1,
        occupancyRate: 73
      }
    },
    rating: 4.3,
    acceptsReferrals: true,
    lastUpdated: new Date()
  },
  {
    id: 'hosp_005',
    name: 'Central Medical Complex',
    address: '654 Center Street, Business District',
    distance: 3.2,
    phone: '+1 (555) 567-8901',
    emergencyContact: '+1 (555) 567-8902',
    website: 'https://centralmedicalcomplex.com',
    specialties: ['Cardiology', 'Pulmonology', 'Endocrinology', 'Diabetes Care'],
    wards: {
      ICU: {
        total: 18,
        available: 4,
        occupied: 13,
        cleaning: 1,
        occupancyRate: 72
      },
      Emergency: {
        total: 28,
        available: 7,
        occupied: 19,
        cleaning: 2,
        occupancyRate: 68
      },
      General: {
        total: 55,
        available: 14,
        occupied: 38,
        cleaning: 3,
        occupancyRate: 69
      },
      Pediatrics: {
        total: 22,
        available: 5,
        occupied: 16,
        cleaning: 1,
        occupancyRate: 73
      }
    },
    rating: 4.8,
    acceptsReferrals: true,
    lastUpdated: new Date()
  },
  {
    id: 'hosp_006',
    name: 'Lakeside Regional Medical',
    address: '987 Lakeview Drive, North District',
    distance: 6.7,
    phone: '+1 (555) 678-9012',
    emergencyContact: '+1 (555) 678-9013',
    website: 'https://lakesideregional.com',
    specialties: ['Orthopedics', 'Sports Medicine', 'Physical Therapy'],
    wards: {
      ICU: {
        total: 14,
        available: 2,
        occupied: 11,
        cleaning: 1,
        occupancyRate: 79
      },
      Emergency: {
        total: 22,
        available: 5,
        occupied: 15,
        cleaning: 2,
        occupancyRate: 68
      },
      General: {
        total: 48,
        available: 11,
        occupied: 34,
        cleaning: 3,
        occupancyRate: 71
      },
      Pediatrics: {
        total: 18,
        available: 4,
        occupied: 13,
        cleaning: 1,
        occupancyRate: 72
      }
    },
    rating: 4.4,
    acceptsReferrals: true,
    lastUpdated: new Date()
  },
  {
    id: 'hosp_007',
    name: 'Hillcrest Memorial Hospital',
    address: '246 Hill Street, South Heights',
    distance: 7.9,
    phone: '+1 (555) 789-0123',
    emergencyContact: '+1 (555) 789-0124',
    website: 'https://hillcrestmemorial.com',
    specialties: ['Oncology', 'Radiation Therapy', 'Palliative Care'],
    wards: {
      ICU: {
        total: 16,
        available: 3,
        occupied: 12,
        cleaning: 1,
        occupancyRate: 75
      },
      Emergency: {
        total: 24,
        available: 6,
        occupied: 16,
        cleaning: 2,
        occupancyRate: 67
      },
      General: {
        total: 52,
        available: 13,
        occupied: 36,
        cleaning: 3,
        occupancyRate: 69
      },
      Pediatrics: {
        total: 20,
        available: 5,
        occupied: 14,
        cleaning: 1,
        occupancyRate: 70
      }
    },
    rating: 4.9,
    acceptsReferrals: true,
    lastUpdated: new Date()
  },
  {
    id: 'hosp_008',
    name: 'Valley View Healthcare',
    address: '135 Valley Road, East Valley',
    distance: 5.6,
    phone: '+1 (555) 890-1234',
    emergencyContact: '+1 (555) 890-1235',
    website: 'https://valleyviewhealthcare.com',
    specialties: ['Gastroenterology', 'Hepatology', 'General Medicine'],
    wards: {
      ICU: {
        total: 13,
        available: 2,
        occupied: 10,
        cleaning: 1,
        occupancyRate: 77
      },
      Emergency: {
        total: 21,
        available: 5,
        occupied: 14,
        cleaning: 2,
        occupancyRate: 67
      },
      General: {
        total: 42,
        available: 9,
        occupied: 31,
        cleaning: 2,
        occupancyRate: 74
      },
      Pediatrics: {
        total: 16,
        available: 3,
        occupied: 12,
        cleaning: 1,
        occupancyRate: 75
      }
    },
    rating: 4.2,
    acceptsReferrals: true,
    lastUpdated: new Date()
  },
  {
    id: 'hosp_009',
    name: 'Oakwood Specialty Hospital',
    address: '864 Oak Avenue, Garden District',
    distance: 4.1,
    phone: '+1 (555) 901-2345',
    emergencyContact: '+1 (555) 901-2346',
    website: 'https://oakwoodspecialty.com',
    specialties: ['Nephrology', 'Dialysis', 'Urology', 'Kidney Care'],
    wards: {
      ICU: {
        total: 17,
        available: 4,
        occupied: 12,
        cleaning: 1,
        occupancyRate: 71
      },
      Emergency: {
        total: 26,
        available: 7,
        occupied: 17,
        cleaning: 2,
        occupancyRate: 65
      },
      General: {
        total: 46,
        available: 11,
        occupied: 32,
        cleaning: 3,
        occupancyRate: 70
      },
      Pediatrics: {
        total: 19,
        available: 4,
        occupied: 14,
        cleaning: 1,
        occupancyRate: 74
      }
    },
    rating: 4.6,
    acceptsReferrals: true,
    lastUpdated: new Date()
  },
  {
    id: 'hosp_010',
    name: 'Coastal Medical Center',
    address: '753 Seaside Boulevard, Coastal Area',
    distance: 8.3,
    phone: '+1 (555) 012-3456',
    emergencyContact: '+1 (555) 012-3457',
    website: 'https://coastalmedicalcenter.com',
    specialties: ['Emergency Medicine', 'Trauma Surgery', 'Critical Care'],
    wards: {
      ICU: {
        total: 19,
        available: 5,
        occupied: 13,
        cleaning: 1,
        occupancyRate: 68
      },
      Emergency: {
        total: 32,
        available: 9,
        occupied: 21,
        cleaning: 2,
        occupancyRate: 66
      },
      General: {
        total: 58,
        available: 16,
        occupied: 39,
        cleaning: 3,
        occupancyRate: 67
      },
      Pediatrics: {
        total: 24,
        available: 6,
        occupied: 17,
        cleaning: 1,
        occupancyRate: 71
      }
    },
    rating: 4.5,
    acceptsReferrals: true,
    lastUpdated: new Date()
  }
];

/**
 * Get nearby hospitals based on filters (from MongoDB)
 * @param {Object} filters - Filter options (distance, ward, minAvailableBeds)
 * @returns {Array} - Array of hospitals matching filters
 */
const getNearbyHospitals = async (filters = {}) => {
  try {
    const { distance = 20, ward, minAvailableBeds = 1, maxDistance } = filters;
    const effectiveDistance = maxDistance || distance;

    const query = {
      isActive: true,
      distance: { $lte: effectiveDistance }
    };

    // If ward type is specified, filter by that ward
    if (ward) {
      query['wards.wardType'] = ward;
      if (minAvailableBeds > 0) {
        query['wards.availableBeds'] = { $gte: minAvailableBeds };
      }
    }

    const hospitals = await Hospital.find(query).sort({ distance: 1 });

    // Transform data to match frontend format
    return hospitals.map(hospital => ({
      id: hospital._id.toString(),
      name: hospital.name,
      address: hospital.address,
      location: hospital.location,
      distance: hospital.distance,
      phone: hospital.contactNumber,
      emergencyContact: hospital.emergencyContact,
      rating: hospital.rating,
      wards: hospital.wards.reduce((acc, w) => {
        acc[w.wardType] = {
          total: w.totalBeds,
          available: w.availableBeds,
          occupied: w.occupiedBeds,
          cleaning: 0, // Can be calculated if needed
          occupancyRate: Math.round((w.occupiedBeds / w.totalBeds) * 100)
        };
        return acc;
      }, {}),
      acceptsReferrals: true,
      lastUpdated: hospital.lastUpdated
    }));
  } catch (error) {
    console.error('Error fetching nearby hospitals:', error);
    throw new Error('Failed to fetch nearby hospitals');
  }
};

/**
 * Get a specific hospital by ID (from MongoDB)
 * @param {String} hospitalId - Hospital ID
 * @returns {Object} - Hospital details
 */
const getHospitalById = async (hospitalId) => {
  try {
    const hospital = await Hospital.findById(hospitalId);
    
    if (!hospital) {
      return null;
    }

    // Transform data to match frontend format
    return {
      id: hospital._id.toString(),
      name: hospital.name,
      address: hospital.address,
      location: hospital.location,
      distance: hospital.distance,
      phone: hospital.contactNumber,
      emergencyContact: hospital.emergencyContact,
      rating: hospital.rating,
      wards: hospital.wards.reduce((acc, w) => {
        acc[w.wardType] = {
          total: w.totalBeds,
          available: w.availableBeds,
          occupied: w.occupiedBeds,
          cleaning: 0,
          occupancyRate: Math.round((w.occupiedBeds / w.totalBeds) * 100)
        };
        return acc;
      }, {}),
      acceptsReferrals: true,
      lastUpdated: hospital.lastUpdated
    };
  } catch (error) {
    console.error('Error fetching hospital by ID:', error);
    return null;
  }
};

/**
 * Get hospitals with available capacity in a specific ward (from MongoDB)
 * @param {String} ward - Ward type (ICU, Emergency, General, Pediatrics)
 * @returns {Array} - Array of hospitals with available capacity
 */
const getHospitalsWithCapacity = async (ward) => {
  try {
    const hospitals = await Hospital.find({
      isActive: true,
      'wards.wardType': ward,
      'wards.occupancyRate': { $lt: 85 } // Less than 85% occupancy
    }).sort({ 'wards.availableBeds': -1 });

    return hospitals.map(hospital => {
      const wardData = hospital.wards.find(w => w.wardType === ward);
      return {
        id: hospital._id.toString(),
        name: hospital.name,
        address: hospital.address,
        distance: hospital.distance,
        phone: hospital.contactNumber,
        emergencyContact: hospital.emergencyContact,
        rating: hospital.rating,
        wards: {
          [ward]: {
            total: wardData.totalBeds,
            available: wardData.availableBeds,
            occupied: wardData.occupiedBeds,
            cleaning: 0,
            occupancyRate: Math.round((wardData.occupiedBeds / wardData.totalBeds) * 100)
          }
        }
      };
    });
  } catch (error) {
    console.error('Error fetching hospitals with capacity:', error);
    throw new Error('Failed to fetch hospitals with available capacity');
  }
};

// Simulate real-time bed availability updates (not used with MongoDB)
const simulateBedAvailabilityUpdate = async () => {
  // This function can be implemented to periodically update MongoDB
  // For now, it's a placeholder for future real-time updates
  console.log('Bed availability update simulation - to be implemented with MongoDB');
};

module.exports = {
  getNearbyHospitals,
  getHospitalById,
  getHospitalsWithCapacity,
  simulateBedAvailabilityUpdate
};
