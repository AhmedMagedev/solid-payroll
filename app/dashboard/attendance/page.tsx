'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Upload, AlertCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';

interface Attendance {
  id: number;
  employeeId: number;
  date: string;
  checkIn: string;
  checkOut: string | null;
  hoursWorked: number | null;
  employeeName?: string;
  isPaidDay?: boolean; // Optional for backward compatibility
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

interface SystemSettings {
  workingHoursStart: string;
  workingHoursEnd: string;
  lateAllowanceMinutes: number;
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

  useEffect(() => {
    fetchAttendance(currentPage, searchTerm);
  }, [currentPage, fetchAttendance]);

  // Fetch system settings
  useEffect(() => {
    async function fetchSystemSettings() {
      try {
        const response = await fetch('/api/settings', {
          credentials: 'include',
        });
        
        if (response.ok) {
          const settings = await response.json();
          setSystemSettings(settings);
        }
      } catch (err) {
        console.error('Error fetching system settings:', err);
      }
    }
    
    fetchSystemSettings();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchAttendance(1, searchTerm);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  function formatTime(timeString: string | null) {
    if (!timeString) return 'N/A';
    try {
      const date = new Date(timeString);
      return format(date, 'h:mm a');
    } catch {
      return 'Invalid time';
    }
  }

  function formatDate(dateString: string) {
    try {
      const date = new Date(dateString);
      return format(date, 'MMM d, yyyy');
    } catch {
      return 'Invalid date';
    }
  }

  // Check if check-in is late (past working hours start + grace period)
  function isCheckInLate(checkInTime: string, recordDate: string): boolean {
    if (!systemSettings || !checkInTime) return false;
    
    try {
      const checkIn = new Date(checkInTime);
      const recordDateObj = new Date(recordDate);
      
      // Parse working hours start time
      const [hours, minutes] = systemSettings.workingHoursStart.split(':');
      const expectedStartTime = new Date(recordDateObj);
      expectedStartTime.setHours(parseInt(hours), parseInt(minutes) + systemSettings.lateAllowanceMinutes, 0, 0);
      
      return checkIn > expectedStartTime;
    } catch {
      return false;
    }
  }

  // Check if check-out is early (before working hours end)
  function isCheckOutEarly(checkOutTime: string | null, recordDate: string): boolean {
    if (!systemSettings || !checkOutTime) return false;
    
    try {
      const checkOut = new Date(checkOutTime);
      const recordDateObj = new Date(recordDate);
      
      // Parse working hours end time
      const [hours, minutes] = systemSettings.workingHoursEnd.split(':');
      const expectedEndTime = new Date(recordDateObj);
      expectedEndTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      return checkOut < expectedEndTime;
    } catch {
      return false;
    }
  }

  // Format time with conditional styling
  function formatTimeWithStyling(
    timeString: string | null, 
    isLate: boolean, 
    isEarly: boolean
  ): React.ReactNode {
    const timeText = formatTime(timeString);
    const className = (isLate || isEarly) ? 'text-red-600 font-medium' : '';
    
    return <span className={className}>{timeText}</span>;
  }

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
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="h-12 px-6 text-left align-middle font-medium text-muted-foreground">Employee</th>
                    <th className="h-12 px-6 text-left align-middle font-medium text-muted-foreground">Date</th>
                    <th className="h-12 px-6 text-left align-middle font-medium text-muted-foreground">Check In</th>
                    <th className="h-12 px-6 text-left align-middle font-medium text-muted-foreground">Check Out</th>
                    <th className="h-12 px-6 text-left align-middle font-medium text-muted-foreground">Hours</th>
                    <th className="h-12 px-6 text-left align-middle font-medium text-muted-foreground">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData.map((record) => (
                    <tr key={record.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-4 px-6">
                        <div className="font-medium">
                          {record.employeeName || `Employee #${record.employeeId}`}
                        </div>
                      </td>
                      <td className="py-4 px-6">{formatDate(record.date)}</td>
                      <td className="py-4 px-6">{formatTimeWithStyling(record.checkIn, isCheckInLate(record.checkIn, record.date), false)}</td>
                      <td className="py-4 px-6">{formatTimeWithStyling(record.checkOut, false, isCheckOutEarly(record.checkOut, record.date))}</td>
                      <td className="py-4 px-6">
                        {record.hoursWorked !== null 
                          ? <span className="font-medium">{record.hoursWorked.toFixed(2)}h</span> 
                          : <span className="text-muted-foreground">N/A</span>}
                      </td>
                      <td className="py-4 px-6">
                        {record.isPaidDay === false ? (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                            Unpaid (Late)
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                            Paid
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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