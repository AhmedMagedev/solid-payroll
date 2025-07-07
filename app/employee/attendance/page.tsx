'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Calendar,
  ArrowLeft,
  Search,
  Filter,
  CheckCircle,
  XCircle,
  AlertCircle,
  Timer
} from 'lucide-react';
import Link from 'next/link';

interface AttendanceRecord {
  id: number;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  hoursWorked: number | null;
  isPaidDay: boolean;
  actualHoursWorked: number;
  lateDeductionHours: number;
  earlyDeductionHours: number;
  checkInLocationVerified: boolean;
  checkOutLocationVerified: boolean;
}

export default function EmployeeAttendancePage() {
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const recordsPerPage = 10;
  const router = useRouter();

  useEffect(() => {
    fetchAttendanceRecords();
  }, [currentPage]);

  useEffect(() => {
    filterRecords();
  }, [records, searchTerm]);

  const fetchAttendanceRecords = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/employee/attendance?page=${currentPage}&limit=${recordsPerPage}`, {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setRecords(data.records);
        setTotalRecords(data.total);
      } else if (response.status === 401) {
        router.push('/employee/login');
      } else {
        setError('فشل في تحميل سجلات الحضور');
      }
    } catch (error) {
      console.error('Error fetching attendance records:', error);
      setError('فشل في تحميل سجلات الحضور');
    } finally {
      setIsLoading(false);
    }
  };

  const filterRecords = () => {
    if (!searchTerm) {
      setFilteredRecords(records);
      return;
    }

    const filtered = records.filter(record => 
      record.date.toLowerCase().includes(searchTerm.toLowerCase())
    );
    setFilteredRecords(filtered);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ar-SA', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatTime = (timeString: string | null) => {
    if (!timeString) return '-';
    return new Date(timeString).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = (record: AttendanceRecord) => {
    if (!record.checkIn) {
      return <Badge variant="secondary">غائب</Badge>;
    }
    if (!record.checkOut) {
      return <Badge variant="default" className="bg-yellow-100 text-yellow-800">غير مكتمل</Badge>;
    }
    if (!record.isPaidDay) {
      return <Badge variant="destructive">غير مدفوع</Badge>;
    }
    return <Badge variant="default" className="bg-green-100 text-green-800">مكتمل</Badge>;
  };

  const totalPages = Math.ceil(totalRecords / recordsPerPage);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-4 space-x-reverse">
              <Link href="/employee/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 ml-2" />
                  العودة للوحة التحكم
                </Button>
              </Link>
              <h1 className="text-xl font-semibold text-gray-900">سجل الحضور</h1>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Search and Filters */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Search className="h-5 w-5 ml-2" />
              البحث والتصفية
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1">
                <Input
                  placeholder="البحث بالتاريخ..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full"
                />
              </div>
              <Button variant="outline">
                <Filter className="h-4 w-4 ml-2" />
                المزيد من المرشحات
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Attendance Records */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center">
                <Calendar className="h-5 w-5 ml-2" />
                سجلات الحضور
              </div>
              <Badge variant="outline">
                {totalRecords} سجل إجمالي
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredRecords.length === 0 ? (
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد سجلات</h3>
                <p className="text-gray-600">
                  {searchTerm ? 'لا توجد سجلات تطابق معايير البحث.' : 'لا توجد سجلات حضور متاحة.'}
                </p>
              </div>
            ) : (
              <>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>التاريخ</TableHead>
                        <TableHead>وقت الحضور</TableHead>
                        <TableHead>وقت الانصراف</TableHead>
                        <TableHead>ساعات العمل</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>تحقق الموقع</TableHead>
                        <TableHead>الخصومات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredRecords.map((record) => (
                        <TableRow key={record.id}>
                          <TableCell className="font-medium">
                            {formatDate(record.date)}
                          </TableCell>
                          <TableCell>
                            {record.checkIn ? (
                              <div className="flex items-center">
                                <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
                                {formatTime(record.checkIn)}
                              </div>
                            ) : (
                              <div className="flex items-center">
                                <XCircle className="h-4 w-4 text-red-500 ml-2" />
                                -
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.checkOut ? (
                              <div className="flex items-center">
                                <CheckCircle className="h-4 w-4 text-green-500 ml-2" />
                                {formatTime(record.checkOut)}
                              </div>
                            ) : (
                              <div className="flex items-center">
                                <XCircle className="h-4 w-4 text-red-500 ml-2" />
                                -
                              </div>
                            )}
                          </TableCell>
                          <TableCell>
                            {record.hoursWorked ? (
                              <div className="flex items-center">
                                <Timer className="h-4 w-4 text-blue-500 ml-2" />
                                {record.hoursWorked.toFixed(2)} ساعة
                              </div>
                            ) : (
                              '-'
                            )}
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(record)}
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-1 space-x-reverse">
                              {record.checkInLocationVerified && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                  دخول ✓
                                </Badge>
                              )}
                              {record.checkOutLocationVerified && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700">
                                  خروج ✓
                                </Badge>
                              )}
                            </div>
                          </TableCell>
                          <TableCell>
                            {(record.lateDeductionHours > 0 || record.earlyDeductionHours > 0) ? (
                              <div className="text-xs space-y-1">
                                {record.lateDeductionHours > 0 && (
                                  <div className="text-red-600">
                                    تأخير: -{record.lateDeductionHours} ساعة
                                  </div>
                                )}
                                {record.earlyDeductionHours > 0 && (
                                  <div className="text-red-600">
                                    مغادرة مبكرة: -{record.earlyDeductionHours} ساعة
                                  </div>
                                )}
                              </div>
                            ) : (
                              <span className="text-green-600 text-xs">لا يوجد</span>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6">
                    <div className="text-sm text-gray-600">
                      عرض {((currentPage - 1) * recordsPerPage) + 1} إلى{' '}
                      {Math.min(currentPage * recordsPerPage, totalRecords)} من {totalRecords} سجل
                    </div>
                    <div className="flex space-x-2 space-x-reverse">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                        disabled={currentPage === 1}
                      >
                        السابق
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                        disabled={currentPage === totalPages}
                      >
                        التالي
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
} 