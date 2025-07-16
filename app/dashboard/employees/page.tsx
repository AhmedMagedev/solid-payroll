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
        <h1 className="text-3xl font-bold text-primary">الموظفون</h1>
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <Input
            placeholder="البحث بالاسم أو الرقم..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-full sm:max-w-xs bg-white text-right"
          />
          <div className="flex flex-row gap-2">
            <Button onClick={() => router.push('/dashboard/employees/create')}>
              إضافة موظف
            </Button>
            <Button 
              variant="outline" 
              onClick={() => router.push('/dashboard/employees/upload')}
            >
              <Upload className="h-4 w-4 ml-2" />
              رفع الموظفين
            </Button>
            <Button className="cursor-pointer" onClick={() => router.push('/dashboard/attendance/upload')}>
              رفع الحضور
            </Button>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>دليل الموظفين</CardTitle>
        </CardHeader>
        <CardContent dir="rtl">
          {/* Custom table without whitespace issues */}
          <div className="border rounded-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-right p-3 font-semibold text-sm border-b">الاسم</th>
                  <th className="text-right p-3 font-semibold text-sm border-b">البريد الإلكتروني</th>
                  <th className="text-right p-3 font-semibold text-sm border-b">المنصب</th>
                  <th className="text-right p-3 font-semibold text-sm border-b">الأجر بالساعة</th>
                  <th className="text-right p-3 font-semibold text-sm border-b">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr className="border-b">
                    <td colSpan={5} className="p-4 text-center">جاري تحميل الموظفين...</td>
                  </tr>
                ) : currentEmployees.length === 0 ? (
                  <tr className="border-b">
                    <td colSpan={5} className="p-4 text-center">
                      {searchTerm ? `لم يتم العثور على موظفين مطابقين لـ "${searchTerm}".` : 'لم يتم العثور على موظفين. أضف أو ارفع موظفين للبدء.'}
                    </td>
                  </tr>
                ) : (
                  currentEmployees.map((employee) => (
                                         <tr key={employee.id} className="border-b hover:bg-muted/30 transition-colors">
                       <td className="p-3 font-medium text-right">
                         <Link href={`/dashboard/employees/${employee.id}`} className="hover:underline text-primary">
                           {employee.name}
                         </Link>
                       </td>
                       <td className="p-3 text-muted-foreground text-right">{employee.email}</td>
                       <td className="p-3 text-right">{employee.position}</td>
                       <td className="p-3 font-mono text-right">{employee.hourlyRate} ج.م</td>
                       <td className="p-3 text-right">
                         <div className="flex items-center gap-1 justify-end">
                           <Button
                             variant="ghost"
                             size="sm"
                             onClick={() => router.push(`/dashboard/employees/${employee.id}/edit`)}
                             className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                             title="تعديل الموظف"
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
                السابق
              </Button>
              <span className="text-sm text-muted-foreground">
                صفحة {currentPage} من {totalPages > 0 ? totalPages : 1} 
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={handleNextPage}
                disabled={currentPage === totalPages || isLoading || totalPages === 0}
              >
                التالي
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
} 