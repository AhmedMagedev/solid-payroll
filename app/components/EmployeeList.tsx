import { Employee } from '../generated/prisma';

interface EmployeeListProps {
  employees: Employee[];
}

export default function EmployeeList({ employees }: EmployeeListProps) {
  if (employees.length === 0) {
    return (
      <div className="bg-white p-6 rounded-lg shadow-md text-center" dir="rtl">
        <p className="text-gray-500">لم يتم العثور على موظفين. أضف أول موظف!</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden" dir="rtl">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-muted/50">
            <tr>
              <th className="text-right p-3 font-semibold text-sm border-b">الاسم</th>
              <th className="text-right p-3 font-semibold text-sm border-b">البريد الإلكتروني</th>
              <th className="text-right p-3 font-semibold text-sm border-b">المنصب</th>
              <th className="text-right p-3 font-semibold text-sm border-b">الأجر بالساعة</th>
              <th className="text-right p-3 font-semibold text-sm border-b">الإجراءات</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {employees.map((employee) => (
              <tr key={employee.id} className="border-b hover:bg-muted/30 transition-colors">
                <td className="p-3 font-medium text-right">{employee.name}</td>
                <td className="p-3 text-muted-foreground text-right">{employee.email}</td>
                <td className="p-3 text-right">{employee.position}</td>
                <td className="p-3 font-mono text-right">{employee.hourlyRate} ج.م</td>
                {/* Actions column */}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
} 