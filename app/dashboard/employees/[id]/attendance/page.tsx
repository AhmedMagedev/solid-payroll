'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar, ArrowLeft, CalendarX } from 'lucide-react';
import { formatEgyptTime } from '@/lib/timezone';
import { parseISO, format, startOfMonth, endOfMonth, eachDayOfInterval } from 'date-fns';
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';

interface Employee {
  id: number;
  name: string;
  email: string;
  position: string;
  hourlyRate: number;
}

interface AttendanceRecord {
  id: number;
  employeeId: number;
  date: string;
  checkIn: string;
  checkOut: string | null;
  hoursWorked: number | null;
  isPaidDay?: boolean;
  penalties?: Penalty[];
  // New penalty fields
  graceMinutesUsed?: number;
  lateMinutesBeyondGrace?: number;
  makeupTimeRequired?: number;
  makeupTimeCompleted?: number;
  totalPenaltyAmount?: number;
}

interface SystemSettings {
  id: number;
  workDaySunday: boolean;
  workDayMonday: boolean;
  workDayTuesday: boolean;
  workDayWednesday: boolean;
  workDayThursday: boolean;
  workDayFriday: boolean;
  workDaySaturday: boolean;
  workingHoursPerDay: number;
  lateAllowanceMinutes: number;
  workingHoursStart: string;
  workingHoursEnd: string;
}

interface Penalty {
  type: string;
  label: string;
  color: string;
}

interface AbsentDay {
  date: string;
  dayName: string;
  isWorkDay: boolean;
}

