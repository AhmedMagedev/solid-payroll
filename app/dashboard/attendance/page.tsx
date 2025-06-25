'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, AlertCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatEgyptTime } from '@/lib/timezone';
import { parseISO, differenceInMinutes } from 'date-fns';
import Link from 'next/link';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';

interface Attendance {
  id: number;
  employeeId: number;
  employee: {
    id: number;
    name: string;
  };
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  hoursWorked: number | null;
  isPaidDay: boolean;
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

interface AttendanceResponse {
  data: Attendance[];
  pagination: PaginationInfo;
}

interface Penalty {
  type: string;
  label: string;
  color: string;
}

interface SystemSettings {
  id: number;
  lateAllowanceMinutes: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  workingHoursPerDay: number;
}

export default function AttendancePage() {
  const router = useRouter();
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);

  const fetchAttendance = useCallback(async (page: number, search: string) => {
    try {
      setIsLoading(true);
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20'
      });
      
      if (search.trim()) {
        params.append('search', search.trim());
      }
      
      const response = await fetch(`/api/attendance?${params.toString()}`, {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch attendance data');
      }
      
      const data: AttendanceResponse = await response.json();
      setAttendanceData(data.data);
      setPagination(data.pagination);
      setError(null);
    } catch (err) {
      setError('Error loading attendance data. Please try again.');
      console.error('Error fetching attendance:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchSystemSettings = async () => {
    try {
      const response = await fetch('/api/settings', {
        credentials: 'include',
      });
      
      if (response.ok) {
        const settings = await response.json();
        setSystemSettings(settings);
      }
    } catch (error) {
      console.error('Failed to fetch system settings:', error);
    }
  };

  useEffect(() => {
    fetchAttendance(currentPage, searchTerm);
    fetchSystemSettings();
  }, [currentPage, searchTerm, fetchAttendance]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchAttendance(1, searchTerm);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Format date as MM/DD/YYYY
  const formatDate = (dateString: string) => {
    try {
      // Handle different date formats
      if (!dateString) return 'Invalid Date';
      
      // If it's already in YYYY-MM-DD format, parse it directly
      if (/^\d{4}-\d{2}-\d{2}$/.test(dateString)) {
        const date = new Date(dateString + 'T00:00:00');
        if (isNaN(date.getTime())) return 'Invalid Date';
        return date.toLocaleDateString('en-US');
      }
      
      // Try parsing as ISO string
      const date = new Date(dateString);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleDateString('en-US');
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return 'Invalid Date';
    }
  };

  // Calculate penalties for attendance record
  const calculatePenalties = (record: Attendance): Penalty[] => {
    // Use backend penalties if present
    if ((record as unknown as { penalties?: Penalty[] }).penalties && Array.isArray((record as unknown as { penalties?: Penalty[] }).penalties)) {
      return (record as unknown as { penalties: Penalty[] }).penalties;
    }
    // Fallback to frontend calculation (legacy)
    const penalties: Penalty[] = [];
    if (!record.checkIn || !record.date || !systemSettings) return penalties;
    try {
      const recordDate = parseISO(record.date);
      const checkInTime = new Date(record.checkIn);
      const checkOutTime = record.checkOut ? new Date(record.checkOut) : null;
      const [startHours, startMinutes] = systemSettings.workingHoursStart.split(':');
      const [endHours, endMinutes] = systemSettings.workingHoursEnd.split(':');
      const workStart = new Date(recordDate);
      workStart.setHours(parseInt(startHours), parseInt(startMinutes) + systemSettings.lateAllowanceMinutes, 0, 0);
      const workEnd = new Date(recordDate);
      workEnd.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);
      if (record.isPaidDay === false) {
        penalties.push({ type: 'unpaid', label: 'Unpaid Day', color: 'bg-red-100 text-red-800' });
        return penalties;
      }
      if (checkInTime > workStart) {
        const lateMinutes = differenceInMinutes(checkInTime, workStart);
        const lateHours = lateMinutes / 60;
        if (lateHours >= 2.5) {
          penalties.push({ type: 'late-full', label: 'Whole Day Unpaid', color: 'bg-red-100 text-red-800' });
        } else if (lateHours >= 1.5) {
          penalties.push({ type: 'late-half', label: 'Half Day Penalty', color: 'bg-orange-100 text-orange-800' });
        } else if (lateHours >= 0.5) {
          penalties.push({ type: 'late-2h', label: '2h Late Penalty', color: 'bg-yellow-100 text-yellow-800' });
        }
      }
      if (checkOutTime && checkOutTime < workEnd) {
        const earlyMinutes = differenceInMinutes(workEnd, checkOutTime);
        const earlyHours = earlyMinutes / 60;
        if (earlyHours >= 2) {
          penalties.push({ type: 'early-half', label: 'Half Day Early Penalty', color: 'bg-purple-100 text-purple-800' });
        } else if (earlyHours >= 1) {
          penalties.push({ type: 'early-2h', label: '2h Early Penalty', color: 'bg-blue-100 text-blue-800' });
        }
      }
    } catch {
      // ignore
    }
    return penalties;
  };

  const PaginationControls = () => {
    if (!pagination || pagination.totalPages <= 1) return null;

    const pageNumbers = [];
    const maxVisiblePages = 5;
    const startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
    const endPage = Math.min(pagination.totalPages, startPage + maxVisiblePages - 1);

    for (let i = startPage; i <= endPage; i++) {
      pageNumbers.push(i);
    }

    return (
      <div className="flex items-center justify-between mt-4">
        <div className="text-sm text-muted-foreground">
          Showing {pagination.startIndex} to {pagination.endIndex} of {pagination.totalCount} results
        </div>
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!pagination.hasPrevPage}
          >
            <ChevronLeft className="h-4 w-4" />
            Previous
          </Button>
          
          {pageNumbers.map((pageNum) => (
            <Button
              key={pageNum}
              variant={pageNum === currentPage ? "default" : "outline"}
              size="sm"
              onClick={() => handlePageChange(pageNum)}
            >
              {pageNum}
            </Button>
          ))}
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={!pagination.hasNextPage}
          >
            Next
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance Records</h1>
          <p className="text-muted-foreground mt-1">View and manage employee attendance data</p>
        </div>
        <Button onClick={() => router.push('/dashboard/attendance/upload')} className="w-full md:w-auto">
          <Upload className="h-4 w-4 mr-2" />
          Upload Attendance Log
        </Button>
      </div>

      {/* Search Bar */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="Search by employee name..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              Search
            </Button>
            {searchTerm && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={() => {
                  setSearchTerm('');
                  setCurrentPage(1);
                  fetchAttendance(1, '');
                }}
              >
                Clear
              </Button>
            )}
          </form>
        </CardContent>
      </Card>
      
      {isLoading ? (
        <Card className="shadow-sm">
          <CardContent className="p-8">
            <div className="flex justify-center items-center min-h-[200px]">
              <div className="text-center">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-current border-r-transparent mb-2"></div>
                <p className="text-muted-foreground">Loading attendance data...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="shadow-sm border-red-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-center text-red-500 mb-2">
              <AlertCircle className="h-5 w-5 mr-2" />
              <p className="font-medium">{error}</p>
            </div>
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={() => fetchAttendance(currentPage, searchTerm)}
                size="sm"
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : attendanceData.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-10">
            <div className="text-center max-w-md mx-auto">
              <div className="bg-muted rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-4">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">
                {searchTerm ? 'No matching attendance records found' : 'No attendance records found'}
              </h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm 
                  ? 'Try adjusting your search criteria or clear the search to see all records.'
                  : 'Upload your first attendance log to start tracking employee hours.'
                }
              </p>
              {!searchTerm && (
                <Button onClick={() => router.push('/dashboard/attendance/upload')}>
                  Upload Attendance Log
                </Button>
              )}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="flex items-center justify-between">
              <span>Attendance Records</span>
              {pagination && (
                <span className="text-sm font-normal text-muted-foreground">
                  {pagination.totalCount} total records
                </span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Employee</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Check In</TableHead>
                    <TableHead>Check Out</TableHead>
                    <TableHead>Hours</TableHead>
                  </TableRow>
                </TableHeader>
                                  <TableBody>
                    {attendanceData.map((attendance) => {
                      return (
                      <TableRow key={attendance.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">
                          <Link 
                            href={`/dashboard/employees/${attendance.employeeId}`}
                            className="hover:underline text-primary"
                          >
                            {attendance.employee.name}
                          </Link>
                        </TableCell>
                        <TableCell>{formatDate(attendance.date)}</TableCell>
                        <TableCell>
                          {attendance.checkIn ? formatEgyptTime(attendance.checkIn, 'h:mm a') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          {attendance.checkOut ? formatEgyptTime(attendance.checkOut, 'h:mm a') : 'N/A'}
                        </TableCell>
                        <TableCell>
                          <span className={`font-semibold ${
                            attendance.hoursWorked && attendance.hoursWorked >= 9 
                              ? 'text-green-600' 
                              : attendance.hoursWorked && attendance.hoursWorked > 0 
                                ? 'text-orange-600' 
                                : 'text-red-600'
                          }`}>
                            {attendance.hoursWorked?.toFixed(1) || '0.0'}h
                          </span>
                        </TableCell>
                      </TableRow>
                    );
                  })}
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