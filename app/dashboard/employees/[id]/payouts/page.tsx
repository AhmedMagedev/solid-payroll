'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval } from 'date-fns';
import { formatEgyptTime } from '@/lib/timezone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Calendar, DollarSign, Clock, CalendarCheck, CalendarX } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/sonner";
import PayoutAdjustments from '@/app/components/PayoutAdjustments';

interface Employee {
  id: number;
  name: string;
  email: string;
  position: string;
  fingerprintId?: string;
  dailyRate: number;
  paymentBasis: string;
}

interface Attendance {
  id: number;
  date: string;
  checkIn: string;
  checkOut: string | null;
  hoursWorked: number | null;
  isPaidDay?: boolean; // Optional for backward compatibility
}

interface PayoutAdjustment {
  id: number;
  payoutId: number;
  type: string;
  amount: number;
  reason: string;
  createdAt: string;
  updatedAt: string;
}

interface Payout {
  id: number;
  employeeId: number;
  periodStart: string;
  periodEnd: string;
  amount: number;
  totalAmount: number;
  basePayout: number;
  finalAmount: number;
  isPaid: boolean;
  comment: string | null;
  paymentDate: string | null;
  adjustmentAmount?: number;
  adjustmentReason?: string;
  adjustments?: PayoutAdjustment[];
  adjustmentsTotal?: number;
  includeOvertime?: boolean;
  
