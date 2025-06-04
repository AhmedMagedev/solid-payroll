'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';

interface Employee {
  id: number;
  name: string;
  email: string;
  position: string;
  dailyRate: number;
}

interface AttendanceRecord {
  id: number;
  employeeId: number;
  date: string;
  checkIn: string;
  checkOut: string | null;
  hoursWorked: number | null;
  isPaidDay?: boolean; // Optional for backward compatibility
}

interface SystemSettings {
  workingHoursStart: string;
  workingHoursEnd: string;
  lateAllowanceMinutes: number;
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
  data: AttendanceRecord[];
  pagination: PaginationInfo;
}

export default function EmployeeAttendancePage() {
  const params = useParams();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyTotal, setMonthlyTotal] = useState<number>(0);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  
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

  const fetchData = useCallback(async (page: number) => {
    if (!params.id) return;
    
    try {
      setIsLoading(true);
      
      // Fetch employee details
      const employeeResponse = await fetch(`/api/employee/${params.id}`, {
        credentials: 'include',
      });
      
      if (!employeeResponse.ok) {
        throw new Error('Failed to fetch employee details');
      }
      
      const employeeData = await employeeResponse.json();
      setEmployee(employeeData);
      
      // Fetch attendance records with pagination
      const params2 = new URLSearchParams({
        employeeId: params.id as string,
        page: page.toString(),
        limit: '20'
      });
      
      const attendanceResponse = await fetch(`/api/attendance?${params2.toString()}`, {
        credentials: 'include',
      });
      
      if (!attendanceResponse.ok) {
        throw new Error('Failed to fetch attendance records');
      }
      
      const attendanceData: AttendanceResponse = await attendanceResponse.json();
      const records = attendanceData.data || attendanceData; // Fallback for old format
      setAttendanceRecords(records);
      setPagination(attendanceData.pagination || null);
      
      // Calculate total hours (for all records, not just current page)
      // We'll need to fetch all records for accurate total
      if (attendanceData.pagination) {
        // For paginated response, show current page stats only
        let totalHours = 0;
        for (const record of records) {
          if (record.hoursWorked) {
            totalHours += record.hoursWorked;
          }
        }
        setMonthlyTotal(totalHours);
      } else {
        // Fallback for old format
        let totalHours = 0;
        for (const record of records) {
          if (record.hoursWorked) {
            totalHours += record.hoursWorked;
          }
        }
        setMonthlyTotal(totalHours);
      }
      
      setError(null);
    } catch (err) {
      setError('Error loading data. Please try again.');
      console.error('Error fetching data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [params.id]);

  useEffect(() => {
    fetchData(currentPage);
  }, [currentPage, fetchData]);

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };
  
  function formatTime(timeString: string | null) {
    if (!timeString) return 'N/A';
    try {
      const date = new Date(timeString);
      // For production, convert UTC stored time back to local time (UTC+3)
      const timezoneOffset = 3 * 60; // UTC+3 in minutes
      const localTime = new Date(date.getTime() + (timezoneOffset * 60 * 1000));
      return format(localTime, 'h:mm a');
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
      const checkInDate = new Date(checkInTime);
      // Convert UTC stored time back to local time (UTC+3) for comparison
      const timezoneOffset = 3 * 60; // UTC+3 in minutes
      const localCheckIn = new Date(checkInDate.getTime() + (timezoneOffset * 60 * 1000));
      
      const recordDateObj = new Date(recordDate);
      
      // Parse working hours start time
      const [hours, minutes] = systemSettings.workingHoursStart.split(':');
      const expectedStartTime = new Date(recordDateObj);
      expectedStartTime.setHours(parseInt(hours), parseInt(minutes) + systemSettings.lateAllowanceMinutes, 0, 0);
      
      return localCheckIn > expectedStartTime;
    } catch {
      return false;
    }
  }

  // Check if check-out is early (before working hours end)
  function isCheckOutEarly(checkOutTime: string | null, recordDate: string): boolean {
    if (!systemSettings || !checkOutTime) return false;
    
    try {
      const checkOutDate = new Date(checkOutTime);
      // Convert UTC stored time back to local time (UTC+3) for comparison
      const timezoneOffset = 3 * 60; // UTC+3 in minutes
      const localCheckOut = new Date(checkOutDate.getTime() + (timezoneOffset * 60 * 1000));
      
      const recordDateObj = new Date(recordDate);
      
      // Parse working hours end time
      const [hours, minutes] = systemSettings.workingHoursEnd.split(':');
      const expectedEndTime = new Date(recordDateObj);
      expectedEndTime.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      
      return localCheckOut < expectedEndTime;
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
  
  function calculateExpectedSalary() {
    if (!employee) return 0;
    // Count only paid days for salary calculation
    const paidDays = attendanceRecords.filter(record => record.isPaidDay !== false);
    const paidDaysCount = pagination ? 
      Math.round((paidDays.length / attendanceRecords.length) * pagination.totalCount) : 
      paidDays.length;
    return paidDaysCount * employee.dailyRate;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center items-center min-h-[300px]">
          <div className="text-center">
            <p>Loading employee attendance...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-500">
              <p>{error || 'Employee not found'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">{employee.name}&apos;s Attendance</h1>
          <p className="text-muted-foreground mt-1">{employee.position}</p>
        </div>
        <Button variant="outline" className="mt-4 md:mt-0">
          <Calendar className="mr-2 h-4 w-4" />
          Filter by Date
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Total Attendance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">
              {pagination ? pagination.totalCount : attendanceRecords.length} days
            </div>
            {pagination && (
              <div className="text-xs text-muted-foreground mt-1">
                Showing {pagination.startIndex} - {pagination.endIndex}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Paid Days
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold text-green-600">
              {attendanceRecords.filter(record => record.isPaidDay !== false).length} days
            </div>
            <div className="text-xs text-muted-foreground mt-1">
              Days eligible for salary
            </div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {pagination ? 'Hours (Current Page)' : 'Total Hours'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{monthlyTotal.toFixed(2)} hours</div>
            {pagination && (
              <div className="text-xs text-muted-foreground mt-1">
                Page {pagination.currentPage} of {pagination.totalPages}
              </div>
            )}
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expected Salary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">L.E {calculateExpectedSalary().toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-1">Based on paid days only</div>
          </CardContent>
        </Card>
      </div>
      
      {attendanceRecords.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-8">
            <div className="text-center">
              <p className="text-lg">No attendance records found for this employee.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardHeader className="border-b">
            <CardTitle>Attendance History</CardTitle>
            {pagination && (
              <div className="text-sm text-muted-foreground">
                Showing {pagination.startIndex} - {pagination.endIndex} of {pagination.totalCount} records
              </div>
            )}
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="h-12 px-6 text-left align-middle font-medium">Date</th>
                    <th className="h-12 px-6 text-left align-middle font-medium">Check In</th>
                    <th className="h-12 px-6 text-left align-middle font-medium">Check Out</th>
                    <th className="h-12 px-6 text-left align-middle font-medium">Hours</th>
                    <th className="h-12 px-6 text-left align-middle font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.map((record) => (
                    <tr key={record.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-6 py-4 font-medium">{formatDate(record.date)}</td>
                      <td className="px-6 py-4">
                        {formatTimeWithStyling(
                          record.checkIn,
                          isCheckInLate(record.checkIn, record.date),
                          false
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {formatTimeWithStyling(
                          record.checkOut,
                          false,
                          isCheckOutEarly(record.checkOut, record.date)
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {record.hoursWorked !== null 
                          ? `${record.hoursWorked.toFixed(2)}h` 
                          : 'N/A'}
                      </td>
                      <td className="px-6 py-4">
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
          </CardContent>
        </Card>
      )}
      
      {/* Pagination Controls */}
      {pagination && pagination.totalPages > 1 && (
        <div className="flex flex-col sm:flex-row justify-between items-center gap-4 mt-6">
          <div className="text-sm text-muted-foreground">
            Page {pagination.currentPage} of {pagination.totalPages} ({pagination.totalCount} total records)
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={!pagination.hasPrevPage || isLoading}
            >
              Previous
            </Button>
            
            {/* Page Numbers */}
            <div className="flex items-center gap-1">
              {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                let pageNum;
                if (pagination.totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= pagination.totalPages - 2) {
                  pageNum = pagination.totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }

                return (
                  <Button
                    key={pageNum}
                    variant={pageNum === currentPage ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePageChange(pageNum)}
                    disabled={isLoading}
                    className="w-8 h-8 p-0"
                  >
                    {pageNum}
                  </Button>
                );
              })}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={!pagination.hasNextPage || isLoading}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
} 