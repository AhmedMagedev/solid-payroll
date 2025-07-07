import { PrismaClient } from '../app/generated/prisma/index.js';

const prisma = new PrismaClient();

async function createSampleLocations() {
  console.log('Creating sample work locations...');

  // Sample location data with real coordinates
  const locations = [
    {
      name: 'Main Office',
      address: 'Downtown Cairo, Egypt',
      latitude: 30.0444,  // Cairo coordinates
      longitude: 31.2357,
      radiusMeters: 150,
      description: 'Main headquarters building',
      workingHoursStart: '09:00',
      workingHoursEnd: '18:00',
      timezone: 'Africa/Cairo',
      createdBy: 'admin'
    },
    {
      name: 'Branch Office A',
      address: 'Maadi, Cairo, Egypt',
      latitude: 29.9602,  // Maadi coordinates
      longitude: 31.2569,
      radiusMeters: 100,
      description: 'Branch office in Maadi area',
      workingHoursStart: '08:30',
      workingHoursEnd: '17:30',
      timezone: 'Africa/Cairo',
      createdBy: 'admin'
    },
    {
      name: 'Remote Office',
      address: 'New Administrative Capital, Egypt',
      latitude: 30.0131,  // New Capital coordinates
      longitude: 31.4914,
      radiusMeters: 200,
      description: 'Remote office location',
      workingHoursStart: '09:00',
      workingHoursEnd: '18:00',
      timezone: 'Africa/Cairo',
      createdBy: 'admin'
    }
  ];

  try {
    // Create locations
    for (const locationData of locations) {
      const location = await prisma.workLocation.create({
        data: locationData
      });
      console.log(`✓ Created location: ${location.name} (ID: ${location.id})`);
    }

    console.log('✅ Sample locations created successfully!');
    
    // Display summary
    const allLocations = await prisma.workLocation.findMany({
      select: {
        id: true,
        name: true,
        address: true,
        latitude: true,
        longitude: true,
        radiusMeters: true,
        isActive: true
      }
    });

    console.log('\n📍 Available locations:');
    allLocations.forEach(location => {
      console.log(`- ${location.name}: ${location.address} (${location.latitude}, ${location.longitude}) - ${location.radiusMeters}m radius`);
    });

  } catch (error) {
    console.error('❌ Error creating sample locations:', error);
    throw error;
  }
}

async function main() {
  try {
    await createSampleLocations();
  } catch (error) {
    console.error('Failed to create sample locations:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 