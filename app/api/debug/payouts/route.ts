import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';

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
    
    console.log('[DEBUG Payouts] Fetching all payouts for debugging...');
    
    // Get all payouts with employee information
    const payouts = await prisma.payout.findMany({
      include: {
        employee: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });
    
    console.log(`[DEBUG Payouts] Found ${payouts.length} payouts`);
    
    // Get summary statistics
    const totalPayouts = payouts.length;
    const paidPayouts = payouts.filter(p => p.isPaid).length;
    const unpaidPayouts = payouts.filter(p => !p.isPaid).length;
    const payoutsWithComments = payouts.filter(p => p.comment && p.comment.trim() !== '').length;
    
    const summary = {
      total: totalPayouts,
      paid: paidPayouts,
      unpaid: unpaidPayouts,
      withComments: payoutsWithComments,
      percentagePaid: totalPayouts > 0 ? Math.round((paidPayouts / totalPayouts) * 100) : 0
    };
    
    // Get employee count for context
    const employeeCount = await prisma.employee.count();
    
    const debugInfo = {
      timestamp: new Date().toISOString(),
      summary,
      employeeCount,
      payouts: payouts.map(payout => ({
        id: payout.id,
        employee: payout.employee.name,
        employeeId: payout.employeeId,
        period: `${payout.periodStart} to ${payout.periodEnd}`,
        amount: payout.amount,
        isPaid: payout.isPaid,
        comment: payout.comment,
        paymentDate: payout.paymentDate,
        createdAt: payout.createdAt,
        updatedAt: payout.updatedAt
      }))
    };
    
    console.log('[DEBUG Payouts] Summary:', summary);
    
    return NextResponse.json(debugInfo);
    
  } catch (error) {
    console.error('[DEBUG Payouts] Error:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch debug information',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
} 