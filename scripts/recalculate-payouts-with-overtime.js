#!/usr/bin/env node

import { PrismaClient } from '../app/generated/prisma/index.js';

const prisma = new PrismaClient();

async function recalculatePayoutsWithOvertime() {
  try {
    console.log('🔄 Starting payout recalculation with overtime...');
    
    // Get all payouts
    const payouts = await prisma.payout.findMany({
      include: {
        employee: true
      }
    });
    
    console.log(`📋 Found ${payouts.length} payouts to recalculate`);
    
    let updated = 0;
    
    for (const payout of payouts) {
      try {
        // Get attendance records for this payout period
        const attendance = await prisma.attendance.findMany({
          where: {
            employeeId: payout.employeeId,
            date: {
              gte: payout.periodStart,
              lte: payout.periodEnd
            }
          }
        });
        
        // Calculate with new overtime logic
        const paidDays = attendance.filter(a => a.isPaidDay && a.hoursWorked && a.hoursWorked > 0);
        const daysWorked = paidDays.length;
        const totalHours = paidDays.reduce((sum, a) => sum + (a.hoursWorked || 0), 0);
        
        // Enhanced calculation: include overtime
        const hoursPerDay = 8; // Standard working hours per day
        let regularHours = 0;
        let overtimeHours = 0;
        
        // Calculate overtime per day (up to 2 hours per day at 1.5x rate)
        paidDays.forEach((record) => {
          const dailyHours = record.hoursWorked || 0;
          if (dailyHours > hoursPerDay) {
            const potentialOvertimeHours = dailyHours - hoursPerDay;
            regularHours += hoursPerDay;
            // Apply 2-hour overtime cap per day
            overtimeHours += Math.min(potentialOvertimeHours, 2);
            // Excess overtime beyond 2 hours counted as regular time
            if (potentialOvertimeHours > 2) {
              regularHours += (potentialOvertimeHours - 2);
            }
          } else {
            regularHours += dailyHours;
          }
        });
        
        // Calculate amounts
        const basePayout = daysWorked * payout.employee.dailyRate;
        const hourlyRate = payout.employee.dailyRate / hoursPerDay;
        const overtimeRate = hourlyRate * 1.5; // 1.5x overtime rate
        const overtimePayout = overtimeHours * overtimeRate;
        const newAmount = basePayout + overtimePayout;
        
        // Count unpaid days for reporting
        const unpaidDays = attendance.filter(a => !a.isPaidDay).length;
        
        // Update if amount changed
        if (Math.abs(payout.amount - newAmount) > 0.01) { // Use small threshold for float comparison
          await prisma.payout.update({
            where: { id: payout.id },
            data: {
              amount: newAmount,
              comment: `Recalculated with overtime: ${daysWorked} paid days, ${totalHours.toFixed(1)} hours (${regularHours.toFixed(1)} regular + ${overtimeHours.toFixed(1)} overtime)${unpaidDays > 0 ? ` (${unpaidDays} unpaid days)` : ''}`,
              updatedAt: new Date()
            }
          });
          
          console.log(`✅ Updated payout ${payout.id} for ${payout.employee.name}: ${payout.amount.toFixed(2)} → ${newAmount.toFixed(2)}`);
          updated++;
        } else {
          console.log(`⏭️  Skipped payout ${payout.id} for ${payout.employee.name}: amount unchanged (${payout.amount.toFixed(2)})`);
        }
        
      } catch (error) {
        console.error(`❌ Error processing payout ${payout.id}:`, error);
      }
    }
    
    console.log(`\n📊 Recalculation completed:`);
    console.log(`   • Total payouts: ${payouts.length}`);
    console.log(`   • Updated: ${updated}`);
    console.log(`   • Unchanged: ${payouts.length - updated}`);
    
  } catch (error) {
    console.error('❌ Error during recalculation:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the script
recalculatePayoutsWithOvertime(); 