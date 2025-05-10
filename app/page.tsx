import { prisma } from '@/lib/prisma';
import EmployeeForm from './components/EmployeeForm';
import EmployeeList from './components/EmployeeList';

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

// This tells Next.js not to attempt database connection during build
export const dynamic = 'force-dynamic';

export default async function Home() {
  // Use try-catch to gracefully handle database connection issues
  let employees: Employee[] = [];
  try {
    employees = await prisma.employee.findMany({
      orderBy: {
        createdAt: 'desc',
      },
    });
  } catch (error) {
    console.error('Failed to fetch employees:', error);
    // Continue with empty employee list
  }

  return (
    <main className="min-h-screen bg-gray-100 py-10">
      <div className="container mx-auto px-4">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Solid Payroll</h1>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <EmployeeForm />
          </div>
          
          <div className="md:col-span-2">
            <h2 className="text-xl font-semibold mb-4 text-gray-800">Employees</h2>
            <EmployeeList employees={employees} />
          </div>
        </div>
        </div>
      </main>
  );
}
