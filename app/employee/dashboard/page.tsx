'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Clock, 
  MapPin, 
  Calendar,
  LogOut,
  User,
  Timer,
  CheckCircle,
  XCircle,
  AlertCircle,
  Activity
} from 'lucide-react';
import Link from 'next/link';

interface Employee {
  id: number;
  name: string;
  email: string;
  position: string;
  department: string;
  profilePicture?: string;
}

interface AttendanceStatus {
  isCheckedIn: boolean;
  checkInTime?: string;
  checkOutTime?: string;
  totalHours?: number;
  status: 'checked-in' | 'checked-out' | 'not-started';
}

export default function EmployeeDashboard() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendanceStatus, setAttendanceStatus] = useState<AttendanceStatus>({
    isCheckedIn: false,
    status: 'not-started'
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [error, setError] = useState('');
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const router = useRouter();

  useEffect(() => {
    fetchEmployeeData();
    fetchTodayAttendance();
    requestLocation();
  }, []);

  const requestLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Location error:', error);
          setError('الوصول إلى الموقع مطلوب للحضور والانصراف. يرجى تفعيل خدمات الموقع.');
        }
      );
    } else {
      setError('متصفحك لا يدعم خدمات تحديد الموقع.');
    }
  };

  const fetchEmployeeData = async () => {
    try {
      const response = await fetch('/api/employee/profile', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setEmployee(data.employee);
      } else if (response.status === 401) {
        router.push('/employee/login');
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
      setError('فشل في تحميل بيانات الملف الشخصي');
    }
  };

  const fetchTodayAttendance = async () => {
    try {
      const response = await fetch('/api/employee/attendance/today', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        if (data.attendance) {
          setAttendanceStatus(data.attendance);
        } else {
          // Fallback to default state if no attendance data
          setAttendanceStatus({
            isCheckedIn: false,
            status: 'not-started'
          });
        }
      }
    } catch (error) {
      console.error('Error fetching attendance:', error);
      // Set default state on error
      setAttendanceStatus({
        isCheckedIn: false,
        status: 'not-started'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleCheckIn = async () => {
    if (!location) {
      setError('الموقع مطلوب للحضور. يرجى تفعيل خدمات الموقع.');
      return;
    }

    setIsCheckingIn(true);
    setError('');

    try {
      const response = await fetch('/api/employee/attendance/checkin', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: new Date().toISOString(),
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        if (data.attendance) {
          setAttendanceStatus(data.attendance);
        }
        setError('');
      } else {
        setError(data.error || 'فشل في تسجيل الحضور');
      }
         } catch {
       setError('حدث خطأ أثناء تسجيل الحضور');
     } finally {
      setIsCheckingIn(false);
    }
  };

  const handleCheckOut = async () => {
    if (!location) {
      setError('الموقع مطلوب للانصراف. يرجى تفعيل خدمات الموقع.');
      return;
    }

    setIsCheckingIn(true);
    setError('');

    try {
      const response = await fetch('/api/employee/attendance/checkout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: location.latitude,
          longitude: location.longitude,
          timestamp: new Date().toISOString(),
        }),
        credentials: 'include',
      });

      const data = await response.json();

      if (response.ok) {
        if (data.attendance) {
          setAttendanceStatus(data.attendance);
        }
        setError('');
      } else {
        setError(data.error || 'فشل في تسجيل الانصراف');
      }
         } catch {
       setError('حدث خطأ أثناء تسجيل الانصراف');
     } finally {
      setIsCheckingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch('/api/employee/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
      router.push('/employee/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  };

  const formatTime = (timeString: string) => {
    return new Date(timeString).toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getCurrentTime = () => {
    return new Date().toLocaleTimeString('ar-SA', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

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
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">بوابة الموظفين</h1>
            </div>
            <div className="flex items-center space-x-4 space-x-reverse">
              {employee && (
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={employee.profilePicture} />
                    <AvatarFallback>
                      {employee.name.split(' ').map(n => n[0]).join('')}
                    </AvatarFallback>
                  </Avatar>
                  <span className="text-sm font-medium text-gray-700">{employee.name}</span>
                </div>
              )}
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 ml-2" />
                تسجيل الخروج
              </Button>
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

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 ml-2" />
                الملف الشخصي
              </CardTitle>
            </CardHeader>
            <CardContent>
              {employee && (
                <div className="space-y-4">
                  <div className="flex items-center space-x-4 space-x-reverse">
                    <Avatar className="h-16 w-16">
                      <AvatarImage src={employee.profilePicture} />
                      <AvatarFallback className="text-lg">
                        {employee.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <h3 className="font-semibold text-lg">{employee.name}</h3>
                      <p className="text-gray-600">{employee.position}</p>
                      <p className="text-sm text-gray-500">{employee.department}</p>
                    </div>
                  </div>
                  <div className="pt-4 border-t">
                    <Link href="/employee/profile">
                      <Button variant="outline" className="w-full">
                        عرض الملف الشخصي الكامل
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Check-in/out Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Clock className="h-5 w-5 ml-2" />
                حضور اليوم
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-center">
                <div className="text-2xl font-mono font-bold text-gray-900">
                  {getCurrentTime()}
                </div>
                <div className="text-sm text-gray-500">
                  {new Date().toLocaleDateString('ar-SA', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })}
                </div>
              </div>

              <div className="space-y-2">
                {attendanceStatus.checkInTime && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">وقت الحضور:</span>
                    <Badge variant="default" className="bg-green-100 text-green-800">
                      <CheckCircle className="h-3 w-3 ml-1" />
                      {formatTime(attendanceStatus.checkInTime)}
                    </Badge>
                  </div>
                )}
                
                {attendanceStatus.checkOutTime && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">وقت الانصراف:</span>
                    <Badge variant="default" className="bg-blue-100 text-blue-800">
                      <XCircle className="h-3 w-3 ml-1" />
                      {formatTime(attendanceStatus.checkOutTime)}
                    </Badge>
                  </div>
                )}

                {attendanceStatus.totalHours && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">إجمالي الساعات:</span>
                    <Badge variant="outline">
                      <Timer className="h-3 w-3 ml-1" />
                      {attendanceStatus.totalHours.toFixed(2)} ساعة
                    </Badge>
                  </div>
                )}
              </div>

              <div className="pt-4">
                {!attendanceStatus.isCheckedIn ? (
                  <Button 
                    onClick={handleCheckIn} 
                    disabled={isCheckingIn || !location}
                    className="w-full bg-green-600 hover:bg-green-700"
                  >
                    {isCheckingIn ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2" />
                        جاري تسجيل الحضور...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 ml-2" />
                        تسجيل الحضور
                      </div>
                    )}
                  </Button>
                ) : (
                  <Button 
                    onClick={handleCheckOut} 
                    disabled={isCheckingIn || !location}
                    className="w-full bg-red-600 hover:bg-red-700"
                  >
                    {isCheckingIn ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2" />
                        جاري تسجيل الانصراف...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <MapPin className="h-4 w-4 ml-2" />
                        تسجيل الانصراف
                      </div>
                    )}
                  </Button>
                )}
              </div>

              {!location && (
                <div className="text-center">
                  <Button variant="outline" size="sm" onClick={requestLocation}>
                    <MapPin className="h-4 w-4 ml-2" />
                    تفعيل الموقع
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="h-5 w-5 ml-2" />
                إجراءات سريعة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Link href="/employee/attendance">
                <Button variant="outline" className="w-full justify-start">
                  <Calendar className="h-4 w-4 ml-2" />
                  عرض سجل الحضور
                </Button>
              </Link>
              <Link href="/employee/profile">
                <Button variant="outline" className="w-full justify-start">
                  <User className="h-4 w-4 ml-2" />
                  إدارة الملف الشخصي
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
} 