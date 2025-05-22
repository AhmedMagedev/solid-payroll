'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Switch } from '@/components/ui/switch';
import { AlertCircle, CheckCircle2, Settings as SettingsIcon, Clock } from 'lucide-react';

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

export default function SettingsPage() {
  const [settings, setSettings] = useState<SystemSettings>({
    id: 0,
    lateAllowanceMinutes: 15,
    workDaySunday: false,
    workDayMonday: true,
    workDayTuesday: true,
    workDayWednesday: true,
    workDayThursday: true,
    workDayFriday: true,
    workDaySaturday: false,
    workingHoursPerDay: 8,
    workingHoursStart: '09:00',
    workingHoursEnd: '17:00',
    overtimeMultiplier: 1.5,
    weekendOvertimeMultiplier: 2,
  });
  
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{
    success?: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  // Ensure time values are always formatted correctly
  const formatTimeValue = (time: string | undefined | null): string => {
    if (!time) return '09:00';
    
    // Check if the time is in HH:MM format
    const isValidTimeFormat = /^([0-1]?[0-9]|2[0-3]):[0-5][0-9]$/.test(time);
    return isValidTimeFormat ? time : '09:00';
  };

  // Format time for display with AM/PM
  const formatTimeForDisplay = (time: string): string => {
    try {
      const [hours, minutes] = time.split(':');
      const hourNum = parseInt(hours, 10);
      const period = hourNum >= 12 ? 'PM' : 'AM';
      const hour12 = hourNum % 12 || 12;
      return `${hour12.toString().padStart(2, '0')}:${minutes} ${period}`;
    } catch {
      return '09:00 AM';
    }
  };

  // Parse display time back to 24h format
  const parseTimeFromDisplay = (displayTime: string): string => {
    try {
      const [timePart, period] = displayTime.split(' ');
      const [hours, minutes] = timePart.split(':');
      let hour = parseInt(hours, 10);
      
      if (period === 'PM' && hour < 12) {
        hour += 12;
      } else if (period === 'AM' && hour === 12) {
        hour = 0;
      }
      
      return `${hour.toString().padStart(2, '0')}:${minutes}`;
    } catch {
      return '09:00';
    }
  };

  // Fetch settings on load
  useEffect(() => {
    async function fetchSettings() {
      try {
        const response = await fetch('/api/settings');
        
        if (!response.ok) {
          throw new Error('Failed to fetch settings');
        }
        
        const data: SystemSettings = await response.json();
        
        // Ensure the time values are properly formatted
        const formattedData = {
          ...data,
          workingHoursStart: formatTimeValue(data.workingHoursStart),
          workingHoursEnd: formatTimeValue(data.workingHoursEnd)
        };
        
        setSettings(formattedData);
      } catch (error) {
        console.error('Error loading settings:', error);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchSettings();
  }, []);

  // Handle input changes
  const handleChange = <K extends keyof SystemSettings>(key: K, value: SystemSettings[K]) => {
    setSettings(prev => ({
      ...prev,
      [key]: value,
    }));
  };

  // Save settings
  const handleSave = async () => {
    setIsSaving(true);
    setSaveResult(null);
    
    try {
      const response = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setSaveResult({
          success: true,
          message: 'Settings saved successfully',
        });
      } else {
        setSaveResult({
          success: false,
          error: data.error || 'Failed to save settings',
        });
      }
    } catch (error) {
      setSaveResult({
        success: false,
        error: 'An error occurred while saving settings',
      });
      console.error('Error saving settings:', error);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex justify-center items-center min-h-[300px]">
          <div className="text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
            <p className="mt-2 text-muted-foreground">Loading settings...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">System Settings</h1>
          <p className="text-muted-foreground mt-1">Configure global system parameters</p>
        </div>
        <Button onClick={handleSave} disabled={isSaving} className="w-full md:w-auto">
          {isSaving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>
      
      {saveResult && (
        <div className="mb-6">
          {saveResult.success ? (
            <Alert className="bg-green-50 border-green-500">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <AlertTitle className="text-green-800 font-medium">Success!</AlertTitle>
              <AlertDescription className="text-green-700">
                {saveResult.message}
              </AlertDescription>
            </Alert>
          ) : (
            <Alert variant="destructive">
              <AlertCircle className="h-5 w-5" />
              <AlertTitle>Error</AlertTitle>
              <AlertDescription>
                {saveResult.error}
              </AlertDescription>
            </Alert>
          )}
        </div>
      )}
      
      <div className="space-y-6">
        <Card className="shadow-sm">
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="flex items-center">
              <SettingsIcon className="h-5 w-5 mr-2" />
              Attendance Rules
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-8 md:grid-cols-2">
              <div>
                <div className="mb-6">
                  <Label htmlFor="lateAllowanceMinutes" className="text-base font-medium mb-2 block">
                    Late Allowance (minutes)
                  </Label>
                  <Input
                    id="lateAllowanceMinutes"
                    type="number"
                    value={settings.lateAllowanceMinutes}
                    onChange={(e) => handleChange('lateAllowanceMinutes', parseInt(e.target.value) || 0)}
                    min="0"
                    max="60"
                    className="h-11"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Grace period before an employee is marked as late
                  </p>
                </div>
                
                <div>
                  <Label htmlFor="workingHoursPerDay" className="text-base font-medium mb-2 block">
                    Working Hours Per Day
                  </Label>
                  <Input
                    id="workingHoursPerDay"
                    type="number"
                    value={settings.workingHoursPerDay}
                    onChange={(e) => handleChange('workingHoursPerDay', parseFloat(e.target.value) || 0)}
                    min="1"
                    max="12"
                    step="0.5"
                    className="h-11"
                  />
                  <p className="text-sm text-muted-foreground mt-2">
                    Standard number of hours in a work day
                  </p>
                </div>
              </div>
              
              <div>
                <Label className="text-base font-medium mb-4 block">Working Days</Label>
                <div className="space-y-4">
                  {[
                    { key: 'workDaySunday', label: 'Sunday' },
                    { key: 'workDayMonday', label: 'Monday' },
                    { key: 'workDayTuesday', label: 'Tuesday' },
                    { key: 'workDayWednesday', label: 'Wednesday' },
                    { key: 'workDayThursday', label: 'Thursday' },
                    { key: 'workDayFriday', label: 'Friday' },
                    { key: 'workDaySaturday', label: 'Saturday' },
                  ].map(({ key, label }) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label htmlFor={key} className="cursor-pointer">{label}</Label>
                      <Switch 
                        id={key} 
                        checked={settings[key as keyof SystemSettings] as boolean}
                        onCheckedChange={(checked: boolean) => 
                          handleChange(key as keyof SystemSettings, checked)
                        }
                      />
                    </div>
                  ))}
                </div>
                <p className="text-sm text-muted-foreground mt-3">
                  Toggle which days are regular working days
                </p>
              </div>

              <div className="md:col-span-2">
                <div className="flex items-center gap-2 mb-4">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-base font-medium">Working Hours</Label>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <Label htmlFor="workingHoursStart" className="text-sm font-medium mb-2 block">Start Time</Label>
                    <div className="relative">
                      <Input
                        id="workingHoursStart"
                        value={formatTimeForDisplay(settings.workingHoursStart || '09:00')}
                        onChange={(e) => {
                          const timeIn24h = parseTimeFromDisplay(e.target.value);
                          handleChange('workingHoursStart', timeIn24h);
                        }}
                        className="h-11 pr-10"
                      />
                      <Clock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                  
                  <div>
                    <Label htmlFor="workingHoursEnd" className="text-sm font-medium mb-2 block">End Time</Label>
                    <div className="relative">
                      <Input
                        id="workingHoursEnd"
                        value={formatTimeForDisplay(settings.workingHoursEnd || '17:00')}
                        onChange={(e) => {
                          const timeIn24h = parseTimeFromDisplay(e.target.value);
                          handleChange('workingHoursEnd', timeIn24h);
                        }}
                        className="h-11 pr-10"
                      />
                      <Clock className="absolute right-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-muted-foreground pointer-events-none" />
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-muted-foreground mt-3">
                  Set the standard working hours for all employees
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="shadow-sm">
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle className="flex items-center">
              <SettingsIcon className="h-5 w-5 mr-2" />
              Payroll Settings
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-6">
            <div className="grid gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="overtimeMultiplier" className="text-base font-medium mb-2 block">
                  Overtime Multiplier
                </Label>
                <Input
                  id="overtimeMultiplier"
                  type="number"
                  value={settings.overtimeMultiplier}
                  onChange={(e) => handleChange('overtimeMultiplier', parseFloat(e.target.value) || 0)}
                  min="1"
                  max="3"
                  step="0.1"
                  className="h-11"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Pay multiplier for overtime hours on regular days
                </p>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="weekendOvertimeMultiplier" className="text-base font-medium mb-2 block">
                  Weekend/Holiday Multiplier
                </Label>
                <Input
                  id="weekendOvertimeMultiplier"
                  type="number"
                  value={settings.weekendOvertimeMultiplier}
                  onChange={(e) => handleChange('weekendOvertimeMultiplier', parseFloat(e.target.value) || 0)}
                  min="1"
                  max="3"
                  step="0.1"
                  className="h-11"
                />
                <p className="text-sm text-muted-foreground mt-2">
                  Pay multiplier for hours worked on weekends or holidays
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 