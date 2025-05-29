import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/app/generated/prisma';
import { verifyToken } from '@/app/lib/auth';

const prisma = new PrismaClient();

// PUT - Update an adjustment
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ adjustmentId: string }> }
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

    const { adjustmentId } = await params;
    const id = parseInt(adjustmentId, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid adjustment ID' }, { status: 400 });
    }

    // Check if adjustment exists
    const existingAdjustment = await prisma.payoutAdjustment.findUnique({
      where: { id }
    });

    if (!existingAdjustment) {
      return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });
    }

    const data = await request.json();

    // Validate adjustment type if provided
    if (data.type) {
      const validTypes = ['bonus', 'deduction', 'overtime', 'other'];
      if (!validTypes.includes(data.type)) {
        return NextResponse.json(
          { error: 'Invalid adjustment type. Must be one of: ' + validTypes.join(', ') },
          { status: 400 }
        );
      }
    }

    // Update the adjustment
    const adjustment = await prisma.payoutAdjustment.update({
      where: { id },
      data: {
        type: data.type || undefined,
        amount: data.amount ? parseFloat(data.amount) : undefined,
        reason: data.reason || undefined
      }
    });

    return NextResponse.json({
      message: 'Adjustment updated successfully',
      adjustment
    });
  } catch (error: unknown) {
    console.error('Error updating payout adjustment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to update payout adjustment', details: errorMessage },
      { status: 500 }
    );
  }
}

// DELETE - Delete an adjustment
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ adjustmentId: string }> }
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

    const { adjustmentId } = await params;
    const id = parseInt(adjustmentId, 10);

    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid adjustment ID' }, { status: 400 });
    }

    // Check if adjustment exists
    const existingAdjustment = await prisma.payoutAdjustment.findUnique({
      where: { id }
    });

    if (!existingAdjustment) {
      return NextResponse.json({ error: 'Adjustment not found' }, { status: 404 });
    }

    // Delete the adjustment
    await prisma.payoutAdjustment.delete({
      where: { id }
    });

    return NextResponse.json({
      message: 'Adjustment deleted successfully'
    });
  } catch (error: unknown) {
    console.error('Error deleting payout adjustment:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: 'Failed to delete payout adjustment', details: errorMessage },
      { status: 500 }
    );
  }
} 