export default function EmployeeAttendancePage() {
  const params = useParams();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const monthsPerPage = 1;
  
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const employeeId = parseInt(id, 10);

  useEffect(() => {
    async function fetchData() {
      if (isNaN(employeeId)) {
        setError('Invalid employee ID');
        setIsLoading(false);
        return;
      }
      
      try {
        // Fetch employee data
        const employeeResponse = await fetch(`/api/employee/${employeeId}`, {
          credentials: 'include',
        });
        
        if (!employeeResponse.ok) {
          throw new Error('Failed to fetch employee');
        }
        
        const employeeData = await employeeResponse.json();
        setEmployee(employeeData);
        
        // Fetch attendance data
        const attendanceResponse = await fetch(`/api/attendance/employee/${employeeId}`, {
          credentials: 'include',
        });
        
        if (!attendanceResponse.ok) {
          throw new Error('Failed to fetch attendance data');
        }
        
        const attendanceData = await attendanceResponse.json();
        setAttendanceRecords(attendanceData);
        
        // Fetch system settings
        const settingsResponse = await fetch('/api/settings', {
          credentials: 'include',
        });
        
        if (settingsResponse.ok) {
          const settingsData = await settingsResponse.json();
          setSystemSettings(settingsData);
        }
      } catch (error) {
        console.error("Failed to fetch data:", error);
        setError('Could not load employee data');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [employeeId]);



  // Get absent days for a month
  const getAbsentDays = (monthKey: string, records: AttendanceRecord[]): AbsentDay[] => {
    if (!systemSettings) return [];
    
    try {
      const monthDate = parseISO(monthKey + '-01');
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      
      // Get all days in the month
      const allDays = eachDayOfInterval({ start, end });
      
      // Get attendance dates for this month
      const attendanceDates = new Set(records.map(record => record.date));
      
      // Map day of week to system settings
      const workDays = [
        systemSettings.workDaySunday,    // 0 = Sunday
        systemSettings.workDayMonday,    // 1 = Monday
        systemSettings.workDayTuesday,   // 2 = Tuesday
        systemSettings.workDayWednesday, // 3 = Wednesday
        systemSettings.workDayThursday,  // 4 = Thursday
        systemSettings.workDayFriday,    // 5 = Friday
        systemSettings.workDaySaturday   // 6 = Saturday
      ];
      
      // Find absent days
      const absentDays: AbsentDay[] = [];
      
      for (const day of allDays) {
        const dateString = format(day, 'yyyy-MM-dd');
        const dayOfWeek = day.getDay();
        const isWorkDay = workDays[dayOfWeek];
        
        // If it's a work day and employee didn't attend, mark as absent
        if (isWorkDay && !attendanceDates.has(dateString)) {
          absentDays.push({
            date: dateString,
            dayName: format(day, 'EEEE'),
            isWorkDay: true
          });
        }
      }
      
      return absentDays;
    } catch (e) {
      console.warn('[EmployeeAttendancePage] Error calculating absent days:', e);
      return [];
    }
  };

  // Group attendance by month
  const groupAttendanceByMonth = () => {
    const grouped: { [key: string]: AttendanceRecord[] } = {};
    
    attendanceRecords.forEach(record => {
      try {
        const date = parseISO(record.date);
        const monthKey = format(date, 'yyyy-MM');
        
        if (!grouped[monthKey]) {
          grouped[monthKey] = [];
        }
        grouped[monthKey].push(record);
      } catch (e) {
        console.warn('[EmployeeAttendancePage] Error grouping attendance record:', record, e);
      }
    });
    
    // Sort groups by month (newest first)
    const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    const sortedGrouped: { [key: string]: AttendanceRecord[] } = {};
    
    sortedKeys.forEach(key => {
      // Sort records within each month (oldest first for chronological order)
      sortedGrouped[key] = grouped[key].sort((a, b) => {
        try {
          return parseISO(a.date).getTime() - parseISO(b.date).getTime();
        } catch {
          return 0;
        }
      });
    });
    
    return sortedGrouped;
  };

  // Safe date formatting
  const safeFormatDate = (dateString: string | null | undefined, formatStr: string = 'MMM d, yyyy') => {
    if (!dateString) return 'Invalid Date';
    try {
      const date = parseISO(dateString);
      return format(date, formatStr);
    } catch {
      return 'Invalid Date';
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex justify-center items-center min-h-[400px]">
          <div className="text-center">
            <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent mb-4"></div>
            <p className="text-muted-foreground">Loading attendance data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Card>
          <CardContent className="p-8">
            <div className="text-center text-red-500">
              <p className="text-lg font-medium">{error || 'Employee not found'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const groupedAttendance = groupAttendanceByMonth();
  const monthEntries = Object.entries(groupedAttendance);
  const totalMonths = monthEntries.length;
  const totalPages = Math.ceil(totalMonths / monthsPerPage);
  const startIndex = (currentPage - 1) * monthsPerPage;
  const endIndex = startIndex + monthsPerPage;
  const currentMonthEntries = monthEntries.slice(startIndex, endIndex);

  // Calculate overall stats
  const totalRecords = attendanceRecords.length;
  const totalPaidDays = attendanceRecords.filter(record => record.isPaidDay !== false).length;
  const totalHours = attendanceRecords.reduce((sum, record) => sum + (record.hoursWorked || 0), 0);

  const AttendancePaginationComponent = () => (
    <div className="flex justify-center items-center space-x-4 py-4">
      <Pagination>
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious 
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (currentPage > 1) setCurrentPage(currentPage - 1);
              }}
              className={currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
          
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
            <PaginationItem key={page}>
              <PaginationLink
                href="#"
                onClick={(e) => {
                  e.preventDefault();
                  setCurrentPage(page);
                }}
                isActive={page === currentPage}
              >
                {page}
              </PaginationLink>
            </PaginationItem>
          ))}
          
          <PaginationItem>
            <PaginationNext 
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (currentPage < totalPages) setCurrentPage(currentPage + 1);
              }}
              className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
      
      <div className="text-sm text-muted-foreground">
        Month {startIndex + 1}-{Math.min(endIndex, totalMonths)} of {totalMonths}
      </div>
    </div>
  );

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header Section */}
      <div className="mb-6">
        <Button asChild variant="outline" size="sm" className="mb-4">
          <Link href={`/dashboard/employees/${employee.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Employee
          </Link>
        </Button>
        
        <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
                              <h1 className="text-2xl font-bold text-gray-900 mb-2">📅 {employee.name}&apos;s Attendance</h1>
              <div className="flex items-center flex-wrap gap-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span>Position:</span> 
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 font-medium">
                    {employee.position}
                  </Badge>
                </div>
                <span className="text-gray-400">•</span>
                <div className="flex items-center gap-2">
                  <span>Hourly Rate:</span> 
                  <Badge variant="secondary" className="bg-green-100 text-green-800 font-medium">
                    L.E {employee.hourlyRate.toFixed(2)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalRecords}</div>
            <p className="text-xs text-muted-foreground mt-1">attendance days</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Paid Days</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{totalPaidDays}</div>
            <p className="text-xs text-muted-foreground mt-1">eligible for salary</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">{totalHours.toFixed(1)}h</div>
            <p className="text-xs text-muted-foreground mt-1">worked overall</p>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Avg</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-purple-600">
              {totalMonths > 0 ? (totalRecords / totalMonths).toFixed(1) : '0'}
            </div>
            <p className="text-xs text-muted-foreground mt-1">days per month</p>
          </CardContent>
        </Card>
      </div>

      {/* Attendance Records */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        <div className="bg-slate-100 rounded-t-lg p-4 border-b border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                📊 Attendance Records by Month
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Showing {totalRecords} total records • Including absent days tracking
              </p>
            </div>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800">
              {totalMonths} months
            </Badge>
          </div>
        </div>
        
        <div className="p-6">
          {totalRecords > 0 ? (
            <div className="space-y-6">
              {/* Top Pagination */}
              {totalMonths > monthsPerPage && <AttendancePaginationComponent />}
              
              {/* Current Month Display */}
              <div className="space-y-6">
                {currentMonthEntries.map(([monthKey, records]) => {
                  const monthDate = parseISO(monthKey + '-01');
                  const monthName = format(monthDate, 'MMMM yyyy');
                  const absentDays = getAbsentDays(monthKey, records);
                  
                  return (
                    <div key={monthKey} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                      <div className="bg-slate-50 p-4 border-b border-slate-200">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-gray-900 flex items-center">
                            <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                            {monthName}
                          </h3>
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className="bg-white border-gray-300">
                              {records.length} attended
                            </Badge>
                            {absentDays.length > 0 && (
                              <Badge variant="outline" className="bg-gray-100 border-gray-300 text-gray-600">
                                {absentDays.length} absent
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>
                      
                      <div className="overflow-x-auto">
                        <table className="w-full">
                          <thead>
                            <tr className="bg-gray-50 border-b border-gray-200">
                              <th className="text-left px-4 py-3 font-semibold text-gray-700 text-sm">Date</th>
                              <th className="text-left px-4 py-3 font-semibold text-gray-700 text-sm">Check In</th>
                              <th className="text-left px-4 py-3 font-semibold text-gray-700 text-sm">Check Out</th>
                              <th className="text-left px-4 py-3 font-semibold text-gray-700 text-sm">Hours</th>
                              <th className="text-left px-4 py-3 font-semibold text-gray-700 text-sm">Penalties</th>
                              <th className="text-left px-4 py-3 font-semibold text-gray-700 text-sm">Penalty Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {/* Combine and sort all records chronologically */}
                            {(() => {
                              // Create combined array with type indicators
                              const attendanceItems = records.map(record => ({ type: 'attendance', data: record, date: record.date }));
                              const absentItems = absentDays.map(day => ({ type: 'absent', data: day, date: day.date }));
                              const allItems = [...attendanceItems, ...absentItems];
                              
                              // Sort all items by date chronologically (oldest first)
                              allItems.sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
                              
                              return allItems.map((item) => {
                                if (item.type === 'attendance') {
                                  const record = item.data as AttendanceRecord;
                                  
                                  return (
                                    <tr key={record.id} className="border-b border-gray-100 last:border-0 hover:bg-blue-50 transition-colors">
                                      <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                          <span className="font-semibold text-gray-900">{safeFormatDate(record.date, 'MMM d')}</span>
                                          <span className="text-xs text-gray-500">
                                            {safeFormatDate(record.date, 'EEEE')}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-700">
                                        {record.checkIn ? formatEgyptTime(record.checkIn, 'h:mm a') : 'N/A'}
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-700">
                                        {record.checkOut 
                                          ? formatEgyptTime(record.checkOut, 'h:mm a') 
                                          : '—'}
                                      </td>
                                      <td className="px-4 py-3">
                                        <span className={`font-semibold text-sm ${record.hoursWorked && record.hoursWorked >= 9 ? 'text-green-600' : record.hoursWorked && record.hoursWorked > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                                          {record.hoursWorked?.toFixed(1) || '0'}h
                                        </span>
                                      </td>
                                      <td className="px-4 py-3">
                                        <div className="flex flex-wrap gap-1">
                                          {record.penalties && record.penalties.length > 0 && (() => {
                                            // Check if there's an UNPAID DAY penalty
                                            const isUnpaidDayPenalty = (penalty: Penalty) => {
                                              const label = penalty.label?.toLowerCase() || '';
                                              return (
                                                label.includes('unpaid day') || 
                                                label.includes('whole day unpaid') ||
                                                (label.includes('missing') && label.includes('unpaid'))
                                              );
                                            };
                                            
                                            const hasUnpaidDayPenalty = record.penalties.some(isUnpaidDayPenalty);
                                            
                                            // If UNPAID DAY penalty exists, only show that one
                                            const penaltiesToShow = hasUnpaidDayPenalty 
                                              ? record.penalties.filter(isUnpaidDayPenalty)
                                              : record.penalties;
                                            
                                            return penaltiesToShow.map((penalty, index) => (
                                              <Badge key={index} variant="outline" className={penalty.color + ' text-xs'}>
                                                {penalty.label}
                                              </Badge>
                                            ));
                                          })()}
                                        </div>
                                      </td>
                                      <td className="px-4 py-3">
                                        {(record.totalPenaltyAmount || 0) > 0 && (
                                          <span className="font-semibold text-sm text-red-600">
                                            L.E {(record.totalPenaltyAmount || 0).toFixed(2)}
                                          </span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                } else {
                                  const absentDay = item.data as AbsentDay;
                                  
                                  return (
                                    <tr key={absentDay.date} className="border-b border-gray-100 last:border-0 bg-gray-50/70 hover:bg-gray-100 transition-colors">
                                      <td className="px-4 py-3">
                                        <div className="flex flex-col">
                                          <span className="font-semibold text-gray-600">{safeFormatDate(absentDay.date, 'MMM d')}</span>
                                          <span className="text-xs text-gray-500">
                                            {absentDay.dayName}
                                          </span>
                                        </div>
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-500">—</td>
                                      <td className="px-4 py-3 text-sm text-gray-500">—</td>
                                      <td className="px-4 py-3">
                                        <span className="font-semibold text-sm text-gray-600">0h</span>
                                      </td>
                                      <td className="px-4 py-3 text-sm text-gray-500">—</td>
                                      <td className="px-4 py-3 text-sm text-gray-500">—</td>
                                    </tr>
                                  );
                                }
                              });
                            })()}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Bottom Pagination */}
              {totalMonths > monthsPerPage && <AttendancePaginationComponent />}
            </div>
          ) : (
            <div className="text-center p-8 text-gray-500">
              <CalendarX className="h-16 w-16 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No attendance records found</h3>
              <p className="text-sm">No attendance data is available for this employee yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
} 