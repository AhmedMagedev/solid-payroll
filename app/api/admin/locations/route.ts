import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const locations = await prisma.workLocation.findMany({
      include: {
        _count: {
          select: {
            employeeAssignments: true,
            checkInRequests: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return NextResponse.json({
      success: true,
      locations,
    });
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      address,
      latitude,
      longitude,
      radiusMeters,
      timezone,
      description,
      workingHoursStart,
      workingHoursEnd,
    } = body;

    // Validate required fields
    if (!name || !address || latitude === undefined || longitude === undefined) {
      return NextResponse.json(
        { error: 'Name, address, latitude, and longitude are required' },
        { status: 400 }
      );
    }

    // Validate coordinates
    if (latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
      return NextResponse.json(
        { error: 'Invalid coordinates' },
        { status: 400 }
      );
    }

    // Validate radius
    if (radiusMeters && (radiusMeters < 10 || radiusMeters > 1000)) {
      return NextResponse.json(
        { error: 'Radius must be between 10 and 1000 meters' },
        { status: 400 }
      );
    }

    // Check if location with same name already exists
    const existingLocation = await prisma.workLocation.findFirst({
      where: {
        name: {
          equals: name,
          mode: 'insensitive',
        },
      },
    });

    if (existingLocation) {
      return NextResponse.json(
        { error: 'A location with this name already exists' },
        { status: 400 }
      );
    }

    const location = await prisma.workLocation.create({
      data: {
        name,
        address,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        radiusMeters: radiusMeters ? parseInt(radiusMeters) : 100,
        timezone: timezone || 'Africa/Cairo',
        description: description || null,
        workingHoursStart: workingHoursStart || null,
        workingHoursEnd: workingHoursEnd || null,
        createdBy: 'admin', // TODO: Get from session
      },
    });

    return NextResponse.json({
      success: true,
      location,
      message: 'Location created successfully',
    });
  } catch (error) {
    console.error('Error creating location:', error);
    return NextResponse.json(
      { error: 'Failed to create location' },
      { status: 500 }
    );
  }
} 