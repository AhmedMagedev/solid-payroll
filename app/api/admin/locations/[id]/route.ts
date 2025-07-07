import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid location ID' },
        { status: 400 }
      );
    }

    const location = await prisma.workLocation.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employeeAssignments: true,
            checkInRequests: true,
          },
        },
        employeeAssignments: {
          include: {
            employee: {
              select: {
                id: true,
                name: true,
                email: true,
                position: true,
              },
            },
          },
        },
      },
    });

    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      location,
    });
  } catch (error) {
    console.error('Error fetching location:', error);
    return NextResponse.json(
      { error: 'Failed to fetch location' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid location ID' },
        { status: 400 }
      );
    }

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
      isActive,
    } = body;

    // Check if location exists
    const existingLocation = await prisma.workLocation.findUnique({
      where: { id },
    });

    if (!existingLocation) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    // If updating name, check for duplicates (excluding current location)
    if (name && name !== existingLocation.name) {
      const duplicateLocation = await prisma.workLocation.findFirst({
        where: {
          name: {
            equals: name,
            mode: 'insensitive',
          },
          id: {
            not: id,
          },
        },
      });

      if (duplicateLocation) {
        return NextResponse.json(
          { error: 'A location with this name already exists' },
          { status: 400 }
        );
      }
    }

    // Validate coordinates if provided
    if (latitude !== undefined || longitude !== undefined) {
      const lat = latitude !== undefined ? parseFloat(latitude) : existingLocation.latitude;
      const lng = longitude !== undefined ? parseFloat(longitude) : existingLocation.longitude;
      
      if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
        return NextResponse.json(
          { error: 'Invalid coordinates' },
          { status: 400 }
        );
      }
    }

    // Validate radius if provided
    if (radiusMeters !== undefined && (radiusMeters < 10 || radiusMeters > 1000)) {
      return NextResponse.json(
        { error: 'Radius must be between 10 and 1000 meters' },
        { status: 400 }
      );
    }

    // Build update data
    const updateData: Partial<{
      name: string;
      address: string;
      latitude: number;
      longitude: number;
      radiusMeters: number;
      timezone: string;
      description: string | null;
      workingHoursStart: string | null;
      workingHoursEnd: string | null;
      isActive: boolean;
    }> = {};
    if (name !== undefined) updateData.name = name;
    if (address !== undefined) updateData.address = address;
    if (latitude !== undefined) updateData.latitude = parseFloat(latitude);
    if (longitude !== undefined) updateData.longitude = parseFloat(longitude);
    if (radiusMeters !== undefined) updateData.radiusMeters = parseInt(radiusMeters);
    if (timezone !== undefined) updateData.timezone = timezone;
    if (description !== undefined) updateData.description = description || null;
    if (workingHoursStart !== undefined) updateData.workingHoursStart = workingHoursStart || null;
    if (workingHoursEnd !== undefined) updateData.workingHoursEnd = workingHoursEnd || null;
    if (isActive !== undefined) updateData.isActive = isActive;

    const location = await prisma.workLocation.update({
      where: { id },
      data: updateData,
    });

    return NextResponse.json({
      success: true,
      location,
      message: 'Location updated successfully',
    });
  } catch (error) {
    console.error('Error updating location:', error);
    return NextResponse.json(
      { error: 'Failed to update location' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const id = parseInt(params.id);
    
    if (isNaN(id)) {
      return NextResponse.json(
        { error: 'Invalid location ID' },
        { status: 400 }
      );
    }

    // Check if location exists
    const existingLocation = await prisma.workLocation.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            employeeAssignments: true,
            checkInRequests: true,
            attendanceRecords: true,
          },
        },
      },
    });

    if (!existingLocation) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    // Check if location has any dependencies
    const hasEmployees = existingLocation._count.employeeAssignments > 0;
    const hasCheckIns = existingLocation._count.checkInRequests > 0;
    const hasAttendance = existingLocation._count.attendanceRecords > 0;

    if (hasEmployees || hasCheckIns || hasAttendance) {
      // Instead of deleting, deactivate the location
      const location = await prisma.workLocation.update({
        where: { id },
        data: { isActive: false },
      });

      return NextResponse.json({
        success: true,
        location,
        message: 'Location deactivated (has existing data)',
      });
    }

    // Safe to delete - no dependencies
    await prisma.workLocation.delete({
      where: { id },
    });

    return NextResponse.json({
      success: true,
      message: 'Location deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting location:', error);
    return NextResponse.json(
      { error: 'Failed to delete location' },
      { status: 500 }
    );
  }
} 