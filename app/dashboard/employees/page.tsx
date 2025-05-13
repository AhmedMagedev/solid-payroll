'use client'; // <<< Add 'use client' for useState and event handlers

// import { prisma } from '@/app/lib/prisma'; // Removed unused import
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileUpload } from "@/app/components/FileUpload";
import {
  Table,
  TableBody,
  // TableCaption, // Will remove or make static
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button"; // For pagination buttons
import { Input } from "@/components/ui/input"; // Added for Search
import { useState, useEffect, useMemo } from 'react'; // For pagination state and search optimization
import Link from 'next/link'; // Added for navigation to profile page

// Define the Employee interface
interface Employee {
  id: number;
  name: string;
  email: string; // Keep in interface for data structure, but won't display
  position: string;
  salary: number;
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

  useEffect(() => {
    async function fetchEmployees() {
      setIsLoading(true);
      try {
        const response = await fetch('/api/employees'); 
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
          <FileUpload />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Employee Directory</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow suppressHydrationWarning={true}>{/*
                */}<TableHead className="w-[100px]">{`ID`}</TableHead>{/*
                */}<TableHead>{`Name`}</TableHead>{/*
                */}{/* <TableHead>Email</TableHead> */}{/*
                */}<TableHead>{`Position`}</TableHead>{/*
                */}<TableHead className="text-right">{`Salary`}</TableHead>{/*
              */}</TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center">Loading employees...</TableCell></TableRow>
              ) : currentEmployees.length === 0 ? (
                <TableRow><TableCell colSpan={4} className="text-center">
                  {searchTerm ? `No employees found matching "${searchTerm}".` : 'No employees found. Add or upload employees to get started.'}
                </TableCell></TableRow>
              ) : (
                currentEmployees.map((employee) => (
                  <TableRow key={employee.id}>
                    <TableCell className="font-medium">{employee.id}</TableCell> {/* Display ID */}
                    <TableCell>
                      <Link href={`/dashboard/employees/${employee.id}`} className="hover:underline text-primary">
                        {employee.name}
                      </Link>
                    </TableCell>
                    {/* <TableCell>{employee.email}</TableCell> */} {/* Email cell removed */}
                    <TableCell>{employee.position}</TableCell>
                    <TableCell className="text-right">L.E {employee.salary.toFixed(2)}</TableCell> {/* Salary format updated */}
                  </TableRow>
                ))
              )}
            </TableBody>
            {/* Removed dynamic TableCaption, pagination controls will show page info */}
          </Table>
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