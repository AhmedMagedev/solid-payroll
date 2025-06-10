#!/usr/bin/env node

import { PrismaClient } from '../app/generated/prisma/index.js';

const prisma = new PrismaClient();

async function updateExistingPayouts() {
  try {
    console.log('🔄 Starting payout breakdown update...');
    
    // Get all payouts
    const payouts = await prisma.payout.findMany({
      include: {
        employee: true
      }
    });
    
    console.log(`📋 Found ${payouts.length} payouts to update`);
    
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
        
        // Calculate breakdown
        const paidDays = attendance.filter(a => a.isPaidDay && a.hoursWorked && a.hoursWorked > 0);
        const daysWorked = paidDays.length;
        const unpaidDays = attendance.length - daysWorked;
        const totalHours = paidDays.reduce((sum, a) => sum + (a.hoursWorked || 0), 0);
        
        // Calculate overtime per day (up to 2 hours per day at 1.5x rate)
        const hoursPerDay = 9; // Standard working hours per day (updated from 8 to 9)
        let regularHours = 0;
        let overtimeHours = 0;
        
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
        const finalAmount = basePayout + overtimePayout;
        const excessOvertimeHours = Math.max(0, totalHours - regularHours - overtimeHours);
        
        // Update the payout with breakdown data
        await prisma.payout.update({
          where: { id: payout.id },
          data: {
            daysWorked,
            unpaidDays,
            totalHours,
            regularHours,
            overtimeHours,
            excessOvertimeHours,
            basePayout,
            overtimePayout,
            finalAmount,
            // Update amount to include overtime if it wasn't already
            amount: finalAmount
          }
        });
        
        updated++;
        console.log(`✅ Updated payout ${payout.id} for ${payout.employee.name}: ${daysWorked} days, L.E ${finalAmount.toFixed(2)}`);
        
      } catch (error) {
        console.error(`❌ Error updating payout ${payout.id}:`, error.message);
      }
    }
    
    console.log(`\n🎉 Successfully updated ${updated} payouts!`);
    
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

updateExistingPayouts(); 