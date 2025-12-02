// backend/seedHospitals.js
// Script to seed nearby hospitals data into MongoDB

const mongoose = require('mongoose');
const Hospital = require('./models/Hospital');
require('dotenv').config();

const hospitalsData = [
  {
    name: "Apollo Hospitals",
    address: "Sarita Vihar, Delhi-Mathura Road, New Delhi",
    location: { latitude: 28.5355, longitude: 77.2808 },
    distance: 2.5,
    contactNumber: "+91-11-2692-5858",
    emergencyContact: "+91-11-2692-5801",
    rating: 4.5,
    wards: [
      { wardType: "ICU", totalBeds: 30, availableBeds: 5, occupiedBeds: 25 },
      { wardType: "Emergency", totalBeds: 20, availableBeds: 8, occupiedBeds: 12 },
      { wardType: "General", totalBeds: 100, availableBeds: 15, occupiedBeds: 85 },
      { wardType: "Pediatrics", totalBeds: 25, availableBeds: 4, occupiedBeds: 21 }
    ],
    isActive: true
  },
  {
    name: "Fortis Hospital",
    address: "Sector 62, Noida, Uttar Pradesh",
    location: { latitude: 28.6139, longitude: 77.3589 },
    distance: 5.2,
    contactNumber: "+91-120-247-2222",
    emergencyContact: "+91-120-247-2200",
    rating: 4.3,
    wards: [
      { wardType: "ICU", totalBeds: 25, availableBeds: 3, occupiedBeds: 22 },
      { wardType: "Emergency", totalBeds: 15, availableBeds: 5, occupiedBeds: 10 },
      { wardType: "General", totalBeds: 80, availableBeds: 20, occupiedBeds: 60 },
      { wardType: "Pediatrics", totalBeds: 20, availableBeds: 6, occupiedBeds: 14 }
    ],
    isActive: true
  },
  {
    name: "Max Super Speciality Hospital",
    address: "Saket, New Delhi",
    location: { latitude: 28.5244, longitude: 77.2066 },
    distance: 3.8,
    contactNumber: "+91-11-2651-5050",
    emergencyContact: "+91-11-2651-5000",
    rating: 4.6,
    wards: [
      { wardType: "ICU", totalBeds: 35, availableBeds: 7, occupiedBeds: 28 },
      { wardType: "Emergency", totalBeds: 25, availableBeds: 10, occupiedBeds: 15 },
      { wardType: "General", totalBeds: 120, availableBeds: 25, occupiedBeds: 95 },
      { wardType: "Pediatrics", totalBeds: 30, availableBeds: 8, occupiedBeds: 22 }
    ],
    isActive: true
  },
  {
    name: "AIIMS Delhi",
    address: "Ansari Nagar, New Delhi",
    location: { latitude: 28.5672, longitude: 77.2100 },
    distance: 7.1,
    contactNumber: "+91-11-2658-8500",
    emergencyContact: "+91-11-2659-3333",
    rating: 4.8,
    wards: [
      { wardType: "ICU", totalBeds: 50, availableBeds: 2, occupiedBeds: 48 },
      { wardType: "Emergency", totalBeds: 40, availableBeds: 4, occupiedBeds: 36 },
      { wardType: "General", totalBeds: 200, availableBeds: 10, occupiedBeds: 190 },
      { wardType: "Pediatrics", totalBeds: 45, availableBeds: 3, occupiedBeds: 42 }
    ],
    isActive: true
  },
  {
    name: "BLK-Max Super Speciality Hospital",
    address: "Pusa Road, Rajendra Place, New Delhi",
    location: { latitude: 28.6409, longitude: 77.1872 },
    distance: 9.5,
    contactNumber: "+91-11-3040-3040",
    emergencyContact: "+91-11-3040-3030",
    rating: 4.4,
    wards: [
      { wardType: "ICU", totalBeds: 28, availableBeds: 6, occupiedBeds: 22 },
      { wardType: "Emergency", totalBeds: 18, availableBeds: 7, occupiedBeds: 11 },
      { wardType: "General", totalBeds: 90, availableBeds: 18, occupiedBeds: 72 },
      { wardType: "Pediatrics", totalBeds: 22, availableBeds: 5, occupiedBeds: 17 }
    ],
    isActive: true
  },
  {
    name: "Indraprastha Apollo Hospital",
    address: "Sarita Vihar, New Delhi",
    location: { latitude: 28.5330, longitude: 77.2800 },
    distance: 2.3,
    contactNumber: "+91-11-7179-1090",
    emergencyContact: "+91-11-7179-1000",
    rating: 4.7,
    wards: [
      { wardType: "ICU", totalBeds: 40, availableBeds: 8, occupiedBeds: 32 },
      { wardType: "Emergency", totalBeds: 30, availableBeds: 12, occupiedBeds: 18 },
      { wardType: "General", totalBeds: 150, availableBeds: 30, occupiedBeds: 120 },
      { wardType: "Pediatrics", totalBeds: 35, availableBeds: 10, occupiedBeds: 25 }
    ],
    isActive: true
  },
  {
    name: "Medanta - The Medicity",
    address: "Sector 38, Gurugram, Haryana",
    location: { latitude: 28.4421, longitude: 77.0384 },
    distance: 12.7,
    contactNumber: "+91-124-414-1414",
    emergencyContact: "+91-124-414-1400",
    rating: 4.5,
    wards: [
      { wardType: "ICU", totalBeds: 45, availableBeds: 4, occupiedBeds: 41 },
      { wardType: "Emergency", totalBeds: 35, availableBeds: 6, occupiedBeds: 29 },
      { wardType: "General", totalBeds: 180, availableBeds: 22, occupiedBeds: 158 },
      { wardType: "Pediatrics", totalBeds: 40, availableBeds: 7, occupiedBeds: 33 }
    ],
    isActive: true
  },
  {
    name: "Sir Ganga Ram Hospital",
    address: "Rajinder Nagar, New Delhi",
    location: { latitude: 28.6428, longitude: 77.1890 },
    distance: 8.9,
    contactNumber: "+91-11-2575-0000",
    emergencyContact: "+91-11-2575-0111",
    rating: 4.6,
    wards: [
      { wardType: "ICU", totalBeds: 32, availableBeds: 5, occupiedBeds: 27 },
      { wardType: "Emergency", totalBeds: 22, availableBeds: 9, occupiedBeds: 13 },
      { wardType: "General", totalBeds: 110, availableBeds: 24, occupiedBeds: 86 },
      { wardType: "Pediatrics", totalBeds: 28, availableBeds: 6, occupiedBeds: 22 }
    ],
    isActive: true
  },
  {
    name: "Safdarjung Hospital",
    address: "Ring Road, Safdarjung Enclave, New Delhi",
    location: { latitude: 28.5678, longitude: 77.2068 },
    distance: 6.4,
    contactNumber: "+91-11-2673-0000",
    emergencyContact: "+91-11-2616-5060",
    rating: 4.2,
    wards: [
      { wardType: "ICU", totalBeds: 38, availableBeds: 9, occupiedBeds: 29 },
      { wardType: "Emergency", totalBeds: 28, availableBeds: 11, occupiedBeds: 17 },
      { wardType: "General", totalBeds: 160, availableBeds: 35, occupiedBeds: 125 },
      { wardType: "Pediatrics", totalBeds: 32, availableBeds: 8, occupiedBeds: 24 }
    ],
    isActive: true
  },
  {
    name: "Manipal Hospital",
    address: "Dwarka, New Delhi",
    location: { latitude: 28.5921, longitude: 77.0460 },
    distance: 15.3,
    contactNumber: "+91-11-4967-4967",
    emergencyContact: "+91-11-4967-4900",
    rating: 4.3,
    wards: [
      { wardType: "ICU", totalBeds: 26, availableBeds: 6, occupiedBeds: 20 },
      { wardType: "Emergency", totalBeds: 16, availableBeds: 8, occupiedBeds: 8 },
      { wardType: "General", totalBeds: 85, availableBeds: 19, occupiedBeds: 66 },
      { wardType: "Pediatrics", totalBeds: 24, availableBeds: 7, occupiedBeds: 17 }
    ],
    isActive: true
  }
];

const seedHospitals = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log('✅ Connected to MongoDB');

    // Clear existing hospitals
    await Hospital.deleteMany({});
    console.log('🗑️  Cleared existing hospitals');

    // Insert new hospitals
    const hospitals = await Hospital.insertMany(hospitalsData);
    console.log(`✅ Successfully seeded ${hospitals.length} hospitals`);

    // Display summary
    console.log('\n📊 Seeded Hospitals Summary:');
    hospitals.forEach((hospital, index) => {
      console.log(`${index + 1}. ${hospital.name} - ${hospital.distance}km away`);
      hospital.wards.forEach(ward => {
        console.log(`   ${ward.wardType}: ${ward.availableBeds}/${ward.totalBeds} available`);
      });
    });

    process.exit(0);
  } catch (error) {
    console.error('❌ Error seeding hospitals:', error);
    process.exit(1);
  }
};

// Run the seed function
seedHospitals();
