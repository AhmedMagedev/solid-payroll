import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';
import { verifyToken } from '@/app/lib/auth';
import { parseEgyptTimeToUtc, isCheckInBeyondGracePeriod } from '@/lib/timezone';
import { startOfWeek, endOfWeek, format } from 'date-fns';

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

        // Calculate hours worked with new penalty rules and track deductions
        let hoursWorked = 0;
        let actualHoursWorked = 0;
        let lateDeductionHours = 0;
        let earlyDeductionHours = 0;
        
        if (checkOut && checkOut > checkIn) {
          actualHoursWorked = (checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60);
          hoursWorked = actualHoursWorked;
          
          // Apply new penalty rules (9:00-18:00 with 30min grace = 9:30-18:30)
          const standardWorkStart = new Date(checkIn);
          standardWorkStart.setHours(9, 0, 0, 0); // 9:00 AM
          
          const standardWorkEnd = new Date(checkIn);
          standardWorkEnd.setHours(18, 0, 0, 0); // 6:00 PM
          
          const graceWorkStart = new Date(checkIn);
          graceWorkStart.setHours(9, 30, 0, 0); // 9:30 AM (with grace)
          
          const compensationWorkEnd = new Date(checkIn);
          compensationWorkEnd.setHours(18, 30, 0, 0); // 6:30 PM (compensation for grace)
          
          // Check for late arrival penalties
          const minutesLate = Math.max(0, (checkIn.getTime() - graceWorkStart.getTime()) / (1000 * 60));
          
          // Check for early departure penalties  
          const expectedWorkEnd = checkIn <= graceWorkStart ? standardWorkEnd : compensationWorkEnd;
          const minutesEarly = Math.max(0, (expectedWorkEnd.getTime() - checkOut.getTime()) / (1000 * 60));
          
          console.log(`[Hours Calc] ${employee.name}: CheckIn: ${checkIn.toLocaleString()}, CheckOut: ${checkOut.toLocaleString()}`);
          console.log(`[Hours Calc] Grace Start: ${graceWorkStart.toLocaleString()}, Expected End: ${expectedWorkEnd.toLocaleString()}`);
          console.log(`[Hours Calc] Minutes Late: ${minutesLate.toFixed(1)}, Minutes Early: ${minutesEarly.toFixed(1)}, Actual Hours: ${actualHoursWorked.toFixed(2)}`);
          
          // Apply late penalties and track deductions
          if (minutesLate > 0) {
            if (minutesLate >= 150) { // More than 2.5 hours late (2h + 30min grace)
              lateDeductionHours = actualHoursWorked; // Whole day deducted
              hoursWorked = 0; // Whole day unpaid
              console.log(`[Hours Calc] Penalty: Whole day unpaid (${minutesLate.toFixed(1)} minutes late) - ${lateDeductionHours.toFixed(2)} hours deducted`);
            } else if (minutesLate >= 90) { // 1.5-2.5 hours late (1h + 30min grace to 2h + 30min grace)
              lateDeductionHours = 4.5; // Half day deduction
              hoursWorked = Math.max(0, actualHoursWorked - 4.5); // Deduct half day (4.5 hours)
              console.log(`[Hours Calc] Penalty: Half day deducted (${minutesLate.toFixed(1)} minutes late) - ${lateDeductionHours} hours deducted`);
            } else if (minutesLate >= 30) { // 30min-1.5h late (30min grace to 1h + 30min grace)
              lateDeductionHours = 2; // 2 hours deduction
              hoursWorked = Math.max(0, actualHoursWorked - 2); // Deduct 2 hours
              console.log(`[Hours Calc] Penalty: 2 hours deducted (${minutesLate.toFixed(1)} minutes late) - ${lateDeductionHours} hours deducted`);
            }
          }
          
          // Apply early departure penalties and track deductions (can be combined with late penalties)
          if (minutesEarly > 0) {
            if (minutesEarly >= 120) { // Left 2+ hours early
              earlyDeductionHours = 4.5; // Half day deduction
              hoursWorked = Math.max(0, hoursWorked - 4.5); // Deduct half day
              console.log(`[Hours Calc] Penalty: Half day deducted for early departure (${minutesEarly.toFixed(1)} minutes early) - ${earlyDeductionHours} hours deducted`);
            } else if (minutesEarly >= 60) { // Left 1-2 hours early  
              earlyDeductionHours = 2; // 2 hours deduction
              hoursWorked = Math.max(0, hoursWorked - 2); // Deduct 2 hours
              console.log(`[Hours Calc] Penalty: 2 hours deducted for early departure (${minutesEarly.toFixed(1)} minutes early) - ${earlyDeductionHours} hours deducted`);
            }
          }
          
          console.log(`[Hours Calc] Final hours after penalties: ${hoursWorked.toFixed(2)} (Late deductions: ${lateDeductionHours}h, Early deductions: ${earlyDeductionHours}h)`);
        }

        console.log(`[API] Employee ${employee.name}: Check-in: ${checkIn.toLocaleString()}, Check-out: ${checkOut?.toLocaleString() || 'N/A'}, Hours: ${hoursWorked.toFixed(2)}, Paid: ${isPaidDay}`);

        const attendanceData = {
          employeeId: employee.id,
          date: new Date(date),
          checkIn,
          checkOut,
          hoursWorked: hoursWorked > 0 ? hoursWorked : null,
          isPaidDay,
          actualHoursWorked,
          lateDeductionHours,
          earlyDeductionHours,
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
              actualHoursWorked: record.actualHoursWorked,
              lateDeductionHours: record.lateDeductionHours,
              earlyDeductionHours: record.earlyDeductionHours,
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

          // Group attendance by payment period based on employee's payment basis
          console.log(`[Upload Payout] Employee ${employee.name} has payment basis: ${employee.paymentBasis}`);
          
          const attendanceByPeriod = new Map<string, {
            attendance: Array<{
              id: number;
              employeeId: number;
              date: Date;
              checkIn: Date;
              checkOut: Date | null;
              hoursWorked: number | null;
              createdAt: Date;
              updatedAt: Date;
              isPaidDay: boolean;
            }>,
            periodStart: Date;
            periodEnd: Date;
            label: string;
          }>();
          
          if (employee.paymentBasis === 'Weekly') {
            // Group by weekly periods for weekly employees (Saturday to Friday weeks since Friday is day off)
            
            // First, determine the date range for generating weeks
            const now = new Date();
            let earliestDate: Date;
                         const latestDate: Date = now;
            
            if (employee.attendance.length > 0) {
              const attendanceDates = employee.attendance.map(a => new Date(a.date));
              earliestDate = new Date(Math.min(...attendanceDates.map(d => d.getTime())));
              // Extend range to cover more periods - go back at least 3 months
              const threeMonthsAgo = new Date(now);
              threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);
              earliestDate = earliestDate < threeMonthsAgo ? earliestDate : threeMonthsAgo;
            } else {
              // No attendance data, start from 3 months ago
              earliestDate = new Date(now);
              earliestDate.setMonth(earliestDate.getMonth() - 3);
            }
            
            console.log(`[Weekly Periods] Generating weeks from ${earliestDate.toISOString().split('T')[0]} to ${latestDate.toISOString().split('T')[0]}`);
            
            // Generate all week periods in the range (Saturday to Friday)
            let currentWeekStart = startOfWeek(earliestDate, { weekStartsOn: 6 }); // Start on Saturday
            
            while (currentWeekStart < now) {
              const weekEnd = endOfWeek(currentWeekStart, { weekStartsOn: 6 }); // End on Friday
              
              // Only create periods for weeks that have completely finished
              if (weekEnd < now) {
                // Create week key and period boundaries
                const weekKey = `week-${format(currentWeekStart, 'yyyy-MM-dd')}`;
                const weekLabel = `Week ${format(currentWeekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`;
                
                // Convert to UTC dates for consistency
                const weekStartUTC = new Date(Date.UTC(
                  currentWeekStart.getFullYear(), 
                  currentWeekStart.getMonth(), 
                  currentWeekStart.getDate(), 
                  0, 0, 0, 0
                ));
                const weekEndUTC = new Date(Date.UTC(
                  weekEnd.getFullYear(), 
                  weekEnd.getMonth(), 
                  weekEnd.getDate(), 
                  23, 59, 59, 999
                ));
                
                // Initialize the week period
                if (!attendanceByPeriod.has(weekKey)) {
                  attendanceByPeriod.set(weekKey, {
                    attendance: [],
                    periodStart: weekStartUTC,
                    periodEnd: weekEndUTC,
                    label: weekLabel
                  });
                }
                
                console.log(`[Weekly Periods] Created week: ${weekLabel} (${weekStartUTC.toISOString().split('T')[0]} to ${weekEndUTC.toISOString().split('T')[0]})`);
              } else {
                console.log(`[Weekly Periods] Skipping incomplete week: ${format(currentWeekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`);
              }
              
              // Move to next week
              currentWeekStart = new Date(currentWeekStart);
              currentWeekStart.setDate(currentWeekStart.getDate() + 7);
            }
            
            // Now assign attendance records to their appropriate weeks
            for (const attendance of employee.attendance) {
              const attendanceDate = new Date(attendance.date);
              const weekStart = startOfWeek(attendanceDate, { weekStartsOn: 6 }); // Saturday start
              const weekKey = `week-${format(weekStart, 'yyyy-MM-dd')}`;
              
              if (attendanceByPeriod.has(weekKey)) {
                attendanceByPeriod.get(weekKey)!.attendance.push(attendance);
                console.log(`[Upload Payout] Added attendance for ${employee.name} on ${format(attendanceDate, 'MMM d, yyyy')} to week ${weekKey}`);
              }
            }
          } else {
            // Group by monthly periods for monthly employees (default)
            for (const attendance of employee.attendance) {
              const monthKey = `${attendance.date.getFullYear()}-${String(attendance.date.getMonth() + 1).padStart(2, '0')}`;
              const [year, month] = monthKey.split('-').map(Number);
              
              // Create proper month boundaries
              const monthStart = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0, 0));
              const monthEnd = new Date(Date.UTC(year, month, 0, 23, 59, 59, 999));
              const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
                               'July', 'August', 'September', 'October', 'November', 'December'];
              const monthLabel = `${monthNames[month - 1]} ${year}`;
              
              if (!attendanceByPeriod.has(monthKey)) {
                attendanceByPeriod.set(monthKey, {
                  attendance: [],
                  periodStart: monthStart,
                  periodEnd: monthEnd,
                  label: monthLabel
                });
              }
              attendanceByPeriod.get(monthKey)!.attendance.push(attendance);
              
              console.log(`[Upload Payout] Added attendance for ${employee.name} to ${monthLabel} (${monthStart.toISOString().split('T')[0]} to ${monthEnd.toISOString().split('T')[0]})`);
            }
          }

          // Calculate payouts for each period
          for (const [, periodData] of attendanceByPeriod) {
            const { attendance: periodAttendance, periodStart, periodEnd, label } = periodData;
            
            console.log(`[Upload Payout Debug] Processing ${label}:`);
            console.log(`  - Period Start: ${periodStart.toISOString()}`);
            console.log(`  - Period End: ${periodEnd.toISOString()}`);
            console.log(`  - Attendance records: ${periodAttendance.length}`);

            // Calculate various totals from attendance data
            const paidDays = periodAttendance.filter((a) => a.isPaidDay && a.hoursWorked && a.hoursWorked > 0);
            const daysWorked = paidDays.length;
            const totalHours = paidDays.reduce((sum, a) => sum + (a.hoursWorked || 0), 0);
            
            // NEW OVERTIME CALCULATION with updated rules
            const hoursPerDay = 9; // Standard working hours per day
            const hourlyRate = employee.hourlyRate;
            const overtimeRate = hourlyRate * 1.5; // 1.5x overtime rate
            const holidayRate = hourlyRate * 2; // 2x holiday rate
            
            let regularHours = 0;
            let overtimeHours = 0;
            let excessOvertimeHours = 0; // Hours beyond 2-hour overtime cap (paid at regular rate)
            let holidayHours = 0; // Holiday hours (paid at 2x rate)
            
            console.log(`[New Overtime Calc] Employee ${employee.name}, Period ${label}: Processing ${paidDays.length} paid days`);
            
            // Helper function to check if next working day exists and employee was present
            const getNextWorkingDay = (date: Date) => {
              const nextDay = new Date(date);
              nextDay.setDate(nextDay.getDate() + 1);
              const dayOfWeek = nextDay.getDay();
              // Working days: Sunday(0), Monday(1), Tuesday(2), Wednesday(3), Thursday(4)
              // Friday(5) and Saturday(6) are off
              return (dayOfWeek >= 0 && dayOfWeek <= 4) ? nextDay : null;
            };
            
            const isHoliday = (date: Date) => {
              const dayOfWeek = date.getDay();
              // Friday(5) and Saturday(6) are holidays
              return dayOfWeek === 5 || dayOfWeek === 6;
            };
            
            // Calculate overtime per day with new rules
            paidDays.forEach((attendance, dayIndex) => {
              const dailyHours = attendance.hoursWorked || 0;
              const attendanceDate = new Date(attendance.date);
              
              console.log(`[New Overtime Calc] Day ${dayIndex + 1}: ${attendanceDate.toDateString()}, Hours: ${dailyHours}, Holiday: ${isHoliday(attendanceDate)}`);
              
              // Check if this is a holiday
              if (isHoliday(attendanceDate)) {
                holidayHours += dailyHours;
                console.log(`[New Overtime Calc] Holiday work: ${dailyHours} hours at 2x rate`);
                return;
              }
              
              // Regular workday processing
              if (dailyHours > hoursPerDay) {
                const potentialOvertimeHours = dailyHours - hoursPerDay;
                console.log(`[New Overtime Calc] Potential overtime: ${potentialOvertimeHours} hours`);
                
                // Check if employee must be present next working day for overtime eligibility
                const nextWorkingDay = getNextWorkingDay(attendanceDate);
                let isOvertimeEligible = true;
                
                if (nextWorkingDay) {
                  // Check if employee was present on the next working day
                  const nextDayAttendance = paidDays.find(a => {
                    const aDate = new Date(a.date);
                    return aDate.toDateString() === nextWorkingDay.toDateString() && !isHoliday(aDate);
                  });
                  
                  // If next working day exists and employee was not present, overtime is not eligible
                  if (!nextDayAttendance) {
                    isOvertimeEligible = false;
                    console.log(`[New Overtime Calc] Overtime not eligible - not present next working day (${nextWorkingDay.toDateString()})`);
                  } else {
                    console.log(`[New Overtime Calc] Overtime eligible - present next working day`);
                  }
                } else {
                  console.log(`[New Overtime Calc] Overtime eligible - no next working day required`);
                }
                
                if (isOvertimeEligible) {
                  regularHours += hoursPerDay;
                  
                  // Apply 2-hour overtime cap rule
                  if (potentialOvertimeHours <= 2) {
                    // All overtime hours within cap - paid at overtime rate (1.5x)
                    overtimeHours += potentialOvertimeHours;
                    console.log(`[New Overtime Calc] Added ${potentialOvertimeHours} overtime hours at 1.5x rate`);
                  } else {
                    // First 2 hours at overtime rate, rest at regular rate
                    overtimeHours += 2;
                    excessOvertimeHours += (potentialOvertimeHours - 2);
                    console.log(`[New Overtime Calc] Added 2 overtime hours at 1.5x + ${potentialOvertimeHours - 2} excess hours at regular rate`);
                  }
                } else {
                  // Overtime not eligible, treat as regular hours up to standard hours
                  regularHours += Math.min(dailyHours, hoursPerDay);
                  console.log(`[New Overtime Calc] Overtime not eligible - treating as regular hours: ${Math.min(dailyHours, hoursPerDay)}`);
                }
              } else {
                regularHours += dailyHours;
                console.log(`[New Overtime Calc] Regular day: ${dailyHours} hours`);
              }
            });
            
            // Include excess overtime hours in regular hours for payment calculation
            regularHours += excessOvertimeHours;
            
            console.log(`[New Overtime Calc] Final totals - Regular: ${regularHours}, Overtime: ${overtimeHours}, Excess: ${excessOvertimeHours}, Holiday: ${holidayHours}`);
            
            // Calculate deductions and gross salary
            const unpaidDaysCount = periodAttendance.length - daysWorked;
            const grossSalary = periodAttendance.length * hoursPerDay * hourlyRate; // What they would earn without deductions
            const unpaidDaysDeductions = unpaidDaysCount * hoursPerDay * hourlyRate;
            
            // We'll calculate late/early deductions from the difference between gross and actual paid
            const lateDeductions = 0; // Will be calculated from attendance penalties  
            const earlyDeductions = 0; // Will be calculated from attendance penalties
            const totalDeductions = unpaidDaysDeductions + lateDeductions + earlyDeductions;
            
            // Calculate amounts with new structure
            const basePayout = regularHours * hourlyRate;
            const overtimePayout = overtimeHours * overtimeRate; // 1.5x overtime rate
            const excessOvertimePayout = excessOvertimeHours * hourlyRate; // Excess overtime at regular rate
            const holidayPayout = holidayHours * holidayRate; // 2x holiday rate
            const totalAmount = basePayout + overtimePayout + excessOvertimePayout + holidayPayout;
            
            console.log(`[New Overtime Calc] Amounts - Base: ${basePayout.toFixed(2)}, Overtime (1.5x): ${overtimePayout.toFixed(2)}, Excess Overtime (regular): ${excessOvertimePayout.toFixed(2)}, Holiday (2x): ${holidayPayout.toFixed(2)}, Total: ${totalAmount.toFixed(2)}`);
            
            // Count unpaid days for reporting
            const unpaidDays = periodAttendance.length - daysWorked;

            const existingPayout = await prisma.payout.findFirst({
              where: {
                employeeId: employee.id,
                periodStart: periodStart,
                periodEnd: periodEnd
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
                  overtimePayout: overtimePayout + excessOvertimePayout, // Combined overtime payment
                  finalAmount: totalAmount,
                  grossSalary: grossSalary,
                  lateDeductions: lateDeductions,
                  earlyDeductions: earlyDeductions,
                  unpaidDaysDeductions: unpaidDaysDeductions,
                  totalDeductions: totalDeductions,
                  holidayHours: holidayHours,
                  holidayPayout: holidayPayout,
                  comment: `Auto-updated: ${daysWorked} paid days, ${totalHours.toFixed(1)} hours${unpaidDays > 0 ? ` (${unpaidDays} unpaid days)` : ''}${holidayHours > 0 ? ` (${holidayHours.toFixed(1)} holiday hours)` : ''}`,
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
                  overtimePayout: overtimePayout + excessOvertimePayout, // Combined overtime payment
                  finalAmount: totalAmount,
                  grossSalary: grossSalary,
                  lateDeductions: lateDeductions,
                  earlyDeductions: earlyDeductions,
                  unpaidDaysDeductions: unpaidDaysDeductions,
                  totalDeductions: totalDeductions,
                  holidayHours: holidayHours,
                  holidayPayout: holidayPayout,
                  comment: `Auto-calculated: ${daysWorked} paid days, ${totalHours.toFixed(1)} hours${unpaidDays > 0 ? ` (${unpaidDays} unpaid days)` : ''}${holidayHours > 0 ? ` (${holidayHours.toFixed(1)} holiday hours)` : ''}`
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