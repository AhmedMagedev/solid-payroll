'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, DollarSign, Calendar, Mail, Hash, CreditCard, Phone, Fingerprint } from 'lucide-react';
import EmployeeActions from './employee-actions';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatEgyptTime } from '@/lib/timezone';

interface Employee {
  id: number;
  name: string;
  email: string;
  position: string;
  phone?: string; // Optional phone number
  fingerprintId?: string; // For mapping to attendance device IDs
  hourlyRate: number;
  paymentBasis?: string; // Make it optional since older records might not have it
  createdAt: string;
  updatedAt: string;
}

export default function EmployeeProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const employeeId = parseInt(id, 10);

  useEffect(() => {
    // Check if user is admin from localStorage token
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        setIsAdmin(payload.isAdmin || false);
      } catch (error) {
        console.error('Error parsing token:', error);
        setIsAdmin(false);
      }
    }

    async function fetchEmployee() {
      if (isNaN(employeeId)) {
        setError('رقم الموظف غير صالح');
        setIsLoading(false);
        return;
      }
      
      try {
        const response = await fetch(`/api/employee/${employeeId}`, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch employee');
        }
        
        const data = await response.json();
        setEmployee(data);
      } catch (error) {
        console.error("Failed to fetch employee:", error);
        setError('لا يمكن تحميل بيانات الموظف');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchEmployee();
  }, [employeeId]);

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex justify-center items-center min-h-[300px]">
          <div className="text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
            <p className="mt-2 text-muted-foreground">جاري تحميل بيانات الموظف...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Card className="mx-auto max-w-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-destructive">خطأ</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/employees">العودة إلى الموظفين</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isNaN(employeeId)) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Card className="mx-auto max-w-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-destructive">رقم موظف غير صالح</CardTitle>
          </CardHeader>
          <CardContent>
            <p>رقم الموظف المقدم غير صالح.</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/employees">العودة إلى الموظفين</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Card className="mx-auto max-w-2xl shadow-sm">
          <CardHeader>
            <CardTitle>الموظف غير موجود</CardTitle>
          </CardHeader>
          <CardContent>
            <p>عذراً، لم نتمكن من العثور على موظف برقم: {employeeId}.</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/employees">العودة إلى الموظفين</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <Button asChild variant="outline" size="sm">
          <Link href="/dashboard/employees">
            <ArrowLeft className="ml-2 h-4 w-4" />
            العودة إلى الموظفين
          </Link>
        </Button>
        <EmployeeActions employeeId={employee.id} />
      </div>

      <Card className="mx-auto shadow-sm overflow-hidden">
        <CardHeader className="text-center pt-10 pb-6 bg-muted/20">
          <div className="flex justify-center mb-4">
            <Avatar className="h-24 w-24 text-3xl border-4 border-background shadow-md">
              <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
            </Avatar>
          </div>
          <CardTitle className="text-2xl font-bold">{employee.name}</CardTitle>
          <CardDescription className="text-md mt-1">{employee.position}</CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-6">
          <div className="border-t pt-6">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 md:grid-cols-3">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-muted-foreground flex items-center">
                  <Hash className="h-4 w-4 ml-2" />
                  <span>رقم الموظف</span>
                </dt>
                <dd className="mt-1 text-base font-medium text-left">{employee.id}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-muted-foreground flex items-center">
                  <Mail className="h-4 w-4 ml-2" />
                  <span>البريد الإلكتروني</span>
                </dt>
                <dd className="mt-1 text-base truncate text-left">{employee.email}</dd>
              </div>
              {employee.phone && (
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-muted-foreground flex items-center">
                    <Phone className="h-4 w-4 ml-2" />
                    <span>الهاتف</span>
                  </dt>
                  <dd className="mt-1 text-base text-left">{employee.phone}</dd>
                </div>
              )}
              {employee.fingerprintId ? (
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-muted-foreground flex items-center">
                    <Fingerprint className="h-4 w-4 ml-2" />
                    <span>رقم الجهاز</span>
                  </dt>
                  <dd className="mt-1 text-base font-mono text-left">{employee.fingerprintId}</dd>
                </div>
              ) : (
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-muted-foreground flex items-center">
                    <Fingerprint className="h-4 w-4 ml-2" />
                    <span>رقم الجهاز</span>
                  </dt>
                  <dd className="mt-1 text-base text-orange-600 italic text-left">غير محدد - مطلوب لربط الحضور</dd>
                </div>
              )}
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-muted-foreground flex items-center">
                  <Calendar className="h-4 w-4 ml-2" />
                  <span>تاريخ الانضمام</span>
                </dt>
                <dd className="mt-1 text-base text-left">{employee.createdAt ? formatEgyptTime(employee.createdAt, 'MMM d, yyyy') : 'غير متوفر'}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-muted-foreground flex items-center">
                  <DollarSign className="h-4 w-4 ml-2" />
                  <span>الأجر بالساعة</span>
                </dt>
                <dd className="mt-1 text-base font-medium text-left">{employee.hourlyRate.toFixed(2)} ج.م</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-muted-foreground flex items-center">
                  <CreditCard className="h-4 w-4 ml-2" />
                  <span>أساس الدفع</span>
                </dt>
                <dd className="mt-1 text-base font-medium text-left">{employee.paymentBasis === 'Monthly' ? 'شهري' : employee.paymentBasis || 'شهري'}</dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0 mt-8 sm:space-x-reverse">
            <Button 
              className="sm:flex-1" 
              onClick={() => router.push(`/dashboard/employees/${employee.id}/edit`)}
            >
              تعديل الملف الشخصي
            </Button>
            <Button 
              variant="outline" 
              className="sm:flex-1"
              onClick={() => router.push(`/dashboard/employees/${employee.id}/attendance`)}
            >
              عرض الحضور
            </Button>
            {isAdmin && (
              <Button 
                variant="outline" 
                className="sm:flex-1"
                onClick={() => router.push(`/dashboard/employees/${employee.id}/payouts`)}
              >
                المدفوعات
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 