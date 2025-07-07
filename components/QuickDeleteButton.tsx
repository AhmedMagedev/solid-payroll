'use client';

import { Button } from "@/components/ui/button";
import { Trash2 } from 'lucide-react';
import { useState } from 'react';

interface QuickDeleteButtonProps {
  employeeId: number;
  employeeName: string;
  onDelete: () => void;
}

export function QuickDeleteButton({ employeeId, employeeName, onDelete }: QuickDeleteButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    if (!showConfirm) {
      setShowConfirm(true);
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

      // Success - call the onDelete callback to update the local state
      onDelete();
    } catch (error) {
      console.error('Delete error:', error);
      alert(`Error deleting employee: ${(error as Error).message}`);
    } finally {
      setIsDeleting(false);
      setShowConfirm(false);
    }
  };

  const handleCancel = () => {
    setShowConfirm(false);
  };

  if (showConfirm) {
    return (
      <div className="flex items-center gap-1">
        <Button
          variant="destructive"
          size="sm"
          onClick={handleDelete}
          disabled={isDeleting}
          className="h-6 px-2 text-xs"
        >
          {isDeleting ? 'Deleting...' : 'Yes'}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleCancel}
          disabled={isDeleting}
          className="h-6 px-2 text-xs"
        >
          No
        </Button>
      </div>
    );
  }

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleDelete}
      className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
      title={`Delete ${employeeName}`}
    >
      <Trash2 className="h-4 w-4" />
    </Button>
  );
} 