'use client';

import { Button } from "@/components/ui/button";
import { Edit, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface EmployeeActionsProps {
  employeeId: number;
}

export default function EmployeeActions({ employeeId }: EmployeeActionsProps) {
  const router = useRouter();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleEdit = () => {
    router.push(`/dashboard/employees/${employeeId}/edit`);
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }

    setIsDeleting(true);
    try {
      const response = await fetch(`/api/employee/${employeeId}`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to delete employee');
      }

      // Success - redirect to employees list
      router.push('/dashboard/employees');
      router.refresh();
    } catch (error) {
      console.error('Delete error:', error);
      alert(`Error deleting employee: ${(error as Error).message}`);
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
  };

  const handleCancelDelete = () => {
    setShowDeleteConfirm(false);
  };

  if (showDeleteConfirm) {
    return (
      <div className="flex items-center space-x-2 bg-red-50 border border-red-200 rounded-md p-2">
        <span className="text-sm text-red-800 mr-2">Delete employee?</span>
        <Button 
          variant="destructive" 
          size="sm" 
          onClick={handleDelete}
          disabled={isDeleting}
        >
          {isDeleting ? 'Deleting...' : 'Yes'}
        </Button>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleCancelDelete}
          disabled={isDeleting}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center space-x-2">
      <Button variant="outline" size="icon" onClick={handleEdit} aria-label="Edit employee">
        <Edit className="h-4 w-4" />
      </Button>
      <Button 
        variant="outline" 
        size="icon" 
        onClick={handleDelete} 
        aria-label="Delete employee"
        className="hover:bg-red-50 hover:border-red-200 hover:text-red-600"
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
} 