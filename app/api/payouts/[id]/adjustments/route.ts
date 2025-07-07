import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';
import { verifyToken } from '@/app/lib/auth';

const prisma = new PrismaClient();

// GET all adjustments for a payout
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check for authentication
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Verify token
    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }

    const { id } = await params;
    const payoutId = parseInt(id, 10);

    if (isNaN(payoutId)) {
      return NextResponse.json({ error: 'Invalid payout ID' }, { status: 400 });
    }

    // Check if payout exists
    const payout = await prisma.payout.findUnique({
      where: { id: payoutId }
    });

    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    // Get all adjustments for this payout
    const adjustments = await prisma.payoutAdjustment.findMany({
      where: { payoutId },
      orderBy: { createdAt: 'desc' }
    });

    return NextResponse.json(adjustments);
  } catch (error: unknown) {
    console.error('Error fetching payout adjustments:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to fetch payout adjustments', details: errorMessage },
      { status: 500 }
    );
  }
}

// POST - Create a new adjustment for a payout
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check for authentication
    const token = request.cookies.get('auth_token')?.value;
    
    if (!token) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }
    
    // Verify token
    const session = await verifyToken(token);
    if (!session) {
      return NextResponse.json({ error: 'Invalid authentication token' }, { status: 401 });
    }

    const { id } = await params;
    const payoutId = parseInt(id, 10);

    if (isNaN(payoutId)) {
      return NextResponse.json({ error: 'Invalid payout ID' }, { status: 400 });
    }

    // Check if payout exists
    const payout = await prisma.payout.findUnique({
      where: { id: payoutId }
    });

    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }

    const data = await request.json();
    
    // Validate required fields
    if (!data.type || !data.amount || !data.reason) {
      return NextResponse.json(
        { error: 'Missing required fields: type, amount, reason' },
        { status: 400 }
      );
    }

    // Validate adjustment type
    const validTypes = ['bonus', 'deduction', 'overtime', 'other'];
    if (!validTypes.includes(data.type)) {
      return NextResponse.json(
        { error: 'Invalid adjustment type. Must be one of: ' + validTypes.join(', ') },
        { status: 400 }
      );
    }

    // Create the adjustment
    const adjustment = await prisma.payoutAdjustment.create({
      data: {
        payoutId,
        type: data.type,
        amount: parseFloat(data.amount),
        reason: data.reason
      }
    });

    return NextResponse.json({
      message: 'Adjustment created successfully',
      adjustment
    });
  } catch (error: unknown) {
    console.error('Error creating payout adjustment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to create payout adjustment', details: errorMessage },
      { status: 500 }
    );
  }
} 