import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';

const prisma = new PrismaClient();

// GET system settings
export async function GET() {
  try {
    // Get the first (and only) settings record, or create it if it doesn't exist
    let settings = await prisma.systemSettings.findFirst();
    
    if (!settings) {
      // Create default settings if none exist
      settings = await prisma.systemSettings.create({
        data: {} // Use schema defaults
      });
    }
    
    return NextResponse.json(settings);
  } catch (error: unknown) {
    console.error('Error fetching settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch settings', details: errorMessage },
      { status: 500 }
    );
  }
}

// Update system settings
export async function PUT(request: NextRequest) {
  try {
    const data = await request.json();
    
    // Get existing settings or create default
    const existingSettings = await prisma.systemSettings.findFirst();
    let settings;
    
    if (existingSettings) {
      // Update existing settings
      settings = await prisma.systemSettings.update({
        where: { id: existingSettings.id },
        data: {
          lateAllowanceMinutes: data.lateAllowanceMinutes !== undefined ? 
            parseInt(data.lateAllowanceMinutes) : undefined,
          workDaySunday: data.workDaySunday !== undefined ? 
            Boolean(data.workDaySunday) : undefined,
          workDayMonday: data.workDayMonday !== undefined ? 
            Boolean(data.workDayMonday) : undefined,
          workDayTuesday: data.workDayTuesday !== undefined ? 
            Boolean(data.workDayTuesday) : undefined,
          workDayWednesday: data.workDayWednesday !== undefined ? 
            Boolean(data.workDayWednesday) : undefined,
          workDayThursday: data.workDayThursday !== undefined ? 
            Boolean(data.workDayThursday) : undefined,
          workDayFriday: data.workDayFriday !== undefined ? 
            Boolean(data.workDayFriday) : undefined,
          workDaySaturday: data.workDaySaturday !== undefined ? 
            Boolean(data.workDaySaturday) : undefined,
          workingHoursPerDay: data.workingHoursPerDay !== undefined ? 
            parseFloat(data.workingHoursPerDay) : undefined,
          workingHoursStart: data.workingHoursStart || undefined,
          workingHoursEnd: data.workingHoursEnd || undefined,
          overtimeMultiplier: data.overtimeMultiplier !== undefined ? 
            parseFloat(data.overtimeMultiplier) : undefined,
          weekendOvertimeMultiplier: data.weekendOvertimeMultiplier !== undefined ? 
            parseFloat(data.weekendOvertimeMultiplier) : undefined,
        },
      });
    } else {
      // Create new settings
      settings = await prisma.systemSettings.create({
        data: {
          lateAllowanceMinutes: data.lateAllowanceMinutes !== undefined ? 
            parseInt(data.lateAllowanceMinutes) : 15,
          workDaySunday: data.workDaySunday !== undefined ? 
            Boolean(data.workDaySunday) : false,
          workDayMonday: data.workDayMonday !== undefined ? 
            Boolean(data.workDayMonday) : true,
          workDayTuesday: data.workDayTuesday !== undefined ? 
            Boolean(data.workDayTuesday) : true,
          workDayWednesday: data.workDayWednesday !== undefined ? 
            Boolean(data.workDayWednesday) : true,
          workDayThursday: data.workDayThursday !== undefined ? 
            Boolean(data.workDayThursday) : true,
          workDayFriday: data.workDayFriday !== undefined ? 
            Boolean(data.workDayFriday) : true,
          workDaySaturday: data.workDaySaturday !== undefined ? 
            Boolean(data.workDaySaturday) : false,
          workingHoursPerDay: data.workingHoursPerDay !== undefined ? 
            parseFloat(data.workingHoursPerDay) : 8,
          workingHoursStart: data.workingHoursStart || "09:00",
          workingHoursEnd: data.workingHoursEnd || "17:00",
          overtimeMultiplier: data.overtimeMultiplier !== undefined ? 
            parseFloat(data.overtimeMultiplier) : 1.5,
          weekendOvertimeMultiplier: data.weekendOvertimeMultiplier !== undefined ? 
            parseFloat(data.weekendOvertimeMultiplier) : 2,
        },
      });
    }
    
    return NextResponse.json({
      message: 'Settings updated successfully',
      settings
    });
  } catch (error: unknown) {
    console.error('Error updating settings:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update settings', details: errorMessage },
      { status: 500 }
    );
  }
} 