'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Button } from '@/components/ui/button';
import { Calendar } from 'lucide-react';

interface Employee {
  id: number;
  name: string;
  email: string;
  position: string;
  dailyRate: number;
}

interface AttendanceRecord {
  id: number;
  employeeId: number;
  date: string;
  checkIn: string;
  checkOut: string | null;
  hoursWorked: number | null;
}

export default function EmployeeAttendancePage() {
  const params = useParams();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [monthlyTotal, setMonthlyTotal] = useState<number>(0);
  
  useEffect(() => {
    async function fetchData() {
      if (!params.id) return;
      
      try {
        // Fetch employee details
        const employeeResponse = await fetch(`/api/employee/${params.id}`, {
          credentials: 'include',
        });
        
        if (!employeeResponse.ok) {
          throw new Error('Failed to fetch employee details');
        }
        
        const employeeData = await employeeResponse.json();
        setEmployee(employeeData);
        
        // Fetch attendance records
        const attendanceResponse = await fetch(`/api/attendance?employeeId=${params.id}`, {
          credentials: 'include',
        });
        
        if (!attendanceResponse.ok) {
          throw new Error('Failed to fetch attendance records');
        }
        
        const attendanceData = await attendanceResponse.json();
        setAttendanceRecords(attendanceData);
        
        // Calculate monthly total hours
        let totalHours = 0;
        for (const record of attendanceData) {
          if (record.hoursWorked) {
            totalHours += record.hoursWorked;
          }
        }
        setMonthlyTotal(totalHours);
        
      } catch (err) {
        setError('Error loading data. Please try again.');
        console.error('Error fetching data:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchData();
  }, [params.id]);
  
  function formatTime(timeString: string | null) {
    if (!timeString) return 'N/A';
    try {
      const date = new Date(timeString);
      return format(date, 'h:mm a');
    } catch {
      return 'Invalid time';
    }
  }
  
  function formatDate(dateString: string) {
    try {
      const date = new Date(dateString);
      return format(date, 'MMM d, yyyy');
    } catch {
      return 'Invalid date';
    }
  }
  
  function calculateExpectedSalary() {
    if (!employee) return 0;
    const workingDays = attendanceRecords.length;
    return workingDays * employee.dailyRate;
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8">
        <div className="flex justify-center items-center min-h-[300px]">
          <div className="text-center">
            <p>Loading employee attendance...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="container mx-auto py-8">
        <Card>
          <CardContent className="p-6">
            <div className="text-center text-red-500">
              <p>{error || 'Employee not found'}</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold">{employee.name}&apos;s Attendance</h1>
          <p className="text-muted-foreground mt-1">{employee.position}</p>
        </div>
        <Button variant="outline" className="mt-4 md:mt-0">
          <Calendar className="mr-2 h-4 w-4" />
          Filter by Date
        </Button>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Workdays</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{attendanceRecords.length} days</div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Hours</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">{monthlyTotal.toFixed(2)} hours</div>
          </CardContent>
        </Card>
        
        <Card className="shadow-sm">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Expected Salary</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-bold">L.E {calculateExpectedSalary().toFixed(2)}</div>
            <div className="text-xs text-muted-foreground mt-1">Based on L.E {employee.dailyRate.toFixed(2)}/day</div>
          </CardContent>
        </Card>
      </div>
      
      {attendanceRecords.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-8">
            <div className="text-center">
              <p className="text-lg">No attendance records found for this employee.</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardHeader className="border-b">
            <CardTitle>Attendance History</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="h-12 px-6 text-left align-middle font-medium">Date</th>
                    <th className="h-12 px-6 text-left align-middle font-medium">Check In</th>
                    <th className="h-12 px-6 text-left align-middle font-medium">Check Out</th>
                    <th className="h-12 px-6 text-left align-middle font-medium">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceRecords.map((record) => (
                    <tr key={record.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="px-6 py-4 font-medium">{formatDate(record.date)}</td>
                      <td className="px-6 py-4">{formatTime(record.checkIn)}</td>
                      <td className="px-6 py-4">{formatTime(record.checkOut)}</td>
                      <td className="px-6 py-4">
                        {record.hoursWorked !== null 
                          ? `${record.hoursWorked.toFixed(2)}h` 
                          : 'N/A'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
} 