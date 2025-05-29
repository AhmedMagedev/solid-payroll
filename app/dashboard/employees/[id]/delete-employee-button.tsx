'use client';

import { Button } from "@/components/ui/button";
import { Trash2, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

interface DeleteEmployeeButtonProps {
  employeeId: number;
  employeeName: string;
}

export default function DeleteEmployeeButton({ employeeId, employeeName }: DeleteEmployeeButtonProps) {
  const router = useRouter();
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [confirmationText, setConfirmationText] = useState('');
  const [isDeleting, setIsDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expectedConfirmation = `DELETE ${employeeName.toUpperCase()}`;

  const handleInitialDelete = () => {
    setShowConfirmation(true);
    setError(null);
  };

  const handleConfirmDelete = async () => {
    if (confirmationText !== expectedConfirmation) {
      setError(`Please type exactly: ${expectedConfirmation}`);
      return;
    }

    setIsDeleting(true);
    setError(null);

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
      setError(`Error deleting employee: ${(error as Error).message}`);
    } finally {
      setIsDeleting(false);
    }
  };

  const handleCancel = () => {
    setShowConfirmation(false);
    setConfirmationText('');
    setError(null);
  };

  if (showConfirmation) {
    return (
      <div className="space-y-4 w-full max-w-md">
        <div className="text-sm">
          <p className="font-medium text-red-800 mb-2">
            Are you sure you want to delete {employeeName}?
          </p>
          <p className="text-red-600 mb-3">
            This will permanently delete:
          </p>
          <ul className="text-red-600 text-xs space-y-1 mb-4">
            <li>• Employee profile and personal information</li>
            <li>• All attendance records</li>
            <li>• All payout records and adjustments</li>
            <li>• Any associated data</li>
          </ul>
          <p className="text-red-800 font-medium">
            Type <span className="font-mono bg-red-100 px-1 rounded">{expectedConfirmation}</span> to confirm:
          </p>
        </div>
        
        <input
          type="text"
          value={confirmationText}
          onChange={(e) => setConfirmationText(e.target.value)}
          className="w-full px-3 py-2 border border-red-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-red-500"
          placeholder={expectedConfirmation}
          disabled={isDeleting}
        />
        
        {error && (
          <div className="text-xs text-red-600 bg-red-100 p-2 rounded">
            {error}
          </div>
        )}
        
        <div className="flex gap-2 justify-end">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleCancel}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button 
            variant="destructive" 
            size="sm" 
            onClick={handleConfirmDelete}
            disabled={isDeleting || confirmationText !== expectedConfirmation}
          >
            {isDeleting ? (
              <>
                <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                Deleting...
              </>
            ) : (
              <>
                <Trash2 className="mr-2 h-3 w-3" />
                Delete Employee
              </>
            )}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <Button 
      variant="destructive" 
      size="sm"
      onClick={handleInitialDelete}
      className="shrink-0"
    >
      <Trash2 className="mr-2 h-4 w-4" />
      Delete Employee
    </Button>
  );
} 