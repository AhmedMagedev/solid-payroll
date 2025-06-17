import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function cleanAttendance() {
  try {
    console.log('🧹 Attendance Cleanup Script');
    console.log('============================\n');

    // Get command line arguments
    const args = process.argv.slice(2);
    const command = args[0] || 'help';

    switch (command) {
      case 'all':
        await deleteAllAttendance();
        break;
      
      case 'date':
        const date = args[1];
        if (!date) {
          console.error('❌ Please provide a date (YYYY-MM-DD)');
          console.log('Usage: node scripts/clean-attendance.js date 2025-01-14');
          process.exit(1);
        }
        await deleteAttendanceByDate(date);
        break;
      
      case 'range':
        const startDate = args[1];
        const endDate = args[2];
        if (!startDate || !endDate) {
          console.error('❌ Please provide start and end dates (YYYY-MM-DD)');
          console.log('Usage: node scripts/clean-attendance.js range 2025-01-14 2025-01-20');
          process.exit(1);
        }
        await deleteAttendanceByDateRange(startDate, endDate);
        break;
      
      case 'employee':
        const employeeId = args[1];
        if (!employeeId) {
          console.error('❌ Please provide an employee ID');
          console.log('Usage: node scripts/clean-attendance.js employee 12345');
          process.exit(1);
        }
        await deleteAttendanceByEmployee(employeeId);
        break;
      
      case 'recent':
        const days = parseInt(args[1]) || 7;
        await deleteRecentAttendance(days);
        break;
      
      case 'help':
      default:
        showHelp();
        break;
    }

  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    await prisma.$disconnect();
  }
}

async function deleteAllAttendance() {
  console.log('🗑️  Deleting ALL attendance records...\n');
  
  // Get counts before deletion
  const attendanceCount = await prisma.attendance.count();
  const payoutCount = await prisma.payout.count();
  
  console.log(`📊 Current records:`);
  console.log(`   - Attendance: ${attendanceCount}`);
  console.log(`   - Payouts: ${payoutCount}\n`);
  
  if (attendanceCount === 0) {
    console.log('✅ No attendance records to delete');
    return;
  }
  
  // Delete related payouts first (they depend on attendance)
  console.log('🔄 Deleting related payouts...');
  const deletedPayouts = await prisma.payout.deleteMany({});
  console.log(`✅ Deleted ${deletedPayouts.count} payout records`);
  
  // Delete attendance records
  console.log('🔄 Deleting attendance records...');
  const deletedAttendance = await prisma.attendance.deleteMany({});
  console.log(`✅ Deleted ${deletedAttendance.count} attendance records`);
  
  console.log('\n🎉 All attendance and payout records have been deleted!');
}

async function deleteAttendanceByDate(dateStr) {
  console.log(`🗑️  Deleting attendance records for ${dateStr}...\n`);
  
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) {
    console.error('❌ Invalid date format. Use YYYY-MM-DD');
    return;
  }
  
  // Get affected employee IDs before deletion
  const attendanceRecords = await prisma.attendance.findMany({
    where: { date },
    select: { employeeId: true }
  });
  
  const affectedEmployeeIds = [...new Set(attendanceRecords.map(r => r.employeeId))];
  
  console.log(`📊 Found ${attendanceRecords.length} attendance records for ${affectedEmployeeIds.length} employees`);
  
  if (attendanceRecords.length === 0) {
    console.log('✅ No attendance records found for this date');
    return;
  }
  
  // Delete attendance records for the date
  const deletedAttendance = await prisma.attendance.deleteMany({
    where: { date }
  });
  
  console.log(`✅ Deleted ${deletedAttendance.count} attendance records`);
  
  // Recalculate payouts for affected employees
  await recalculatePayouts(affectedEmployeeIds);
  
  console.log(`\n🎉 Cleanup completed for ${dateStr}!`);
}

