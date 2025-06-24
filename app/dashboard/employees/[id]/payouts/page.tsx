'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { format, startOfMonth, endOfMonth, parseISO, isWithinInterval, differenceInMinutes, eachDayOfInterval } from 'date-fns';
import { formatEgyptTime } from '@/lib/timezone';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, Calendar, Clock, CalendarCheck, CalendarX } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Toaster } from "@/components/ui/sonner";
import { Pagination, PaginationContent, PaginationItem, PaginationLink, PaginationNext, PaginationPrevious } from '@/components/ui/pagination';
import PayoutAdjustments from '@/app/components/PayoutAdjustments';

interface Employee {
  id: number;
  name: string;
  email: string;
  position: string;
  fingerprintId?: string;
  hourlyRate: number;
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
  lateAllowanceMinutes: number;
  workingHoursStart: string;
  workingHoursEnd: string;
}

interface Penalty {
  type: string;
  label: string;
  color: string;
}

interface PayoutPeriod {
  label: string;
  start: Date;
  end: Date;
  existingPayout?: Payout;
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
  // Add state to hide adjustments temporarily
  const [hideAdjustments] = useState(true);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const payoutsPerPage = 3;
  
  // Attendance pagination state
  const [attendanceCurrentPage, setAttendanceCurrentPage] = useState(1);
  const monthsPerPage = 1; // One month per page
  
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

  // Get actual payouts from database with their proper periods
  const getPayoutsFromDatabase = () => {
    console.log(`[Database Payouts] Employee ${employee.name} has ${existingPayouts.length} payouts in database`);
    
    // Convert database payouts to the format expected by the UI
    const payoutPeriods = existingPayouts.map(payout => ({
      label: formatPayoutPeriodLabel(payout),
      start: new Date(payout.periodStart),
      end: new Date(payout.periodEnd),
      existingPayout: payout
    }));
    
    // Sort by period start date (newest first)
    payoutPeriods.sort((a, b) => b.start.getTime() - a.start.getTime());
    
    console.log(`[Database Payouts] Formatted ${payoutPeriods.length} payout periods`);
    return payoutPeriods;
  };
  
