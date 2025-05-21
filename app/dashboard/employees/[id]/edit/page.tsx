'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';

interface Employee {
  id: number;
  name: string;
  email: string;
  position: string;
  salary: number;
}

export default function EmployeeEditPage() {
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
      <div className="p-6">
        <Card className="w-full max-w-md mx-auto text-center">
          <CardContent className="p-6">
            <p>Loading employee data...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !employee) {
    return (
      <div className="p-6">
        <Card className="w-full max-w-md mx-auto text-center">
          <CardHeader>
            <CardTitle className="text-destructive">{error || 'Employee Not Found'}</CardTitle>
          </CardHeader>
          <CardContent>
            <p>{error ? error : `Could not find employee with ID: ${employeeId}.`}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6">
      <Button asChild variant="outline" size="sm" className="mb-6">
        <Link href={`/dashboard/employees/${employeeId}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Profile
        </Link>
      </Button>
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Edit Employee: {employee.name}</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-4">Employee ID: {employee.id}</p>
          {/* Placeholder for EmployeeForm */}
          <div className="p-6 border rounded-md bg-muted/20">
            <p className="text-center text-muted-foreground">
              Employee edit form will be here.
            </p>
            {/* Form implementation would go here */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 