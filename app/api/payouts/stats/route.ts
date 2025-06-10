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
    
    const { searchParams } = new URL(request.url);
    const month = searchParams.get('month');
    const search = searchParams.get('search');
    
    if (!month) {
      return NextResponse.json({ error: 'Month parameter is required' }, { status: 400 });
    }
    
    console.log(`[Payouts Stats API] Fetching stats for month: ${month}, search: ${search}`);
    
    // Parse the month parameter (format: YYYY-MM)
    const [year, monthNum] = month.split('-').map(Number);
    if (!year || !monthNum || monthNum < 1 || monthNum > 12) {
      return NextResponse.json({ error: 'Invalid month format. Use YYYY-MM' }, { status: 400 });
    }
    
    // Create month boundaries
    const startOfMonth = new Date(year, monthNum - 1, 1); // monthNum - 1 because Date uses 0-based months
    const endOfMonth = new Date(year, monthNum, 0, 23, 59, 59, 999); // Day 0 of next month = last day of current month
    
    console.log(`[Payouts Stats API] Date range: ${startOfMonth.toISOString()} to ${endOfMonth.toISOString()}`);
    
    // Build where clause
    const where: {
      periodStart: {
        gte: string;
        lte: string;
      };
      OR?: Array<{
        employee?: { name: { contains: string; mode: 'insensitive' } };
        comment?: { contains: string; mode: 'insensitive' };
      }>;
    } = {
      periodStart: {
        gte: startOfMonth.toISOString(),
        lte: endOfMonth.toISOString()
      }
    };
    
    // Add search filter if provided
    if (search && search.trim()) {
      where.OR = [
        {
          employee: {
            name: {
              contains: search.trim(),
              mode: 'insensitive'
            }
          }
        },
        {
          comment: {
            contains: search.trim(),
            mode: 'insensitive'
          }
        }
      ];
    }
    
    // Fetch all payouts for the month (without pagination) to calculate total stats
    const allPayouts = await prisma.payout.findMany({
      where,
      select: {
        isPaid: true,
        finalAmount: true,
        basePayout: true
      }
    });
    
    console.log(`[Payouts Stats API] Found ${allPayouts.length} payouts for stats calculation`);
    
    // Calculate statistics
    const paidPayouts = allPayouts.filter(p => p.isPaid);
    const pendingPayouts = allPayouts.filter(p => !p.isPaid);
    
    const stats = {
      totalPaid: paidPayouts.reduce((sum, p) => sum + (p.finalAmount || 0), 0),
      totalPending: pendingPayouts.reduce((sum, p) => sum + (p.basePayout || 0), 0),
      paidCount: paidPayouts.length,
      pendingCount: pendingPayouts.length,
      totalCount: allPayouts.length
    };
    
    console.log(`[Payouts Stats API] Calculated stats:`, stats);
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('[Payouts Stats API] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch payout statistics' }, { status: 500 });
  }
} 