  // Format payout period label based on the period dates
  const formatPayoutPeriodLabel = (payout: Payout) => {
    const start = new Date(payout.periodStart);
    const end = new Date(payout.periodEnd);
    
    // Check if it's a weekly period (6-7 days) or monthly period
    const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays <= 7) {
      // Weekly period - show week range
      return `Week ${format(start, 'MMM d')} - ${format(end, 'MMM d, yyyy')}`;
    } else {
      // Monthly period - show month name
      return format(start, 'MMMM yyyy');
    }
  };
  
  // Calculate payout for a period
  const calculatePeriodPayout = (periodStart: Date, periodEnd: Date) => {
    console.log(`[Period Payout] Calculating for period: ${periodStart.toISOString().split('T')[0]} to ${periodEnd.toISOString().split('T')[0]}`);
    console.log(`[Period Payout] Total attendance records available: ${attendance.length}`);
    
    // Filter attendance records for this period
    const periodAttendance = attendance.filter(record => {
      if (!record.date || typeof record.date !== 'string') {
        console.warn('[EmployeePayoutsPage] Invalid or missing date in attendance record, skipping:', record);
        return false;
      }
      try {
        const recordDate = parseISO(record.date);
        const isWithin = isWithinInterval(recordDate, { start: periodStart, end: periodEnd });
        
        if (isWithin) {
          console.log(`[Period Payout] Including attendance record: ${record.date} (${recordDate.toDateString()})`);
        }
        
        return isWithin;
      } catch (e) {
        console.warn('[EmployeePayoutsPage] Error parsing record.date, skipping record:', record.date, e);
        return false;
      }
    });
    
    console.log(`[Period Payout] Filtered attendance records for period: ${periodAttendance.length}`);
    
    // Calculate days worked - only count days where isPaidDay is true (or undefined for backward compatibility)
    const paidDays = periodAttendance.filter(record => record.isPaidDay !== false);
    const daysWorked = paidDays.length;
    const unpaidDays = periodAttendance.length - daysWorked;
    
    console.log(`[Period Payout] Days worked: ${daysWorked}, Unpaid days: ${unpaidDays}, Total period attendance: ${periodAttendance.length}`);
    
    // Calculate total hours worked - only from paid days
    const totalHours = paidDays.reduce((sum, record) => {
      return sum + (record.hoursWorked || 0);
    }, 0);
    
    // Calculate expected hours based on working days in period
    const workingDaysInPeriod = getWorkingDaysInPeriod(periodStart, periodEnd);
    const hoursPerDay = systemSettings?.workingHoursPerDay || 9; // Use system setting or default to 9
    const expectedHours = workingDaysInPeriod * hoursPerDay;
    
    console.log(`[Period Payout] Working days in period: ${workingDaysInPeriod}, Expected hours: ${expectedHours}, Actual hours: ${totalHours}`);
    
    // Calculate regular and overtime hours
    // NEW LOGIC: Calculate overtime based on daily hours, not total period hours
    // RULE: Overtime only counts if employee is present the next working day (if it's not a day off)
    // RULE: Only first 2 hours of overtime per day get overtime rate, rest paid at regular rate
    let regularHours = 0;
    let overtimeHours = 0;
    let excessOvertimeHours = 0;
    
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
    
    // Calculate hourly rate from Hourly Rate
            const hourlyRate = employee.hourlyRate;
    const overtimeRate = hourlyRate * 1.5; // 1.5x overtime rate
    
    // Calculate payout: base Hourly Rate (overtime is added conditionally in UI)
          const basePayout = regularHours * hourlyRate;
    const excessOvertimePayout = excessOvertimeHours * hourlyRate; // Excess overtime at regular rate
    const overtimePayout = (overtimeHours * overtimeRate) + excessOvertimePayout; // Total overtime payment
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
      
      console.log(`[Working Days] Fallback calculation (Mon-Fri): ${count} working days from ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}`);
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
    
    console.log(`[Working Days] System work days: ${workDays.map((isWork, day) => isWork ? ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][day] : null).filter(Boolean).join(', ')}`);
    
    const debugDays = [];
    while (current <= end) {
      const dayOfWeek = current.getDay();
      const isWorkDay = workDays[dayOfWeek];
      
      debugDays.push({
        date: current.toISOString().split('T')[0],
        day: ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'][dayOfWeek],
        isWorkDay
      });
      
      if (isWorkDay) {
        count++;
      }
      current.setDate(current.getDate() + 1);
    }
    
    console.log(`[Working Days] Detailed calculation from ${start.toISOString().split('T')[0]} to ${end.toISOString().split('T')[0]}:`, debugDays);
    console.log(`[Working Days] Total working days: ${count}`);
    
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
  
  const paymentPeriods = getPayoutsFromDatabase();
  
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

    console.log(`[Frontend Payout Search] Looking for payout with exact period: ${periodStartSearch.toISOString().split('T')[0]} to ${periodEndSearch.toISOString().split('T')[0]}`);

    return existingPayouts.find(payout => {
      try {
        if (!payout.periodStart || !payout.periodEnd) {
            console.warn('[EmployeePayoutsPage] Payout record missing periodStart or periodEnd, skipping in findExistingPayout:', payout);
            return false;
        }
        
        const payoutStartDate = parseISO(payout.periodStart);
        const payoutEndDate = parseISO(payout.periodEnd);
        
        // Use exact period matching for both weekly and monthly periods
        const startMatches = payoutStartDate.toISOString().split('T')[0] === periodStartSearch.toISOString().split('T')[0];
        const endMatches = payoutEndDate.toISOString().split('T')[0] === periodEndSearch.toISOString().split('T')[0];
        const exactMatch = startMatches && endMatches;
        
        if (exactMatch) {
          console.log(`[Frontend Payout Match] Found exact payout match: Payout ID ${payout.id}, Period: ${payout.periodStart} to ${payout.periodEnd}, Base: ${payout.basePayout}`);
        }
        
        return exactMatch;
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

  // Function to calculate penalties for an attendance record
  const calculatePenalties = (record: Attendance): Penalty[] => {
    const penalties: Penalty[] = [];
    
    if (!record.checkIn || !record.date || !systemSettings) return penalties;
    
    try {
      const recordDate = parseISO(record.date);
      const checkInTime = new Date(record.checkIn);
      const checkOutTime = record.checkOut ? new Date(record.checkOut) : null;
      
      // Working hours with dynamic grace period from settings
      const [startHours, startMinutes] = systemSettings.workingHoursStart.split(':');
      const [endHours, endMinutes] = systemSettings.workingHoursEnd.split(':');
      
      const workStart = new Date(recordDate);
      workStart.setHours(parseInt(startHours), parseInt(startMinutes) + systemSettings.lateAllowanceMinutes, 0, 0);
      
      const workEnd = new Date(recordDate);
      workEnd.setHours(parseInt(endHours), parseInt(endMinutes), 0, 0);
      
      // Check if it's an unpaid day
      if (record.isPaidDay === false) {
        penalties.push({ type: 'unpaid', label: 'Unpaid Day', color: 'bg-red-100 text-red-800' });
        return penalties;
      }
      
      // Calculate late arrival penalty
      if (checkInTime > workStart) {
        const lateMinutes = differenceInMinutes(checkInTime, workStart);
        const lateHours = lateMinutes / 60;
        
        if (lateHours >= 2.5) {
          penalties.push({ type: 'late-full', label: 'Whole Day Unpaid', color: 'bg-red-100 text-red-800' });
        } else if (lateHours >= 1.5) {
          penalties.push({ type: 'late-half', label: 'Half Day Penalty', color: 'bg-orange-100 text-orange-800' });
        } else if (lateHours >= 0.5) {
          penalties.push({ type: 'late-2h', label: '2h Late Penalty', color: 'bg-yellow-100 text-yellow-800' });
        }
      }
      
      // Calculate early departure penalty
      if (checkOutTime && checkOutTime < workEnd) {
        const earlyMinutes = differenceInMinutes(workEnd, checkOutTime);
        const earlyHours = earlyMinutes / 60;
        
        if (earlyHours >= 2) {
          penalties.push({ type: 'early-half', label: 'Half Day Early Penalty', color: 'bg-purple-100 text-purple-800' });
        } else if (earlyHours >= 1) {
          penalties.push({ type: 'early-2h', label: '2h Early Penalty', color: 'bg-blue-100 text-blue-800' });
        }
      }
      
    } catch (e) {
      console.warn('[EmployeePayoutsPage] Error calculating penalties for record:', record, e);
    }
    
    return penalties;
  };

  // Get absent days for a month (reused from the attendance page)
  const getAbsentDays = (monthKey: string, records: Attendance[]): { date: string; dayName: string; isWorkDay: boolean; }[] => {
    if (!systemSettings) return [];
    
    try {
      const monthDate = parseISO(monthKey + '-01');
      const start = startOfMonth(monthDate);
      const end = endOfMonth(monthDate);
      
      // Get all days in the month
      const allDays = eachDayOfInterval({ start, end });
      
      // Get attendance dates for this month
      const attendanceDates = new Set(records.map(record => record.date));
      
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
      
      // Find absent days
      const absentDays: { date: string; dayName: string; isWorkDay: boolean; }[] = [];
      
      for (const day of allDays) {
        const dateString = format(day, 'yyyy-MM-dd');
        const dayOfWeek = day.getDay();
        const isWorkDay = workDays[dayOfWeek];
        
        // If it's a work day and employee didn't attend, mark as absent
        if (isWorkDay && !attendanceDates.has(dateString)) {
          absentDays.push({
            date: dateString,
            dayName: format(day, 'EEEE'),
            isWorkDay: true
          });
        }
      }
      
      return absentDays;
    } catch (e) {
      console.warn('[EmployeePayoutsPage] Error calculating absent days:', e);
      return [];
    }
  };

  // Group attendance by month
  const groupAttendanceByMonth = () => {
    const grouped: { [key: string]: Attendance[] } = {};
    
    attendance.forEach(record => {
      try {
        const date = parseISO(record.date);
        const monthKey = format(date, 'yyyy-MM');
        
        if (!grouped[monthKey]) {
          grouped[monthKey] = [];
        }
        grouped[monthKey].push(record);
      } catch (e) {
        console.warn('[EmployeePayoutsPage] Error grouping attendance record:', record, e);
      }
    });
    
    // Sort groups by month (newest first)
    const sortedKeys = Object.keys(grouped).sort((a, b) => b.localeCompare(a));
    const sortedGrouped: { [key: string]: Attendance[] } = {};
    
    sortedKeys.forEach(key => {
      // Sort records within each month (oldest first for chronological order)
      sortedGrouped[key] = grouped[key].sort((a, b) => {
        try {
          return parseISO(a.date).getTime() - parseISO(b.date).getTime();
        } catch {
          return 0;
        }
      });
    });
    
    return sortedGrouped;
  };

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <Toaster richColors />
      
      {/* Header Section */}
      <div className="mb-6">
        <Button asChild variant="outline" size="sm" className="mb-4">
          <Link href={`/dashboard/employees/${employee.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Employee
          </Link>
        </Button>
        
        <div className="bg-slate-50 rounded-lg p-6 border border-slate-200">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 mb-2">Payouts for {employee.name}</h1>
              <div className="flex items-center flex-wrap gap-3 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <span>Payment Basis:</span> 
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 font-medium">
                    {employee.paymentBasis}
                  </Badge>
                </div>
                <span className="text-gray-400">•</span>
                <div className="flex items-center gap-2">
                  <span>Hourly Rate:</span> 
                  <Badge variant="secondary" className="bg-green-100 text-green-800 font-medium">
                    L.E {employee.hourlyRate.toFixed(2)}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Enhanced Tabs */}
      <Tabs defaultValue="payouts" className="w-full">
        <div className="bg-white rounded-lg border border-gray-200 shadow-sm mb-6">
          <TabsList className="w-full h-12 bg-gray-50 rounded-lg p-1">
            <TabsTrigger 
              value="payouts" 
              className="flex-1 h-10 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all"
            >
              💰 Payouts Overview
            </TabsTrigger>
            <TabsTrigger 
              value="attendance" 
              className="flex-1 h-10 text-sm font-medium data-[state=active]:bg-white data-[state=active]:text-blue-600 data-[state=active]:shadow-sm transition-all"
            >
              📅 Attendance Records
            </TabsTrigger>
          </TabsList>
        </div>
        
        <TabsContent value="payouts" className="space-y-6">
          {/* Pagination Logic */}
          {(() => {
            const totalPayouts = paymentPeriods.length;
            const totalPages = Math.ceil(totalPayouts / payoutsPerPage);
            const startIndex = (currentPage - 1) * payoutsPerPage;
            const endIndex = startIndex + payoutsPerPage;
            const currentPayouts = paymentPeriods.slice(startIndex, endIndex);

            const PaginationComponent = () => (
              <div className="flex justify-center items-center space-x-4 py-4">
                <Pagination>
                  <PaginationContent>
                    <PaginationItem>
                      <PaginationPrevious 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage > 1) setCurrentPage(currentPage - 1);
                        }}
                        className={currentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                    
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <PaginationItem key={page}>
                        <PaginationLink
                          href="#"
                          onClick={(e) => {
                            e.preventDefault();
                            setCurrentPage(page);
                          }}
                          isActive={page === currentPage}
                        >
                          {page}
                        </PaginationLink>
                      </PaginationItem>
                    ))}
                    
                    <PaginationItem>
                      <PaginationNext 
                        href="#"
                        onClick={(e) => {
                          e.preventDefault();
                          if (currentPage < totalPages) setCurrentPage(currentPage + 1);
                        }}
                        className={currentPage >= totalPages ? 'pointer-events-none opacity-50' : ''}
                      />
                    </PaginationItem>
                  </PaginationContent>
                </Pagination>
                
                <div className="text-sm text-muted-foreground">
                  Showing {startIndex + 1}-{Math.min(endIndex, totalPayouts)} of {totalPayouts} payouts
                </div>
              </div>
            );

            return (
              <>
                {/* Top Pagination */}
                {totalPayouts > payoutsPerPage && <PaginationComponent />}
                
                {/* Payouts List */}
                <div className="space-y-6">
                  {currentPayouts.map((period: PayoutPeriod, localIndex: number) => {
                    const index = startIndex + localIndex; // Adjust index for proper form IDs
            const existingPayout = period.existingPayout || findExistingPayout(period.start, period.end);
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
                
                // If we have days worked, calculate basePayout from Hourly Rate
                if (daysWorked > 0 && employee.hourlyRate > 0) {
                  derivedBasePayout = daysWorked * 9 * employee.hourlyRate;
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
                          <h3 className="text-md font-medium mb-3"> {period.label} - Payout Breakdown</h3>
                          
                          {/* Calculate deductions for display */}
                          {(() => {
                            // Calculate deductions from attendance data for existing payouts
                            const periodAttendance = attendance.filter(record => {
                              const recordDate = parseISO(record.date);
                              return isWithinInterval(recordDate, { start: period.start, end: period.end });
                            });
                            
                            const hoursPerDay = systemSettings?.workingHoursPerDay || 9;
                            const hourlyRate = employee.hourlyRate;
                            
                            // Calculate gross salary (perfect attendance)
                            const grossSalary = workingDaysInPeriod * hoursPerDay * hourlyRate;
                            
                            // Calculate deductions
                            const unpaidDaysCount = periodAttendance.filter(record => record.isPaidDay === false).length;
                            const unpaidDaysDeductions = unpaidDaysCount * hoursPerDay * hourlyRate;
                            
                            // Calculate penalty deductions from hours difference
                            const expectedWorkHours = daysWorked * hoursPerDay;
                            const actualWorkHours = totalHours;
                            const hoursPenalized = Math.max(0, expectedWorkHours - actualWorkHours);
                            const penaltyDeductions = hoursPenalized * hourlyRate;
                            
                            const totalDeductions = unpaidDaysDeductions + penaltyDeductions;
                            const actualPayout = existingPayout ? (existingPayout.finalAmount || existingPayout.amount) : (basePayout + (currentState.includeOvertime ? overtimePayout : 0));
                            
                            return (
                              <div className="space-y-2">
                                {/* Gross Salary */}
                                <div className="flex justify-between items-center p-2 bg-green-50 rounded">
                                  <span className="text-green-700 font-medium">Complete Salary (No Deductions)</span>
                                  <span className="font-bold text-green-800">L.E {grossSalary.toFixed(2)}</span>
                                </div>
                                
                                {/* Deductions Section */}
                                {totalDeductions > 0 && (
                                  <div className="p-2 bg-red-50 rounded">
                                    <div className="font-medium text-red-700 mb-2">Deductions:</div>
                                    <div className="space-y-1 ml-2">
                                      {unpaidDaysDeductions > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                          <span className="text-red-600">Unpaid Days ({unpaidDaysCount} days)</span>
                                          <span className="font-semibold text-red-700">-L.E {unpaidDaysDeductions.toFixed(2)}</span>
                                        </div>
                                      )}
                                      {penaltyDeductions > 0 && (
                                        <div className="flex justify-between items-center text-sm">
                                          <span className="text-red-600">Time Penalties ({hoursPenalized.toFixed(1)} hrs)</span>
                                          <span className="font-semibold text-red-700">-L.E {penaltyDeductions.toFixed(2)}</span>
                                        </div>
                                      )}
                                      <div className="flex justify-between items-center text-sm border-t border-red-300 pt-1">
                                        <span className="font-medium text-red-700">Total Deductions</span>
                                        <span className="font-bold text-red-800">-L.E {totalDeductions.toFixed(2)}</span>
                                      </div>
                                    </div>
                                  </div>
                                )}
                                
                                {/* Base Amount After Deductions */}
                                <div className="flex justify-between items-center p-2 bg-blue-50 rounded">
                                  <span className="text-blue-700 font-medium">Base Payout (After Deductions)</span>
                                  <span className="font-bold text-blue-800">L.E {basePayout.toFixed(2)}</span>
                                </div>
                                
                                {/* Overtime Section */}
                                <div className="p-2 bg-orange-50 rounded">
                                  <div className="flex justify-between items-center mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="font-medium text-orange-700">Overtime ({overtimeHours.toFixed(1)} hrs)</span>
                                      <Switch
                                        id={`overtime-toggle-${index}`}
                                        checked={currentState.includeOvertime}
                                        onCheckedChange={(checked) => {
                                          updateTempState(period.start, period.end, { includeOvertime: checked });
                                        }}
                                      />
                                    </div>
                                    <span className={`font-bold ${currentState.includeOvertime ? 'text-orange-800' : 'text-muted-foreground line-through'}`}>
                                      L.E {overtimePayout.toFixed(2)}
                                    </span>
                                  </div>
                                  {!currentState.includeOvertime && overtimePayout > 0 && (
                                    <div className="text-xs text-orange-600">
                                      Overtime pay excluded from payout
                                    </div>
                                  )}
                                  {excessOvertimeHours >= 0.1 && (
                                    <div className="text-xs text-amber-600">
                                      {excessOvertimeHours.toFixed(1)} hrs beyond 2-hour overtime cap paid at regular rate
                                    </div>
                                  )}
                                  {overtimeHours === 0 && (
                                    <div className="text-xs text-orange-600">
                                      No overtime hours calculated
                                    </div>
                                  )}
                                </div>
                                
                                {/* Adjustments if any */}
                                {!hideAdjustments && currentState.adjustmentAmount !== 0 && (
                                  <div className={`flex justify-between items-center p-2 rounded ${currentState.adjustmentAmount > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                                    <span className={`font-medium ${currentState.adjustmentAmount > 0 ? 'text-green-700' : 'text-red-700'}`}>
                                      {currentState.adjustmentAmount > 0 ? '💰 Bonus/Addition' : '📉 Deduction/Penalty'}
                                    </span>
                                    <span className={`font-bold ${currentState.adjustmentAmount > 0 ? 'text-green-800' : 'text-red-800'}`}>
                                      {currentState.adjustmentAmount > 0 ? '+' : ''}L.E {currentState.adjustmentAmount.toFixed(2)}
                                    </span>
                                  </div>
                                )}
                                
                                {/* Final Payout */}
                                <div className="flex justify-between items-center p-3 bg-gray-100 rounded-lg border-2 border-gray-300">
                                  <span className="text-gray-800 font-bold text-lg">Final Payout</span>
                                  <span className="font-bold text-gray-900 text-xl">L.E {actualPayout.toFixed(2)}</span>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                      
                      <div className="bg-muted/10 p-3 rounded-md">
                        <h4 className="font-medium mb-2 text-sm">📊 Attendance Summary</h4>
                        <div className="space-y-1">
                          <div className="flex justify-between items-center text-sm">
                            <span className="flex items-center">
                              <CalendarCheck className="h-3 w-3 mr-1" />
                              Days Worked
                            </span>
                            <span className="font-medium">{daysWorked} / {workingDaysInPeriod}</span>
                          </div>
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
                            <span className="flex items-center">
                              Regular Hours
                            </span>
                            <span className="font-medium">{regularHours.toFixed(1)} / {expectedHours}</span>
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
                          {overtimeHours >= 0.1 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-orange-600">Overtime Hours</span>
                              <span className="font-medium text-orange-600">{overtimeHours.toFixed(1)} hrs</span>
                            </div>
                          )}
                          {excessOvertimeHours >= 0.1 && (
                            <div className="flex justify-between items-center text-sm">
                              <span className="text-amber-600">Excess Overtime (Regular Rate)</span>
                              <span className="font-medium text-amber-600">{excessOvertimeHours.toFixed(1)} hrs</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    {/* Full-width comment and adjustment section */}
                    <div className="pt-2 border-t space-y-4">
                      {/* New Multiple Adjustments Component - Now available for all periods */}
                      {!hideAdjustments && (
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
                      )}
                      
                      {/* Legacy Single Adjustment (for existing adjustmentAmount) */}
                      {!hideAdjustments && (currentState.adjustmentAmount !== 0 || currentState.adjustmentReason) && (
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
                              // Note: overtimePayout now includes both 1.5x overtime + excess overtime at regular rate
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
                </div>
                
                {/* Bottom Pagination */}
                {totalPayouts > payoutsPerPage && <PaginationComponent />}
              </>
            );
          })()}
        </TabsContent>
        
        <TabsContent value="attendance" className="space-y-6">
          <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
            <div className="bg-slate-100 rounded-t-lg p-4 border-b border-slate-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 flex items-center">
                    📅 Attendance Records
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">
                    Showing {attendance.length} total records for {employee.name} • Organized by month
                  </p>
                </div>
                <Badge variant="secondary" className="bg-blue-100 text-blue-800">
                  {Object.keys(groupAttendanceByMonth()).length} months
                </Badge>
              </div>
            </div>
            <div className="p-6">
              {attendance.length > 0 ? (
                <div className="space-y-4">
                  {(() => {
                    const groupedAttendance = groupAttendanceByMonth();
                    const monthEntries = Object.entries(groupedAttendance);
                    const totalMonths = monthEntries.length;
                    const totalAttendancePages = Math.ceil(totalMonths / monthsPerPage);
                    const attendanceStartIndex = (attendanceCurrentPage - 1) * monthsPerPage;
                    const attendanceEndIndex = attendanceStartIndex + monthsPerPage;
                    const currentMonthEntries = monthEntries.slice(attendanceStartIndex, attendanceEndIndex);

                    const AttendancePaginationComponent = () => (
                      <div className="flex justify-center items-center space-x-4 py-4">
                        <Pagination>
                          <PaginationContent>
                            <PaginationItem>
                              <PaginationPrevious 
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (attendanceCurrentPage > 1) setAttendanceCurrentPage(attendanceCurrentPage - 1);
                                }}
                                className={attendanceCurrentPage <= 1 ? 'pointer-events-none opacity-50' : ''}
                              />
                            </PaginationItem>
                            
                            {Array.from({ length: totalAttendancePages }, (_, i) => i + 1).map((page) => (
                              <PaginationItem key={page}>
                                <PaginationLink
                                  href="#"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    setAttendanceCurrentPage(page);
                                  }}
                                  isActive={page === attendanceCurrentPage}
                                >
                                  {page}
                                </PaginationLink>
                              </PaginationItem>
                            ))}
                            
                            <PaginationItem>
                              <PaginationNext 
                                href="#"
                                onClick={(e) => {
                                  e.preventDefault();
                                  if (attendanceCurrentPage < totalAttendancePages) setAttendanceCurrentPage(attendanceCurrentPage + 1);
                                }}
                                className={attendanceCurrentPage >= totalAttendancePages ? 'pointer-events-none opacity-50' : ''}
                              />
                            </PaginationItem>
                          </PaginationContent>
                        </Pagination>
                        
                        <div className="text-sm text-muted-foreground">
                          Month {attendanceStartIndex + 1}-{Math.min(attendanceEndIndex, totalMonths)} of {totalMonths}
                        </div>
                      </div>
                    );
                    
                    return (
                      <>
                        {/* Top Pagination */}
                        {totalMonths > monthsPerPage && <AttendancePaginationComponent />}
                        
                        {/* Current Month Display */}
                        <div className="space-y-4">
                          {currentMonthEntries.map(([monthKey, records]) => {
                            const monthDate = parseISO(monthKey + '-01');
                            const monthName = format(monthDate, 'MMMM yyyy');
                            const absentDays = getAbsentDays(monthKey, records);
                            
                            return (
                              <div key={monthKey} className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
                                <div className="bg-slate-50 p-4 border-b border-slate-200">
                                  <div className="flex items-center justify-between">
                                    <h3 className="font-semibold text-gray-900 flex items-center">
                                      <Calendar className="h-5 w-5 mr-2 text-blue-600" />
                                      {monthName}
                                    </h3>
                                    <div className="flex items-center gap-3">
                                      <Badge variant="outline" className="bg-white border-gray-300">
                                        {records.length} attended
                                      </Badge>
                                                                             {absentDays.length > 0 && (
                                         <Badge variant="outline" className="bg-gray-100 border-gray-300 text-gray-600">
                                           {absentDays.length} absent
                                         </Badge>
                                       )}
                                    </div>
                                  </div>
                                </div>
                                
                                <div className="overflow-x-auto">
                                  <table className="w-full">
                                    <thead>
                                      <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="text-left px-4 py-3 font-semibold text-gray-700 text-sm">Date</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-700 text-sm">Check In</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-700 text-sm">Check Out</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-700 text-sm">Hours</th>
                                        <th className="text-left px-4 py-3 font-semibold text-gray-700 text-sm">Penalties</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {/* Combine and sort all records chronologically */}
                                      {(() => {
                                        // Create combined array with type indicators
                                        const attendanceItems = records.map(record => ({ type: 'attendance', data: record, date: record.date }));
                                        const absentItems = absentDays.map(day => ({ type: 'absent', data: day, date: day.date }));
                                        const allItems = [...attendanceItems, ...absentItems];
                                        
                                        // Sort all items by date chronologically (oldest first)
                                        allItems.sort((a, b) => parseISO(a.date).getTime() - parseISO(b.date).getTime());
                                        
                                        return allItems.map((item) => {
                                          if (item.type === 'attendance') {
                                            const record = item.data as Attendance;
                                            const penalties = calculatePenalties(record);
                                            
                                            return (
                                              <tr key={record.id} className="border-b border-gray-100 last:border-0 hover:bg-blue-50 transition-colors">
                                                <td className="px-4 py-3">
                                                  <div className="flex flex-col">
                                                    <span className="font-semibold text-gray-900">{safeFormatDate(record.date, 'MMM d')}</span>
                                                    <span className="text-xs text-gray-500">
                                                      {safeFormatDate(record.date, 'EEEE')}
                                                    </span>
                                                  </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700">
                                                  {record.checkIn ? formatEgyptTime(record.checkIn, 'h:mm a') : 'N/A'}
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-700">
                                                  {record.checkOut 
                                                    ? formatEgyptTime(record.checkOut, 'h:mm a') 
                                                    : '—'}
                                                </td>
                                                <td className="px-4 py-3">
                                                  <span className={`font-semibold text-sm ${record.hoursWorked && record.hoursWorked >= 9 ? 'text-green-600' : record.hoursWorked && record.hoursWorked > 0 ? 'text-orange-600' : 'text-red-600'}`}>
                                                    {record.hoursWorked?.toFixed(1) || '0'}h
                                                  </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                  <div className="flex flex-wrap gap-1">
                                                    {penalties.length > 0 ? (
                                                      penalties.map((penalty, idx) => (
                                                        <span
                                                          key={idx}
                                                          className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${penalty.color}`}
                                                        >
                                                          {penalty.label}
                                                        </span>
                                                      ))
                                                    ) : (
                                                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                                                        No Penalties
                                                      </span>
                                                    )}
                                                  </div>
                                                </td>
                                              </tr>
                                            );
                                          } else {
                                            const absentDay = item.data as { date: string; dayName: string; isWorkDay: boolean; };
                                            
                                            return (
                                              <tr key={absentDay.date} className="border-b border-gray-100 last:border-0 bg-gray-50/70 hover:bg-gray-100 transition-colors">
                                                <td className="px-4 py-3">
                                                  <div className="flex flex-col">
                                                    <span className="font-semibold text-gray-600">{safeFormatDate(absentDay.date, 'MMM d')}</span>
                                                    <span className="text-xs text-gray-500">
                                                      {absentDay.dayName}
                                                    </span>
                                                  </div>
                                                </td>
                                                <td className="px-4 py-3 text-sm text-gray-500">—</td>
                                                <td className="px-4 py-3 text-sm text-gray-500">—</td>
                                                <td className="px-4 py-3">
                                                  <span className="font-semibold text-sm text-gray-600">0h</span>
                                                </td>
                                                <td className="px-4 py-3">
                                                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-200 text-gray-700">
                                                    Absent
                                                  </span>
                                                </td>
                                              </tr>
                                            );
                                          }
                                        });
                                      })()}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                        
                        {/* Bottom Pagination */}
                        {totalMonths > monthsPerPage && <AttendancePaginationComponent />}
                      </>
                    );
                  })()}
                </div>
              ) : (
                <div className="text-center p-8 text-gray-500">
                  <CalendarX className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <h3 className="text-lg font-medium mb-2">No attendance records found</h3>
                  <p className="text-sm">No attendance data is available for this employee yet.</p>
                </div>
              )}
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
} 