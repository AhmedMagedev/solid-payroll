'use client'; // <<< Add 'use client' for useState and event handlers

// import { prisma } from '@/app/lib/prisma'; // Removed unused import
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button"; // For pagination buttons
import { Input } from "@/components/ui/input"; // Added for Search
import { useState, useEffect, useMemo } from 'react'; // For pagination state and search optimization
import Link from 'next/link'; // Added for navigation to profile page
import { useRouter } from "next/navigation";
import { Edit, Upload } from 'lucide-react';
import { QuickDeleteButton } from "../../../components/QuickDeleteButton";

// Define the Employee interface
interface Employee {
  id: number;
  name: string;
  email: string; // Keep in interface for data structure, but won't display
  position: string;
  fingerprintId?: string;
  hourlyRate: number;
  paymentBasis?: string;
  createdAt: Date;
  updatedAt: Date;
}

const ITEMS_PER_PAGE = 15;

// This component will now handle its own data fetching or receive it as props
// For simplicity with existing structure, we'll make it fetch then manage client-side
export default function EmployeesPage() {
  const [allEmployees, setAllEmployees] = useState<Employee[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState(''); // Added for Search
  const router = useRouter();

  useEffect(() => {
    async function fetchEmployees() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/employees', {
          credentials: 'include',
        }); 
        if (!response.ok) {
          throw new Error('Failed to fetch employees');
        }
        const data: Employee[] = await response.json();
        // Sort employees by ID in ascending order
        data.sort((a, b) => a.id - b.id); // Changed sorting to by ID
        setAllEmployees(data);
        console.log('[Employees Page] Fetched employees client-side:', data.length);
      } catch (error) {
        console.error('[Employees Page] Failed to fetch employees client-side:', error);
        // set an error state here if needed
      } finally {
        setIsLoading(false);
      }
    }
    fetchEmployees();
  }, []); // Empty dependency array means this runs once on mount

  // Filter employees based on search term
  const filteredEmployees = useMemo(() => {
    if (!searchTerm) {
      return allEmployees;
    }
    return allEmployees.filter(employee =>
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.id.toString().includes(searchTerm) // Also search by ID
    );
  }, [allEmployees, searchTerm]);

  const totalPages = Math.ceil(filteredEmployees.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const endIndex = startIndex + ITEMS_PER_PAGE;
  const currentEmployees = filteredEmployees.slice(startIndex, endIndex);

  // Reset to page 1 when search term changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const handlePreviousPage = () => {
    setCurrentPage((prev) => Math.max(prev - 1, 1));
  };

  const handleNextPage = () => {
    setCurrentPage((prev) => Math.min(prev + 1, totalPages));
  };

  // Ensure no whitespace between table elements that could cause hydration errors
  return (
    <div className="p-6">      
      <div className="flex flex-col sm:flex-row justify-between sm:items-center mb-6 gap-4">
        <h1 className="text-3xl font-bold text-primary">Employees</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Input
            placeholder="Search by name or ID..." // Updated placeholder
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-full sm:max-w-xs bg-white" // Added bg-white class
          />
          <div className="flex flex-row gap-2">
            <Button onClick={() => router.push('/dashboard/employees/create')}>
              Add Employee
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.push('/dashboard/employees/upload')}
            >
              <Upload className="h-4 w-4 mr-2" />
              Upload Employees
            </Button>
            <Button onClick={() => router.push('/dashboard/attendance/upload')}>
              Upload Attendance
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Directory</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Custom table without whitespace issues */}
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="h-10 px-4 text-left align-middle font-medium w-[100px]">ID</th>
                  <th className="h-10 px-4 text-left align-middle font-medium">Name</th>
                  <th className="h-10 px-4 text-left align-middle font-medium">Position</th>
                  <th className="h-10 px-4 text-left align-middle font-medium">Device ID</th>
                  <th className="h-10 px-4 text-left align-middle font-medium">Hourly Rate</th>
                  <th className="h-10 px-4 text-right align-middle font-medium">Est. Monthly</th>
                  <th className="h-10 px-4 text-center align-middle font-medium w-[120px]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr className="border-b">
                    <td colSpan={7} className="p-4 text-center">Loading employees...</td>
                  </tr>
                ) : currentEmployees.length === 0 ? (
                  <tr className="border-b">
                    <td colSpan={7} className="p-4 text-center">
                      {searchTerm ? `No employees found matching "${searchTerm}".` : 'No employees found. Add or upload employees to get started.'}
                    </td>
                  </tr>
                ) : (
                  currentEmployees.map((employee) => (
                    <tr key={employee.id} className="border-b hover:bg-muted/50 transition-colors">
                      <td className="p-4 font-medium">{employee.id}</td>
                      <td className="p-4">
                        <Link href={`/dashboard/employees/${employee.id}`} className="hover:underline text-primary">
                          {employee.name}
                        </Link>
                      </td>
                      <td className="p-4">{employee.position}</td>
                      <td className="p-4 font-mono text-sm">
                        {employee.fingerprintId ? (
                          employee.fingerprintId
                        ) : (
                          <span className="text-orange-600 italic">Not set</span>
                        )}
                      </td>
                      <td className="p-4">L.E {employee.hourlyRate.toFixed(2)}</td>
                      <td className="p-4 text-right">L.E {(employee.hourlyRate * 9 * 22).toFixed(2)}</td>
                      <td className="p-4">
                        <div className="flex items-center justify-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/dashboard/employees/${employee.id}/edit`)}
                            className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                            title="Edit employee"
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <QuickDeleteButton 
                            employeeId={employee.id} 
                            employeeName={employee.name}
                            onDelete={() => {
                              setAllEmployees(prev => prev.filter(emp => emp.id !== employee.id));
                            }}
                          />
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 0 && (
            <div className="flex items-center justify-between py-4">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePreviousPage}
                disabled={currentPage === 1 || isLoading}
              >
                Previous
              </Button>
              <span className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages > 0 ? totalPages : 1} 
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages || isLoading || totalPages === 0}
              >
                Next
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 