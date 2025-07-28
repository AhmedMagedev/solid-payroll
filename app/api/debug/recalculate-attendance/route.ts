import { NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';

const prisma = new PrismaClient();

export async function POST() {
  try {
    console.log('[DEBUG] Starting manual attendance recalculation...');

    // Get system settings
    const systemSettings = await prisma.systemSettings.findFirst();
    const lateAllowanceMinutes = systemSettings?.lateAllowanceMinutes || 15;
    const workingHoursStart = systemSettings?.workingHoursStart || "09:00";

    console.log(`[DEBUG] Using settings: Start: ${workingHoursStart}, Grace: ${lateAllowanceMinutes} minutes`);

    // Helper function to check if check-in is beyond grace period (no timezone conversion)
    function isCheckInBeyondGracePeriod(checkInTime: Date): boolean {
      try {
        // Parse working hours start time
        const [hours, minutes] = workingHoursStart.split(':');
        
        // Use check-in time as-is without timezone conversion
        const graceEndTime = new Date(checkInTime);
        graceEndTime.setHours(parseInt(hours), parseInt(minutes) + lateAllowanceMinutes, 0, 0);
        
        return checkInTime > graceEndTime;
      } catch {
        return false;
      }
    }

    // Get all attendance records
    const allAttendance = await prisma.attendance.findMany({
      orderBy: { date: 'desc' },
      include: {
        employee: {
          select: { name: true }
        }
      }
    });

    console.log(`[DEBUG] Found ${allAttendance.length} attendance records to process`);

    let updatedCount = 0;
    let paidToUnpaidCount = 0;
    let unpaidToPaidCount = 0;
    const examples = [];

    // Process each attendance record
    for (const record of allAttendance) {
      const checkInTime = new Date(record.checkIn);
      
      // Determine if this day should be paid (false if late beyond grace period)
      const shouldBePaid = !isCheckInBeyondGracePeriod(checkInTime);
      const currentlyPaid = record.isPaidDay !== false; // Default to true if null/undefined
      
      // Log the first few examples
      if (examples.length < 5) {
        const [hours, minutes] = workingHoursStart.split(':');
        
        // Use check-in time as-is without timezone conversion
        const graceEndTime = new Date(checkInTime);
        graceEndTime.setHours(parseInt(hours), parseInt(minutes) + lateAllowanceMinutes, 0, 0);
        
        examples.push({
          employee: record.employee.name,
          date: record.date.toISOString().split('T')[0],
          checkIn: checkInTime.toISOString(), // Show time as-is
          graceEndTime: graceEndTime.toISOString(),
          isLate: checkInTime > graceEndTime,
          currentlyPaid,
          shouldBePaid,
          willUpdate: shouldBePaid !== currentlyPaid
        });
      }
      
      // Only update if the status needs to change
      if (shouldBePaid !== currentlyPaid) {
        await prisma.attendance.update({
          where: { id: record.id },
          data: { isPaidDay: shouldBePaid }
        });
        
        updatedCount++;
        if (currentlyPaid && !shouldBePaid) {
          paidToUnpaidCount++;
        } else if (!currentlyPaid && shouldBePaid) {
          unpaidToPaidCount++;
        }
      }
    }

    console.log(`[DEBUG] Recalculation completed: ${updatedCount} records updated`);

    return NextResponse.json({
      message: 'Attendance recalculation completed',
      totalRecords: allAttendance.length,
      updatedRecords: updatedCount,
      paidToUnpaidTransitions: paidToUnpaidCount,
      unpaidToPaidTransitions: unpaidToPaidCount,
      settings: {
        workingHoursStart,
        lateAllowanceMinutes
      },
      examples
    });

  } catch (error) {
    console.error('Error in manual attendance recalculation:', error);
    return NextResponse.json({ 
      error: 'Failed to recalculate attendance',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 