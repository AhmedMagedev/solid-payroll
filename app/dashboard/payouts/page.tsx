'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { ArrowUpDown, Eye, Search, AlertCircle, ChevronLeft, ChevronRight, DollarSign } from 'lucide-react';
import { formatEgyptTime } from '@/lib/timezone';
import { format, parseISO } from 'date-fns';
import { Input } from '@/components/ui/input';

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
  totalAmount: number; // This usually includes adjustments
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
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [sortField, setSortField] = useState<string | null>('periodEnd');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  const fetchPayouts = useCallback(async (page: number, search: string, field: string | null, direction: 'asc' | 'desc') => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '15',
      });
      if (search) params.append('search', search);
      if (field) params.append('sortField', field);
      if (direction) params.append('sortDirection', direction);

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
    fetchPayouts(currentPage, searchTerm, sortField, sortDirection);
  }, [currentPage, searchTerm, sortField, sortDirection, fetchPayouts]);

  const handleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };
  
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1); // Reset to first page on new search
    fetchPayouts(1, searchTerm, sortField, sortDirection);
  };
  
  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const formatDateRange = (start: string, end: string) => {
    const startDate = parseISO(start);
    const endDate = parseISO(end);
    return `${format(startDate, 'MMM d, yyyy')} - ${format(endDate, 'MMM d, yyyy')}`;
  };

  const getStatusBadge = (isPaid: boolean, paymentDate: string | null) => {
    if (isPaid) {
      return <Badge variant="default">Paid{paymentDate ? ` on ${format(parseISO(paymentDate), 'MMM d, yy')}` : ''}</Badge>;
    }
    return <Badge variant="secondary">Pending</Badge>;
  };

  const PaginationControls = () => {
    if (!pagination || pagination.totalPages <= 1) return null;
    const pageNumbers = [];
    const maxVisiblePages = 5;
    const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1);
    for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

    return (
      <div className="flex items-center justify-between mt-4">
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
    <TableHead onClick={() => handleSort(field)} className="cursor-pointer hover:bg-muted/50">
      <div className="flex items-center">
        {label}
        {sortField === field && <ArrowUpDown className="ml-2 h-4 w-4" />}
      </div>
    </TableHead>
  );

  return (
    <div className="p-4 md:p-6 max-w-full mx-auto">
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center"><DollarSign className="h-6 w-6 mr-2 text-primary" /> All Payouts</CardTitle>
          <CardDescription>View and manage all employee payouts.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSearch} className="flex gap-4 mb-4">
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
                <Button type="button" variant="outline" onClick={() => { setSearchTerm(''); setCurrentPage(1); fetchPayouts(1, '', sortField, sortDirection); }}>Clear</Button>
            )}
          </form>
        </CardContent>
      </Card>

      {isLoading && payouts.length === 0 && (
        <div className="flex justify-center items-center min-h-[300px]">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent mb-4"></div>
            <p className="text-muted-foreground">Loading payouts...</p>
          </div>
        </div>
      )}

      {error && (
        <Card className="border-red-500/50 bg-red-50/30">
          <CardContent className="p-6">
            <div className="flex items-center text-red-600">
              <AlertCircle className="h-5 w-5 mr-2" />
              <span className="font-medium">Error:</span> {error}
            </div>
            <Button variant="outline" onClick={() => fetchPayouts(currentPage, searchTerm, sortField, sortDirection)} className="mt-4">Try Again</Button>
          </CardContent>
        </Card>
      )}

      {!isLoading && !error && payouts.length === 0 && (
        <Card>
          <CardContent className="p-10 text-center text-muted-foreground">
            No payouts found. {searchTerm ? 'Try adjusting your search.' : ''}
          </CardContent>
        </Card>
      )}

      {!error && payouts.length > 0 && (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <SortableTableHeader field="employee.name" label="Employee" />
                    <SortableTableHeader field="periodEnd" label="Pay Period" />
                    <SortableTableHeader field="totalAmount" label="Total Amount" />
                    <SortableTableHeader field="isPaid" label="Status" />
                    <SortableTableHeader field="paymentDate" label="Payment Date" />
                    <SortableTableHeader field="updatedAt" label="Last Updated" />
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {payouts.map((payout) => (
                    <TableRow key={payout.id}>
                      <TableCell className="font-medium">
                        <Link href={`/dashboard/employees/${payout.employeeId}/payouts`} className="hover:underline">
                            {payout.employee.name}
                        </Link>
                        <div className="text-xs text-muted-foreground">{payout.employee.paymentBasis}</div>
                      </TableCell>
                      <TableCell>{formatDateRange(payout.periodStart, payout.periodEnd)}</TableCell>
                      <TableCell>L.E {payout.totalAmount.toFixed(2)}</TableCell>
                      <TableCell>{getStatusBadge(payout.isPaid, payout.paymentDate)}</TableCell>
                      <TableCell>{payout.paymentDate ? formatEgyptTime(payout.paymentDate, 'MMM d, yyyy') : '-'}</TableCell>
                      <TableCell>{formatEgyptTime(payout.updatedAt, 'MMM d, yyyy, h:mm a')}</TableCell>
                      <TableCell>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={`/dashboard/employees/${payout.employeeId}/payouts?periodStart=${payout.periodStart}&periodEnd=${payout.periodEnd}`}>
                            <Eye className="h-4 w-4 mr-1" /> View Details
                          </Link>
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
         {pagination && <CardContent className="p-4 border-t"><PaginationControls /></CardContent>}
        </Card>
      )}
    </div>
  );
} 