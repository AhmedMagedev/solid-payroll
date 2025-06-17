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
      { day: 'Sunday', enabled: settings.workDaySunday },
      { day: 'Monday', enabled: settings.workDayMonday },
      { day: 'Tuesday', enabled: settings.workDayTuesday },
      { day: 'Wednesday', enabled: settings.workDayWednesday },
      { day: 'Thursday', enabled: settings.workDayThursday },
      { day: 'Friday', enabled: settings.workDayFriday },
      { day: 'Saturday', enabled: settings.workDaySaturday },
    ];
    return days.filter(d => d.enabled).map(d => d.day);
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
          <h1 className="text-3xl font-bold">Rules & Policies</h1>
          <p className="text-muted-foreground mt-1">
            Business rules and policies that apply to all employees
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/settings">
            <Settings className="h-4 w-4 mr-2" />
            Manage Settings
          </Link>
        </Button>
      </div>

      {/* Attendance Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-blue-600" />
            Attendance Rules
          </CardTitle>
          <CardDescription>
            Rules governing check-in times, late arrivals, and paid/unpaid days
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Grace Period Rule */}
          <div className="border rounded-lg p-4 bg-orange-50 border-orange-200">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-orange-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-orange-900 mb-2">Grace Period Policy</h3>
                <div className="text-sm text-orange-800 space-y-2">
                  <p>
                    <strong>Rule:</strong> Employees arriving after the grace period will have their entire day marked as unpaid.
                  </p>
                  <div className="bg-white/50 rounded p-3 border border-orange-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="font-medium">Working Hours:</span> 
                        {settings ? ` ${settings.workingHoursStart} - ${settings.workingHoursEnd}` : ' Loading...'}
                      </div>
                      <div>
                        <span className="font-medium">Grace Period:</span> 
                        {settings ? ` ${settings.lateAllowanceMinutes} minutes` : ' Loading...'}
                      </div>
                      <div>
                        <span className="font-medium">Latest Allowed Arrival:</span> 
                        {settings ? ` ${(parseInt(settings.workingHoursStart.split(':')[0]) * 60 + parseInt(settings.workingHoursStart.split(':')[1]) + settings.lateAllowanceMinutes) >= 60 
                          ? Math.floor((parseInt(settings.workingHoursStart.split(':')[0]) * 60 + parseInt(settings.workingHoursStart.split(':')[1]) + settings.lateAllowanceMinutes) / 60).toString().padStart(2, '0') + ':' + 
                            ((parseInt(settings.workingHoursStart.split(':')[0]) * 60 + parseInt(settings.workingHoursStart.split(':')[1]) + settings.lateAllowanceMinutes) % 60).toString().padStart(2, '0')
                          : settings.workingHoursStart}` : ' Loading...'}
                      </div>
                      <div>
                        <span className="font-medium">Penalty:</span> Entire day unpaid
                      </div>
                    </div>
                  </div>
                  <p className="text-xs">
                    <strong>Example:</strong> If working hours start at 9:00 AM with 15 minutes grace period, 
                    arriving at 9:16 AM or later will result in the entire day being unpaid.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Working Days */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              Working Days
            </h3>
            <div className="flex flex-wrap gap-2">
              {['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'].map(day => {
                const isWorkDay = getWorkDays().includes(day);
                return (
                  <Badge 
                    key={day} 
                    variant={isWorkDay ? "default" : "secondary"}
                    className={isWorkDay ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-600"}
                  >
                    {isWorkDay ? <CheckCircle className="h-3 w-3 mr-1" /> : <XCircle className="h-3 w-3 mr-1" />}
                    {day}
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
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-green-600" />
            Overtime Calculation Rules
          </CardTitle>
          <CardDescription>
            Rules governing when overtime pay is calculated and awarded
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Overtime Calculation Rule */}
          <div className="border rounded-lg p-4 bg-blue-50 border-blue-200">
            <div className="flex items-start gap-3">
              <DollarSign className="h-5 w-5 text-blue-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-blue-900 mb-2">Daily Overtime Calculation</h3>
                <div className="text-sm text-blue-800 space-y-2">
                  <p>
                    <strong>Rule:</strong> Overtime hours are calculated when an employee works more than the standard daily hours.
                  </p>
                  <div className="bg-white/50 rounded p-3 border border-blue-300">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                      <div>
                        <span className="font-medium">Standard Hours/Day:</span> 
                        {settings ? ` ${settings.workingHoursPerDay} hours` : ' Loading...'}
                      </div>
                      <div>
                        <span className="font-medium">Overtime Rate:</span> 
                        {settings ? ` ${settings.overtimeMultiplier}x regular rate` : ' Loading...'}
                      </div>
                      <div>
                        <span className="font-medium">Weekend Overtime:</span> 
                        {settings ? ` ${settings.weekendOvertimeMultiplier}x regular rate` : ' Loading...'}
                      </div>
                      <div>
                        <span className="font-medium">Calculation:</span> Per day basis
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
                <h3 className="font-semibold text-amber-900 mb-2">Overtime Rate Cap</h3>
                <div className="text-sm text-amber-800 space-y-2">
                  <p>
                    <strong>Rule:</strong> Overtime multiplier rate only applies to the first 2 hours of overtime per day. Additional overtime hours are paid at regular rate.
                  </p>
                  <div className="bg-white/50 rounded p-3 border border-amber-300">
                    <div className="space-y-2 text-xs">
                      <div className="grid grid-cols-1 gap-2">
                        <div><span className="font-medium">Overtime Cap:</span> 2 hours per day at overtime rate</div>
                        <div><span className="font-medium">Excess Hours:</span> Paid at regular rate (1x)</div>
                        <div><span className="font-medium">Purpose:</span> Cost control for excessive overtime</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p><strong>Example:</strong> Employee works 12 hours (Standard: 8 hours)</p>
                    <div className="bg-white/30 rounded p-2 space-y-1">
                      <p>• Hours 1-8: Regular rate (1x)</p>
                      <p>• Hours 9-10: Overtime rate (1.5x) - First 2 overtime hours</p>
                      <p>• Hours 11-12: Regular rate (1x) - Excess overtime hours</p>
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
                <h3 className="font-semibold text-purple-900 mb-2">Overtime Eligibility Rule</h3>
                <div className="text-sm text-purple-800 space-y-2">
                  <p>
                    <strong>Rule:</strong> To receive overtime pay for a working day, the employee must be present the following working day (if it&apos;s not a day off).
                  </p>
                  <div className="bg-white/50 rounded p-3 border border-purple-300">
                    <div className="space-y-2 text-xs">
                      <div className="grid grid-cols-1 gap-2">
                        <div><span className="font-medium">Condition:</span> Must be present the next working day</div>
                        <div><span className="font-medium">Exception:</span> Rule doesn&apos;t apply if next day is a day off</div>
                        <div><span className="font-medium">Penalty:</span> Overtime hours excluded from pay calculation</div>
                      </div>
                    </div>
                  </div>
                  <div className="space-y-1 text-xs">
                    <p><strong>Examples:</strong></p>
                    <div className="bg-white/30 rounded p-2 space-y-1">
                      <p>✅ <strong>Eligible:</strong> Work 10 hours on Monday, present on Tuesday → Overtime counted</p>
                      <p>✅ <strong>Eligible:</strong> Work 10 hours on Friday, next day is Saturday (day off) → Overtime counted</p>
                      <p>❌ <strong>Not Eligible:</strong> Work 10 hours on Monday, absent on Tuesday → Overtime excluded</p>
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
                <h3 className="font-semibold text-green-900 mb-2">Overtime Pay Control</h3>
                <div className="text-sm text-green-800 space-y-2">
                  <p>
                    <strong>Rule:</strong> Overtime pay can be optionally included or excluded from each payout period.
                  </p>
                  <div className="bg-white/50 rounded p-3 border border-green-300">
                    <div className="space-y-2 text-xs">
                      <div><span className="font-medium">Control:</span> Manual toggle per payout period</div>
                      <div><span className="font-medium">Default:</span> Overtime excluded by default</div>
                      <div><span className="font-medium">Flexibility:</span> Can be enabled/disabled per employee per period</div>
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
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-purple-600" />
            Payroll Rules
          </CardTitle>
          <CardDescription>
            Rules governing salary calculations and adjustments
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Base Salary Rule */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Base Salary Calculation</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• Base salary is calculated as: <strong>Days Worked × Hourly Rate</strong></p>
              <p>• Only paid days (arriving within grace period) count toward base salary</p>
              <p>• Unpaid days (late arrivals) are excluded from base salary calculation</p>
            </div>
          </div>

          {/* Adjustments Rule */}
          <div className="border rounded-lg p-4">
            <h3 className="font-semibold mb-2">Salary Adjustments</h3>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>• Multiple adjustments can be added per payout period</p>
              <p>• Adjustment types: Bonus, Deduction, Overtime, Other</p>
              <p>• All adjustments require detailed reasons for audit purposes</p>
              <p>• Final payout = Base Salary + Overtime (if enabled) + All Adjustments</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Footer */}
      <div className="text-center text-sm text-muted-foreground border-t pt-6">
        <p>
          These rules and policies are automatically applied to all payroll calculations. 
          For questions or rule modifications, contact your system administrator.
        </p>
        <p className="mt-2">
          <strong>Last Updated:</strong> Based on current system settings
        </p>
      </div>
    </div>
  );
} 