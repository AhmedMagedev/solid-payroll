'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft, DollarSign, Calendar, Mail, Hash, CreditCard, Phone } from 'lucide-react';
import EmployeeActions from './employee-actions';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Employee {
  id: number;
  name: string;
  email: string;
  position: string;
  phone?: string; // Optional phone number
  dailyRate: number;
  paymentBasis?: string; // Make it optional since older records might not have it
  createdAt: string;
  updatedAt: string;
}

export default function EmployeeProfilePage() {
  const params = useParams();
  const router = useRouter();
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
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <div className="flex justify-center items-center min-h-[300px]">
          <div className="text-center">
            <div className="inline-block h-6 w-6 animate-spin rounded-full border-4 border-solid border-current border-r-transparent"></div>
            <p className="mt-2 text-muted-foreground">Loading employee data...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Card className="mx-auto max-w-2xl shadow-sm">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error}</p>
            <Button asChild className="mt-4">
              <Link href="/dashboard/employees">Back to Employees</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isNaN(employeeId)) {
    return (
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Card className="mx-auto max-w-2xl shadow-sm">
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
      <div className="p-4 md:p-6 max-w-7xl mx-auto">
        <Card className="mx-auto max-w-2xl shadow-sm">
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
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <Button asChild variant="outline" size="sm" className="mb-6">
        <Link href="/dashboard/employees">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Employees
        </Link>
      </Button>

      <Card className="mx-auto shadow-sm overflow-hidden">
        <div className="absolute top-4 right-4 z-10">
          <EmployeeActions employeeId={employee.id} />
        </div>

        <CardHeader className="text-center pt-10 pb-6 bg-muted/20">
          <div className="flex justify-center mb-4">
            <Avatar className="h-24 w-24 text-3xl border-4 border-background shadow-md">
              <AvatarFallback>{getInitials(employee.name)}</AvatarFallback>
            </Avatar>
          </div>
          <CardTitle className="text-2xl font-bold">{employee.name}</CardTitle>
          <CardDescription className="text-md mt-1">{employee.position}</CardDescription>
        </CardHeader>
        <CardContent className="px-6 py-6">
          <div className="border-t pt-6">
            <dl className="grid grid-cols-1 gap-x-6 gap-y-5 sm:grid-cols-2 md:grid-cols-3">
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-muted-foreground flex items-center">
                  <Hash className="h-4 w-4 mr-2" />
                  Employee ID
                </dt>
                <dd className="mt-1 text-base font-medium">{employee.id}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-muted-foreground flex items-center">
                  <Mail className="h-4 w-4 mr-2" />
                  Email
                </dt>
                <dd className="mt-1 text-base truncate">{employee.email}</dd>
              </div>
              {employee.phone && (
                <div className="sm:col-span-1">
                  <dt className="text-sm font-medium text-muted-foreground flex items-center">
                    <Phone className="h-4 w-4 mr-2" />
                    Phone
                  </dt>
                  <dd className="mt-1 text-base">{employee.phone}</dd>
                </div>
              )}
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-muted-foreground flex items-center">
                  <Calendar className="h-4 w-4 mr-2" />
                  Joined Date
                </dt>
                <dd className="mt-1 text-base">{new Date(employee.createdAt).toLocaleDateString()}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-muted-foreground flex items-center">
                  <DollarSign className="h-4 w-4 mr-2" />
                  Daily Rate
                </dt>
                <dd className="mt-1 text-base font-medium">L.E {employee.dailyRate.toFixed(2)}</dd>
              </div>
              <div className="sm:col-span-1">
                <dt className="text-sm font-medium text-muted-foreground flex items-center">
                  <CreditCard className="h-4 w-4 mr-2" />
                  Payment Basis
                </dt>
                <dd className="mt-1 text-base font-medium">{employee.paymentBasis || 'Monthly'}</dd>
              </div>
            </dl>
          </div>
          <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-3 sm:space-y-0 mt-8">
            <Button 
              className="sm:flex-1" 
              onClick={() => router.push(`/dashboard/employees/${employee.id}/edit`)}
            >
              Edit Profile
            </Button>
            <Button 
              variant="outline" 
              className="sm:flex-1"
              onClick={() => router.push(`/dashboard/employees/${employee.id}/attendance`)}
            >
              View Attendance
            </Button>
            <Button 
              variant="outline" 
              className="sm:flex-1"
              onClick={() => router.push(`/dashboard/employees/${employee.id}/payouts`)}
            >
              Payouts
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 