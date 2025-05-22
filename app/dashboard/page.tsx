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
import { Badge } from '@/components/ui/badge';
import {
  ClockIcon,
  UserIcon,
  CalendarIcon,
  PercentIcon,
  CircleUser
} from 'lucide-react';

// Dashboard stat box component
interface StatBoxProps {
  title: string;
  value: string | number;
  icon: React.ReactNode;
  description: string;
  isLoading?: boolean;
  change?: string | null;
  changeType?: 'positive' | 'negative' | null;
}

const StatBox = ({ 
  title, 
  value, 
  icon, 
  description, 
  isLoading = false, 
  change = null, 
  changeType = null 
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
            {change !== null && (
              <div className={`mt-2 flex items-center text-xs ${changeType === 'positive' ? 'text-green-600' : 'text-red-600'}`}>
                {changeType === 'positive' ? '↑' : '↓'} {change}% from yesterday
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};

// Chart colors
const COLORS = ['#0088FE', '#00C49F', '#FFBB28', '#FF8042', '#8884d8'];

export default function DashboardPage() {
  const [stats, setStats] = useState<Record<string, any> | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStats() {
      try {
        const response = await fetch('/api/dashboard/stats');
        
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

  // Calculate attendance change percentage
  const calculateAttendanceChange = () => {
    if (!stats || stats.yesterdayAttendance === 0) return null;
    
    const change = ((stats.todayAttendance - stats.yesterdayAttendance) / stats.yesterdayAttendance) * 100;
    return {
      value: Math.abs(change).toFixed(1),
      type: change >= 0 ? 'positive' : 'negative' as 'positive' | 'negative'
    };
  };

  const attendanceChange = stats ? calculateAttendanceChange() : null;

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

      {/* Stats grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <StatBox
          title="Total Employees"
          value={stats ? stats.totalEmployees : '-'}
          icon={<UserIcon className="h-4 w-4 text-muted-foreground" />}
          description="Registered in the system"
          isLoading={isLoading}
        />
        
        <StatBox
          title="Today's Attendance"
          value={stats ? stats.todayAttendance : '-'}
          icon={<ClockIcon className="h-4 w-4 text-muted-foreground" />}
          description="Employees checked in today"
          isLoading={isLoading}
          change={attendanceChange?.value}
          changeType={attendanceChange?.type}
        />
        
        <StatBox
          title="Weekly Attendance"
          value={stats ? stats.last7DaysAttendance : '-'}
          icon={<CalendarIcon className="h-4 w-4 text-muted-foreground" />}
          description="Total check-ins last 7 days"
          isLoading={isLoading}
        />
        
        <StatBox
          title="Attendance Rate"
          value={stats ? `${stats.attendancePercentage}%` : '-'}
          icon={<PercentIcon className="h-4 w-4 text-muted-foreground" />}
          description="Of total workforce today"
          isLoading={isLoading}
        />
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        {/* Attendance chart */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Weekly Attendance</CardTitle>
            <CardDescription>Number of employees checking in each day</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="h-[250px] w-full" />
              </div>
            ) : stats?.attendanceChartData?.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={stats?.attendanceChartData}
                    margin={{
                      top: 5,
                      right: 30,
                      left: 20,
                      bottom: 5,
                    }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#3b82f6" name="Employees" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No attendance data available for the past week
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment basis distribution chart */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-lg">Payment Basis Distribution</CardTitle>
            <CardDescription>Employees by payment frequency</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="h-[300px] flex items-center justify-center">
                <Skeleton className="h-[250px] w-full" />
              </div>
            ) : stats?.paymentBasisChartData?.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={stats?.paymentBasisChartData}
                      cx="50%"
                      cy="50%"
                      labelLine={true}
                      outerRadius={100}
                      fill="#8884d8"
                      dataKey="value"
                      nameKey="name"
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {stats?.paymentBasisChartData?.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No payment basis data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Additional data cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Today's present employees */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Present Today</CardTitle>
            <CardDescription>First 5 employees who checked in today</CardDescription>
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
            ) : stats?.presentEmployees?.length > 0 ? (
              <div className="space-y-4">
                {stats?.presentEmployees?.map((attendance: any, index: number) => (
                  <div key={index} className="flex items-center space-x-4">
                    <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                      <CircleUser className="h-6 w-6" />
                    </div>
                    <div>
                      <div className="font-medium">{attendance.employee.name}</div>
                      <div className="text-sm text-muted-foreground">
                        {attendance.employee.position}
                      </div>
                    </div>
                    <div className="ml-auto text-sm text-muted-foreground">
                      Checked in at {new Date(attendance.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No employees have checked in today
              </div>
            )}
          </CardContent>
        </Card>

        {/* Top employees by rate */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Top Salaries</CardTitle>
            <CardDescription>Employees with highest daily rates</CardDescription>
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
            ) : stats?.topEmployeesByRate?.length > 0 ? (
              <div className="space-y-4">
                {stats?.topEmployeesByRate?.map((employee: any, index: number) => (
                  <div key={index} className="flex items-center space-x-4">
                    <div className="flex items-center justify-center h-8 w-8 rounded-full bg-primary/10 text-primary">
                      {index + 1}
                    </div>
                    <div>
                      <div className="font-medium">{employee.name}</div>
                      <div className="text-sm text-muted-foreground">{employee.position}</div>
                    </div>
                    <div className="ml-auto font-medium">
                      L.E {employee.dailyRate.toFixed(2)}/day
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-8 text-center text-muted-foreground">
                No employee data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 