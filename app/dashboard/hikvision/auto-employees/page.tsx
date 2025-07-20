'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, User, RefreshCw } from 'lucide-react';

interface Employee {
  id: number;
  name: string;
  email: string;
  position: string;
  hikvisionEmployeeId?: string;
  fingerprintId?: string;
  hourlyRate: number;
  paymentBasis: string;
  createdAt: string;
}

export default function HikvisionAutoEmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAutoCreatedEmployees = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/employees', {
        credentials: 'include',
      });
      
      if (!response.ok) {
        throw new Error('Failed to fetch employees');
      }
      
      const allEmployees: Employee[] = await response.json();
      
      // Filter employees that have hikvisionEmployeeId and were likely auto-created
      const autoCreatedEmployees = allEmployees.filter(emp => 
        emp.hikvisionEmployeeId && 
        emp.hikvisionEmployeeId === emp.fingerprintId &&
        (!emp.email || emp.email.includes('employee') || emp.position === 'Employee')
      );
      
      setEmployees(autoCreatedEmployees);
      setError(null);
    } catch (err) {
      setError('Failed to load employees');
      console.error('Error fetching employees:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchAutoCreatedEmployees();
  }, []);

  const handleRefresh = () => {
    fetchAutoCreatedEmployees();
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <Card className="w-full max-w-md mx-auto text-center">
          <CardContent className="p-6">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading auto-created employees...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center mb-6">
        <div className="flex items-center gap-4">
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard/employees">
              <ArrowLeft className="ml-2 h-4 w-4" />
              Back to All Employees
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold">Auto-Created Employees</h1>
            <p className="text-muted-foreground">Employees automatically created from Hikvision attendance data</p>
          </div>
        </div>
        <Button onClick={handleRefresh} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <Card className="mb-6 border-destructive">
          <CardContent className="p-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {employees.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-semibold mb-2">No Auto-Created Employees</h3>
            <p className="text-muted-foreground mb-4">
              No employees have been automatically created from Hikvision attendance data yet.
            </p>
            <div className="text-sm text-muted-foreground">
              <p>Employees will be auto-created when:</p>
              <ul className="list-disc list-inside mt-2 space-y-1">
                <li>Hikvision sends attendance data for unknown employee IDs</li>
                <li>The webhook endpoint receives new employee events</li>
                <li>Manual attendance pulls detect new employees</li>
              </ul>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          <div className="mb-4">
            <Badge variant="outline" className="text-sm">
              {employees.length} auto-created employee{employees.length !== 1 ? 's' : ''}
            </Badge>
          </div>
          
          {employees.map((employee) => (
            <Card key={employee.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle className="text-lg">{employee.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">{employee.position}</p>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="secondary">Auto-Created</Badge>
                    <Badge variant="outline">ID: {employee.hikvisionEmployeeId}</Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
                  <div>
                    <p className="font-medium text-muted-foreground">Employee ID</p>
                    <p>#{employee.id}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Hikvision ID</p>
                    <p>{employee.hikvisionEmployeeId}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Hourly Rate</p>
                    <p>L.E {employee.hourlyRate.toFixed(2)}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Payment Basis</p>
                    <p>{employee.paymentBasis}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Email</p>
                    <p className="text-xs">{employee.email || 'Not provided'}</p>
                  </div>
                  <div>
                    <p className="font-medium text-muted-foreground">Created Date</p>
                    <p>{new Date(employee.createdAt).toLocaleDateString()}</p>
                  </div>
                  <div className="md:col-span-2">
                    <div className="flex gap-2">
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/employees/${employee.id}`}>
                          View Profile
                        </Link>
                      </Button>
                      <Button asChild size="sm" variant="outline">
                        <Link href={`/dashboard/employees/${employee.id}/edit`}>
                          Edit Details
                        </Link>
                      </Button>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
} 