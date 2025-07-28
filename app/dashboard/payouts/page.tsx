'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, Eye, Search, AlertCircle, ChevronLeft, ChevronRight, DollarSign, Users, TrendingUp, Calendar, EyeOff } from 'lucide-react';
import { formatEgyptTime } from '@/lib/timezone';
import { format, parseISO, startOfMonth, endOfMonth } from 'date-fns';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Payout {
  id: number;
  employeeId: number;
  employee: {
    name: string;
    paymentBasis: string;
  };
  periodStart: string;
  periodEnd: string;
  amount: number;
  totalAmount: number;
  basePayout: number;
  finalAmount: number;
  isPaid: boolean;
  paymentDate: string | null;
  comment: string | null;
  adjustmentsTotal?: number;
  createdAt: string;
  updatedAt: string;
}

interface PaginationInfo {
  currentPage: number;
  totalPages: number;
  totalCount: number;
  limit: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  startIndex: number;
  endIndex: number;
}

interface PayoutsResponse {
  data: Payout[];
  pagination: PaginationInfo;
}

export default function AllPayoutsPage() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [monthlyStats, setMonthlyStats] = useState<{
    totalPaid: number;
    totalPending: number;
    paidCount: number;
    pendingCount: number;
    totalCount: number;
  } | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isStatsLoading, setIsStatsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string>('periodEnd');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    // Default to current month
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  // Add state to hide adjustments temporarily
  const [hideAdjustments, setHideAdjustments] = useState(true);

  // Generate month options for the last 12 months
  const getMonthOptions = () => {
    const options = [];
    const now = new Date();
    
    for (let i = 0; i < 12; i++) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const value = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const label = format(date, 'MMMM yyyy');
      options.push({ value, label });
    }
    
    return options;
  };

  const monthOptions = getMonthOptions();

  const fetchMonthlyStats = useCallback(async (month: string, search: string) => {
    setIsStatsLoading(true);
    try {
      const params = new URLSearchParams({
        month: month
      });
      
      if (search) {
        params.append('search', search);
      }

      const response = await fetch(`/api/payouts/stats?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch monthly stats');
      }
      
      const stats = await response.json();
      setMonthlyStats(stats);
    } catch (err) {
      console.error('Error fetching monthly stats:', err);
      // If stats fail, we can still show the paginated data
      setMonthlyStats(null);
    } finally {
      setIsStatsLoading(false);
    }
  }, []);

  const fetchPayouts = useCallback(async (page: number, search: string, field: string, direction: 'asc' | 'desc', month: string) => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
        sortField: field,
        sortDirection: direction,
      });
      
      if (search) params.append('search', search);
      
      // Add month filtering
      if (month) {
        const [year, monthNum] = month.split('-');
        const startDate = startOfMonth(new Date(parseInt(year), parseInt(monthNum) - 1));
        const endDate = endOfMonth(new Date(parseInt(year), parseInt(monthNum) - 1));
        
        // Filter by periodStart date to get payouts for the selected month's work period
        params.append('startDate', startDate.toISOString().split('T')[0]);
        params.append('endDate', endDate.toISOString().split('T')[0]);
      }

      const response = await fetch(`/api/payouts?${params.toString()}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to fetch payouts');
      }
      const data: PayoutsResponse = await response.json();
      setPayouts(data.data);
      setPagination(data.pagination);
      setError(null);
    } catch (err) {
      setError('Could not load payouts. Please try again.');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPayouts(currentPage, searchTerm, sortField, sortDirection, selectedMonth);
    fetchMonthlyStats(selectedMonth, searchTerm);
  }, [currentPage, searchTerm, sortField, sortDirection, selectedMonth, fetchPayouts, fetchMonthlyStats]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
    setCurrentPage(1);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleMonthChange = (month: string) => {
    setSelectedMonth(month);
    setCurrentPage(1);
  };

  const formatDateRange = (start: string, end: string) => {
    try {
      const startDate = parseISO(start);
      const endDate = parseISO(end);
      return `${format(startDate, 'MMM d')} - ${format(endDate, 'MMM d, yyyy')}`;
    } catch {
      return 'Invalid Date Range';
    }
  };

  const getStatusBadge = (isPaid: boolean, paymentDate: string | null) => {
    if (isPaid) {
              const dateText = paymentDate ? ` on ${formatEgyptTime(paymentDate)}` : '';
      return <Badge className="bg-green-600 hover:bg-green-700">Paid{dateText}</Badge>;
    }
    return <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 hover:bg-yellow-200">Pending</Badge>;
  };



  // Get the selected month display name
  const getSelectedMonthDisplay = () => {
    const option = monthOptions.find(opt => opt.value === selectedMonth);
    return option ? option.label : 'Selected Month';
  };

  const PaginationControls = () => {
    if (!pagination || pagination.totalPages <= 1) return null;
    const pageNumbers = [];
    const maxVisiblePages = 5;
    const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1);
    for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

    return (
      <div className="flex items-center justify-between mt-6">
        <div className="text-sm text-muted-foreground">
          Showing {pagination.startIndex} to {pagination.endIndex} of {pagination.totalCount} results
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage - 1)} disabled={!pagination.hasPrevPage}>
            <ChevronLeft className="h-4 w-4" /> Previous
          </Button>
          {pageNumbers.map(num => (
            <Button key={num} variant={num === currentPage ? "default" : "outline"} size="sm" onClick={() => handlePageChange(num)}>{num}</Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => handlePageChange(currentPage + 1)} disabled={!pagination.hasNextPage}>
            Next <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  const SortableTableHeader = ({ field, label }: { field: string; label: string }) => (
    <TableHead onClick={() => handleSort(field)} className="cursor-pointer hover:bg-muted/50 transition-colors">
      <div className="flex items-center">
        {label}
        {sortField === field && <ArrowUpDown className={`ml-2 h-4 w-4 ${sortDirection === 'asc' ? 'rotate-180' : ''}`} />}
      </div>
    </TableHead>
  );

  return (
    <div className="p-4 md:p-6 max-w-full mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight flex items-center">
          <DollarSign className="h-8 w-8 mr-3 text-primary" />
          All Payouts - {getSelectedMonthDisplay()}
        </h1>
        <p className="text-muted-foreground mt-2">
          View and manage employee payouts for the selected month.
        </p>
      </div>

      {/* Stats Cards */}
      {!error && (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-green-100 rounded-lg">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-muted-foreground">Total Paid</p>
                  <p className="text-xl font-bold">
                    {isStatsLoading ? (
                      <span className="animate-pulse bg-gray-300 rounded h-6 w-20 inline-block"></span>
                    ) : (
                      `L.E ${(monthlyStats?.totalPaid || 0).toFixed(2)}`
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <Calendar className="h-5 w-5 text-yellow-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-muted-foreground">Total Pending</p>
                  <p className="text-xl font-bold">
                    {isStatsLoading ? (
                      <span className="animate-pulse bg-gray-300 rounded h-6 w-20 inline-block"></span>
                    ) : (
                      `L.E ${(monthlyStats?.totalPending || 0).toFixed(2)}`
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <Users className="h-5 w-5 text-blue-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-muted-foreground">Paid Payouts</p>
                  <p className="text-xl font-bold">
                    {isStatsLoading ? (
                      <span className="animate-pulse bg-gray-300 rounded h-6 w-16 inline-block"></span>
                    ) : (
                      monthlyStats?.paidCount || 0
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <AlertCircle className="h-5 w-5 text-orange-600" />
                </div>
                <div className="ml-3">
                  <p className="text-sm font-medium text-muted-foreground">Pending Payouts</p>
                  <p className="text-xl font-bold">
                    {isStatsLoading ? (
                      <span className="animate-pulse bg-gray-300 rounded h-6 w-16 inline-block"></span>
                    ) : (
                      monthlyStats?.pendingCount || 0
                    )}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Month Filter and Search */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Month Picker */}
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-muted-foreground" />
              <Select value={selectedMonth} onValueChange={handleMonthChange}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select month" />
                </SelectTrigger>
                <SelectContent>
                  {monthOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            
            {/* Search */}
            <form onSubmit={handleSearch} className="flex gap-4 flex-1">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  type="text"
                  placeholder="Search by employee name or comment..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Button type="submit" disabled={isLoading}>Search</Button>
              {searchTerm && (
                <Button 
                  type="button" 
                  variant="outline" 
                  onClick={() => { 
                    setSearchTerm(''); 
                    setCurrentPage(1); 
                  }}
                >
                  Clear
                </Button>
              )}
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Loading State */}
      {isLoading && payouts.length === 0 && (
        <div className="flex justify-center items-center min-h-[300px]">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent mb-4"></div>
            <p className="text-muted-foreground">Loading payouts...</p>
          </div>
        </div>
      )}

      {/* Error State */}
      {error && (
        <Card className="border-red-500/50 bg-red-50/30">
          <CardContent className="p-6">
            <div className="flex items-center text-red-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span className="font-medium">Error:</span> {error}
            </div>
            <Button variant="outline" onClick={() => fetchPayouts(currentPage, searchTerm, sortField, sortDirection, selectedMonth)} className="mt-4">
              Try Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Empty State */}
      {!isLoading && !error && payouts.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            <DollarSign className="h-16 w-16 mx-auto mb-4 opacity-50" />
            <h3 className="text-lg font-medium mb-2">No payouts found</h3>
            <p>
              {searchTerm 
                ? `No payouts found for "${searchTerm}" in ${getSelectedMonthDisplay()}. Try adjusting your search criteria.`
                : `No payouts have been created for ${getSelectedMonthDisplay()}.`
              }
            </p>
          </CardContent>
        </Card>
      )}

      {/* Payouts Table */}
      {!error && payouts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Payouts Table</CardTitle>
            <CardDescription>
              {pagination ? `${pagination.totalCount} total payouts` : 'All payouts'}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHeader field="employee.name" label="Employee" />
                    <SortableTableHeader field="periodEnd" label="Pay Period" />
                    <TableHead>Payment Basis</TableHead>
                    <SortableTableHeader field="totalAmount" label="Amount" />
                    <SortableTableHeader field="isPaid" label="Status" />
                    <SortableTableHeader field="paymentDate" label="Payment Date" />
                    <SortableTableHeader field="updatedAt" label="Last Updated" />
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((payout) => (
                    <TableRow key={payout.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">
                        <Link 
                          href={`/dashboard/employees/${payout.employeeId}`} 
                          className="hover:underline text-primary"
                        >
                          {payout.employee.name}
                        </Link>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {formatDateRange(payout.periodStart, payout.periodEnd)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {payout.employee.paymentBasis}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-semibold">
                        {payout.isPaid ? (
                          <>
                            L.E {payout.finalAmount.toFixed(2)}
                            <div className="text-xs text-muted-foreground">
                              Final amount (paid)
                            </div>
                          </>
                        ) : (
                          <>
                            L.E {payout.basePayout.toFixed(2)}
                            <div className="text-xs text-muted-foreground">
                              Base calculation (pending)
                            </div>
                          </>
                        )}
                        {!hideAdjustments && payout.adjustmentsTotal !== 0 && (
                          <div className="text-xs text-muted-foreground">
                            Base: L.E {payout.amount.toFixed(2)}
                            {payout.adjustmentsTotal && payout.adjustmentsTotal !== 0 && (
                              <span className={payout.adjustmentsTotal > 0 ? 'text-green-600' : 'text-red-600'}>
                                {' '}{payout.adjustmentsTotal > 0 ? '+' : ''}L.E {payout.adjustmentsTotal.toFixed(2)}
                              </span>
                            )}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(payout.isPaid, payout.paymentDate)}
                      </TableCell>
                      <TableCell>
                        {payout.paymentDate ? formatEgyptTime(payout.paymentDate) : '-'}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {formatEgyptTime(payout.updatedAt)}
                      </TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/dashboard/employees/${payout.employeeId}/payouts`}>
                            <Eye className="h-4 w-4 mr-1" />
                            View
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            <div className="p-4">
              <PaginationControls />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 