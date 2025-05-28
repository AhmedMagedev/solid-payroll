'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval, startOfWeek, endOfWeek, addWeeks } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Calendar, DollarSign, Clock, CalendarCheck, CalendarX } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '../../../../../components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from "sonner";
import { Textarea } from "../../../../../components/ui/textarea";
import { Switch } from "../../../../../components/ui/switch";
import { Toaster } from "../../../../../components/ui/sonner";

interface Employee {
  id: number;
  name: string;
  email: string;
  position: string;
  dailyRate: number;
  paymentBasis: string;
}

interface Attendance {
  id: number;
  date: string;
  checkIn: string;
  checkOut: string | null;
  hoursWorked: number | null;
}

interface Payout {
  id: number;
  employeeId: number;
  periodStart: string;
  periodEnd: string;
  amount: number;
  isPaid: boolean;
  comment: string | null;
  paymentDate: string | null;
  adjustmentAmount?: number;
  adjustmentReason?: string;
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
}

export default function EmployeePayoutsPage() {
  const params = useParams();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [existingPayouts, setExistingPayouts] = useState<Payout[]>([]);
  const [tempChanges, setTempChanges] = useState<Record<string, {isPaid?: boolean, comment?: string, adjustmentAmount?: number, adjustmentReason?: string}>>({});
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({});
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  
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
        setAttendance(attendanceData);
        
        // Fetch payouts data
        const payoutsResponse = await fetch(`/api/payouts?employeeId=${employeeId}`, {
          credentials: 'include',
        });
        
        if (payoutsResponse.ok) {
          const payoutsData = await payoutsResponse.json();
          setExistingPayouts(payoutsData);
          console.log('Loaded payouts from database:', payoutsData);
        }
        
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

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex items-center mb-6">
          <Skeleton className="h-9 w-32" />
        </div>
        <div className="space-y-6">
          <Skeleton className="h-10 w-full max-w-md" />
          <div className="grid gap-6">
            {Array(3).fill(0).map((_, i) => (
              <Card key={i} className="overflow-hidden">
                <Skeleton className="h-24 w-full" />
                <CardContent className="p-6">
                  <div className="space-y-4">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                    <div className="grid grid-cols-2 gap-4">
                      <Skeleton className="h-16 w-full" />
                      <Skeleton className="h-16 w-full" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Button asChild variant="outline" size="sm" className="mb-6">
          <Link href={`/dashboard/employees/${employeeId}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Employee
          </Link>
        </Button>
        
        <Card className="mx-auto max-w-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-destructive">{error || 'Employee Not Found'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error ? error : `Could not find an employee with ID: ${employeeId}`}</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/employees">Back to Employees</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get payment periods based on payment basis
  const getPaymentPeriods = () => {
    const now = new Date();
    const periods = [];
    
    // Use the employee's payment basis to determine periods
    switch(employee.paymentBasis) {
      case 'Weekly':
        // Show last 4 weeks
        for (let i = 0; i < 4; i++) {
          const weekStart = startOfWeek(addWeeks(now, -i));
          const weekEnd = endOfWeek(addWeeks(now, -i));
          periods.push({
            label: `Week of ${format(weekStart, 'MMM d')} - ${format(weekEnd, 'MMM d, yyyy')}`,
            start: weekStart,
            end: weekEnd
          });
        }
        break;
        
      case 'Biweekly':
        // Show last 4 bi-weekly periods
        for (let i = 0; i < 4; i++) {
          const periodStart = startOfWeek(addWeeks(now, -(i*2)));
          const periodEnd = endOfWeek(addWeeks(periodStart, 1));
          periods.push({
            label: `${format(periodStart, 'MMM d')} - ${format(periodEnd, 'MMM d, yyyy')}`,
            start: periodStart,
            end: periodEnd
          });
        }
        break;
        
      case 'Monthly':
      default:
        // Show last 3 months
        for (let i = 0; i < 3; i++) {
          const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const monthStart = startOfMonth(monthDate);
          const monthEnd = endOfMonth(monthDate);
          periods.push({
            label: format(monthStart, 'MMMM yyyy'),
            start: monthStart,
            end: monthEnd
          });
        }
    }
    
    return periods;
  };
  
  // Calculate payout for a period
  const calculatePeriodPayout = (periodStart: Date, periodEnd: Date) => {
    // Filter attendance records for this period
    const periodAttendance = attendance.filter(record => {
      const recordDate = parseISO(record.date);
      return isWithinInterval(recordDate, { start: periodStart, end: periodEnd });
    });
    
    // Calculate days worked
    const daysWorked = periodAttendance.length;
    
    // Calculate total hours worked
    const totalHours = periodAttendance.reduce((sum, record) => {
      return sum + (record.hoursWorked || 0);
    }, 0);
    
    // Calculate expected hours based on working days in period
    const workingDaysInPeriod = getWorkingDaysInPeriod(periodStart, periodEnd);
    const hoursPerDay = systemSettings?.workingHoursPerDay || 8; // Use system setting or default to 8
    const expectedHours = workingDaysInPeriod * hoursPerDay;
    
    // Calculate regular and overtime hours
    const regularHours = Math.min(totalHours, expectedHours);
    const overtimeHours = Math.max(0, totalHours - expectedHours);
    
    // Calculate hourly rate from daily rate
    const hourlyRate = employee.dailyRate / hoursPerDay;
    const overtimeRate = hourlyRate * 1.5; // 1.5x overtime rate
    
    // Calculate payout: base daily rate + overtime pay
    const basePayout = daysWorked * employee.dailyRate;
    const overtimePayout = overtimeHours * overtimeRate;
    const totalPayout = basePayout + overtimePayout;
    
    return {
      daysWorked,
      workingDaysInPeriod,
      totalHours,
      expectedHours,
      regularHours,
      overtimeHours,
      basePayout,
      overtimePayout,
      payout: totalPayout
    };
  };
  
  // Helper to calculate working days in a period based on system settings
  const getWorkingDaysInPeriod = (start: Date, end: Date) => {
    if (!systemSettings) {
      // Fallback to Monday-Friday if settings not loaded yet
      let count = 0;
      const current = new Date(start);
      
      while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek >= 1 && dayOfWeek <= 5) {
          count++;
        }
        current.setDate(current.getDate() + 1);
      }
      
      return count;
    }
    
    let count = 0;
    const current = new Date(start);
    
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
    
    while (current <= end) {
      const dayOfWeek = current.getDay();
      if (workDays[dayOfWeek]) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    return count;
  };
  
  const paymentPeriods = getPaymentPeriods();
  
  // Helper function to generate period key
  const getPeriodKey = (periodStart: Date, periodEnd: Date) => {
    // Use date strings instead of full ISO strings for consistency
    const startDate = periodStart.toISOString().split('T')[0];
    const endDate = periodEnd.toISOString().split('T')[0];
    return `${startDate}-${endDate}`;
  };
  
  // Find existing payout for a period
  const findExistingPayout = (periodStart: Date, periodEnd: Date) => {
    return existingPayouts.find(payout => {
      const payoutStart = new Date(payout.periodStart);
      const payoutEnd = new Date(payout.periodEnd);
      
      // Compare dates by converting to ISO date strings (YYYY-MM-DD) to avoid time zone and millisecond issues
      const startMatches = payoutStart.toISOString().split('T')[0] === periodStart.toISOString().split('T')[0];
      const endMatches = payoutEnd.toISOString().split('T')[0] === periodEnd.toISOString().split('T')[0];
      
      console.log('Comparing payout periods:', {
        payoutId: payout.id,
        dbStart: payoutStart.toISOString(),
        dbEnd: payoutEnd.toISOString(),
        searchStart: periodStart.toISOString(),
        searchEnd: periodEnd.toISOString(),
        startMatches,
        endMatches,
        matches: startMatches && endMatches
      });
      
      return startMatches && endMatches;
    });
  };

  // Get current state for a period (combines DB and temp changes)
  const getCurrentState = (periodStart: Date, periodEnd: Date) => {
    const periodKey = getPeriodKey(periodStart, periodEnd);
    const existingPayout = findExistingPayout(periodStart, periodEnd);
    const tempChange = tempChanges[periodKey];
    
    return {
      isPaid: tempChange?.isPaid !== undefined ? tempChange.isPaid : (existingPayout?.isPaid || false),
      comment: tempChange?.comment !== undefined ? tempChange.comment : (existingPayout?.comment || ''),
      adjustmentAmount: tempChange?.adjustmentAmount !== undefined ? tempChange.adjustmentAmount : (existingPayout?.adjustmentAmount || 0),
      adjustmentReason: tempChange?.adjustmentReason !== undefined ? tempChange.adjustmentReason : (existingPayout?.adjustmentReason || ''),
      hasChanges: tempChange && (
        (tempChange.isPaid !== undefined && tempChange.isPaid !== existingPayout?.isPaid) ||
        (tempChange.comment !== undefined && tempChange.comment !== (existingPayout?.comment || '')) ||
        (tempChange.adjustmentAmount !== undefined && tempChange.adjustmentAmount !== (existingPayout?.adjustmentAmount || 0)) ||
        (tempChange.adjustmentReason !== undefined && tempChange.adjustmentReason !== (existingPayout?.adjustmentReason || ''))
      )
    };
  };

  // Update temporary state
  const updateTempState = (periodStart: Date, periodEnd: Date, updates: {isPaid?: boolean, comment?: string, adjustmentAmount?: number, adjustmentReason?: string}) => {
    const periodKey = getPeriodKey(periodStart, periodEnd);
    setTempChanges(prev => ({
      ...prev,
      [periodKey]: { ...prev[periodKey], ...updates }
    }));
  };

  // Save payout to database
  const savePayout = async (periodStart: Date, periodEnd: Date, amount: number) => {
    const periodKey = getPeriodKey(periodStart, periodEnd);
    const currentState = getCurrentState(periodStart, periodEnd);
    
    setIsUpdating(prev => ({ ...prev, [periodKey]: true }));
    
    try {
      const existingPayout = findExistingPayout(periodStart, periodEnd);
      
      if (existingPayout) {
        // Update existing payout
        const response = await fetch(`/api/payouts/${existingPayout.id}`, {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            isPaid: currentState.isPaid,
            comment: currentState.comment,
            adjustmentAmount: currentState.adjustmentAmount,
            adjustmentReason: currentState.adjustmentReason,
          }),
        });
        
        if (response.ok) {
          const updatedPayout = await response.json();
          
          // Update the payout in state
          setExistingPayouts(prev => 
            prev.map(p => p.id === updatedPayout.id ? updatedPayout : p)
          );
          
          // Clear temp changes for this period
          setTempChanges(prev => {
            const newTemp = { ...prev };
            delete newTemp[periodKey];
            return newTemp;
          });
          
          toast.success('Payout updated successfully');
        } else {
          toast.error('Failed to update payout');
        }
      } else {
        // Create new payout
        const response = await fetch('/api/payouts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            employeeId,
            periodStart,
            periodEnd,
            amount,
            isPaid: currentState.isPaid,
            comment: currentState.comment,
            adjustmentAmount: currentState.adjustmentAmount,
            adjustmentReason: currentState.adjustmentReason,
          }),
        });
        
        if (response.ok) {
          const newPayout = await response.json();
          setExistingPayouts(prev => [...prev, newPayout]);
          
          // Clear temp changes for this period
          setTempChanges(prev => {
            const newTemp = { ...prev };
            delete newTemp[periodKey];
            return newTemp;
          });
          
          toast.success('Payout created successfully');
        } else {
          toast.error('Failed to create payout');
        }
      }
    } catch (error) {
      console.error('Error saving payout:', error);
      toast.error('An error occurred while saving the payout');
    } finally {
      setIsUpdating(prev => ({ ...prev, [periodKey]: false }));
    }
  };

  return (
    <div className="p-2 md:p-3 max-w-7xl mx-auto">
      <Toaster richColors />
      <Button asChild variant="outline" size="sm" className="mb-2">
        <Link href={`/dashboard/employees/${employee.id}`}>
          <ArrowLeft className="mr-1 h-3 w-3" />
          Back
        </Link>
      </Button>
      
      <div className="mb-3">
        <h1 className="text-lg font-bold">Payouts for {employee.name}</h1>
        <div className="text-muted-foreground flex items-center flex-wrap gap-1 text-xs">
          <span>Payment basis:</span> <Badge variant="outline" className="text-xs py-0 h-5">{employee.paymentBasis}</Badge>
          <span className="mx-1">•</span>
          <span>Daily rate:</span> <Badge variant="outline" className="text-xs py-0 h-5">L.E {employee.dailyRate.toFixed(2)}</Badge>
        </div>
      </div>
      
      <Tabs defaultValue="payouts" className="w-full">
        <TabsList className="mb-2 h-8">
          <TabsTrigger value="payouts" className="text-xs h-6 px-2">Payouts</TabsTrigger>
          <TabsTrigger value="attendance" className="text-xs h-6 px-2">Attendance</TabsTrigger>
        </TabsList>
        
        <TabsContent value="payouts" className="space-y-6">
          {paymentPeriods.map((period, index) => {
            const { daysWorked, workingDaysInPeriod, totalHours, expectedHours, regularHours, overtimeHours, basePayout, overtimePayout, payout } = 
              calculatePeriodPayout(period.start, period.end);
            
            const currentState = getCurrentState(period.start, period.end);
            const existingPayout = findExistingPayout(period.start, period.end);
            const periodKey = getPeriodKey(period.start, period.end);
            
            return (
              <Card key={index} className="overflow-hidden">
                <CardHeader className="bg-muted/20 border-b py-2 px-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center text-md">
                      <Calendar className="h-4 w-4 mr-1 text-primary" />
                      {period.label}
                    </CardTitle>
                    <div className="flex items-center gap-3">
                      {/* Payment status on the right */}
                      {currentState.isPaid && (
                        <Badge variant="outline" className="bg-green-500 text-white text-xs">
                          Paid{existingPayout?.paymentDate ? ` on ${new Date(existingPayout.paymentDate).toLocaleDateString()}` : ''}
                        </Badge>
                      )}
                      <div className="flex items-center">
                        <span className="text-xs text-muted-foreground mr-1">Mark as Paid</span>
                        <Switch
                          id={`paid-toggle-${index}`}
                          checked={currentState.isPaid}
                          onCheckedChange={(checked) => {
                            updateTempState(period.start, period.end, { isPaid: checked });
                          }}
                        />
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="p-3">
                  <div className="space-y-4">
                    {/* Main content in single column for better space usage */}
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-3">
                        <div>
                          <h3 className="text-md font-medium mb-2">{period.label}</h3>
                          <div className="space-y-1">
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center text-sm">
                                <CalendarCheck className="h-3 w-3 mr-1" />
                                Days Worked
                              </span>
                              <span className="font-semibold text-sm">{daysWorked} / {workingDaysInPeriod}</span>
                            </div>
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center text-sm">
                                <Clock className="h-3 w-3 mr-1" />
                                Regular Hours
                              </span>
                              <span className="font-semibold text-sm">{regularHours.toFixed(1)} / {expectedHours}</span>
                            </div>
                            {overtimeHours > 0 && (
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground flex items-center text-sm text-orange-600">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Overtime Hours
                                </span>
                                <span className="font-semibold text-sm text-orange-600">{overtimeHours.toFixed(1)} hrs</span>
                              </div>
                            )}
                          </div>
                        </div>
                        
                        <div className="pt-2 border-t space-y-1">
                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground flex items-center text-sm">
                              <DollarSign className="h-3 w-3 mr-1" />
                              Base Payout
                            </span>
                            <span className="font-semibold text-sm">L.E {basePayout.toFixed(2)}</span>
                          </div>
                          {overtimePayout > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground flex items-center text-sm text-orange-600">
                                <DollarSign className="h-3 w-3 mr-1" />
                                Overtime Pay (1.5x)
                              </span>
                              <span className="font-semibold text-sm text-orange-600">L.E {overtimePayout.toFixed(2)}</span>
                            </div>
                          )}
                          {currentState.adjustmentAmount !== 0 && (
                            <div className="flex justify-between items-center">
                              <span className={`text-muted-foreground flex items-center text-sm ${currentState.adjustmentAmount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                <DollarSign className="h-3 w-3 mr-1" />
                                {currentState.adjustmentAmount > 0 ? 'Bonus/Addition' : 'Deduction/Penalty'}
                              </span>
                              <span className={`font-semibold text-sm ${currentState.adjustmentAmount > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {currentState.adjustmentAmount > 0 ? '+' : ''}L.E {currentState.adjustmentAmount.toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-1 border-t">
                            <span className="text-muted-foreground flex items-center font-medium">
                              <DollarSign className="h-4 w-4 mr-1" />
                              Final Payout
                            </span>
                            <span className="text-lg font-bold">L.E {(payout + currentState.adjustmentAmount).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                      
                      <div className="bg-muted/10 p-3 rounded-md">
                        <h4 className="font-medium mb-2 text-sm">Attendance Summary</h4>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-sm">
                            <span>Attendance Rate</span>
                            <span className="font-medium">
                              {workingDaysInPeriod > 0 
                                ? Math.round((daysWorked / workingDaysInPeriod) * 100) 
                                : 0}%
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span>Absences</span>
                            <span className="font-medium">
                              {workingDaysInPeriod - daysWorked} day(s)
                            </span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span>Total Hours</span>
                            <span className="font-medium">{totalHours.toFixed(1)} hrs</span>
                          </div>
                          <div className="flex justify-between items-center text-sm">
                            <span>Avg. Hours/Day</span>
                            <span className="font-medium">
                              {daysWorked > 0 ? (totalHours / daysWorked).toFixed(1) : 0}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>
                    
                    {/* Full-width comment and adjustment section */}
                    <div className="pt-2 border-t space-y-4">
                      {/* Adjustment Section */}
                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="space-y-1">
                          <label 
                            htmlFor={`adjustment-amount-${index}`}
                            className="text-xs text-muted-foreground"
                          >
                            Adjustment Amount (L.E)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            id={`adjustment-amount-${index}`}
                            placeholder="0.00 (+ for bonus, - for deduction)"
                            value={currentState.adjustmentAmount || ''}
                            onChange={(e) => {
                              const value = e.target.value === '' ? 0 : parseFloat(e.target.value);
                              updateTempState(period.start, period.end, { adjustmentAmount: isNaN(value) ? 0 : value });
                            }}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </div>
                        <div className="space-y-1">
                          <label 
                            htmlFor={`adjustment-reason-${index}`}
                            className="text-xs text-muted-foreground"
                          >
                            Adjustment Reason
                          </label>
                          <input
                            type="text"
                            id={`adjustment-reason-${index}`}
                            placeholder="e.g., Bonus, Late penalty, Transport allowance..."
                            value={currentState.adjustmentReason}
                            onChange={(e) => {
                              updateTempState(period.start, period.end, { adjustmentReason: e.target.value });
                            }}
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                          />
                        </div>
                      </div>
                      
                      {/* Comment Section */}
                      <div className="space-y-1">
                        <label 
                          htmlFor={`comment-${index}`}
                          className="text-xs text-muted-foreground"
                        >
                          Payment Comment
                        </label>
                        <Textarea
                          id={`comment-${index}`}
                          placeholder="Add a comment about this payment..."
                          value={currentState.comment}
                          onChange={(e) => {
                            updateTempState(period.start, period.end, { comment: e.target.value });
                          }}
                          className="resize-none min-h-[60px] text-sm w-full"
                        />
                      </div>
                      
                      {/* Update button - centered */}
                      <div className="flex justify-center">
                        <div className="flex flex-col items-center space-y-1">
                          {currentState.hasChanges && (
                            <div className="text-xs text-orange-600 font-medium">
                              ⚠️ Unsaved changes
                            </div>
                          )}
                                                      <Button 
                              className={`h-8 text-sm px-8 ${currentState.hasChanges ? 'bg-orange-600 hover:bg-orange-700' : ''}`}
                              onClick={() => savePayout(period.start, period.end, payout + currentState.adjustmentAmount)}
                              disabled={isUpdating[periodKey]}
                            >
                              {isUpdating[periodKey] ? 'Updating...' : 'Update Payout'}
                            </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </TabsContent>
        
        <TabsContent value="attendance" className="space-y-4">
          <Card>
            <CardHeader className="py-2 px-3">
              <CardTitle className="text-md">Attendance Records</CardTitle>
              <CardDescription className="text-xs">
                Showing {attendance.length} records for {employee.name}
              </CardDescription>
            </CardHeader>
            <CardContent className="p-2">
              {attendance.length > 0 ? (
                <div className="border rounded-md">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="text-left p-2 font-medium">Date</th>
                        <th className="text-left p-2 font-medium">Check In</th>
                        <th className="text-left p-2 font-medium">Check Out</th>
                        <th className="text-left p-2 font-medium">Hours</th>
                      </tr>
                    </thead>
                    <tbody>
                      {attendance
                        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
                        .map((record) => (
                        <tr key={record.id} className="border-b last:border-0">
                          <td className="p-1.5">{format(parseISO(record.date), 'MMM d, yyyy')}</td>
                          <td className="p-1.5">{format(parseISO(record.checkIn), 'h:mm a')}</td>
                          <td className="p-1.5">
                            {record.checkOut 
                              ? format(parseISO(record.checkOut), 'h:mm a') 
                              : '—'}
                          </td>
                          <td className="p-1.5">{record.hoursWorked?.toFixed(1) || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center p-6 text-muted-foreground">
                  <CalendarX className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p>No attendance records found</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
} 