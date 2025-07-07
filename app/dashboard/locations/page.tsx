'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MapPin, 
  Plus, 
  Edit, 
  Users,
  AlertCircle,
  CheckCircle,
  Trash2,
  Save,
  X
} from 'lucide-react';

interface WorkLocation {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
  timezone: string;
  description?: string;
  workingHoursStart?: string;
  workingHoursEnd?: string;
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  _count?: {
    employeeAssignments: number;
    checkInRequests: number;
  };
}

interface LocationFormData {
  name: string;
  address: string;
  latitude: string;
  longitude: string;
  radiusMeters: string;
  timezone: string;
  description: string;
  workingHoursStart: string;
  workingHoursEnd: string;
}

export default function LocationsPage() {
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<LocationFormData>({
    name: '',
    address: '',
    latitude: '',
    longitude: '',
    radiusMeters: '100',
    timezone: 'Africa/Cairo',
    description: '',
    workingHoursStart: '09:00',
    workingHoursEnd: '18:00'
  });

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/admin/locations');
      
      if (response.ok) {
        const data = await response.json();
        setLocations(data.locations);
      } else {
        setError('فشل في تحميل المواقع');
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
      setError('فشل في تحميل المواقع');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    // Validate required fields
    if (!formData.name || !formData.address || !formData.latitude || !formData.longitude) {
      setError('الاسم والعنوان وإحداثيات الموقع مطلوبة');
      return;
    }

    // Validate coordinates
    const lat = parseFloat(formData.latitude);
    const lng = parseFloat(formData.longitude);
    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      setError('يرجى إدخال إحداثيات صحيحة (خط العرض: -90 إلى 90، خط الطول: -180 إلى 180)');
      return;
    }

    const radius = parseInt(formData.radiusMeters);
    if (isNaN(radius) || radius < 10 || radius > 1000) {
      setError('نصف القطر يجب أن يكون بين 10 و 1000 متر');
      return;
    }

    try {
      const url = editingId ? `/api/admin/locations/${editingId}` : '/api/admin/locations';
      const method = editingId ? 'PUT' : 'POST';

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: formData.name,
          address: formData.address,
          latitude: lat,
          longitude: lng,
          radiusMeters: radius,
          timezone: formData.timezone,
          description: formData.description || null,
          workingHoursStart: formData.workingHoursStart || null,
          workingHoursEnd: formData.workingHoursEnd || null,
        }),
      });

      if (response.ok) {
        setSuccess(editingId ? 'تم تحديث الموقع بنجاح' : 'تم إنشاء الموقع بنجاح');
        setIsCreating(false);
        setEditingId(null);
        resetForm();
        fetchLocations();
      } else {
        const data = await response.json();
        setError(data.error || 'فشل في حفظ الموقع');
      }
    } catch (error) {
      console.error('Error saving location:', error);
      setError('فشل في حفظ الموقع');
    }
  };

  const handleEdit = (location: WorkLocation) => {
    setFormData({
      name: location.name,
      address: location.address,
      latitude: location.latitude.toString(),
      longitude: location.longitude.toString(),
      radiusMeters: location.radiusMeters.toString(),
      timezone: location.timezone,
      description: location.description || '',
      workingHoursStart: location.workingHoursStart || '09:00',
      workingHoursEnd: location.workingHoursEnd || '18:00'
    });
    setEditingId(location.id);
    setIsCreating(true);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('هل أنت متأكد من حذف هذا الموقع؟ سيتم إزالة جميع تعيينات الموظفين.')) {
      return;
    }

    try {
      const response = await fetch(`/api/admin/locations/${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setSuccess('تم حذف الموقع بنجاح');
        fetchLocations();
      } else {
        const data = await response.json();
        setError(data.error || 'فشل في حذف الموقع');
      }
    } catch (error) {
      console.error('Error deleting location:', error);
      setError('فشل في حذف الموقع');
    }
  };

  const handleToggleActive = async (id: number, isActive: boolean) => {
    try {
      const response = await fetch(`/api/admin/locations/${id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          isActive: !isActive,
        }),
      });

      if (response.ok) {
        setSuccess(`تم ${!isActive ? 'تنشيط' : 'إلغاء تنشيط'} الموقع بنجاح`);
        fetchLocations();
      } else {
        const data = await response.json();
        setError(data.error || 'فشل في تحديث الموقع');
      }
    } catch (error) {
      console.error('Error updating location:', error);
      setError('فشل في تحديث الموقع');
    }
  };

  const resetForm = () => {
    setFormData({
      name: '',
      address: '',
      latitude: '',
      longitude: '',
      radiusMeters: '100',
      timezone: 'Africa/Cairo',
      description: '',
      workingHoursStart: '09:00',
      workingHoursEnd: '18:00'
    });
  };

  const handleCancel = () => {
    setIsCreating(false);
    setEditingId(null);
    resetForm();
    setError('');
    setSuccess('');
  };

  const getCurrentLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setFormData(prev => ({
            ...prev,
            latitude: position.coords.latitude.toString(),
            longitude: position.coords.longitude.toString()
          }));
        },
        (error) => {
          console.error('Error getting location:', error);
          setError('تعذر الحصول على الموقع الحالي. يرجى إدخال الإحداثيات يدوياً.');
        }
      );
    } else {
      setError('متصفحك لا يدعم خدمة تحديد الموقع.');
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="min-h-[400px] flex items-center justify-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">مواقع العمل</h1>
          <p className="text-muted-foreground mt-1">إدارة مواقع العمل وإعدادات السياج الجغرافي</p>
        </div>
        <Button onClick={() => setIsCreating(true)} disabled={isCreating}>
          <Plus className="h-4 w-4 ml-2" />
          إضافة موقع
        </Button>
      </div>

      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {success && (
        <Alert className="border-green-200 bg-green-50 mb-6">
          <CheckCircle className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800">{success}</AlertDescription>
        </Alert>
      )}

      {/* Create/Edit Form */}
      {isCreating && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle className="flex items-center">
              <MapPin className="h-5 w-5 ml-2" />
              {editingId ? 'تعديل الموقع' : 'إضافة موقع جديد'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="name">اسم الموقع *</Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="مثل: المكتب الرئيسي، الفرع أ"
                    className="text-right"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="timezone">المنطقة الزمنية</Label>
                  <select
                    id="timezone"
                    value={formData.timezone}
                    onChange={(e) => setFormData(prev => ({ ...prev, timezone: e.target.value }))}
                    className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-right"
                  >
                    <option value="Africa/Cairo">القاهرة (EET)</option>
                    <option value="America/New_York">نيويورك (EST)</option>
                    <option value="America/Los_Angeles">لوس أنجلوس (PST)</option>
                    <option value="Europe/London">لندن (GMT)</option>
                    <option value="Asia/Dubai">دبي (GST)</option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="address">العنوان *</Label>
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
                    placeholder="العنوان الكامل للموقع"
                    className="text-right"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="latitude">خط العرض *</Label>
                  <div className="flex space-x-2 space-x-reverse">
                    <Input
                      id="latitude"
                      value={formData.latitude}
                      onChange={(e) => setFormData(prev => ({ ...prev, latitude: e.target.value }))}
                      placeholder="مثل: 30.0444"
                      className="text-right"
                      required
                    />
                    <Button type="button" variant="outline" onClick={getCurrentLocation} title="الحصول على الموقع الحالي">
                      <MapPin className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div>
                  <Label htmlFor="longitude">خط الطول *</Label>
                  <Input
                    id="longitude"
                    value={formData.longitude}
                    onChange={(e) => setFormData(prev => ({ ...prev, longitude: e.target.value }))}
                    placeholder="مثل: 31.2357"
                    className="text-right"
                    required
                  />
                </div>

                <div>
                  <Label htmlFor="radiusMeters">نصف قطر السياج الجغرافي (متر)</Label>
                  <Input
                    id="radiusMeters"
                    type="number"
                    min="10"
                    max="1000"
                    value={formData.radiusMeters}
                    onChange={(e) => setFormData(prev => ({ ...prev, radiusMeters: e.target.value }))}
                    placeholder="100"
                    className="text-right"
                  />
                </div>

                <div>
                  <Label htmlFor="workingHoursStart">بداية ساعات العمل</Label>
                  <Input
                    id="workingHoursStart"
                    type="time"
                    value={formData.workingHoursStart}
                    onChange={(e) => setFormData(prev => ({ ...prev, workingHoursStart: e.target.value }))}
                    className="text-right"
                  />
                </div>

                <div>
                  <Label htmlFor="workingHoursEnd">نهاية ساعات العمل</Label>
                  <Input
                    id="workingHoursEnd"
                    type="time"
                    value={formData.workingHoursEnd}
                    onChange={(e) => setFormData(prev => ({ ...prev, workingHoursEnd: e.target.value }))}
                    className="text-right"
                  />
                </div>

                <div className="md:col-span-2">
                  <Label htmlFor="description">الوصف</Label>
                  <Textarea
                    id="description"
                    value={formData.description}
                    onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="وصف اختياري للموقع"
                    className="text-right"
                    rows={3}
                  />
                </div>
              </div>

              <div className="flex space-x-2 space-x-reverse">
                <Button type="submit">
                  <Save className="h-4 w-4 ml-2" />
                  {editingId ? 'تحديث الموقع' : 'إنشاء الموقع'}
                </Button>
                <Button type="button" variant="outline" onClick={handleCancel}>
                  <X className="h-4 w-4 ml-2" />
                  إلغاء
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Locations List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <MapPin className="h-5 w-5 ml-2" />
            المواقع الموجودة ({locations.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {locations.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد مواقع</h3>
              <p className="text-gray-600 mb-4">أنشئ موقع العمل الأول لتمكين الحضور المبني على الموقع.</p>
              <Button onClick={() => setIsCreating(true)}>
                <Plus className="h-4 w-4 ml-2" />
                إضافة موقع
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-right">الاسم</TableHead>
                    <TableHead className="text-right">العنوان</TableHead>
                    <TableHead className="text-right">الإحداثيات</TableHead>
                    <TableHead className="text-right">نصف القطر</TableHead>
                    <TableHead className="text-right">الموظفون</TableHead>
                    <TableHead className="text-right">الحالة</TableHead>
                    <TableHead className="text-center">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {locations.map((location) => (
                    <TableRow key={location.id}>
                      <TableCell className="font-medium text-right">
                        <div>
                          <div className="font-semibold">{location.name}</div>
                          {location.description && (
                            <div className="text-sm text-gray-500">{location.description}</div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm">{location.address}</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="text-sm">
                          <div>خط العرض: {location.latitude.toFixed(6)}</div>
                          <div>خط الطول: {location.longitude.toFixed(6)}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge variant="outline">
                          {location.radiusMeters} متر
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end">
                          <span className="ml-1">{location._count?.employeeAssignments || 0}</span>
                          <Users className="h-4 w-4" />
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Badge 
                          variant={location.isActive ? 'default' : 'secondary'}
                          className={location.isActive ? 'bg-green-100 text-green-800' : ''}
                        >
                          {location.isActive ? 'نشط' : 'غير نشط'}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-center space-x-2 space-x-reverse">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(location)}
                            title="تعديل"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleToggleActive(location.id, location.isActive)}
                            title={location.isActive ? 'إلغاء تنشيط' : 'تنشيط'}
                          >
                            {location.isActive ? 'إلغاء تنشيط' : 'تنشيط'}
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(location.id)}
                            className="text-red-600 hover:text-red-800"
                            title="حذف"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 