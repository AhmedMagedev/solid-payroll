import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/app/lib/prisma';
import { verifyToken } from '@/app/lib/auth';
import { Prisma } from '@/app/generated/prisma';

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
    const search = searchParams.get('search');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '20', 10);
    const sortField = searchParams.get('sortField') || 'periodEnd';
    const sortDirection = searchParams.get('sortDirection') as 'asc' | 'desc' || 'desc';
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    
    // Calculate offset for pagination
    const offset = (page - 1) * limit;
    
    // Build where clause
    const where: Prisma.PayoutWhereInput = {};
    if (employeeId) {
      where.employeeId = parseInt(employeeId, 10);
    }
    if (search) {
      where.OR = [
        {
          employee: {
            name: {
              contains: search,
              mode: 'insensitive'
            }
          }
        },
        {
          comment: {
            contains: search,
            mode: 'insensitive'
          }
        }
      ];
    }
    
    // Add date filtering by periodStart (which month the work period belongs to)
    if (startDate || endDate) {
      where.periodStart = {};
      if (startDate) {
        where.periodStart.gte = new Date(startDate);
      }
      if (endDate) {
        where.periodStart.lte = new Date(endDate);
      }
    }
    
    // Build order by clause
    const orderBy: Prisma.PayoutOrderByWithRelationInput = {};
    if (sortField.includes('.')) {
      // Handle nested sorting (e.g., employee.name)
      const [relation, field] = sortField.split('.');
      if (relation === 'employee' && field === 'name') {
        orderBy.employee = { name: sortDirection };
      }
    } else {
      // Direct field sorting
      switch (sortField) {
        case 'periodEnd':
          orderBy.periodEnd = sortDirection;
          break;
        case 'periodStart':
          orderBy.periodStart = sortDirection;
          break;
        case 'amount':
          orderBy.amount = sortDirection;
          break;
        case 'isPaid':
          orderBy.isPaid = sortDirection;
          break;
        case 'paymentDate':
          orderBy.paymentDate = sortDirection;
          break;
        case 'updatedAt':
          orderBy.updatedAt = sortDirection;
          break;
        case 'createdAt':
          orderBy.createdAt = sortDirection;
          break;
        default:
          orderBy.periodEnd = sortDirection;
      }
    }
    
    // Get total count for pagination
    const totalCount = await prisma.payout.count({ where });
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / limit);
    const hasNextPage = page < totalPages;
    const hasPrevPage = page > 1;
    
    // Fetch payouts with adjustments
    const payouts = await prisma.payout.findMany({
      where,
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
      },
      orderBy,
      skip: offset,
      take: limit
    });
    
    // Use stored amounts only - no calculations
    const payoutsWithTotals = payouts.map(payout => {
      const adjustmentsTotal = payout.adjustments.reduce((sum, adj) => sum + adj.amount, 0);
      // Use stored finalAmount from database only
      const totalAmount = payout.finalAmount || payout.amount;
      
      return {
        ...payout,
        adjustmentsTotal,
        totalAmount
      };
    });
    
    return NextResponse.json({
      data: payoutsWithTotals,
      pagination: {
        currentPage: page,
        totalPages,
        totalCount,
        limit,
        hasNextPage,
        hasPrevPage,
        startIndex: offset + 1,
        endIndex: Math.min(offset + limit, totalCount)
      }
    });
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
        paymentDate: data.isPaid ? new Date() : null,
        adjustmentAmount: data.adjustmentAmount || 0,
        adjustmentReason: data.adjustmentReason || null,
        includeOvertime: data.includeOvertime || false
      }
    });
    
    return NextResponse.json(payout, { status: 201 });
  } catch (error) {
    console.error('Error creating payout:', error);
    return NextResponse.json({ error: 'Failed to create payout' }, { status: 500 });
  }
} 