#!/usr/bin/env npx ts-node

import { PrismaClient } from '../app/generated/prisma/client';
import * as readline from 'readline';

const prisma = new PrismaClient();

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

async function askConfirmation(): Promise<boolean> {
  return new Promise((resolve) => {
    rl.question(
      '⚠️  WARNING: This will permanently delete ALL employees and their related data (attendance, payouts).\n' +
      'This action cannot be undone!\n\n' +
      'Type "DELETE ALL EMPLOYEES" to confirm: ',
      (answer) => {
        resolve(answer === 'DELETE ALL EMPLOYEES');
      }
    );
  });
}

async function removeAllEmployees() {
  try {
    console.log('🔍 Checking current employee count...');
    
    const employeeCount = await prisma.employee.count();
    const attendanceCount = await prisma.attendance.count();
    const payoutCount = await prisma.payout.count();
    
    console.log(`\n📊 Current data summary:`);
    console.log(`   • Employees: ${employeeCount}`);
    console.log(`   • Attendance records: ${attendanceCount}`);
    console.log(`   • Payout records: ${payoutCount}`);
    
    if (employeeCount === 0) {
      console.log('\n✅ No employees found in the database.');
      return;
    }
    
    const confirmed = await askConfirmation();
    
    if (!confirmed) {
      console.log('\n❌ Operation cancelled. No data was deleted.');
      return;
    }
    
    console.log('\n🗑️  Starting deletion process...');
    
    // Delete in the correct order due to foreign key constraints
    // 1. Delete attendance records first
    const deletedAttendance = await prisma.attendance.deleteMany({});
    console.log(`   ✓ Deleted ${deletedAttendance.count} attendance records`);
    
    // 2. Delete payout records
    const deletedPayouts = await prisma.payout.deleteMany({});
    console.log(`   ✓ Deleted ${deletedPayouts.count} payout records`);
    
    // 3. Finally delete employees
    const deletedEmployees = await prisma.employee.deleteMany({});
    console.log(`   ✓ Deleted ${deletedEmployees.count} employees`);
    
    console.log('\n✅ All employees and related data have been successfully removed!');
    
  } catch (error) {
    console.error('\n❌ Error occurred during deletion:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
    rl.close();
  }
}

// Main execution
if (require.main === module) {
  removeAllEmployees()
    .then(() => {
      console.log('\n🏁 Script completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\n💥 Script failed:', error);
      process.exit(1);
    });
}

export { removeAllEmployees }; 