  // Detailed breakdown fields from database
  daysWorked?: number;
  unpaidDays?: number;
  totalHours?: number;
  regularHours?: number;
  overtimeHours?: number;
  excessOvertimeHours?: number;
  overtimePayout?: number;
  createdAt?: string;
  updatedAt?: string;
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
  const [tempChanges, setTempChanges] = useState<Record<string, {isPaid?: boolean, comment?: string, adjustmentAmount?: number, adjustmentReason?: string, includeOvertime?: boolean}>>({});
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
          // Handle both old format (direct array) and new format (paginated object)
          if (Array.isArray(payoutsData)) {
            setExistingPayouts(payoutsData);
          } else if (payoutsData.data && Array.isArray(payoutsData.data)) {
            setExistingPayouts(payoutsData.data);
          } else {
            console.warn('[EmployeePayoutsPage] Unexpected payouts data format:', payoutsData);
            setExistingPayouts([]);
          }
          console.log('Loaded payouts from database:', payoutsData);
        } else {
          console.warn('[EmployeePayoutsPage] Failed to fetch payouts, initializing empty array');
          setExistingPayouts([]);
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
    
    // IMPORTANT: Always use monthly periods for consistency with backend APIs
    // regardless of employee payment basis setting
    
    // Show last 6 months for better coverage
    for (let i = 0; i < 6; i++) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthStart = startOfMonth(monthDate);
      const monthEnd = endOfMonth(monthDate);
      periods.push({
        label: format(monthStart, 'MMMM yyyy'),
        start: monthStart,
        end: monthEnd
      });
    }
    
    return periods;
  };
  
  // Calculate payout for a period
  const calculatePeriodPayout = (periodStart: Date, periodEnd: Date) => {
    // Filter attendance records for this period
    const periodAttendance = attendance.filter(record => {
      if (!record.date || typeof record.date !== 'string') {
        console.warn('[EmployeePayoutsPage] Invalid or missing date in attendance record, skipping:', record);
        return false;
      }
      try {
        const recordDate = parseISO(record.date);
        return isWithinInterval(recordDate, { start: periodStart, end: periodEnd });
      } catch (e) {
        console.warn('[EmployeePayoutsPage] Error parsing record.date, skipping record:', record.date, e);
        return false;
      }
    });
    
    // Calculate days worked - only count days where isPaidDay is true (or undefined for backward compatibility)
    const paidDays = periodAttendance.filter(record => record.isPaidDay !== false);
    const daysWorked = paidDays.length;
    const unpaidDays = periodAttendance.length - daysWorked;
    
    // Calculate total hours worked - only from paid days
    const totalHours = paidDays.reduce((sum, record) => {
      return sum + (record.hoursWorked || 0);
    }, 0);
    
    // Calculate expected hours based on working days in period
    const workingDaysInPeriod = getWorkingDaysInPeriod(periodStart, periodEnd);
    const hoursPerDay = systemSettings?.workingHoursPerDay || 9; // Use system setting or default to 9
    const expectedHours = workingDaysInPeriod * hoursPerDay;
    
    // Calculate regular and overtime hours
    // NEW LOGIC: Calculate overtime based on daily hours, not total period hours
    // RULE: Overtime only counts if employee is present the next working day (if it's not a day off)
    // RULE: Only first 2 hours of overtime per day get overtime rate, rest paid at regular rate
    let regularHours = 0;
    let overtimeHours = 0;
    let excessOvertimeHours = 0; // Hours beyond 2-hour overtime cap
    
    paidDays.forEach((record) => {
      const dailyHours = record.hoursWorked || 0;
      const recordDate = parseISO(record.date);
      
      // Check if this day has overtime hours
      if (dailyHours > hoursPerDay) {
        const potentialOvertimeHours = dailyHours - hoursPerDay;
        
        // Check if employee must be present next working day for overtime eligibility
        const nextWorkingDay = getNextWorkingDay(recordDate);
        let isOvertimeEligible = true;
        
        if (nextWorkingDay) {
          // Check if employee was present on the next working day
          const nextDayAttendance = paidDays.find(a => {
            const aDate = parseISO(a.date);
            return aDate.toDateString() === nextWorkingDay.toDateString();
          });
          
          // If next working day exists and employee was not present, overtime is not eligible
          if (!nextDayAttendance) {
            isOvertimeEligible = false;
          }
        }
        
        if (isOvertimeEligible) {
          regularHours += hoursPerDay;
          
          // Apply 2-hour overtime cap rule
          if (potentialOvertimeHours <= 2) {
            // All overtime hours within cap - paid at overtime rate
            overtimeHours += potentialOvertimeHours;
          } else {
            // First 2 hours at overtime rate, rest at regular rate
            overtimeHours += 2;
            excessOvertimeHours += (potentialOvertimeHours - 2);
          }
        } else {
          // Overtime not eligible, treat as regular hours up to standard hours
          regularHours += Math.min(dailyHours, hoursPerDay);
        }
      } else {
        regularHours += dailyHours;
      }
    });
    
    // Include excess overtime hours in regular hours for payment calculation
    regularHours += excessOvertimeHours;
    
    // Calculate hourly rate from daily rate
    const hourlyRate = employee.dailyRate / hoursPerDay;
    const overtimeRate = hourlyRate * 1.5; // 1.5x overtime rate
    
    // Calculate payout: base daily rate (overtime is added conditionally in UI)
    const basePayout = daysWorked * employee.dailyRate;
    const overtimePayout = overtimeHours * overtimeRate;
    // Return only base payout - overtime will be added conditionally based on toggle
    
    return {
      daysWorked,
      unpaidDays,
      workingDaysInPeriod,
      totalHours,
      expectedHours,
      regularHours,
      overtimeHours,
      excessOvertimeHours,
      basePayout,
      overtimePayout,
      payout: basePayout // Only base payout, overtime added conditionally in UI
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
  
  // Helper to get the next working day after a given date
  const getNextWorkingDay = (date: Date) => {
    if (!systemSettings) return null;
    
    const workDays = [
      systemSettings.workDaySunday,    // 0 = Sunday
      systemSettings.workDayMonday,    // 1 = Monday
      systemSettings.workDayTuesday,   // 2 = Tuesday
      systemSettings.workDayWednesday, // 3 = Wednesday
      systemSettings.workDayThursday,  // 4 = Thursday
      systemSettings.workDayFriday,    // 5 = Friday
      systemSettings.workDaySaturday   // 6 = Saturday
    ];
    
    const nextDay = new Date(date);
    nextDay.setDate(nextDay.getDate() + 1);
    
    // Look for the next 7 days to find a working day
    for (let i = 0; i < 7; i++) {
      const dayOfWeek = nextDay.getDay();
      if (workDays[dayOfWeek]) {
        return nextDay;
      }
      nextDay.setDate(nextDay.getDate() + 1);
    }
    
    return null; // No working day found in the next 7 days
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
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const findExistingPayout = (periodStartSearch: Date, periodEndSearch: Date) => {
    // Safety check: ensure existingPayouts is an array
    if (!Array.isArray(existingPayouts)) {
      console.warn('[EmployeePayoutsPage] existingPayouts is not an array:', existingPayouts);
      return undefined;
    }

    // Use month-based matching to find payouts within the same month
    const searchYear = periodStartSearch.getFullYear();
    const searchMonth = periodStartSearch.getMonth(); // 0-based
    
    console.log(`[Frontend Payout Search] Looking for payout in ${searchYear}-${String(searchMonth + 1).padStart(2, '0')}`);

    return existingPayouts.find(payout => {
      try {
        if (!payout.periodStart || !payout.periodEnd) {
            console.warn('[EmployeePayoutsPage] Payout record missing periodStart or periodEnd, skipping in findExistingPayout:', payout);
            return false;
        }
        
        const payoutStartDate = parseISO(payout.periodStart);
        const payoutYear = payoutStartDate.getFullYear();
        const payoutMonth = payoutStartDate.getMonth(); // 0-based
        
        // Match by year and month instead of exact dates
        const matches = payoutYear === searchYear && payoutMonth === searchMonth;
        
        if (matches) {
          console.log(`[Frontend Payout Match] Found payout for ${searchYear}-${String(searchMonth + 1).padStart(2, '0')}: Payout ID ${payout.id}, Base: ${payout.basePayout}`);
        }
        
        return matches;
      } catch (e) {
        console.warn('[EmployeePayoutsPage] Error parsing payout period dates, skipping payout in findExistingPayout:', payout, e);
        return false;
      }
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
      includeOvertime: tempChange?.includeOvertime !== undefined ? tempChange.includeOvertime : (existingPayout?.includeOvertime || false),
      hasChanges: tempChange && (
        (tempChange.isPaid !== undefined && tempChange.isPaid !== existingPayout?.isPaid) ||
        (tempChange.comment !== undefined && tempChange.comment !== (existingPayout?.comment || '')) ||
        (tempChange.adjustmentAmount !== undefined && tempChange.adjustmentAmount !== (existingPayout?.adjustmentAmount || 0)) ||
        (tempChange.adjustmentReason !== undefined && tempChange.adjustmentReason !== (existingPayout?.adjustmentReason || '')) ||
        (tempChange.includeOvertime !== undefined && tempChange.includeOvertime !== (existingPayout?.includeOvertime || false))
      )
    };
  };

  // Update temporary state
  const updateTempState = (periodStart: Date, periodEnd: Date, updates: {isPaid?: boolean, comment?: string, adjustmentAmount?: number, adjustmentReason?: string, includeOvertime?: boolean}) => {
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
            includeOvertime: currentState.includeOvertime,
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
            includeOvertime: currentState.includeOvertime,
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

  // Helper function to safely format date strings
  const safeFormatDate = (dateString: string | null | undefined, formatStr: string = 'MMM d, yyyy') => {
    if (!dateString) return 'N/A';
    try {
      return format(parseISO(dateString), formatStr);
    } catch (e) {
      console.warn('[EmployeePayoutsPage] Error formatting date:', dateString, e);
      return 'Invalid Date';
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
            const existingPayout = findExistingPayout(period.start, period.end);
            const currentState = getCurrentState(period.start, period.end);
            
            // Use stored database values if payout exists, otherwise calculate for new periods
            let payoutData;
            if (existingPayout) {
              // Use stored values from database - prioritize stored amounts
              // If basePayout is 0 but we have amount/finalAmount, derive basePayout
              let derivedBasePayout = existingPayout.basePayout || 0;
              let derivedOvertimePayout = existingPayout.overtimePayout || 0;
              
              // If basePayout is 0 but we have a total amount, try to derive the breakdown
              if (derivedBasePayout === 0 && (existingPayout.finalAmount || existingPayout.amount)) {
                const totalAmount = existingPayout.finalAmount || existingPayout.amount;
                const daysWorked = existingPayout.daysWorked || 0;
                
                // If we have days worked, calculate basePayout from daily rate
                if (daysWorked > 0 && employee.dailyRate > 0) {
                  derivedBasePayout = daysWorked * employee.dailyRate;
                  derivedOvertimePayout = Math.max(0, totalAmount - derivedBasePayout);
                } else {
                  // Fallback: assume all amount is base payout
                  derivedBasePayout = totalAmount;
                  derivedOvertimePayout = 0;
                }
              }
              
              payoutData = {
                daysWorked: existingPayout.daysWorked || 0,
                unpaidDays: existingPayout.unpaidDays || 0,
                totalHours: existingPayout.totalHours || 0,
                regularHours: existingPayout.regularHours || 0,
                overtimeHours: existingPayout.overtimeHours || 0,
                excessOvertimeHours: existingPayout.excessOvertimeHours || 0,
                basePayout: derivedBasePayout,
                overtimePayout: derivedOvertimePayout,
                workingDaysInPeriod: getWorkingDaysInPeriod(period.start, period.end),
                expectedHours: getWorkingDaysInPeriod(period.start, period.end) * (systemSettings?.workingHoursPerDay || 9)
              };
              
              console.log(`[Payout Display] ${period.label}: BasePayout: ${derivedBasePayout}, OvertimePayout: ${derivedOvertimePayout}, TotalFromDB: ${existingPayout.finalAmount || existingPayout.amount}`);
            } else {
              // Calculate for new periods only (fallback)
              payoutData = calculatePeriodPayout(period.start, period.end);
            }
            
            const { daysWorked, unpaidDays, workingDaysInPeriod, totalHours, regularHours, overtimeHours, excessOvertimeHours, basePayout, overtimePayout, expectedHours } = payoutData;
            
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
                          Paid{existingPayout?.paymentDate ? ` on ${formatEgyptTime(existingPayout.paymentDate, 'MMM d, yyyy')}` : ''}
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
                            {overtimeHours >= 0.1 && (
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground flex items-center text-sm text-orange-600">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Overtime Hours
                                </span>
                                <span className="font-semibold text-sm text-orange-600">{overtimeHours.toFixed(1)} hrs</span>
                              </div>
                            )}
                            {excessOvertimeHours >= 0.1 && (
                              <div className="flex justify-between items-center">
                                <span className="text-muted-foreground flex items-center text-sm text-amber-600">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Excess Overtime (Regular Rate)
                                </span>
                                <span className="font-semibold text-sm text-amber-600">{excessOvertimeHours.toFixed(1)} hrs</span>
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
                          
                          {/* Always show overtime section for control */}
                          <div className="space-y-2">
                            <div className="flex justify-between items-center">
                              <div className="flex items-center gap-2">
                                <span className="text-muted-foreground flex items-center text-sm text-orange-600">
                                  <Clock className="h-3 w-3 mr-1" />
                                  Overtime ({overtimeHours.toFixed(1)} hrs)
                                </span>
                                <Switch
                                  id={`overtime-toggle-${index}`}
                                  checked={currentState.includeOvertime}
                                  onCheckedChange={(checked) => {
                                    updateTempState(period.start, period.end, { includeOvertime: checked });
                                  }}
                                />
                              </div>
                              <span className={`font-semibold text-sm ${currentState.includeOvertime ? 'text-orange-600' : 'text-muted-foreground line-through'}`}>
                                L.E {overtimePayout.toFixed(2)}
                              </span>
                            </div>
                            
                            {overtimeHours === 0 && (
                              <div className="text-xs text-muted-foreground text-orange-600 ml-4">
                                ℹ️ No overtime hours calculated (all days ≤9 hrs or overtime not eligible)
                              </div>
                            )}
                            
                            {!currentState.includeOvertime && overtimePayout > 0 && (
                              <div className="text-xs text-muted-foreground text-orange-600 ml-4">
                                ⚠️ Overtime pay excluded from payout
                              </div>
                            )}
                            
                            {excessOvertimeHours >= 0.1 && (
                              <div className="text-xs text-muted-foreground text-amber-600 ml-4">
                                ℹ️ {excessOvertimeHours.toFixed(1)} hrs beyond 2-hour overtime cap paid at regular rate
                              </div>
                            )}
                            
                            {/* Debug info for overtime calculation */}
                            <div className="text-xs text-muted-foreground ml-4">
                              Regular: {regularHours.toFixed(1)}h | Overtime: {overtimeHours.toFixed(1)}h | Excess: {excessOvertimeHours.toFixed(1)}h
                            </div>
                          </div>
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
                          {existingPayout && existingPayout.adjustmentsTotal !== undefined && existingPayout.adjustmentsTotal !== 0 && (
                            <div className="flex justify-between items-center">
                              <span className={`text-muted-foreground flex items-center text-sm ${existingPayout.adjustmentsTotal > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                <DollarSign className="h-3 w-3 mr-1" />
                                Multiple Adjustments
                              </span>
                              <span className={`font-semibold text-sm ${existingPayout.adjustmentsTotal > 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {existingPayout.adjustmentsTotal > 0 ? '+' : ''}L.E {existingPayout.adjustmentsTotal.toFixed(2)}
                              </span>
                            </div>
                          )}
                          <div className="flex justify-between items-center pt-1 border-t">
                            <span className="text-muted-foreground flex items-center font-medium">
                              <DollarSign className="h-4 w-4 mr-1" />
                              Final Payout
                            </span>
                            <span className="text-lg font-bold">
                              L.E {(basePayout + (currentState.includeOvertime ? overtimePayout : 0) + currentState.adjustmentAmount).toFixed(2)}
                            </span>
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
                            <span>Paid Days</span>
                            <span className="font-medium text-green-600">{daysWorked} day(s)</span>
                          </div>
                          {unpaidDays > 0 && (
                            <div className="flex justify-between items-center text-sm">
                              <span>Unpaid Days (Late)</span>
                              <span className="font-medium text-red-600">{unpaidDays} day(s)</span>
                            </div>
                          )}
                          <div className="flex justify-between items-center text-sm">
                            <span>Absences</span>
                            <span className="font-medium">
                              {workingDaysInPeriod - (daysWorked + unpaidDays)} day(s)
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
                      {/* New Multiple Adjustments Component - Now available for all periods */}
                      <PayoutAdjustments 
                        payoutId={existingPayout?.id || null}
                        adjustments={existingPayout?.adjustments || []}
                        onAdjustmentsChange={(updatedAdjustments) => {
                          if (existingPayout) {
                            // Update existing payout - use same logic as main payouts API
                            setExistingPayouts(prev => prev.map(payout => 
                              payout.id === existingPayout.id 
                                ? { 
                                    ...payout, 
                                    adjustments: updatedAdjustments,
                                    adjustmentsTotal: updatedAdjustments.reduce((sum, adj) => sum + adj.amount, 0),
                                    totalAmount: payout.finalAmount || payout.amount
                                  }
                                : payout
                            ));
                          } else {
                            // Create new payout first, then add adjustments
                            // This will be handled by the PayoutAdjustments component
                            console.log('New payout needs to be created with adjustments:', updatedAdjustments);
                          }
                        }}
                        onPayoutCreated={(newPayout: Payout) => {
                          // Add newly created payout to state
                          setExistingPayouts(prev => [...prev, newPayout]);
                        }}
                        periodStart={period.start}
                        periodEnd={period.end}
                        employeeId={employeeId}
                        calculatedAmount={basePayout + (currentState.includeOvertime ? overtimePayout : 0) + currentState.adjustmentAmount}
                      />
                      
                      {/* Legacy Single Adjustment (for existing adjustmentAmount) */}
                      {(currentState.adjustmentAmount !== 0 || currentState.adjustmentReason) && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-md">
                          <h4 className="text-sm font-medium text-amber-800 mb-2">Legacy Adjustment</h4>
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
                        </div>
                      )}
                      
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
                            onClick={() => {
                              // Calculate the final amount including overtime toggle using derived values
                              const overtimeAmount = currentState.includeOvertime ? overtimePayout : 0;
                              const saveAmount = basePayout + overtimeAmount + currentState.adjustmentAmount;
                              savePayout(period.start, period.end, saveAmount);
                            }}
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
                        .sort((a, b) => {
                          // Handle potentially invalid dates during sort
                          try {
                            return parseISO(b.date).getTime() - parseISO(a.date).getTime();
                          } catch {
                            return 0; // Keep order if dates are invalid
                          }
                        })
                        .map((record) => (
                        <tr key={record.id} className="border-b last:border-0">
                          <td className="p-1.5">{safeFormatDate(record.date)}</td>
                          <td className="p-1.5">{record.checkIn ? formatEgyptTime(record.checkIn, 'h:mm a') : 'N/A'}</td>
                          <td className="p-1.5">
                            {record.checkOut 
                              ? formatEgyptTime(record.checkOut, 'h:mm a') 
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