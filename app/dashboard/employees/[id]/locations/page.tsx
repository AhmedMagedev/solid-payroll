'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  MapPin, 
  ArrowLeft, 
  Users,
  AlertCircle,
  CheckCircle,
  Save,
  Plus
} from 'lucide-react';
import Link from 'next/link';

interface Employee {
  id: number;
  name: string;
  email: string;
  position: string;
  primaryWorkLocationId?: number;
}

interface WorkLocation {
  id: number;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  radiusMeters: number;
  isActive: boolean;
  description?: string;
}

interface EmployeeWorkLocation {
  id: number;
  workLocationId: number;
  canCheckIn: boolean;
  canCheckOut: boolean;
  isActive: boolean;
  assignedAt: string;
  assignedBy?: string;
  workLocation: WorkLocation;
}

interface LocationAssignment {
  locationId: number;
  canCheckIn: boolean;
  canCheckOut: boolean;
  isAssigned: boolean;
}

export default function EmployeeLocationsPage() {
  const params = useParams();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [allLocations, setAllLocations] = useState<WorkLocation[]>([]);
  const [assignments, setAssignments] = useState<LocationAssignment[]>([]);
  const [primaryLocationId, setPrimaryLocationId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const employeeId = parseInt(id, 10);

  useEffect(() => {
    if (!isNaN(employeeId)) {
      fetchData();
    }
  }, [employeeId]);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      
      // Fetch employee data, all locations, and current assignments in parallel
      const [employeeRes, locationsRes, assignmentsRes] = await Promise.all([
        fetch(`/api/employee/${employeeId}`),
        fetch('/api/admin/locations'),
        fetch(`/api/admin/employees/${employeeId}/locations`)
      ]);

      if (!employeeRes.ok) {
        throw new Error('Employee not found');
      }

      const employeeData = await employeeRes.json();
      setEmployee(employeeData);
      setPrimaryLocationId(employeeData.primaryWorkLocationId || null);

      let locationsData;
      if (locationsRes.ok) {
        locationsData = await locationsRes.json();
        setAllLocations(locationsData.locations.filter((loc: WorkLocation) => loc.isActive));
      }

      if (assignmentsRes.ok) {
        const assignmentsData = await assignmentsRes.json();
        
        // Initialize assignments state
        initializeAssignments(locationsData?.locations.filter((loc: WorkLocation) => loc.isActive) || [], assignmentsData.assignments || []);
      } else {
        // Initialize with empty assignments if API call fails
        initializeAssignments([], []);
      }
    } catch (error) {
      console.error('Error fetching data:', error);
      setError('فشل في تحميل بيانات الموظف والمواقع');
    } finally {
      setIsLoading(false);
    }
  };

  const initializeAssignments = (locations: WorkLocation[], currentAssignments: EmployeeWorkLocation[]) => {
    const assignmentMap = new Map(
      currentAssignments.map(assignment => [assignment.workLocationId, assignment])
    );

    const newAssignments = locations.map(location => ({
      locationId: location.id,
      canCheckIn: assignmentMap.get(location.id)?.canCheckIn ?? true,
      canCheckOut: assignmentMap.get(location.id)?.canCheckOut ?? true,
      isAssigned: assignmentMap.has(location.id)
    }));

    setAssignments(newAssignments);
  };

  const handleAssignmentChange = (locationId: number, field: keyof LocationAssignment, value: boolean) => {
    setAssignments(prev => prev.map(assignment => 
      assignment.locationId === locationId 
        ? { ...assignment, [field]: value }
        : assignment
    ));
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      setError('');
      setSuccess('');

      // Prepare the assignments to save
      const assignmentsToSave = assignments
        .filter(assignment => assignment.isAssigned)
        .map(assignment => ({
          workLocationId: assignment.locationId,
          canCheckIn: assignment.canCheckIn,
          canCheckOut: assignment.canCheckOut
        }));

      const response = await fetch(`/api/admin/employees/${employeeId}/locations`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          assignments: assignmentsToSave,
          primaryLocationId: primaryLocationId
        }),
      });

      if (response.ok) {
        setSuccess('تم تحديث تعيينات المواقع بنجاح');
        // Refresh the data
        await fetchData();
      } else {
        const data = await response.json();
        setError(data.error || 'فشل في تحديث تعيينات المواقع');
      }
    } catch (error) {
      console.error('Error saving assignments:', error);
      setError('فشل في حفظ تعيينات المواقع');
    } finally {
      setIsSaving(false);
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

  if (!employee) {
    return (
      <div className="p-6">
        <div className="space-y-6">
          <Button asChild variant="outline">
            <Link href="/dashboard/employees">
              <ArrowLeft className="h-4 w-4 ml-2" />
              العودة إلى الموظفين
            </Link>
          </Button>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>الموظف غير موجود</AlertDescription>
          </Alert>
        </div>
      </div>
    );
  }

  const assignedCount = assignments.filter(a => a.isAssigned).length;

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4 sm:space-x-reverse">
          <Button asChild variant="outline">
            <Link href={`/dashboard/employees/${employeeId}`}>
              <ArrowLeft className="h-4 w-4 ml-2" />
              العودة للموظف
            </Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-primary">تعيينات المواقع</h1>
            <p className="text-muted-foreground mt-1">إدارة مواقع العمل للموظف {employee.name}</p>
          </div>
        </div>
        <Button onClick={handleSave} disabled={isSaving}>
          <Save className="h-4 w-4 ml-2" />
          {isSaving ? 'جاري الحفظ...' : 'حفظ التغييرات'}
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

      {/* Employee Info */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <Users className="h-5 w-5 ml-2" />
            معلومات الموظف
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="text-sm font-medium text-muted-foreground">الاسم</label>
              <p className="text-lg font-semibold">{employee.name}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">المنصب</label>
              <p>{employee.position}</p>
            </div>
            <div>
              <label className="text-sm font-medium text-muted-foreground">البريد الإلكتروني</label>
              <p>{employee.email}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Primary Location Selection */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center">
            <MapPin className="h-5 w-5 ml-2" />
            موقع العمل الأساسي
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              اختر موقع العمل الأساسي لهذا الموظف. سيتم استخدامه كافتراضي لتتبع الحضور.
            </p>
            <select
              value={primaryLocationId || ''}
              onChange={(e) => setPrimaryLocationId(e.target.value ? parseInt(e.target.value) : null)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm text-right"
            >
              <option value="">لا يوجد موقع أساسي</option>
              {allLocations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name} - {location.address}
                </option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Location Assignments */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center justify-between">
            <div className="flex items-center">
              <MapPin className="h-5 w-5 ml-2" />
              مواقع العمل المسموحة ({assignedCount} مُعيَّن)
            </div>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {allLocations.length === 0 ? (
            <div className="text-center py-8">
              <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">لا توجد مواقع متاحة</h3>
              <p className="text-gray-600 mb-4">أنشئ مواقع العمل أولاً لتعيينها للموظفين.</p>
              <Button asChild>
                <Link href="/dashboard/locations">
                  <Plus className="h-4 w-4 ml-2" />
                  إدارة المواقع
                </Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                اختر المواقع التي يمكن لهذا الموظف تسجيل الدخول/الخروج منها. يمكنك أيضاً التحكم في الصلاحيات المحددة لكل موقع.
              </p>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">مُعيَّن</TableHead>
                      <TableHead className="text-right">الموقع</TableHead>
                      <TableHead className="text-right">العنوان</TableHead>
                      <TableHead className="text-right">نصف القطر</TableHead>
                      <TableHead className="text-right">يمكن تسجيل الدخول</TableHead>
                      <TableHead className="text-right">يمكن تسجيل الخروج</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allLocations.map((location) => {
                      const assignment = assignments.find(a => a.locationId === location.id);
                      if (!assignment) return null;

                      return (
                        <TableRow key={location.id}>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={assignment.isAssigned}
                              onChange={(e) => 
                                handleAssignmentChange(location.id, 'isAssigned', e.target.checked)
                              }
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500"
                            />
                          </TableCell>
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
                            <Badge variant="outline">
                              {location.radiusMeters} متر
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={assignment.canCheckIn}
                              disabled={!assignment.isAssigned}
                              onChange={(e) => 
                                handleAssignmentChange(location.id, 'canCheckIn', e.target.checked)
                              }
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                            />
                          </TableCell>
                          <TableCell className="text-center">
                            <input
                              type="checkbox"
                              checked={assignment.canCheckOut}
                              disabled={!assignment.isAssigned}
                              onChange={(e) => 
                                handleAssignmentChange(location.id, 'canCheckOut', e.target.checked)
                              }
                              className="w-4 h-4 text-blue-600 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 disabled:opacity-50"
                            />
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 