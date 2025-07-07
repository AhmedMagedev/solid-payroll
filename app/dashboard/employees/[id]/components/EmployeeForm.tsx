'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Employee {
  id: number;
  name: string;
  email: string;
  position: string;
  phone?: string; // Optional phone number field
  fingerprintId?: string; // For mapping to attendance device IDs
  hourlyRate: number;
  paymentBasis?: string; // Make it optional since older records might not have it
}

interface EmployeeFormProps {
  employee: Employee;
}

export function EmployeeForm({ employee }: EmployeeFormProps) {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: employee.name,
    email: employee.email,
    position: employee.position,
    phone: employee.phone || '',
    fingerprintId: employee.fingerprintId || '',
    hourlyRate: employee.hourlyRate.toString(),
    paymentBasis: employee.paymentBasis || 'Monthly', // Default to Monthly
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);
    setSuccess(false);

    try {
      // Basic validation
      if (!formData.name.trim()) {
        throw new Error('الاسم مطلوب');
      }
      if (!formData.email.trim()) {
        throw new Error('البريد الإلكتروني مطلوب');
      }
      if (!formData.position.trim()) {
        throw new Error('المنصب مطلوب');
      }
      if (!formData.fingerprintId.trim()) {
        throw new Error('رقم جهاز البصمة مطلوب');
      }
      if (!formData.paymentBasis) {
        throw new Error('أساس الدفع مطلوب');
      }
      
      const hourlyRate = parseFloat(formData.hourlyRate);
      if (isNaN(hourlyRate) || hourlyRate <= 0) {
        throw new Error('الأجر بالساعة يجب أن يكون رقماً موجباً');
      }

      // Send data to API
      const response = await fetch(`/api/employee/${employee.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          name: formData.name,
          email: formData.email,
          position: formData.position,
          phone: formData.phone || null, // Send null if empty
          fingerprintId: formData.fingerprintId, // Required field, no need for null check
          hourlyRate,
          paymentBasis: formData.paymentBasis,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'فشل في تحديث الموظف');
      }

      setSuccess(true);
      
      // Refresh data and redirect after a short delay
      setTimeout(() => {
        router.push(`/dashboard/employees/${employee.id}`);
        router.refresh();
      }, 1500);
      
    } catch (err) {
      setError((err as Error).message || 'حدث خطأ أثناء تحديث الموظف');
      console.error('Update error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-destructive/10 p-3 rounded-md text-destructive text-sm text-right">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 p-3 rounded-md text-green-700 text-sm text-right">
          تم تحديث الموظف بنجاح! جاري التوجيه...
        </div>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="name">الاسم</Label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          disabled={isSubmitting}
          placeholder="الاسم الكامل"
          className="text-right"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email">البريد الإلكتروني</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          disabled={isSubmitting}
          placeholder="email@example.com"
          className="text-right"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="position">المنصب</Label>
        <Input
          id="position"
          name="position"
          value={formData.position}
          onChange={handleChange}
          disabled={isSubmitting}
          placeholder="المسمى الوظيفي"
          className="text-right"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="phone">رقم الهاتف (اختياري)</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          disabled={isSubmitting}
          placeholder="+20 123 456 7890"
          className="text-right"
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="fingerprintId">رقم جهاز البصمة</Label>
        <Input
          id="fingerprintId"
          name="fingerprintId"
          value={formData.fingerprintId}
          onChange={handleChange}
          disabled={isSubmitting}
          placeholder="رقم الجهاز من ملفات الحضور (مثل: EMP001, 12345)"
          className="text-right"
          required
        />
        <p className="text-xs text-muted-foreground text-right">
          أدخل الرقم الفريد المستخدم في تصدير جهاز الحضور لربط هذا الموظف بصورة صحيحة.
        </p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="hourlyRate">الأجر بالساعة (ج.م)</Label>
          <Input
            id="hourlyRate"
            name="hourlyRate"
            type="number"
            value={formData.hourlyRate}
            onChange={handleChange}
            disabled={isSubmitting}
            placeholder="0.00"
            className="text-right"
            step="0.01"
            min="0"
            inputMode="decimal"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="paymentBasis">أساس الدفع</Label>
          <Select
            disabled={isSubmitting}
            value={formData.paymentBasis}
            onValueChange={(value) => handleSelectChange('paymentBasis', value)}
          >
            <SelectTrigger className="w-full text-right">
              <SelectValue placeholder="اختر أساس الدفع" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Weekly">أسبوعي</SelectItem>
              <SelectItem value="Biweekly">كل أسبوعين</SelectItem>
              <SelectItem value="Monthly">شهري</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="flex justify-end gap-4 pt-2 flex-row-reverse">
        <Button 
          type="button" 
          variant="outline" 
          disabled={isSubmitting}
          onClick={() => router.back()}
        >
          إلغاء
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              جاري الحفظ...
            </>
          ) : (
            'حفظ التغييرات'
          )}
        </Button>
      </div>
    </form>
  );
} 