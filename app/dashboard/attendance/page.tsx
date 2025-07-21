'use client';

import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, AlertCircle, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatEgyptTime, getNowInEgypt } from '@/lib/timezone';
import { parseISO, format } from 'date-fns';
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

export default function AttendancePage() {
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [pagination, setPagination] = useState<PaginationInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [refreshResult, setRefreshResult] = useState<string | null>(null);
  const [isHydrated, setIsHydrated] = useState(false);

  // Hydration effect
  useEffect(() => {
    console.log('[Attendance Page] Component mounting/hydrating');
    setIsHydrated(true);
    console.log('[Attendance Page] Hydration complete');
  }, []);

  const fetchAttendance = useCallback(async (page: number, search: string) => {
    try {
      console.log('[Attendance Page] Fetching attendance data:', {
        page,
        search,
        isHydrated,
        timestamp: new Date().toISOString()
      });
      
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
        console.error('[Attendance Page] Fetch failed:', response.status, response.statusText);
        throw new Error('Failed to fetch attendance data');
      }
      
      const data: AttendanceResponse = await response.json();
      console.log('[Attendance Page] Data received:', {
        recordCount: data.data.length,
        pagination: data.pagination,
        firstRecord: data.data[0],
        isHydrated
      });
      
      setAttendanceData(data.data);
      setPagination(data.pagination);
      setError(null);
    } catch (err) {
      console.error('[Attendance Page] Error fetching attendance:', err);
      setError('خطأ في تحميل بيانات الحضور. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsLoading(false);
    }
  }, [isHydrated]);

  useEffect(() => {
    fetchAttendance(currentPage, searchTerm);
  }, [currentPage, searchTerm, fetchAttendance]);

  // Auto-refresh by periodically fetching fresh data
  useEffect(() => {
    if (!isHydrated) return;

    const autoRefresh = async () => {
      try {
        console.log('[Attendance Page] Auto-refresh check...');
        
        const token = localStorage.getItem('auth_token');
        if (!token) return;

        // Get fresh attendance data
        const headers: HeadersInit = {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        };

        const response = await fetch(`/api/attendance?page=${currentPage}&limit=20${searchTerm ? `&search=${encodeURIComponent(searchTerm)}` : ''}`, {
          headers,
          credentials: 'include'
        });

        if (response.ok) {
          const freshData = await response.json();
          
          // Compare with current data to see if there are changes
          const currentDataString = JSON.stringify(attendanceData);
          const freshDataString = JSON.stringify(freshData.data);
          
          if (currentDataString !== freshDataString && attendanceData.length > 0) {
            console.log('[Attendance Page] New data detected, updating UI...');
            
            // Update the data
            setAttendanceData(freshData.data);
            setPagination(freshData.pagination);
            
            // Show notification
            setRefreshResult('🔄 تم تحديث البيانات تلقائياً');
            setTimeout(() => setRefreshResult(null), 5000);
          } else if (attendanceData.length === 0) {
            // First load, just set the data
            setAttendanceData(freshData.data);
            setPagination(freshData.pagination);
          }
        }
      } catch (error) {
        console.error('[Attendance Page] Auto-refresh error:', error);
      }
    };

    // Auto-refresh every 30 seconds
    const interval = setInterval(autoRefresh, 30000);
    
    return () => clearInterval(interval);
  }, [isHydrated, currentPage, searchTerm, attendanceData]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchAttendance(1, searchTerm);
  };

  const handlePageChange = (newPage: number) => {
    setCurrentPage(newPage);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handlePullAttendanceData = async () => {
    console.log('[Attendance Page] Manual pull triggered by user');
    setIsRefreshing(true);
    setRefreshResult(null);
    setError(null);

    try {
      // Use a date range to ensure we get today's logs
      // Pull from 7 days ago to tomorrow (to account for any timezone issues)
      const todayEgypt = getNowInEgypt();
      
      // Start from 7 days ago at midnight
      const startDate = new Date(todayEgypt.getFullYear(), todayEgypt.getMonth(), todayEgypt.getDate() - 7, 0, 0, 0);
      // End tomorrow at 23:59:59 to ensure we capture today's logs regardless of timezone
      const endDate = new Date(todayEgypt.getFullYear(), todayEgypt.getMonth(), todayEgypt.getDate() + 1, 23, 59, 59);
      
      console.log('[Attendance Page] Pulling attendance data:', {
        egyptTime: todayEgypt.toISOString(),
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        dateRange: `${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
        isHydrated,
        timestamp: new Date().toISOString()
      });
      
      const response = await fetch('/api/attendance?forceRefresh=true', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        setRefreshResult('تم سحب وتحديث البيانات بنجاح!');
        
        // Refresh the attendance data by calling fetchAttendance
        fetchAttendance(currentPage, searchTerm);
        
        // Clear success message after 5 seconds
        setTimeout(() => setRefreshResult(null), 5000);
      } else {
        setError(data.error || 'فشل في سحب بيانات الحضور من الجهاز');
      }
    } catch (err) {
      setError('خطأ في الاتصال بجهاز البصمة. يرجى المحاولة مرة أخرى.');
      console.error('Error pulling attendance data:', err);
    } finally {
      setIsRefreshing(false);
    }
  };

  const formatDate = (dateString: string) => {
    try {
      console.log('[Attendance Page] Formatting date:', { 
        input: dateString, 
        isServer: typeof window === 'undefined',
        userAgent: typeof window !== 'undefined' ? window.navigator.userAgent : 'server'
      });
      
      // Use a more consistent date formatting approach
      const date = parseISO(dateString);
      if (isNaN(date.getTime())) {
        console.warn('[Attendance Page] Invalid date parsed:', dateString);
        return 'تاريخ غير صالح';
      }
      
      // Use a simple, consistent format that works the same on server and client
      const formatted = format(date, 'yyyy-MM-dd');
      console.log('[Attendance Page] Date formatted:', { input: dateString, output: formatted });
      return formatted;
    } catch (error) {
      console.error('[Attendance Page] Date formatting error:', error, 'for date:', dateString);
      return 'تاريخ غير صالح';
    }
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
          عرض {pagination.startIndex} إلى {pagination.endIndex} من {pagination.totalCount} نتيجة
        </div>
        <div className="flex items-center space-x-2 space-x-reverse">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={!pagination.hasPrevPage}
          >
            <ChevronRight className="h-4 w-4" />
            السابق
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
            التالي
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  };

  // Log environment info
  console.log('[Attendance Page] Render environment:', {
    isServer: typeof window === 'undefined',
    isHydrated,
    hasAttendanceData: attendanceData.length > 0,
    isLoading,
    error: !!error,
    timestamp: new Date().toISOString()
  });

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">سجلات الحضور</h1>
          <p className="text-muted-foreground mt-1">عرض وإدارة بيانات حضور الموظفين</p>
        </div>
        <Button 
          onClick={handlePullAttendanceData} 
          disabled={isRefreshing}
          className="w-full md:w-auto"
        >
          <RefreshCw className={`h-4 w-4 ml-2 ${isRefreshing ? 'animate-spin' : ''}`} />
          {isRefreshing ? 'جاري السحب...' : 'سحب بيانات الحضور'}
        </Button>
      </div>

      {/* Search Bar */}
      <Card className="mb-6">
        <CardContent className="p-4">
          <form onSubmit={handleSearch} className="flex gap-4">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                type="text"
                placeholder="البحث باسم الموظف..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-10 text-right"
              />
            </div>
            <Button type="submit" disabled={isLoading}>
              بحث
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
                مسح
              </Button>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Error Message */}
      {error && (
        <Card className="mb-6 border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-red-700">
              <AlertCircle className="h-4 w-4" />
              <span>{error}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success Message */}
      {refreshResult && (
        <Card className="mb-6 border-green-200 bg-green-50">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 text-green-700">
              <RefreshCw className="h-4 w-4" />
              <span>{refreshResult}</span>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Attendance Table */}
      <Card>
        <CardHeader>
          <CardTitle>بيانات الحضور والانصراف</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="text-muted-foreground">جاري تحميل بيانات الحضور...</div>
            </div>
          ) : attendanceData.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <AlertCircle className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">لا توجد سجلات حضور</p>
              <p className="text-sm">
                {searchTerm 
                  ? `لم يتم العثور على نتائج لـ "${searchTerm}"`
                  : 'لم يتم العثور على سجلات حضور. ارفع ملف الحضور للبدء.'
                }
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">اسم الموظف</TableHead>
                    <TableHead className="text-right">التاريخ</TableHead>
                    <TableHead className="text-right">وقت الدخول</TableHead>
                    <TableHead className="text-right">وقت الخروج</TableHead>
                    <TableHead className="text-right">ساعات العمل</TableHead>
                    <TableHead className="text-right">حالة الدفع</TableHead>
                    <TableHead className="text-center">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {attendanceData.map((record) => (
                    <TableRow key={record.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium text-right">
                        <Link 
                          href={`/dashboard/employees/${record.employee.id}`}
                          className="text-primary hover:underline"
                        >
                          {record.employee.name}
                        </Link>
                      </TableCell>
                      <TableCell className="text-right">
                        {isHydrated ? formatDate(record.date) : record.date}
                      </TableCell>
                      <TableCell className="text-right">
                        {isHydrated && record.checkIn 
                          ? formatEgyptTime(record.checkIn)
                          : record.checkIn 
                            ? record.checkIn 
                            : <span className="text-muted-foreground">غير مسجل</span>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        {isHydrated && record.checkOut 
                          ? formatEgyptTime(record.checkOut)
                          : record.checkOut 
                            ? record.checkOut
                            : <span className="text-muted-foreground">غير مسجل</span>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        {record.hoursWorked 
                          ? `${record.hoursWorked.toFixed(2)} ساعة`
                          : <span className="text-muted-foreground">غير محسوب</span>
                        }
                      </TableCell>
                      <TableCell className="text-right">
                        <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                          record.isPaidDay 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {record.isPaidDay ? 'مدفوع' : 'غير مدفوع'}
                        </span>
                      </TableCell>
                      <TableCell className="text-center">
                        <Link href={`/dashboard/employees/${record.employee.id}/attendance`}>
                          <Button variant="ghost" size="sm" className="text-xs">
                            عرض التفاصيل
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
          
          <PaginationControls />
        </CardContent>
      </Card>
    </div>
  );
} 