async function deleteAttendanceByDateRange(startDateStr, endDateStr) {
  console.log(`🗑️  Deleting attendance records from ${startDateStr} to ${endDateStr}...\n`);
  
  const startDate = new Date(startDateStr);
  const endDate = new Date(endDateStr);
  
  if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
    console.error('❌ Invalid date format. Use YYYY-MM-DD');
    return;
  }
  
  // Get affected employee IDs before deletion
  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate
      }
    },
    select: { employeeId: true }
  });
  
  const affectedEmployeeIds = [...new Set(attendanceRecords.map(r => r.employeeId))];
  
  console.log(`📊 Found ${attendanceRecords.length} attendance records for ${affectedEmployeeIds.length} employees`);
  
  if (attendanceRecords.length === 0) {
    console.log('✅ No attendance records found in this date range');
    return;
  }
  
  // Delete attendance records in the range
  const deletedAttendance = await prisma.attendance.deleteMany({
    where: {
      date: {
        gte: startDate,
        lte: endDate
      }
    }
  });
  
  console.log(`✅ Deleted ${deletedAttendance.count} attendance records`);
  
  // Recalculate payouts for affected employees
  await recalculatePayouts(affectedEmployeeIds);
  
  console.log(`\n🎉 Cleanup completed for date range ${startDateStr} to ${endDateStr}!`);
}

async function deleteAttendanceByEmployee(employeeId) {
  console.log(`🗑️  Deleting attendance records for employee ${employeeId}...\n`);
  
  // Check if employee exists
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId }
  });
  
  if (!employee) {
    console.error('❌ Employee not found');
    return;
  }
  
  console.log(`👤 Employee: ${employee.name}`);
  
  // Get attendance count
  const attendanceCount = await prisma.attendance.count({
    where: { employeeId }
  });
  
  console.log(`📊 Found ${attendanceCount} attendance records`);
  
  if (attendanceCount === 0) {
    console.log('✅ No attendance records found for this employee');
    return;
  }
  
  // Delete payouts for this employee
  const deletedPayouts = await prisma.payout.deleteMany({
    where: { employeeId }
  });
  console.log(`✅ Deleted ${deletedPayouts.count} payout records`);
  
  // Delete attendance records
  const deletedAttendance = await prisma.attendance.deleteMany({
    where: { employeeId }
  });
  console.log(`✅ Deleted ${deletedAttendance.count} attendance records`);
  
  console.log(`\n🎉 Cleanup completed for employee ${employee.name}!`);
}

async function deleteRecentAttendance(days) {
  console.log(`🗑️  Deleting attendance records from the last ${days} days...\n`);
  
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  console.log(`📅 Deleting records since: ${cutoffDate.toISOString().split('T')[0]}`);
  
  // Get affected employee IDs before deletion
  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      date: {
        gte: cutoffDate
      }
    },
    select: { employeeId: true }
  });
  
  const affectedEmployeeIds = [...new Set(attendanceRecords.map(r => r.employeeId))];
  
  console.log(`📊 Found ${attendanceRecords.length} attendance records for ${affectedEmployeeIds.length} employees`);
  
  if (attendanceRecords.length === 0) {
    console.log('✅ No recent attendance records found');
    return;
  }
  
  // Delete attendance records
  const deletedAttendance = await prisma.attendance.deleteMany({
    where: {
      date: {
        gte: cutoffDate
      }
    }
  });
  
  console.log(`✅ Deleted ${deletedAttendance.count} attendance records`);
  
  // Recalculate payouts for affected employees
  await recalculatePayouts(affectedEmployeeIds);
  
  console.log(`\n🎉 Cleanup completed for the last ${days} days!`);
}

