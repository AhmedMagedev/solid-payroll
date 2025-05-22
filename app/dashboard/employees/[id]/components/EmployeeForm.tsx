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
  dailyRate: number;
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
    dailyRate: employee.dailyRate.toString(),
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
        throw new Error('Name is required');
      }
      if (!formData.email.trim()) {
        throw new Error('Email is required');
      }
      if (!formData.position.trim()) {
        throw new Error('Position is required');
      }
      if (!formData.paymentBasis) {
        throw new Error('Payment basis is required');
      }
      
      const dailyRate = parseFloat(formData.dailyRate);
      if (isNaN(dailyRate) || dailyRate <= 0) {
        throw new Error('Daily rate must be a positive number');
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
          dailyRate,
          paymentBasis: formData.paymentBasis,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to update employee');
      }

      setSuccess(true);
      
      // Refresh data and redirect after a short delay
      setTimeout(() => {
        router.push(`/dashboard/employees/${employee.id}`);
        router.refresh();
      }, 1500);
      
    } catch (err) {
      setError((err as Error).message || 'An error occurred while updating employee');
      console.error('Update error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-destructive/10 p-3 rounded-md text-destructive text-sm">
          {error}
        </div>
      )}
      
      {success && (
        <div className="bg-green-100 p-3 rounded-md text-green-700 text-sm">
          Employee updated successfully! Redirecting...
        </div>
      )}
      
      <div className="space-y-2">
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          name="name"
          value={formData.name}
          onChange={handleChange}
          disabled={isSubmitting}
          placeholder="Full Name"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          value={formData.email}
          onChange={handleChange}
          disabled={isSubmitting}
          placeholder="email@example.com"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="position">Position</Label>
        <Input
          id="position"
          name="position"
          value={formData.position}
          onChange={handleChange}
          disabled={isSubmitting}
          placeholder="Job Title"
          required
        />
      </div>
      
      <div className="space-y-2">
        <Label htmlFor="phone">Phone Number (Optional)</Label>
        <Input
          id="phone"
          name="phone"
          type="tel"
          value={formData.phone}
          onChange={handleChange}
          disabled={isSubmitting}
          placeholder="+20 123 456 7890"
        />
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="dailyRate">Daily Rate (L.E)</Label>
          <Input
            id="dailyRate"
            name="dailyRate"
            type="number"
            value={formData.dailyRate}
            onChange={handleChange}
            disabled={isSubmitting}
            placeholder="0.00"
            step="0.01"
            min="0"
            inputMode="decimal"
            required
          />
        </div>
        
        <div className="space-y-2">
          <Label htmlFor="paymentBasis">Payment Basis</Label>
          <Select
            disabled={isSubmitting}
            value={formData.paymentBasis}
            onValueChange={(value) => handleSelectChange('paymentBasis', value)}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Select payment basis" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Weekly">Weekly</SelectItem>
              <SelectItem value="Biweekly">Biweekly</SelectItem>
              <SelectItem value="Monthly">Monthly</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <div className="flex justify-end gap-4 pt-2">
        <Button 
          type="button" 
          variant="outline" 
          disabled={isSubmitting}
          onClick={() => router.back()}
        >
          Cancel
        </Button>
        <Button 
          type="submit" 
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Saving...
            </>
          ) : (
            'Save Changes'
          )}
        </Button>
      </div>
    </form>
  );
} 