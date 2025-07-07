'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Clock, Calendar, DollarSign, AlertTriangle, CheckCircle, XCircle, Users, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface SystemSettings {
  id: number;
  lateAllowanceMinutes: number;
  workDaySunday: boolean;
  workDayMonday: boolean;
  workDayTuesday: boolean;
  workDayWednesday: boolean;
  workDayThursday: boolean;
  workDayFriday: boolean;
  workDaySaturday: boolean;
  workingHoursPerDay: number;
  workingHoursStart: string;
  workingHoursEnd: string;
  overtimeMultiplier: number;
  weekendOvertimeMultiplier: number;
}

export default function RulesAndPoliciesPage() {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/settings', {
          credentials: 'include',
        });
        if (response.ok) {
          const data = await response.json();
          setSettings(data);
        }
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchSettings();
  }, []);

  const getWorkDays = () => {
    if (!settings) return [];
    const days = [
      { day: 'Sunday', enabled: settings.workDaySunday, arabic: 'الأحد' },
      { day: 'Monday', enabled: settings.workDayMonday, arabic: 'الاثنين' },
      { day: 'Tuesday', enabled: settings.workDayTuesday, arabic: 'الثلاثاء' },
      { day: 'Wednesday', enabled: settings.workDayWednesday, arabic: 'الأربعاء' },
      { day: 'Thursday', enabled: settings.workDayThursday, arabic: 'الخميس' },
      { day: 'Friday', enabled: settings.workDayFriday, arabic: 'الجمعة' },
      { day: 'Saturday', enabled: settings.workDaySaturday, arabic: 'السبت' },
    ];
    return days;
  };

  if (isLoading) {
    return (
      <div className="p-6 max-w-7xl mx-auto">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="grid gap-6">
            {Array(4).fill(0).map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">القواعد والسياسات</h1>
          <p className="text-muted-foreground mt-1">
            قواعد وسياسات العمل التي تنطبق على جميع الموظفين
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/settings">
            <Settings className="h-4 w-4 ml-2" />
            إدارة الإعدادات
          </Link>
        </Button>
      </div>

      {/* Attendance Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-row-reverse">
            <Clock className="h-5 w-5 text-blue-600" />
            قواعد الحضور
          </CardTitle>
          <CardDescription>
            القواعد التي تحكم أوقات تسجيل الدخول والتأخير والأيام المدفوعة/غير المدفوعة
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Grace Period Rule */}
          <div className="border rounded-lg p-4 bg-orange-50 border-orange-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 mb-2">سياسة فترة السماح</h3>
                <div className="text-sm text-orange-800 space-y-2">
                  <p>
                    <strong>القاعدة:</strong> الموظفون الذين يصلون بعد فترة السماح سيتم تعليم يومهم بالكامل كغير مدفوع.
                  </p>
                  <div className="bg-white/50 rounded p-3 border border-orange-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="font-medium">ساعات العمل:</span> 
                        {settings ? ` ${settings.workingHoursStart} - ${settings.workingHoursEnd}` : ' جاري التحميل...'}
                      </div>
                      <div>
                        <span className="font-medium">فترة السماح:</span> 
                        {settings ? ` ${settings.lateAllowanceMinutes} دقيقة` : ' جاري التحميل...'}
                      </div>
                      <div>
                        <span className="font-medium">آخر وقت للوصول المسموح:</span> 
                        {settings ? ` ${(parseInt(settings.workingHoursStart.split(':')[0]) * 60 + parseInt(settings.workingHoursStart.split(':')[1]) + settings.lateAllowanceMinutes) >= 60 
                          ? Math.floor((parseInt(settings.workingHoursStart.split(':')[0]) * 60 + parseInt(settings.workingHoursStart.split(':')[1]) + settings.lateAllowanceMinutes) / 60).toString().padStart(2, '0') + ':' + 
                            ((parseInt(settings.workingHoursStart.split(':')[0]) * 60 + parseInt(settings.workingHoursStart.split(':')[1]) + settings.lateAllowanceMinutes) % 60).toString().padStart(2, '0')
                          : settings.workingHoursStart}` : ' جاري التحميل...'}
                      </div>
                      <div>
                        <span className="font-medium">الجزاء:</span> اليوم بالكامل غير مدفوع
                      </div>
                    </div>
                  </div>
                  <p className="text-xs">
                    <strong>مثال:</strong> إذا كانت ساعات العمل تبدأ في 9:00 صباحاً مع 15 دقيقة فترة سماح، 
                    فإن الوصول في 9:16 صباحاً أو بعد ذلك سيؤدي إلى اعتبار اليوم بالكامل غير مدفوع.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Working Days */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2 flex-row-reverse">
              <Calendar className="h-4 w-4" />
              أيام العمل
            </h3>
            <div className="flex flex-wrap gap-2">
              {getWorkDays().map(({ day, enabled, arabic }) => {
                return (
                  <Badge 
                    key={day} 
                    variant={enabled ? "default" : "secondary"}
                    className={enabled ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
                  >
                    {enabled ? <CheckCircle className="h-3 w-3 ml-1" /> : <XCircle className="h-3 w-3 ml-1" />}
                    {arabic}
                  </Badge>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Overtime Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-row-reverse">
            <DollarSign className="h-5 w-5 text-green-600" />
            قواعد حساب الوقت الإضافي
          </CardTitle>
          <CardDescription>
            القواعد التي تحكم متى يتم حساب ومنح أجر الوقت الإضافي
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overtime Calculation Rule */}
          <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">حساب الوقت الإضافي اليومي</h3>
                <div className="text-sm text-blue-800 space-y-2">
                  <p>
                    <strong>القاعدة:</strong> يتم حساب ساعات الوقت الإضافي عندما يعمل الموظف أكثر من الساعات اليومية المعيارية.
                  </p>
                  <div className="bg-white/50 rounded p-3 border border-blue-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="font-medium">الساعات المعيارية/اليوم:</span> 
                        {settings ? ` ${settings.workingHoursPerDay} ساعة` : ' جاري التحميل...'}
                      </div>
                      <div>
                        <span className="font-medium">معدل الوقت الإضافي:</span> 
                        {settings ? ` ${settings.overtimeMultiplier}x المعدل العادي` : ' جاري التحميل...'}
                      </div>
                      <div>
                        <span className="font-medium">وقت إضافي نهاية الأسبوع:</span> 
                        {settings ? ` ${settings.weekendOvertimeMultiplier}x المعدل العادي` : ' جاري التحميل...'}
                      </div>
                      <div>
                        <span className="font-medium">طريقة الحساب:</span> على أساس يومي
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Overtime Multiplier Cap Rule */}
          <div className="border rounded-lg p-4 bg-amber-50 border-amber-200">
            <div className="flex items-start gap-3">
              <Clock className="h-5 w-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 mb-2">حد معدل الوقت الإضافي</h3>
                <div className="text-sm text-amber-800 space-y-2">
                  <p>
                    <strong>القاعدة:</strong> معدل مضاعف الوقت الإضافي ينطبق فقط على أول ساعتين من الوقت الإضافي يومياً. الساعات الإضافية الإضافية تُدفع بالمعدل العادي.
                  </p>
                  <div className="bg-white/50 rounded p-3 border border-amber-300">
                    <div className="space-y-2 text-xs">
                      <div className="grid grid-cols-1 gap-2">
                        <div><span className="font-medium">حد الوقت الإضافي:</span> ساعتان يومياً بمعدل الوقت الإضافي</div>
                        <div><span className="font-medium">الساعات الزائدة:</span> تُدفع بالمعدل العادي (1x)</div>
                        <div><span className="font-medium">الغرض:</span> التحكم في التكلفة للوقت الإضافي المفرط</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p><strong>مثال:</strong> موظف يعمل 12 ساعة (المعيار: 8 ساعات)</p>
                    <div className="bg-white/30 rounded p-2 space-y-1">
                      <p>• الساعات 1-8: معدل عادي (1x)</p>
                      <p>• الساعات 9-10: معدل وقت إضافي (1.5x) - أول ساعتين إضافيتين</p>
                      <p>• الساعات 11-12: معدل عادي (1x) - ساعات إضافية زائدة</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* New Overtime Eligibility Rule */}
          <div className="border rounded-lg p-4 bg-purple-50 border-purple-200">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-purple-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-purple-900 mb-2">قاعدة أهلية الوقت الإضافي</h3>
                <div className="text-sm text-purple-800 space-y-2">
                  <p>
                    <strong>القاعدة:</strong> لتلقي أجر الوقت الإضافي ليوم عمل، يجب على الموظف أن يكون حاضراً في يوم العمل التالي (إذا لم يكن يوم إجازة).
                  </p>
                  <div className="bg-white/50 rounded p-3 border border-purple-300">
                    <div className="space-y-2 text-xs">
                      <div className="grid grid-cols-1 gap-2">
                        <div><span className="font-medium">الشرط:</span> يجب الحضور في يوم العمل التالي</div>
                        <div><span className="font-medium">الاستثناء:</span> القاعدة لا تنطبق إذا كان اليوم التالي يوم إجازة</div>
                        <div><span className="font-medium">الجزاء:</span> استبعاد ساعات الوقت الإضافي من حساب الراتب</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p><strong>أمثلة:</strong></p>
                    <div className="bg-white/30 rounded p-2 space-y-1">
                      <p>✅ <strong>مؤهل:</strong> عمل 10 ساعات يوم الاثنين، حاضر يوم الثلاثاء ← يُحسب الوقت الإضافي</p>
                      <p>✅ <strong>مؤهل:</strong> عمل 10 ساعات يوم الجمعة، اليوم التالي السبت (يوم إجازة) ← يُحسب الوقت الإضافي</p>
                      <p>❌ <strong>غير مؤهل:</strong> عمل 10 ساعات يوم الاثنين، غائب يوم الثلاثاء ← يُستبعد الوقت الإضافي</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Overtime Toggle */}
          <div className="border rounded-lg p-4 bg-green-50 border-green-200">
            <div className="flex items-start gap-3">
              <Settings className="h-5 w-5 text-green-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-green-900 mb-2">التحكم في دفع الوقت الإضافي</h3>
                <div className="text-sm text-green-800 space-y-2">
                  <p>
                    <strong>القاعدة:</strong> يمكن اختيارياً تضمين أو استبعاد دفع الوقت الإضافي من كل فترة دفع.
                  </p>
                  <div className="bg-white/50 rounded p-3 border border-green-300">
                    <div className="space-y-2 text-xs">
                      <div><span className="font-medium">التحكم:</span> تبديل يدوي لكل فترة دفع</div>
                      <div><span className="font-medium">الافتراضي:</span> الوقت الإضافي مستبعد افتراضياً</div>
                      <div><span className="font-medium">المرونة:</span> يمكن تمكينه/تعطيله لكل موظف لكل فترة</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Payroll Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 flex-row-reverse">
            <Users className="h-5 w-5 text-purple-600" />
            قواعد الرواتب
          </CardTitle>
          <CardDescription>
            القواعد التي تحكم حسابات الراتب والتعديلات
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Base Salary Rule */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">حساب الراتب الأساسي</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• الراتب الأساسي يُحسب كالتالي: <strong>أيام العمل × الأجر بالساعة</strong></p>
              <p>• فقط الأيام المدفوعة (الوصول خلال فترة السماح) تُحسب في الراتب الأساسي</p>
              <p>• الأيام غير المدفوعة (الوصول المتأخر) تُستبعد من حساب الراتب الأساسي</p>
            </div>
          </div>

          {/* Adjustments Rule */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">تعديلات الراتب</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• يمكن إضافة تعديلات متعددة لكل فترة دفع</p>
              <p>• أنواع التعديلات: مكافأة، خصم، وقت إضافي، أخرى</p>
              <p>• جميع التعديلات تتطلب أسباب مفصلة لأغراض المراجعة</p>
              <p>• الدفع النهائي = الراتب الأساسي + الوقت الإضافي (إذا كان مفعلاً) + جميع التعديلات</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground border-t pt-6">
        <p>
          هذه القواعد والسياسات تُطبق تلقائياً على جميع حسابات الرواتب. 
          للاستفسارات أو تعديل القواعد، اتصل بمدير النظام.
        </p>
        <p className="mt-2">
          <strong>آخر تحديث:</strong> بناءً على إعدادات النظام الحالية
        </p>
      </div>
    </div>
  );
} 