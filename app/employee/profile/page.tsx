'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  User,
  ArrowLeft,
  Edit,
  Save,
  X,
  Phone,
  Mail,

  Calendar,
  Building,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import Link from 'next/link';

interface Employee {
  id: number;
  name: string;
  email: string;
  position: string;
  department: string;
  phone: string;
  profilePicture?: string;
  canWorkRemotely: boolean;
  allowedWorkLocations: string[];
  preferredLanguage: string;
  timezone: string;
  emailNotifications: boolean;
  lastLoginAt?: string;
  lastActiveAt?: string;
}

export default function EmployeeProfilePage() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editForm, setEditForm] = useState<Partial<Employee>>({});
  const router = useRouter();

  useEffect(() => {
    fetchEmployeeData();
  }, []);

  const fetchEmployeeData = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/employee/profile', {
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setEmployee(data.employee);
        setEditForm(data.employee);
      } else if (response.status === 401) {
        router.push('/employee/login');
      } else {
        setError('فشل في تحميل بيانات الملف الشخصي');
      }
    } catch (error) {
      console.error('Error fetching employee data:', error);
      setError('فشل في تحميل بيانات الملف الشخصي');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    setIsEditing(true);
    setError('');
    setSuccess('');
  };

  const handleCancel = () => {
    setIsEditing(false);
    setEditForm(employee || {});
    setError('');
    setSuccess('');
  };

  const handleSave = async () => {
    if (!editForm.name || !editForm.phone) {
      setError('الاسم ورقم الهاتف مطلوبان');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      const response = await fetch('/api/employee/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: editForm.name,
          phone: editForm.phone,
          preferredLanguage: editForm.preferredLanguage,
          timezone: editForm.timezone,
          emailNotifications: editForm.emailNotifications,
        }),
        credentials: 'include',
      });

      if (response.ok) {
        const data = await response.json();
        setEmployee(data.employee);
        setIsEditing(false);
        setSuccess('تم تحديث الملف الشخصي بنجاح');
      } else {
        const data = await response.json();
        setError(data.error || 'فشل في تحديث الملف الشخصي');
      }
         } catch {
       setError('حدث خطأ أثناء تحديث الملف الشخصي');
    } finally {
      setIsSaving(false);
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return 'أبداً';
    return new Date(dateString).toLocaleString('ar-SA', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="min-h-screen flex items-center justify-center" dir="rtl">
        <Card>
          <CardContent className="p-6">
            <p className="text-gray-600">فشل في تحميل بيانات الملف الشخصي</p>
          </CardContent>
        </Card>
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
              <h1 className="text-xl font-semibold text-gray-900">ملفي الشخصي</h1>
            </div>
            <div className="flex items-center space-x-2 space-x-reverse">
              {!isEditing ? (
                <Button onClick={handleEdit}>
                  <Edit className="h-4 w-4 ml-2" />
                  تعديل الملف الشخصي
                </Button>
              ) : (
                <>
                  <Button variant="outline" onClick={handleCancel}>
                    <X className="h-4 w-4 ml-2" />
                    إلغاء
                  </Button>
                  <Button onClick={handleSave} disabled={isSaving}>
                    {isSaving ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white ml-2" />
                        حفظ...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <Save className="h-4 w-4 ml-2" />
                        حفظ التغييرات
                      </div>
                    )}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {error && (
          <Alert variant="destructive" className="mb-6">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {success && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">{success}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Picture and Basic Info */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <User className="h-5 w-5 ml-2" />
                الصورة الشخصية
              </CardTitle>
            </CardHeader>
            <CardContent className="text-center">
              <Avatar className="h-32 w-32 mx-auto mb-4">
                <AvatarImage src={employee.profilePicture} />
                <AvatarFallback className="text-2xl">
                  {employee.name.split(' ').map(n => n[0]).join('')}
                </AvatarFallback>
              </Avatar>
              <h2 className="text-2xl font-bold text-gray-900 mb-2">{employee.name}</h2>
              <p className="text-gray-600 mb-1">{employee.position}</p>
              <p className="text-sm text-gray-500">{employee.department}</p>
              <div className="mt-4">
                <Badge variant="outline" className="bg-green-50 text-green-700">
                  موظف نشط
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Contact Information */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Mail className="h-5 w-5 ml-2" />
                معلومات التواصل والبيانات الشخصية
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Name */}
                <div>
                  <Label htmlFor="name">الاسم الكامل</Label>
                  {isEditing ? (
                    <Input
                      id="name"
                      value={editForm.name || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, name: e.target.value }))}
                      className="mt-1"
                    />
                  ) : (
                    <div className="mt-1 text-sm text-gray-900">{employee.name}</div>
                  )}
                </div>

                {/* Email (Read-only) */}
                <div>
                  <Label htmlFor="email">عنوان البريد الإلكتروني</Label>
                  <div className="mt-1 flex items-center text-sm text-gray-600">
                    <Mail className="h-4 w-4 ml-2" />
                    {employee.email}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">لا يمكن تغيير البريد الإلكتروني</p>
                </div>

                {/* Phone */}
                <div>
                  <Label htmlFor="phone">رقم الهاتف</Label>
                  {isEditing ? (
                    <Input
                      id="phone"
                      value={editForm.phone || ''}
                      onChange={(e) => setEditForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="mt-1"
                    />
                  ) : (
                    <div className="mt-1 flex items-center text-sm text-gray-900">
                      <Phone className="h-4 w-4 ml-2" />
                      {employee.phone}
                    </div>
                  )}
                </div>

                {/* Position (Read-only) */}
                <div>
                  <Label htmlFor="position">المنصب</Label>
                  <div className="mt-1 flex items-center text-sm text-gray-600">
                    <Building className="h-4 w-4 ml-2" />
                    {employee.position}
                  </div>
                </div>

                {/* Preferred Language */}
                <div>
                  <Label htmlFor="language">اللغة المفضلة</Label>
                  {isEditing ? (
                    <select
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={editForm.preferredLanguage || 'ar'}
                      onChange={(e) => setEditForm(prev => ({ ...prev, preferredLanguage: e.target.value }))}
                    >
                      <option value="ar">العربية</option>
                      <option value="en">الإنجليزية</option>
                      <option value="es">الإسبانية</option>
                      <option value="fr">الفرنسية</option>
                    </select>
                  ) : (
                    <div className="mt-1 text-sm text-gray-900">
                      {employee.preferredLanguage === 'ar' ? 'العربية' : 
                       employee.preferredLanguage === 'en' ? 'الإنجليزية' :
                       employee.preferredLanguage === 'es' ? 'الإسبانية' :
                       employee.preferredLanguage === 'fr' ? 'الفرنسية' : 'العربية'}
                    </div>
                  )}
                </div>

                {/* Timezone */}
                <div>
                  <Label htmlFor="timezone">المنطقة الزمنية</Label>
                  {isEditing ? (
                    <select
                      className="mt-1 block w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={editForm.timezone || 'UTC'}
                      onChange={(e) => setEditForm(prev => ({ ...prev, timezone: e.target.value }))}
                    >
                      <option value="UTC">التوقيت العالمي الموحد</option>
                      <option value="America/New_York">التوقيت الشرقي</option>
                      <option value="America/Chicago">التوقيت المركزي</option>
                      <option value="America/Denver">توقيت الجبال</option>
                      <option value="America/Los_Angeles">توقيت المحيط الهادئ</option>
                      <option value="Europe/London">لندن</option>
                      <option value="Europe/Paris">باريس</option>
                      <option value="Asia/Dubai">دبي</option>
                    </select>
                  ) : (
                    <div className="mt-1 text-sm text-gray-900">{employee.timezone}</div>
                  )}
                </div>
              </div>

              {/* Work Settings */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">إعدادات العمل</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="remoteWork">العمل عن بُعد مُفعل</Label>
                      <p className="text-sm text-gray-600">يمكن العمل من مواقع أخرى غير المكتب</p>
                    </div>
                    <Badge variant={employee.canWorkRemotely ? 'default' : 'secondary'}>
                      {employee.canWorkRemotely ? 'مُفعل' : 'معطل'}
                    </Badge>
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <Label htmlFor="emailNotifications">إشعارات البريد الإلكتروني</Label>
                      <p className="text-sm text-gray-600">استقبال إشعارات بريد إلكتروني للتحديثات المهمة</p>
                    </div>
                    {isEditing ? (
                      <Switch
                        checked={editForm.emailNotifications || false}
                        onCheckedChange={(checked) => setEditForm(prev => ({ ...prev, emailNotifications: checked }))}
                      />
                    ) : (
                      <Badge variant={employee.emailNotifications ? 'default' : 'secondary'}>
                        {employee.emailNotifications ? 'مُفعل' : 'معطل'}
                      </Badge>
                    )}
                  </div>
                </div>
              </div>

              {/* Account Activity */}
              <div className="border-t pt-6">
                <h3 className="text-lg font-medium text-gray-900 mb-4">نشاط الحساب</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <Label>آخر تسجيل دخول</Label>
                    <div className="mt-1 flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 ml-2" />
                      {formatDate(employee.lastLoginAt)}
                    </div>
                  </div>
                  <div>
                    <Label>آخر نشاط</Label>
                    <div className="mt-1 flex items-center text-sm text-gray-600">
                      <Calendar className="h-4 w-4 ml-2" />
                      {formatDate(employee.lastActiveAt)}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
} 