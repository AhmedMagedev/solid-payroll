import { prisma } from '@/app/lib/prisma';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';

// We'll need a form component later, e.g., EmployeeForm
// import EmployeeForm from './employee-form'; 

interface EmployeeEditPageProps {
  params: {
    id: string;
  };
}

async function getEmployee(id: number) {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id },
    });
    return employee;
  } catch (error) {
    console.error("Failed to fetch employee for editing:", error);
    return null;
  }
}

export default async function EmployeeEditPage({ params }: EmployeeEditPageProps) {
  const employeeId = parseInt(params.id, 10);

  if (isNaN(employeeId)) {
    return (
      <div className="p-6">
        <Card className="w-full max-w-md mx-auto text-center">
          <CardHeader><CardTitle className="text-destructive">Invalid Employee ID</CardTitle></CardHeader>
          <CardContent><p>The employee ID is not valid.</p></CardContent>
        </Card>
      </div>
    );
  }

  const employee = await getEmployee(employeeId);

  if (!employee) {
    return (
      <div className="p-6">
        <Card className="w-full max-w-md mx-auto text-center">
          <CardHeader><CardTitle>Employee Not Found</CardTitle></CardHeader>
          <CardContent><p>Could not find employee with ID: {employeeId}.</p></CardContent>
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
            {/* <EmployeeForm employee={employee} /> */}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 