'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import EmployeeActions from './employee-actions';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Employee {
  id: number;
  name: string;
  email: string;
  position: string;
  salary: number;
  createdAt: string;
  updatedAt: string;
}

export default function EmployeeProfilePage() {
  const params = useParams();
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const id = typeof params.id === 'string' ? params.id : Array.isArray(params.id) ? params.id[0] : '';
  const employeeId = parseInt(id, 10);

  useEffect(() => {
    async function fetchEmployee() {
      if (isNaN(employeeId)) {
        setError('Invalid employee ID');
        setIsLoading(false);
        return;
      }
      
      try {
        const response = await fetch(`/api/employee/${employeeId}`, {
          credentials: 'include',
        });
        
        if (!response.ok) {
          throw new Error('Failed to fetch employee');
        }
        
        const data = await response.json();
        setEmployee(data);
      } catch (error) {
        console.error("Failed to fetch employee:", error);
        setError('Could not load employee data');
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchEmployee();
  }, [employeeId]);

  if (isLoading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <Card className="w-full max-w-md text-center">
          <CardContent className="p-6">
            <p>Loading employee data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isNaN(employeeId)) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle className="text-destructive">Invalid Employee ID</CardTitle>
          </CardHeader>
          <CardContent>
            <p>The employee ID provided is not valid.</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/employees">Back to Employees</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!employee) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[calc(100vh-theme(spacing.16))]">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <CardTitle>Employee Not Found</CardTitle>
          </CardHeader>
          <CardContent>
            <p>Sorry, we couldn&apos;t find an employee with the ID: {employeeId}.</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/employees">Back to Employees</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const getInitials = (name: string) => {
    const parts = name.split(' ');
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  };

  return (
    <div className="p-4 md:p-6">
      <Button asChild variant="outline" size="sm" className="mb-6">
        <Link href="/dashboard/employees">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Employees
        </Link>
      </Button>

      <Card className="w-full mx-auto relative">
        <div className="absolute top-3 right-3 z-10">
          <EmployeeActions employeeId={employee.id} />
        </div>

        <CardHeader className="text-center pt-8 pb-4">
          <div className="flex justify-center mb-3">
            <Avatar className="h-20 w-20 text-2xl">
              {/* Placeholder for actual image if available */}
              {/* <AvatarImage src={employee.imageUrl} alt={employee.name} /> */}
              <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
            </Avatar>
          </div>
          <CardTitle className="text-2xl">{employee.name}</CardTitle>
          <CardDescription className="text-md">{employee.position}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 px-4 pb-4">
          <div className="border-t pt-3">
            <dl className="grid grid-cols-1 gap-x-3 gap-y-4 sm:grid-cols-2">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-muted-foreground">Employee ID</dt>
                <dd className="mt-1 text-sm text-foreground">{employee.id}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-muted-foreground">Email</dt>
                <dd className="mt-1 text-sm text-foreground">{employee.email}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-muted-foreground">Hourly Rate</dt>
                <dd className="mt-1 text-sm text-foreground">L.E {employee.salary.toFixed(2)}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-muted-foreground">Joined Date</dt>
                <dd className="mt-1 text-sm text-foreground">{new Date(employee.createdAt).toLocaleDateString()}</dd>
              </div>
            </dl>
          </div>
          {/* Add more details or actions here as needed */}
        </CardContent>
      </Card>
    </div>
  );
} 