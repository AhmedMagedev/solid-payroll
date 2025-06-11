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
      if (parts.length < 3) {
        console.warn(`[API] Skipping invalid line: ${line}`);
        continue;
      }

      // Correct parsing: parts[0] = deviceId, parts[1] = date, parts[2] = time
      const deviceId = parseInt(parts[0], 10);
      const timeString = parts[1] + ' ' + parts[2]; // YYYY-MM-DD HH:MM:SS

      console.log(`[API] Parsing line: ${line}`);
      console.log(`[API] Extracted - DeviceID: ${deviceId}, Timestamp: ${timeString}`);

      // Use the Egypt timezone parser
      const checkInDateTime = parseEgyptTimeToUtc(timeString);
      if (!checkInDateTime) {
        console.log(`Skipping record ${line}: Invalid timestamp "${timeString}"`);
        continue;
      }

      // Find employee by deviceId (fingerprint device ID)
      const employee = await prisma.employee.findFirst({
        where: { 
          fingerprintId: deviceId.toString()
        }
      });

      if (!employee) {
        console.log(`Skipping record ${line}: Employee with fingerprint device ID ${deviceId} not found`);
        continue;
      }

      // Calculate if this should be a paid day based on grace period
      const isPaidDay = !isCheckInBeyondGracePeriod(
        checkInDateTime,
        workingHoursStart,
        lateAllowanceMinutes
      );

      const dateKey = checkInDateTime.toISOString().split('T')[0]; // YYYY-MM-DD format
      const employeeKey = `${employee.id}-${dateKey}`;

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
            
            // DEBUG: Log the parsed values
            console.log(`[Upload Payout Debug] MonthKey: ${monthKey}, Year: ${year}, Month: ${month}`);
            
            // FIXED: Create proper month boundaries - 1st to last day of each month (UTC to avoid timezone issues)
            // IMPORTANT: month is 1-based from monthKey, but Date constructor expects 0-based month
            const periodStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)); // First day at 00:00:00 UTC
            const periodEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999)); // Last day at 23:59:59 UTC
            
            console.log(`[Upload Payout Debug] For ${monthKey}:`);
            console.log(`  - Creating periodStart: new Date(${year}, ${month - 1}, 1) = ${periodStart.toISOString()}`);
            console.log(`  - Creating periodEnd: new Date(${year}, ${month}, 0) = ${periodEnd.toISOString()}`);
            console.log(`[Upload Payout] ${monthKey}: ${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`);

            // Only count days where isPaidDay is true
            const paidDays = monthAttendance.filter(a => a.isPaidDay && a.hoursWorked && a.hoursWorked > 0);
            const daysWorked = paidDays.length;
            const totalHours = paidDays.reduce((sum, a) => sum + (a.hoursWorked || 0), 0);
            
            // RESTORED OVERTIME CALCULATION with sophisticated rules
            const hoursPerDay = 9; // Standard working hours per day
            const hourlyRate = employee.dailyRate / hoursPerDay;
            const overtimeRate = hourlyRate * 1.5; // 1.5x overtime rate
            
            let regularHours = 0;
            let overtimeHours = 0;
            let excessOvertimeHours = 0; // Hours beyond 2-hour overtime cap
            
            console.log(`[Overtime Calc] Employee ${employee.name}, Month ${monthKey}: Processing ${paidDays.length} paid days`);
            
            // Calculate overtime per day with rules
            paidDays.forEach((attendance, dayIndex) => {
              const dailyHours = attendance.hoursWorked || 0;
              const attendanceDate = new Date(attendance.date);
              
              console.log(`[Overtime Calc] Day ${dayIndex + 1}: ${attendanceDate.toDateString()}, Hours: ${dailyHours}`);
              
              if (dailyHours > hoursPerDay) {
                const potentialOvertimeHours = dailyHours - hoursPerDay;
                console.log(`[Overtime Calc] Potential overtime: ${potentialOvertimeHours} hours`);
                
                // SIMPLIFIED: Remove next-day presence requirement for now to test
                // We can add it back later if needed
                const isOvertimeEligible = true;
                
                /* DISABLED FOR DEBUGGING
                // Check if employee must be present next working day for overtime eligibility
                const nextWorkingDay = getNextWorkingDay(attendanceDate);
                
                if (nextWorkingDay) {
                  // Check if employee was present on the next working day
                  const nextDayAttendance = paidDays.find(a => {
                    const aDate = new Date(a.date);
                    return aDate.toDateString() === nextWorkingDay.toDateString();
                  });
                  
                  // If next working day exists and employee was not present, overtime is not eligible
                  if (!nextDayAttendance) {
                    isOvertimeEligible = false;
                    console.log(`[Overtime Calc] Overtime not eligible - not present next working day (${nextWorkingDay.toDateString()})`);
                  } else {
                    console.log(`[Overtime Calc] Overtime eligible - present next working day`);
                  }
                } else {
                  console.log(`[Overtime Calc] Overtime eligible - no next working day required`);
                }
                */
                
                if (isOvertimeEligible) {
                  regularHours += hoursPerDay;
                  
                  // Apply 2-hour overtime cap rule
                  if (potentialOvertimeHours <= 2) {
                    // All overtime hours within cap - paid at overtime rate
                    overtimeHours += potentialOvertimeHours;
                    console.log(`[Overtime Calc] Added ${potentialOvertimeHours} overtime hours (within cap)`);
                  } else {
                    // First 2 hours at overtime rate, rest at regular rate
                    overtimeHours += 2;
                    excessOvertimeHours += (potentialOvertimeHours - 2);
                    console.log(`[Overtime Calc] Added 2 overtime hours + ${potentialOvertimeHours - 2} excess hours`);
                  }
                } else {
                  // Overtime not eligible, treat as regular hours up to standard hours
                  regularHours += Math.min(dailyHours, hoursPerDay);
                  console.log(`[Overtime Calc] Overtime not eligible - treating as regular hours`);
                }
              } else {
                regularHours += dailyHours;
                console.log(`[Overtime Calc] Regular day: ${dailyHours} hours`);
              }
            });
            
            // Include excess overtime hours in regular hours for payment calculation
            regularHours += excessOvertimeHours;
            
            console.log(`[Overtime Calc] Final totals - Regular: ${regularHours}, Overtime: ${overtimeHours}, Excess: ${excessOvertimeHours}`);
            
            // Calculate amounts
            const basePayout = daysWorked * employee.dailyRate;
            const excessOvertimePayout = excessOvertimeHours * hourlyRate; // Excess overtime at regular rate
            const overtimePayout = (overtimeHours * overtimeRate) + excessOvertimePayout; // Total overtime payment
            const totalAmount = basePayout + overtimePayout;
            
            console.log(`[Overtime Calc] Amounts - Base: ${basePayout}, Overtime (1.5x): ${(overtimeHours * overtimeRate).toFixed(2)}, Excess Overtime (regular): ${excessOvertimePayout.toFixed(2)}, Total Overtime: ${overtimePayout}, Total: ${totalAmount}`);
            
            // Count unpaid days for reporting
            const unpaidDays = monthAttendance.length - daysWorked;

            const existingPayout = await prisma.payout.findFirst({
              where: {
                employeeId: employee.id,
                AND: [
                  {
                    periodStart: {
                      gte: new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0)), // Start of target month (UTC)
                      lt: new Date(Date.UTC(year, month, 1, 0, 0, 0, 0))  // Start of next month (UTC)
                    }
                  }
                ]
              }
            });

            console.log(`[Upload Payout Debug] Checking for existing payout:`);
            console.log(`  - Employee ID: ${employee.id}`);
            console.log(`  - Period Start: ${periodStart.toISOString()}`);
            console.log(`  - Period End: ${periodEnd.toISOString()}`);
            console.log(`  - Existing payout found: ${existingPayout ? `Yes (ID: ${existingPayout.id})` : 'No'}`);

            if (existingPayout) {
              console.log(`[Upload Payout Debug] Updating existing payout ${existingPayout.id}:`);
              console.log(`  - Current period: ${existingPayout.periodStart} to ${existingPayout.periodEnd}`);
              console.log(`  - New period: ${periodStart.toISOString()} to ${periodEnd.toISOString()}`);
              
              await prisma.payout.update({
                where: { id: existingPayout.id },
                data: {
                  // IMPORTANT: Update the period boundaries to correct values
                  periodStart,
                  periodEnd,
                  amount: totalAmount,
                  daysWorked,
                  unpaidDays,
                  totalHours,
                  regularHours,
                  overtimeHours,
                  excessOvertimeHours,
                  basePayout,
                  overtimePayout,
                  finalAmount: totalAmount,
                  comment: `Auto-updated: ${daysWorked} paid days, ${totalHours.toFixed(1)} hours${unpaidDays > 0 ? ` (${unpaidDays} unpaid days)` : ''}`,
                  updatedAt: new Date()
                }
              });
              payoutResults.updated++;
              console.log(`[Upload Payout Debug] Successfully updated payout ${existingPayout.id} with correct periods`);
            } else {
              console.log(`[Upload Payout Debug] Creating new payout:`);
              const newPayout = await prisma.payout.create({
                data: {
                  employeeId: employee.id,
                  periodStart,
                  periodEnd,
                  amount: totalAmount,
                  daysWorked,
                  unpaidDays,
                  totalHours,
                  regularHours,
                  overtimeHours,
                  excessOvertimeHours,
                  basePayout,
                  overtimePayout,
                  finalAmount: totalAmount,
                  comment: `Auto-calculated: ${daysWorked} paid days, ${totalHours.toFixed(1)} hours${unpaidDays > 0 ? ` (${unpaidDays} unpaid days)` : ''}`
                }
              });
              payoutResults.created++;
              console.log(`[Upload Payout Debug] Successfully created new payout ${newPayout.id} with correct periods`);
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