import { prisma } from '@/app/lib/prisma';
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/app/lib/auth';

export async function DELETE(request: NextRequest) {
  try {
    // Check for authentication
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      console.log('[API Remove All Employees] No token found, returning unauthorized');
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Verify token
    const session = await verifyToken(token);
    if (!session) {
      console.log('[API Remove All Employees] Invalid token, returning unauthorized');
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }
    
    // Get confirmation from request body
    const body = await request.json();
    const { confirmation } = body;
    
    if (confirmation !== 'DELETE ALL EMPLOYEES') {
      return NextResponse.json(
        { 
          error: 'Invalid confirmation. Please provide exact confirmation text.',
          required: 'DELETE ALL EMPLOYEES'
        },
        { status: 400 }
      );
    }
    
    console.log('[API Remove All Employees] Starting deletion process...');
    
    // Get current counts for logging
    const employeeCount = await prisma.employee.count();
    const attendanceCount = await prisma.attendance.count();
    const payoutCount = await prisma.payout.count();
    
    console.log(`[API Remove All Employees] Current data: ${employeeCount} employees, ${attendanceCount} attendance records, ${payoutCount} payouts`);
    
    if (employeeCount === 0) {
      return NextResponse.json({
        message: 'No employees found to delete',
        deleted: {
          employees: 0,
          attendance: 0,
          payouts: 0
        }
      });
    }
    
    // Perform deletions in correct order due to foreign key constraints
    const deletedAttendance = await prisma.attendance.deleteMany({});
    console.log(`[API Remove All Employees] Deleted ${deletedAttendance.count} attendance records`);
    
    const deletedPayouts = await prisma.payout.deleteMany({});
    console.log(`[API Remove All Employees] Deleted ${deletedPayouts.count} payout records`);
    
    const deletedEmployees = await prisma.employee.deleteMany({});
    console.log(`[API Remove All Employees] Deleted ${deletedEmployees.count} employees`);
    
    const result = {
      message: 'All employees and related data have been successfully removed',
      deleted: {
        employees: deletedEmployees.count,
        attendance: deletedAttendance.count,
        payouts: deletedPayouts.count
      },
      timestamp: new Date().toISOString()
    };
    
    console.log('[API Remove All Employees] Operation completed successfully:', result);
    
    return NextResponse.json(result);
    
  } catch (error) {
    console.error('[API Remove All Employees] Error during deletion:', error);
    return NextResponse.json(
      { 
        error: 'Failed to remove employees',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest) {
  try {
    // Check for authentication
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Verify token
    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json(
        { error: 'Invalid authentication token' },
        { status: 401 }
      );
    }
    
    // Return current data summary
    const employeeCount = await prisma.employee.count();
    const attendanceCount = await prisma.attendance.count();
    const payoutCount = await prisma.payout.count();
    
    return NextResponse.json({
      summary: {
        employees: employeeCount,
        attendance: attendanceCount,
        payouts: payoutCount
      },
      instructions: {
        endpoint: 'DELETE /api/admin/remove-all-employees',
        required_body: {
          confirmation: 'DELETE ALL EMPLOYEES'
        },
        warning: 'This operation permanently deletes ALL employee data and cannot be undone!'
      }
    });
    
  } catch (error) {
    console.error('[API Remove All Employees] Error getting summary:', error);
    return NextResponse.json(
      { error: 'Failed to get data summary' },
      { status: 500 }
    );
  }
} 