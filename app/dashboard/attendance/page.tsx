'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { format } from 'date-fns';
import { Upload, AlertCircle } from 'lucide-react';

interface Attendance {
  id: number;
  employeeId: number;
  date: string;
  checkIn: string;
  checkOut: string | null;
  hoursWorked: number | null;
  employeeName?: string;
}

export default function AttendancePage() {
  const router = useRouter();
  const [attendanceData, setAttendanceData] = useState<Attendance[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchAttendance() {
      try {
        const response = await fetch('/api/attendance', {
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch attendance data');
        }
        
        const data = await response.json();
        setAttendanceData(data);
      } catch (err) {
        setError('Error loading attendance data. Please try again.');
        console.error('Error fetching attendance:', err);
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchAttendance();
  }, []);

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

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold">Attendance Records</h1>
          <p className="text-muted-foreground mt-1">View and manage employee attendance data</p>
        </div>
        <Button onClick={() => router.push('/dashboard/attendance/upload')} className="w-full md:w-auto">
          <Upload className="h-4 w-4 mr-2" />
          Upload Attendance Log
        </Button>
      </div>
      
      {isLoading ? (
        <Card className="shadow-sm">
          <CardContent className="p-8">
            <div className="flex justify-center items-center min-h-[200px]">
              <div className="text-center">
                <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-current border-r-transparent mb-2"></div>
                <p className="text-muted-foreground">Loading attendance data...</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="shadow-sm border-red-100">
          <CardContent className="p-6">
            <div className="flex items-center justify-center text-red-500 mb-2">
              <AlertCircle className="h-5 w-5 mr-2" />
              <p className="font-medium">{error}</p>
            </div>
            <div className="text-center">
              <Button 
                variant="outline" 
                onClick={() => window.location.reload()}
                size="sm"
                className="mt-2"
              >
                Try Again
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : attendanceData.length === 0 ? (
        <Card className="shadow-sm">
          <CardContent className="p-10">
            <div className="text-center max-w-md mx-auto">
              <div className="bg-muted rounded-full h-12 w-12 flex items-center justify-center mx-auto mb-4">
                <Upload className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">No attendance records found</h3>
              <p className="text-muted-foreground mb-4">Upload your first attendance log to start tracking employee hours.</p>
              <Button onClick={() => router.push('/dashboard/attendance/upload')}>
                Upload Attendance Log
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="shadow-sm">
          <CardHeader className="bg-muted/20 border-b">
            <CardTitle>Attendance Records</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="h-12 px-6 text-left align-middle font-medium text-muted-foreground">Employee</th>
                    <th className="h-12 px-6 text-left align-middle font-medium text-muted-foreground">Date</th>
                    <th className="h-12 px-6 text-left align-middle font-medium text-muted-foreground">Check In</th>
                    <th className="h-12 px-6 text-left align-middle font-medium text-muted-foreground">Check Out</th>
                    <th className="h-12 px-6 text-left align-middle font-medium text-muted-foreground">Hours</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceData.map((record) => (
                    <tr key={record.id} className="border-b border-border/50 hover:bg-muted/30">
                      <td className="py-4 px-6">
                        <div className="font-medium">
                          {record.employeeName || `Employee #${record.employeeId}`}
                        </div>
                      </td>
                      <td className="py-4 px-6">{formatDate(record.date)}</td>
                      <td className="py-4 px-6">{formatTime(record.checkIn)}</td>
                      <td className="py-4 px-6">{formatTime(record.checkOut)}</td>
                      <td className="py-4 px-6">
                        {record.hoursWorked !== null 
                          ? <span className="font-medium">{record.hoursWorked.toFixed(2)}h</span> 
                          : <span className="text-muted-foreground">N/A</span>}
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