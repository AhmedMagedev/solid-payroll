'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CreateEmployeeForm } from "./components/CreateEmployeeForm";

export default function CreateEmployeePage() {
  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header Section */}
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-2">
            <span>Dashboard</span>
            <span>/</span>
            <span>Employees</span>
            <span>/</span>
            <span className="text-foreground">Add New Employee</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground">Add New Employee</h1>
          <p className="text-muted-foreground mt-2">
            Create a new employee profile with all required information including fingerprint device ID for attendance tracking.
          </p>
        </div>

        {/* Main Form Card */}
        <Card className="shadow-sm border-0 bg-white">
          <CardHeader className="pb-6">
            <CardTitle className="text-xl font-semibold text-foreground">
              Employee Information
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              Fill in the details below to add a new employee to the system.
            </p>
          </CardHeader>
          <CardContent className="px-6 pb-8">
            <CreateEmployeeForm />
          </CardContent>
        </Card>
      </div>
    </div>
  );
} 