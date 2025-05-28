'use client';

import { useState, useEffect } from 'react';
import {
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

import {
  ClockIcon,
  UserIcon,
  CalendarIcon,
  ClockAlert,
  CalendarX,
  DollarSign,
  AlertTriangle
} from 'lucide-react';

// Dashboard stat box component
interface StatBoxProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  isLoading?: boolean;
}

const StatBox = ({ 
  title, 
  value, 
  icon, 
  description, 
  isLoading = false
}: StatBoxProps) => {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-8 w-3/4" />
        ) : (
          <>
            <div className="text-2xl font-bold">{value}</div>
            <p className="text-xs text-muted-foreground mt-1">{description}</p>
          </>
        )}
      </CardContent>
    </Card>
  );
};



interface DashboardStats {
  totalEmployees: number;
  unpaidEmployeesCount: number;
  totalPayrollPaidThisMonth: number;
  totalOvertimePayout: number;
  weeklyAttendanceData: Array<{
    week: string;
    attendanceRate: number;
    actualAttendance: number;
    expectedAttendance: number;
  }>;
  lateArrivalsData: Array<{
    name: string;
    value: number;
    percentage: number;
  }>;
  overtimeEmployees: Array<{
    employee: {
      id: number;
      name: string;
      position: string;
    };
    totalOvertimeHours: number;
    overtimeDays: number;
  }>;
  absenteeismData: Array<{
    name: string;
    value: number;
    percentage: number;
  }>;
  thisWeekStats: {
    totalExpectedAttendance: number;
    actualAttendance: number;
    totalLateArrivals: number;
    totalOnTime: number;
  };
  metadata?: {
    isCurrentWeek: boolean;
    dataWeekStart: string;
    dataWeekEnd: string;
    currentDate: string;
  };
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/dashboard/stats', {
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch dashboard stats');
        }
        
        const data = await response.json();
        setStats(data);
      } catch (err) {
        console.error('Error fetching dashboard stats:', err);
        setError('Failed to load dashboard statistics');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchStats();
  }, []);

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground mt-1 md:mt-0">
          Overview of your company&apos;s payroll and attendance data
        </p>
      </div>

      {/* Show notice if data is from previous week */}
      {stats?.metadata && !stats.metadata.isCurrentWeek && (
        <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">
                Showing data from previous week
              </h3>
              <div className="mt-2 text-sm text-yellow-700">
                <p>
                  No attendance data found for the current week. Displaying statistics from{' '}
                  {new Date(stats.metadata.dataWeekStart).toLocaleDateString()} to{' '}
                  {new Date(stats.metadata.dataWeekEnd).toLocaleDateString()}.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stats Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatBox
          title="Total Employees"
          value={stats ? stats.totalEmployees : '-'}
          icon={<UserIcon className="h-4 w-4 text-muted-foreground" />}
          description="Registered in the system"
          isLoading={isLoading}
        />
        
        <StatBox
          title="Unpaid Employees"
          value={stats ? stats.unpaidEmployeesCount : '-'}
          icon={<AlertTriangle className="h-4 w-4 text-muted-foreground" />}
          description="Employees with unpaid payouts"
          isLoading={isLoading}
        />
        
        <StatBox
          title="Payroll Paid This Month"
          value={stats ? `L.E ${stats.totalPayrollPaidThisMonth.toFixed(2)}` : '-'}
          icon={<DollarSign className="h-4 w-4 text-green-600" />}
          description="Total payroll paid out"
          isLoading={isLoading}
        />
        
        <StatBox
          title="Overtime Payout This Month"
          value={stats ? `L.E ${stats.totalOvertimePayout.toFixed(2)}` : '-'}
          icon={<DollarSign className="h-4 w-4 text-muted-foreground" />}
          description="Total overtime compensation"
          isLoading={isLoading}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* 1. Attendance Rate by Week */}
        <Card className="col-span-1 lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <CalendarIcon className="h-5 w-5 mr-2 text-primary" />
              Attendance Rate by Week
            </CardTitle>
            <CardDescription>Weekly attendance rates for the last 4 weeks</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="h-[250px] w-full" />
              </div>
            ) : stats?.weeklyAttendanceData && stats.weeklyAttendanceData.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats.weeklyAttendanceData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="week" />
                    <YAxis domain={[0, 100]} tickFormatter={(value) => `${value}%`} />
                    <Tooltip 
                      formatter={(value: number | string) => [`${value}%`, 'Attendance Rate']}
                      labelFormatter={(label) => `Week of ${label}`}
                    />
                    <Bar dataKey="attendanceRate" fill="#3b82f6" name="Attendance Rate %" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No attendance data available for {stats?.metadata?.isCurrentWeek ? 'this week' : 'the selected period'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 2. Late Arrivals Percentage (Pie Chart) */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <ClockAlert className="h-5 w-5 mr-2 text-primary" />
              Late Arrivals {stats?.metadata?.isCurrentWeek ? 'This Week' : 'Recent Week'}
            </CardTitle>
            <CardDescription>Percentage of late vs on-time arrivals</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="h-[250px] w-full" />
              </div>
            ) : stats?.lateArrivalsData && stats.lateArrivalsData.some(item => item.value > 0) ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.lateArrivalsData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                    >
                      {stats.lateArrivalsData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name === 'Late' ? '#FF8042' : '#00C49F'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number | string) => [value, 'Count']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No attendance data available for {stats?.metadata?.isCurrentWeek ? 'this week' : 'the selected period'}
              </div>
            )}
          </CardContent>
        </Card>

        {/* 3. Absenteeism Rate (Pie Chart) */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-lg flex items-center">
              <CalendarX className="h-5 w-5 mr-2 text-primary" />
              Absenteeism Rate {stats?.metadata?.isCurrentWeek ? 'This Week' : 'Recent Week'}
            </CardTitle>
            <CardDescription>Present vs absent employees this week</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="h-[250px] w-full" />
              </div>
            ) : stats?.absenteeismData && stats.absenteeismData.some(item => item.value > 0) ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats.absenteeismData}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percentage }) => `${name}: ${percentage}%`}
                    >
                      {stats.absenteeismData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.name === 'Present' ? '#00C49F' : '#FF8042'} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number | string) => [value, 'Count']} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No attendance data available for {stats?.metadata?.isCurrentWeek ? 'this week' : 'the selected period'}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 4. Overtime Hours This Week */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center">
            <ClockIcon className="h-5 w-5 mr-2 text-primary" />
            Overtime Hours {stats?.metadata?.isCurrentWeek ? 'This Week' : 'Recent Week'}
          </CardTitle>
          <CardDescription>Employees who worked overtime this week</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded-full" />
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-[150px]" />
                    <Skeleton className="h-4 w-[100px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : stats?.overtimeEmployees && stats.overtimeEmployees.length > 0 ? (
            <div className="space-y-4">
              {stats.overtimeEmployees.map((overtime, index) => (
                <div key={index} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <div className="flex items-center justify-center h-10 w-10 rounded-full bg-primary/10 text-primary font-medium">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{overtime.employee.name}</div>
                      <div className="text-sm text-muted-foreground">{overtime.employee.position}</div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold text-lg">
                      {overtime.totalOvertimeHours.toFixed(1)} hrs
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {overtime.overtimeDays} day{overtime.overtimeDays !== 1 ? 's' : ''}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="py-8 text-center text-muted-foreground">
              <ClockIcon className="h-12 w-12 mx-auto mb-2 opacity-50" />
              <p>No overtime recorded {stats?.metadata?.isCurrentWeek ? 'this week' : 'for the selected period'}</p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 