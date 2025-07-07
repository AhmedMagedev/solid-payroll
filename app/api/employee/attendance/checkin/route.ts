import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';
import { verifyEmployeeToken } from '@/app/lib/employee-auth';

const prisma = new PrismaClient();

// Function to calculate distance between two points using Haversine formula
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c; // Distance in meters
}

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyEmployeeToken(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'غير مصرح لك بالوصول' },
        { status: 401 }
      );
    }

    const { latitude, longitude, timestamp, workLocationId } = await request.json();

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'إحداثيات الموقع مطلوبة' },
        { status: 400 }
      );
    }

    // Get employee with location assignments
    const employee = await prisma.employee.findUnique({
      where: { id: auth.employeeId },
      include: {
        allowedWorkLocations: {
          where: {
            isActive: true,
            canCheckIn: true,
          },
          include: {
            workLocation: true,
          },
        },
        primaryWorkLocation: true,
      },
    });

    // Filter out inactive work locations
    if (employee) {
      employee.allowedWorkLocations = employee.allowedWorkLocations.filter(
        assignment => assignment.workLocation.isActive
      );
    }

    if (!employee) {
      return NextResponse.json(
        { error: 'الموظف غير موجود' },
        { status: 404 }
      );
    }

    if (employee.allowedWorkLocations.length === 0 && !employee.canWorkRemotely) {
      return NextResponse.json(
        { error: 'لا توجد مواقع عمل مخصصة لك. يرجى التواصل مع الإدارة.' },
        { status: 403 }
      );
    }

    let selectedLocation = null;
    let distanceFromLocation = null;
    let isWithinGeofence = false;
    let nearestLocation = null;
    let nearestDistance = Infinity;

    // If specific location ID provided, validate it
    if (workLocationId) {
      const locationAssignment = employee.allowedWorkLocations.find(
        assignment => assignment.workLocation.id === workLocationId
      );

      if (!locationAssignment) {
        return NextResponse.json(
          { error: 'غير مصرح لك بتسجيل الحضور في هذا الموقع' },
          { status: 403 }
        );
      }

      selectedLocation = locationAssignment.workLocation;
    } else {
      // Auto-detect nearest allowed location
      for (const assignment of employee.allowedWorkLocations) {
        const location = assignment.workLocation;
        const distance = calculateDistance(
          parseFloat(latitude),
          parseFloat(longitude),
          location.latitude,
          location.longitude
        );

        if (distance < nearestDistance) {
          nearestDistance = distance;
          nearestLocation = location;
        }
      }

      selectedLocation = nearestLocation;
      distanceFromLocation = nearestDistance;
    }

    // If no location found and remote work not allowed
    if (!selectedLocation && !employee.canWorkRemotely) {
      return NextResponse.json(
        { error: 'أنت خارج نطاق جميع مواقع العمل المخصصة لك' },
        { status: 403 }
      );
    }

    // Calculate distance and check geofence if location found
    if (selectedLocation) {
      distanceFromLocation = calculateDistance(
        parseFloat(latitude),
        parseFloat(longitude),
        selectedLocation.latitude,
        selectedLocation.longitude
      );

      isWithinGeofence = distanceFromLocation <= selectedLocation.radiusMeters;
      
             // If outside geofence and remote work not allowed, fail immediately
       if (!isWithinGeofence && !employee.canWorkRemotely) {
         return NextResponse.json(
           { 
             error: `أنت بعيد جداً عن ${selectedLocation.name}. يجب أن تكون على بُعد ${selectedLocation.radiusMeters} متر أو أقل لتسجيل الحضور. المسافة الحالية: ${Math.round(distanceFromLocation)} متر.`,
             location: {
               name: selectedLocation.name,
               requiredDistance: selectedLocation.radiusMeters,
               currentDistance: Math.round(distanceFromLocation),
               withinGeofence: false
             }
           },
           { status: 403 }
         );
       }
    }

    // Only auto-approve if within geofence or remote work allowed
    const status = 'AUTO_APPROVED';
    const processedBy = 'AUTO';
    const processedAt = new Date();

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Check if already checked in today
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: auth.employeeId,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (existingAttendance && existingAttendance.checkIn && !existingAttendance.checkOut) {
      return NextResponse.json(
        { error: 'لقد سجلت الحضور بالفعل اليوم' },
        { status: 400 }
      );
    }

    if (existingAttendance && existingAttendance.checkOut) {
      return NextResponse.json(
        { error: 'لقد أكملت حضورك لهذا اليوم بالفعل' },
        { status: 400 }
      );
    }

    const checkInTime = timestamp ? new Date(timestamp) : new Date();

    // Create check-in request for location verification
    const checkInRequest = await prisma.checkInRequest.create({
      data: {
        employeeId: auth.employeeId,
        workLocationId: selectedLocation?.id || null,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        type: 'CHECK_IN',
        timestamp: checkInTime,
        status,
        distanceFromLocation,
        isWithinGeofence,
        processedAt,
        processedBy,
      },
    });

    // Create attendance record (status is always AUTO_APPROVED at this point)
    const attendanceData = {
      employeeId: auth.employeeId,
      workLocationId: selectedLocation?.id || null,
      date: today,
      checkIn: checkInTime,
      checkInLocationVerified: isWithinGeofence || employee.canWorkRemotely,
      checkInRequestId: checkInRequest.id,
      isRemoteWork: !selectedLocation,
      isPaidDay: true,
      actualHoursWorked: 0,
      lateDeductionHours: 0,
      earlyDeductionHours: 0,
    };

    const attendance = await prisma.attendance.upsert({
      where: {
        employeeId_date: {
          employeeId: auth.employeeId,
          date: today,
        },
      },
      update: {
        checkIn: checkInTime,
        checkInLocationVerified: isWithinGeofence || employee.canWorkRemotely,
        checkInRequestId: checkInRequest.id,
        workLocationId: selectedLocation?.id || null,
        isRemoteWork: !selectedLocation,
      },
      create: attendanceData,
    });

    return NextResponse.json({
      message: 'تم تسجيل الحضور بنجاح',
      attendance: {
        isCheckedIn: true,
        checkInTime: attendance.checkIn?.toISOString(),
        status: 'checked-in',
        location: selectedLocation ? {
          id: selectedLocation.id,
          name: selectedLocation.name,
          distance: distanceFromLocation,
          withinGeofence: isWithinGeofence,
        } : null,
        isRemoteWork: !selectedLocation,
      },
    });
  } catch (error) {
    console.error('Check-in error:', error);
    return NextResponse.json(
      { error: 'خطأ في الخادم الداخلي' },
      { status: 500 }
    );
  }
} 