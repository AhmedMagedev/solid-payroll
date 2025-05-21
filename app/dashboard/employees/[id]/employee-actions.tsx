'use client';

import { Button } from "@/components/ui/button";
import { Edit } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface EmployeeActionsProps {
  employeeId: number;
}

export default function EmployeeActions({ employeeId }: EmployeeActionsProps) {
  const router = useRouter();

  const handleEdit = () => {
    router.push(`/dashboard/employees/${employeeId}/edit`);
  };

  return (
    <div className="flex items-center space-x-2">
      <Button variant="outline" size="icon" onClick={handleEdit} aria-label="Edit employee">
        <Edit className="h-4 w-4" />
      </Button>
    </div>
  );
} 