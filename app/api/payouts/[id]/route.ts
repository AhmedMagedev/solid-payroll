import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';

// Get a specific payout
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    const payoutId = parseInt(params.id, 10);
    if (isNaN(payoutId)) {
      return NextResponse.json({ error: 'Invalid payout ID' }, { status: 400 });
    }
    
    const payout = await prisma.payout.findUnique({
      where: { id: payoutId },
      include: {
        employee: {
          select: {
            name: true,
            paymentBasis: true
          }
        }
      }
    });
    
    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }
    
    return NextResponse.json(payout);
  } catch (error) {
    console.error('Error fetching payout:', error);
    return NextResponse.json({ error: 'Failed to fetch payout' }, { status: 500 });
  }
}

// Update a payout's status and comment
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    
    const payoutId = parseInt(params.id, 10);
    if (isNaN(payoutId)) {
      return NextResponse.json({ error: 'Invalid payout ID' }, { status: 400 });
    }
    
    // Parse request body
    const data = await request.json();
    
    // Check if payout exists
    const existingPayout = await prisma.payout.findUnique({
      where: { id: payoutId }
    });
    
    if (!existingPayout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }
    
    // Prepare update data
    const updateData: {
      isPaid?: boolean;
      comment?: string | null;
      paymentDate?: Date | null;
    } = {};
    
    // Only update fields that are provided
    if (data.isPaid !== undefined) {
      updateData.isPaid = data.isPaid;
      // If marking as paid and it wasn't paid before, set payment date
      if (data.isPaid && !existingPayout.isPaid) {
        updateData.paymentDate = new Date();
      }
      // If marking as unpaid, clear payment date
      if (!data.isPaid) {
        updateData.paymentDate = null;
      }
    }
    
    if (data.comment !== undefined) {
      updateData.comment = data.comment;
    }
    
    // Update payout
    const updatedPayout = await prisma.payout.update({
      where: { id: payoutId },
      data: updateData
    });
    
    return NextResponse.json(updatedPayout);
  } catch (error) {
    console.error('Error updating payout:', error);
    return NextResponse.json({ error: 'Failed to update payout' }, { status: 500 });
  }
} 