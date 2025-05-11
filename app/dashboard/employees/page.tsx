import { prisma } from '@/app/lib/prisma';
import EmployeeForm from '@/app/components/EmployeeForm'; // Adjusted import path
import EmployeeList from '@/app/components/EmployeeList'; // Adjusted import path

// Define the Employee interface to match what EmployeeList expects
interface Employee {
  id: number;
  name: string;
  email: string;
  position: string;
  salary: number;
  createdAt: Date;
  updatedAt: Date;
}

export const dynamic = 'force-dynamic'; // Keep if data fetching needs to be dynamic

export default async function EmployeesPage() {
  // Auth checks are now handled by middleware

  let employees: Employee[] = [];
  try {
    employees = await prisma.employee.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
    console.log('[Employees Page] Fetched employees:', employees.length);
  } catch (error) {
    console.error('[Employees Page] Failed to fetch employees:', error);
    // Optionally, you could throw an error or display a message to the user
  }

  return (
    // The outer main and container might be redundant if DashboardLayout provides similar padding/background
    // For now, keeping structure similar to original page, adjust as needed within DashboardLayout
    <div className="p-6"> {/* Added padding, assuming DashboardLayout handles background */}
      {/* The header with logo and title is now part of DashboardLayout via Sidebar */}
      {/* The logout button is also part of DashboardLayout via Sidebar */}
      
      <h1 className="text-3xl font-bold text-[#003366] mb-6">Manage Employees</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1">
          <EmployeeForm />
        </div>
        
        <div className="md:col-span-2">
          {/* <h2 className="text-xl font-semibold mb-4 text-[#003366]">Current Employees</h2> */}
          <EmployeeList employees={employees} />
        </div>
      </div>
    </div>
  );
} 