async function recalculatePayouts(employeeIds) {
  if (employeeIds.length === 0) return;
  
  console.log(`🔄 Recalculating payouts for ${employeeIds.length} affected employees...`);
  
  let payoutsUpdated = 0;
  let payoutsDeleted = 0;
  
  for (const employeeId of employeeIds) {
    try {
      const employee = await prisma.employee.findUnique({
        where: { id: employeeId }
      });
      
      if (!employee) continue;
      
      // Get remaining attendance records for this employee
      const allAttendance = await prisma.attendance.findMany({
        where: { employeeId },
        orderBy: { date: 'asc' }
      });
      
      if (allAttendance.length === 0) {
        // No attendance left, delete all payouts for this employee
        const deletedPayouts = await prisma.payout.deleteMany({
          where: { employeeId }
        });
        payoutsDeleted += deletedPayouts.count;
        continue;
      }
      
      // Group attendance by month and recalculate payouts
      const attendanceByMonth = new Map();
      
      allAttendance.forEach(record => {
        const date = new Date(record.date);
        const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
        
        if (!attendanceByMonth.has(monthKey)) {
          attendanceByMonth.set(monthKey, []);
        }
        attendanceByMonth.get(monthKey).push(record);
      });
      
      // Get all existing payouts for this employee
      const existingPayouts = await prisma.payout.findMany({
        where: { employeeId }
      });
      
      const existingPayoutMap = new Map();
      existingPayouts.forEach(payout => {
        const monthKey = `${payout.periodStart.getFullYear()}-${(payout.periodStart.getMonth() + 1).toString().padStart(2, '0')}`;
        existingPayoutMap.set(monthKey, payout);
      });
      
      // Process each month with attendance
      for (const [monthKey, monthAttendance] of attendanceByMonth) {
        const paidDays = monthAttendance.filter(record => record.isPaidDay);
        const daysWorked = paidDays.length;
        const totalHours = paidDays.reduce((sum, record) => sum + (record.hoursWorked || 0), 0);
        const calculatedAmount = totalHours * employee.hourlyRate;
        
        const existingPayout = existingPayoutMap.get(monthKey);
        
        if (existingPayout) {
          // Update existing payout
          await prisma.payout.update({
            where: { id: existingPayout.id },
            data: {
              amount: calculatedAmount,
              comment: `Recalculated: ${daysWorked} paid days, ${totalHours.toFixed(1)} hours (${monthAttendance.length - daysWorked} unpaid days)`,
              updatedAt: new Date()
            }
          });
          payoutsUpdated++;
          existingPayoutMap.delete(monthKey);
        }
      }
      
      // Delete payouts for months with no attendance
      for (const payout of existingPayoutMap.values()) {
        await prisma.payout.delete({
          where: { id: payout.id }
        });
        payoutsDeleted++;
      }
      
    } catch (error) {
      console.error(`Error recalculating payouts for employee ${employeeId}:`, error);
    }
  }
  
  console.log(`✅ Payouts recalculated: ${payoutsUpdated} updated, ${payoutsDeleted} deleted`);
}

function showHelp() {
  console.log('🧹 Attendance Cleanup Script');
  console.log('============================\n');
  console.log('Usage: node scripts/clean-attendance.js <command> [options]\n');
  console.log('Commands:');
  console.log('  all                           Delete ALL attendance and payout records');
  console.log('  date <YYYY-MM-DD>            Delete records for a specific date');
  console.log('  range <start> <end>          Delete records in date range');
  console.log('  employee <employeeId>        Delete all records for an employee');
  console.log('  recent [days]                Delete records from last N days (default: 7)');
  console.log('  help                         Show this help message\n');
  console.log('Examples:');
  console.log('  node scripts/clean-attendance.js all');
  console.log('  node scripts/clean-attendance.js date 2025-01-14');
  console.log('  node scripts/clean-attendance.js range 2025-01-14 2025-01-20');
  console.log('  node scripts/clean-attendance.js employee 12345');
  console.log('  node scripts/clean-attendance.js recent 3');
  console.log('\n⚠️  Warning: These operations cannot be undone. Make sure to backup your database first!');
}

// Run the script
cleanAttendance(); 