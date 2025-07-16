'use client';

import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Ban, ArrowLeft, User } from 'lucide-react';
import Link from 'next/link';

export default function EmployeePayoutsDisabledPage() {
  const params = useParams();
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      <div className="p-6 max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">مدفوعات الموظف</h1>
            <p className="text-gray-600 mt-1">إدارة مدفوعات الموظف المحدد</p>
          </div>
          <Link href={`/dashboard/employees/${id}`}>
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 ml-2" />
              العودة لملف الموظف
            </Button>
          </Link>
        </div>

        {/* Disabled Message */}
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-4">
              <div className="rounded-full bg-gray-100 p-6">
                <Ban className="h-12 w-12 text-gray-600" />
              </div>
            </div>
            <CardTitle className="text-2xl text-gray-900">
              وظيفة المدفوعات معطلة
            </CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <Alert>
              <Ban className="h-4 w-4" />
              <AlertDescription className="text-right">
                تم تعطيل وظيفة إدارة المدفوعات والرواتب مؤقتاً. لا يمكن عرض أو إدارة مدفوعات الموظفين في الوقت الحالي.
              </AlertDescription>
            </Alert>
            
            <div className="text-gray-600 space-y-2">
              <p>الوظائف المعطلة للموظف تشمل:</p>
              <ul className="list-disc list-inside text-right space-y-1">
                <li>عرض تاريخ المدفوعات</li>
                <li>إنشاء مدفوعات جديدة</li>
                <li>إدارة التعديلات</li>
                <li>تحديث حالة الدفع</li>
                <li>تقارير المدفوعات الفردية</li>
              </ul>
            </div>

            <div className="pt-4 space-y-3">
              <Link href={`/dashboard/employees/${id}`}>
                <Button className="w-full">
                  <User className="h-4 w-4 ml-2" />
                  عرض ملف الموظف
                </Button>
              </Link>
              <Link href="/dashboard/employees">
                <Button variant="outline" className="w-full">
                  العودة لقائمة الموظفين
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 