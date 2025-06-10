import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';

// Get a specific payout
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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
    
    const params = await context.params;
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
        },
        adjustments: {
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });
    
    if (!payout) {
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }
    
    // Calculate total amounts including adjustments - use same logic as main payouts API
    const adjustmentsTotal = payout.adjustments.reduce((sum, adj) => sum + adj.amount, 0);
    // Use stored finalAmount from database only
    const totalAmount = payout.finalAmount || payout.amount;

    const payoutWithTotals = {
      ...payout,
      adjustmentsTotal,
      totalAmount
    };
    
    return NextResponse.json(payoutWithTotals);
  } catch (error) {
    console.error('Error fetching payout:', error);
    return NextResponse.json({ error: 'Failed to fetch payout' }, { status: 500 });
  }
}

// Update a payout's status and comment
export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
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
    
    const params = await context.params;
    const payoutId = parseInt(params.id, 10);
    if (isNaN(payoutId)) {
      return NextResponse.json({ error: 'Invalid payout ID' }, { status: 400 });
    }
    
    // Parse request body
    const data = await request.json();
    
    console.log(`[API Payout Update] Received data for payout ${payoutId}:`, data);
    
    // Check if payout exists
    const existingPayout = await prisma.payout.findUnique({
      where: { id: payoutId }
    });
    
    if (!existingPayout) {
      console.log(`[API Payout Update] Payout ${payoutId} not found`);
      return NextResponse.json({ error: 'Payout not found' }, { status: 404 });
    }
    
    console.log(`[API Payout Update] Existing payout:`, existingPayout);
    
    // Prepare update data
    const updateData: {
      isPaid?: boolean;
      comment?: string | null;
      paymentDate?: Date | null;
      adjustmentAmount?: number;
      adjustmentReason?: string | null;
      includeOvertime?: boolean;
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
    
    if (data.adjustmentAmount !== undefined) {
      updateData.adjustmentAmount = data.adjustmentAmount;
    }
    
    if (data.adjustmentReason !== undefined) {
      updateData.adjustmentReason = data.adjustmentReason;
    }
    
    if (data.includeOvertime !== undefined) {
      updateData.includeOvertime = data.includeOvertime;
    }
    
    console.log(`[API Payout Update] Update data:`, updateData);
    
    // Update payout
    const updatedPayout = await prisma.payout.update({
      where: { id: payoutId },
      data: updateData
    });
    
    console.log(`[API Payout Update] Successfully updated payout:`, updatedPayout);
    
    // Verify the update was actually applied by fetching the record again
    const verificationPayout = await prisma.payout.findUnique({
      where: { id: payoutId }
    });
    
    console.log(`[API Payout Update] Verification - payout from DB:`, verificationPayout);
    
    if (verificationPayout?.isPaid !== updatedPayout.isPaid) {
      console.error(`[API Payout Update] WARNING: Database verification failed! Expected isPaid: ${updatedPayout.isPaid}, but DB shows: ${verificationPayout?.isPaid}`);
    } else {
      console.log(`[API Payout Update] ✅ Database update verified successfully`);
    }
    
    return NextResponse.json(updatedPayout);
  } catch (error) {
    console.error('Error updating payout:', error);
    return NextResponse.json({ error: 'Failed to update payout' }, { status: 500 });
  }
} 