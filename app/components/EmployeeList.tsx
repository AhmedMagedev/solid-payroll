interface Employee {
  id: number;
  name: string;
  email: string;
  position: string;
  hourlyRate: number;
  paymentBasis?: string;
  createdAt: Date;
  updatedAt: Date;
}

interface EmployeeListProps {
  employees: Employee[];
}

export default function EmployeeList({ employees }: EmployeeListProps) {
  if (employees.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md text-center">
        <p className="text-gray-500">No employees found. Add your first employee!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-left p-3 font-semibold text-sm border-b">Name</th>
              <th className="text-left p-3 font-semibold text-sm border-b">Email</th>
              <th className="text-left p-3 font-semibold text-sm border-b">Position</th>
              <th className="text-left p-3 font-semibold text-sm border-b">Hourly Rate</th>
              <th className="text-left p-3 font-semibold text-sm border-b">Payment Basis</th>
              <th className="text-left p-3 font-semibold text-sm border-b">Actions</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees.map((employee) => (
              <tr key={employee.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="p-3 font-medium">{employee.name}</td>
                <td className="p-3 text-muted-foreground">{employee.email}</td>
                <td className="p-3">{employee.position}</td>
                <td className="p-3 font-mono">${employee.hourlyRate}</td>
                <td className="p-3">{employee.paymentBasis || 'Monthly'}</td>
                {/* Actions column */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 