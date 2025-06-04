import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';
import { verifyToken } from '@/app/lib/auth';
import { parseEgyptTimeToUtc, isCheckInBeyondGracePeriod } from '@/lib/timezone';

const prisma = new PrismaClient();

// Configuration for batch processing
const BATCH_SIZE = 20; // Process 20 attendance records at a time
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB max file size
const MAX_RECORDS = 5000; // Maximum number of attendance records per upload

export async function POST(request: NextRequest) {
  try {
    // Check for authentication
    let token = request.cookies.get('auth_token')?.value;
    
    // Check Authorization header if no cookie token
    if (!token) {
      const authHeader = request.headers.get('Authorization');
      if (authHeader?.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }
    
    console.log(`[API Upload] Token check: ${token ? 'found' : 'not found'}`);
    console.log(`[API Upload] All cookies:`, JSON.stringify(Array.from(request.cookies.getAll())));
    
    if (!token) {
      console.log('[API] Upload attempt without authentication');
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Verify token
    const session = await verifyToken(token);
    if (!session) {
      console.log('[API] Upload attempt with invalid token');
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }

    // Fetch system settings for grace period calculation
    const systemSettings = await prisma.systemSettings.findFirst();
    const lateAllowanceMinutes = systemSettings?.lateAllowanceMinutes || 15;
    const workingHoursStart = systemSettings?.workingHoursStart || "09:00";

    console.log(`[API] Grace period settings: Start: ${workingHoursStart}, Allowance: ${lateAllowanceMinutes} minutes`);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json(
        { error: 'No file uploaded' },
        { status: 400 }
      );
    }

    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: `File too large. Maximum size allowed: ${MAX_FILE_SIZE / (1024 * 1024)}MB` },
        { status: 400 }
      );
    }

    // Read file content
    const fileContent = await file.text();
    const lines = fileContent.split('\n').filter(line => line.trim());

    if (lines.length === 0) {
      return NextResponse.json(
        { error: 'File is empty or contains no valid data' },
        { status: 400 }
      );
    }

    if (lines.length > MAX_RECORDS) {
      return NextResponse.json(
        { error: `Too many records in file. Maximum allowed: ${MAX_RECORDS}, found: ${lines.length}` },
        { status: 400 }
      );
    }

    // Process attendance records
    const recordsByEmployeeAndDay = new Map<string, { records: string[], deviceId: string, date: string, employeeId: number, isPaidDay: boolean }>();

    console.log(`[API] Processing ${lines.length} lines from uploaded file`);

    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      if (parts.length < 2) {
        console.warn(`[API] Skipping invalid line: ${line}`);
        continue;
      }

      const employeeId = parseInt(parts[0], 10);
      const deviceId = parseInt(parts[1], 10);
      const timeString = parts[2] + ' ' + parts[3];

      // Use the Egypt timezone parser
      const checkInDateTime = parseEgyptTimeToUtc(timeString);
      if (!checkInDateTime) {
        console.log(`Skipping record ${line}: Invalid timestamp "${timeString}"`);
        continue;
      }

      // Check employee
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId }
      });

      if (!employee) {
        console.log(`Skipping record ${line}: Employee ID ${employeeId} not found`);
        continue;
      }

      // Calculate if this should be a paid day based on grace period
      const isPaidDay = !isCheckInBeyondGracePeriod(
        checkInDateTime,
        workingHoursStart,
        lateAllowanceMinutes
      );

      const dateKey = checkInDateTime.toISOString().split('T')[0]; // YYYY-MM-DD format
      const employeeKey = `${deviceId}-${dateKey}`;

      // Create employee entry if not exists
      if (!recordsByEmployeeAndDay.has(employeeKey)) {
        recordsByEmployeeAndDay.set(employeeKey, {
          employeeId: employee.id,
          deviceId: deviceId.toString(), // Convert to string for consistency
          date: dateKey,
          records: [],
          isPaidDay: isPaidDay // Store calculated isPaidDay
        });
      }

      recordsByEmployeeAndDay.get(employeeKey)!.records.push(timeString);
    }

    console.log(`[API] Grouped records into ${recordsByEmployeeAndDay.size} employee-day combinations`);

    // Process records in batches
    const attendanceRecords = [];
    const entries = Array.from(recordsByEmployeeAndDay.entries());
    
    for (let i = 0; i < entries.length; i += BATCH_SIZE) {
      const batch = entries.slice(i, i + BATCH_SIZE);
      console.log(`[API] Processing batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(entries.length / BATCH_SIZE)}`);
      
      for (const [, data] of batch) {
        const { records, deviceId, date, employeeId, isPaidDay } = data;

        // Find employee by ID
        const employee = await prisma.employee.findUnique({
          where: { id: employeeId }
        });

        if (!employee) {
          console.log(`Employee with ID ${employeeId} not found during processing`);
          continue;
        }

        console.log(`[API] Found employee: ${employee.name} (ID: ${employee.id}) for device ID: ${deviceId}`);

        // Sort records by time to get first (check-in) and last (check-out)
        const sortedRecords = records.sort();
        const firstRecord = sortedRecords[0];
        const lastRecord = sortedRecords[sortedRecords.length - 1];

        console.log(`[API] Employee ${employee.name} on ${date}: First record: ${firstRecord}, Last record: ${lastRecord}`);

        // Parse check-in and check-out times
        const parseTime = (timeStr: string) => {
          const match = timeStr.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
          if (!match) return null;
          const [, year, month, day, hours, minutes, seconds] = match;
          
          // Create date in local time (UTC+3 for production)
          // This ensures the time is stored as intended regardless of server timezone
          const localDate = new Date(
            parseInt(year), 
            parseInt(month) - 1, 
            parseInt(day), 
            parseInt(hours), 
            parseInt(minutes), 
            parseInt(seconds)
          );
          
          // For production, adjust for UTC+3 timezone
          // This ensures times are stored correctly for the business timezone
          const timezoneOffset = 3 * 60; // UTC+3 in minutes
          const utcTime = new Date(localDate.getTime() - (timezoneOffset * 60 * 1000));
          
          return utcTime;
        };

        const checkIn = parseTime(firstRecord);
        const checkOut = parseTime(lastRecord);

        if (!checkIn) {
          console.warn(`[API] Invalid check-in time for employee ${employee.name}: ${firstRecord}`);
          continue;
        }

        // Calculate hours worked
        let hoursWorked = 0;
        if (checkOut && checkOut > checkIn) {
          hoursWorked = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
        }

        console.log(`[API] Employee ${employee.name}: Check-in: ${checkIn.toLocaleString()}, Check-out: ${checkOut?.toLocaleString() || 'N/A'}, Hours: ${hoursWorked.toFixed(2)}, Paid: ${isPaidDay}`);

        const attendanceData = {
          employeeId: employee.id,
          date: new Date(date),
          checkIn,
          checkOut,
          hoursWorked: hoursWorked > 0 ? hoursWorked : null,
          isPaidDay,
        };

        attendanceRecords.push(attendanceData);
      }
      
      // Small delay between batches to prevent overwhelming the database
      if (i + BATCH_SIZE < entries.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.log(`[API] Prepared ${attendanceRecords.length} attendance records for database insertion`);

    // Insert attendance records using upsert to handle duplicates
    let processedCount = 0;
    for (let i = 0; i < attendanceRecords.length; i += BATCH_SIZE) {
      const batch = attendanceRecords.slice(i, i + BATCH_SIZE);
      
      for (const record of batch) {
        try {
          await prisma.attendance.upsert({
            where: {
              employeeId_date: {
                employeeId: record.employeeId,
                date: record.date,
              },
            },
            update: {
              checkIn: record.checkIn,
              checkOut: record.checkOut,
              hoursWorked: record.hoursWorked,
              isPaidDay: record.isPaidDay,
              updatedAt: new Date(),
            },
            create: record,
          });
          processedCount++;
        } catch (error) {
          console.error(`[API] Error upserting attendance record:`, error);
        }
      }
      
      // Small delay between database batches
      if (i + BATCH_SIZE < attendanceRecords.length) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }

    console.log(`[API] Successfully processed ${processedCount} attendance records`);

    // Calculate payouts for affected employees
    const affectedEmployeeIds = [...new Set(attendanceRecords.map(r => r.employeeId))];
    console.log(`[API] Calculating payouts for ${affectedEmployeeIds.length} affected employees`);

    const payoutResults = { created: 0, updated: 0, total: 0 };

    // Process payouts in smaller batches
    for (let i = 0; i < affectedEmployeeIds.length; i += 5) {
      const employeeBatch = affectedEmployeeIds.slice(i, i + 5);
      
      for (const employeeId of employeeBatch) {
        try {
          const employee = await prisma.employee.findUnique({
            where: { id: employeeId },
            include: { attendance: true }
          });

          if (!employee) continue;

          // Group attendance by month for payout calculation
          const attendanceByMonth = new Map<string, Array<{
            id: number;
            employeeId: number;
            date: Date;
            checkIn: Date;
            checkOut: Date | null;
            hoursWorked: number | null;
            createdAt: Date;
            updatedAt: Date;
            isPaidDay: boolean;
          }>>();
          
          for (const attendance of employee.attendance) {
            const monthKey = `${attendance.date.getFullYear()}-${String(attendance.date.getMonth() + 1).padStart(2, '0')}`;
            if (!attendanceByMonth.has(monthKey)) {
              attendanceByMonth.set(monthKey, []);
            }
            attendanceByMonth.get(monthKey)!.push(attendance);
          }

          // Calculate payouts for each month
          for (const [monthKey, monthAttendance] of attendanceByMonth) {
            const [year, month] = monthKey.split('-').map(Number);
            const periodStart = new Date(year, month - 1, 1);
            const periodEnd = new Date(year, month, 0); // Last day of month

            // Only count days where isPaidDay is true
            const paidDays = monthAttendance.filter(a => a.isPaidDay && a.hoursWorked && a.hoursWorked > 0);
            const daysWorked = paidDays.length;
            const totalHours = paidDays.reduce((sum, a) => sum + (a.hoursWorked || 0), 0);
            const amount = daysWorked * employee.dailyRate;

            // Count unpaid days for reporting
            const unpaidDays = monthAttendance.filter(a => !a.isPaidDay).length;

            const existingPayout = await prisma.payout.findFirst({
              where: {
                employeeId: employee.id,
                periodStart: periodStart,
                periodEnd: periodEnd
              }
            });

            if (existingPayout) {
              if (existingPayout.amount !== amount) {
                await prisma.payout.update({
                  where: { id: existingPayout.id },
                  data: {
                    amount,
                    comment: `Auto-updated: ${daysWorked} paid days, ${totalHours.toFixed(1)} hours${unpaidDays > 0 ? ` (${unpaidDays} unpaid days)` : ''}`,
                    updatedAt: new Date()
                  }
                });
                payoutResults.updated++;
              }
            } else {
              await prisma.payout.create({
                data: {
                  employeeId: employee.id,
                  periodStart,
                  periodEnd,
                  amount,
                  comment: `Auto-calculated: ${daysWorked} paid days, ${totalHours.toFixed(1)} hours${unpaidDays > 0 ? ` (${unpaidDays} unpaid days)` : ''}`
                }
              });
              payoutResults.created++;
            }
            payoutResults.total++;
          }
        } catch (error) {
          console.error(`[API] Error calculating payout for employee ${employeeId}:`, error);
        }
      }
      
      // Small delay between payout batches
      if (i + 5 < affectedEmployeeIds.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }

    console.log(`[API] Payout calculation completed: Created ${payoutResults.created}, Updated ${payoutResults.updated}, Total ${payoutResults.total}`);

    return NextResponse.json({
      message: 'Attendance log processed successfully',
      recordsCount: processedCount,
      payouts: payoutResults
    }, { status: 200 });

  } catch (error) {
    console.error('Error processing attendance upload:', error);
    return NextResponse.json({ 
      error: 'Failed to process attendance log',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
} 