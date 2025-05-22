import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';

// Get all payouts or filter by employeeId
export async function GET(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    
    // Build query
    const query: { employeeId?: number } = {};
    if (employeeId) {
      query.employeeId = parseInt(employeeId, 10);
    }
    
    // Fetch payouts
    const payouts = await prisma.payout.findMany({
      where: query,
      include: {
        employee: {
          select: {
            name: true,
            paymentBasis: true
          }
        }
      },
      orderBy: {
        periodEnd: 'desc'
      }
    });
    
    return NextResponse.json(payouts);
  } catch (error) {
    console.error('Error fetching payouts:', error);
    return NextResponse.json({ error: 'Failed to fetch payouts' }, { status: 500 });
  }
}

// Create a new payout
export async function POST(request: NextRequest) {
  try {
    // Verify authentication
    const token = request.cookies.get('auth_token')?.value;
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 401 });
    }
    
    // Parse request body
    const data = await request.json();
    
    // Validate required fields
    if (!data.employeeId || !data.periodStart || !data.periodEnd || data.amount === undefined) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    
    // Create payout
    const payout = await prisma.payout.create({
      data: {
        employeeId: data.employeeId,
        periodStart: new Date(data.periodStart),
        periodEnd: new Date(data.periodEnd),
        amount: data.amount,
        isPaid: data.isPaid || false,
        comment: data.comment || null,
        paymentDate: data.isPaid ? new Date() : null
      }
    });
    
    return NextResponse.json(payout, { status: 201 });
  } catch (error) {
    console.error('Error creating payout:', error);
    return NextResponse.json({ error: 'Failed to create payout' }, { status: 500 });
  }
} 