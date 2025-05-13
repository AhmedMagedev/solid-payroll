'use client';

import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation'; // To redirect after delete, or for navigation
import { useState } from "react"; // For loading state

interface EmployeeActionsProps {
  employeeId: number;
  employeeName: string; // For confirmation messages
}

export default function EmployeeActions({ employeeId, employeeName }: EmployeeActionsProps) {
  const router = useRouter();
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = () => {
    router.push(`/dashboard/employees/${employeeId}/edit`);
  };

  const handleDelete = async () => {
    const confirmed = confirm(`Are you sure you want to delete ${employeeName} (ID: ${employeeId})? This action cannot be undone.`);
    if (confirmed) {
      setIsDeleting(true);
      try {
        const response = await fetch(`/api/employees/${employeeId}`, { method: 'DELETE' });
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ message: "Failed to delete employee. Server did not return valid JSON." }));
          throw new Error(errorData.message || 'Failed to delete employee');
        }
        // TODO: Add a success toast notification here
        alert(`${employeeName} has been deleted.`);
        router.push('/dashboard/employees'); // Redirect to employees list
        router.refresh(); // Refresh data on the target page
      } catch (error) {
        console.error('Delete error:', error);
        // TODO: Add an error toast notification here
        alert((error as Error).message || 'An unexpected error occurred while deleting.');
      } finally {
        setIsDeleting(false);
      }
    }
  };

  return (
    <div className="flex items-center space-x-2">
      <Button variant="outline" size="icon" onClick={handleEdit} aria-label="Edit employee" disabled={isDeleting}>
        <Edit className="h-4 w-4" />
      </Button>
      <Button variant="destructive" size="icon" onClick={handleDelete} aria-label="Delete employee" disabled={isDeleting}>
        {isDeleting ? <span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> : <Trash2 className="h-4 w-4" />}
      </Button>
    </div>
  );
} 