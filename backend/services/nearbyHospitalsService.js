// backend/services/nearbyHospitalsService.js
// Service for managing nearby hospital data and availability

// Hardcoded data for 10 nearby hospitals with bed availability
const nearbyHospitals = [
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

// Get nearby hospitals with optional filtering
const getNearbyHospitals = (filters = {}) => {
  let filtered = [...nearbyHospitals];

  // Filter by ward type
  if (filters.ward) {
    filtered = filtered.filter(hospital => 
      hospital.wards[filters.ward] && hospital.wards[filters.ward].available > 0
    );
  }

  // Filter by maximum distance
  if (filters.maxDistance) {
    filtered = filtered.filter(hospital => hospital.distance <= parseFloat(filters.maxDistance));
  }

  // Filter by minimum available beds
  if (filters.minAvailableBeds && filters.ward) {
    filtered = filtered.filter(hospital => 
      hospital.wards[filters.ward]?.available >= parseInt(filters.minAvailableBeds)
    );
  }

  // Sort by distance (closest first)
  filtered.sort((a, b) => a.distance - b.distance);

  return filtered;
};

// Get a specific hospital by ID
const getHospitalById = (hospitalId) => {
  return nearbyHospitals.find(h => h.id === hospitalId) || null;
};

// Get hospitals with available capacity in a specific ward
const getHospitalsWithCapacity = (ward) => {
  return nearbyHospitals
    .filter(hospital => {
      const wardData = hospital.wards[ward];
      return wardData && wardData.occupancyRate < 85; // Less than 85% occupancy
    })
    .sort((a, b) => b.wards[ward].available - a.wards[ward].available); // Sort by most available beds
};

// Simulate real-time bed availability updates (for future integration)
const simulateBedAvailabilityUpdate = () => {
  // This function can be used to update bed availability in real-time
  // For now, it's a placeholder for future API integration
  nearbyHospitals.forEach(hospital => {
    Object.keys(hospital.wards).forEach(wardType => {
      const ward = hospital.wards[wardType];
      // Simulate small changes in availability
      const change = Math.floor(Math.random() * 3) - 1; // -1, 0, or 1
      const newAvailable = Math.max(0, Math.min(ward.total - ward.cleaning, ward.available + change));
      ward.available = newAvailable;
      ward.occupied = ward.total - ward.available - ward.cleaning;
      ward.occupancyRate = Math.round((ward.occupied / ward.total) * 100);
      ward.lastUpdated = new Date();
    });
  });
};

module.exports = {
  nearbyHospitals,
  getNearbyHospitals,
  getHospitalById,
  getHospitalsWithCapacity,
  simulateBedAvailabilityUpdate
};
