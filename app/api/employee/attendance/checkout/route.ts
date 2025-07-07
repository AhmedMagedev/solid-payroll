import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';
import { verifyEmployeeToken } from '@/app/lib/employee-auth';

const prisma = new PrismaClient();

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyEmployeeToken(request);

    if (!auth) {
      return NextResponse.json(
        { error: 'غير مصرح لك بالوصول' },
        { status: 401 }
      );
    }

    const { latitude, longitude, timestamp } = await request.json();

    if (!latitude || !longitude) {
      return NextResponse.json(
        { error: 'إحداثيات الموقع مطلوبة' },
        { status: 400 }
      );
    }

    // Get today's date
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    // Find today's attendance record
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: auth.employeeId,
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
    });

    if (!existingAttendance || !existingAttendance.checkIn) {
      return NextResponse.json(
        { error: 'يجب عليك تسجيل الحضور أولاً قبل الانصراف' },
        { status: 400 }
      );
    }

    if (existingAttendance.checkOut) {
      return NextResponse.json(
        { error: 'لقد سجلت الانصراف بالفعل اليوم' },
        { status: 400 }
      );
    }

    const checkOutTime = timestamp ? new Date(timestamp) : new Date();

    // Validate checkout time is after checkin
    if (checkOutTime <= existingAttendance.checkIn) {
      return NextResponse.json(
        { error: 'وقت الانصراف يجب أن يكون بعد وقت الحضور' },
        { status: 400 }
      );
    }

    // Create check-out request for location verification
    const checkOutRequest = await prisma.checkInRequest.create({
      data: {
        employeeId: auth.employeeId,
        latitude: parseFloat(latitude),
        longitude: parseFloat(longitude),
        type: 'CHECK_OUT',
        timestamp: checkOutTime,
        status: 'AUTO_APPROVED', // For now, auto-approve all requests
        isWithinGeofence: true, // We'll implement proper geofencing later
        processedAt: new Date(),
        processedBy: 'AUTO',
      },
    });

    // Calculate total hours worked
    const hoursWorked = (checkOutTime.getTime() - existingAttendance.checkIn.getTime()) / (1000 * 60 * 60);

    // Update attendance record
    const attendance = await prisma.attendance.update({
      where: { id: existingAttendance.id },
      data: {
        checkOut: checkOutTime,
        checkOutLocationVerified: true,
        checkOutRequestId: checkOutRequest.id,
        hoursWorked: hoursWorked,
        actualHoursWorked: hoursWorked,
      },
    });

    return NextResponse.json({
      message: 'تم تسجيل الانصراف بنجاح',
      attendance: {
        isCheckedIn: false,
        checkInTime: attendance.checkIn?.toISOString(),
        checkOutTime: attendance.checkOut?.toISOString(),
        totalHours: hoursWorked,
        status: 'checked-out',
      },
    });
  } catch (error) {
    console.error('Check-out error:', error);
    return NextResponse.json(
      { error: 'خطأ في الخادم الداخلي' },
      { status: 500 }
    );
  }
} 