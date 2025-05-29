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

export function CreateEmployeeForm() {
  const router = useRouter();
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    position: '',
    phone: '',
    fingerprintId: '',
    dailyRate: '',
    paymentBasis: 'Monthly', // Default to Monthly
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
      if (!formData.fingerprintId.trim()) {
        throw new Error('Fingerprint Device ID is required');
      }
      if (!formData.paymentBasis) {
        throw new Error('Payment basis is required');
      }
      
      const dailyRate = parseFloat(formData.dailyRate);
      if (isNaN(dailyRate) || dailyRate <= 0) {
        throw new Error('Daily rate must be a positive number');
      }

      // Send data to API
      const response = await fetch('/api/employees', {
        method: 'POST',
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
          dailyRate,
          paymentBasis: formData.paymentBasis,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create employee');
      }

      setSuccess(true);
      
      // Redirect to the employees list after a short delay
      setTimeout(() => {
        router.push('/dashboard/employees');
        router.refresh();
      }, 1500);
      
    } catch (err) {
      setError((err as Error).message || 'An error occurred while creating employee');
      console.error('Create error:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8">
      {error && (
        <div className="bg-red-50 border border-red-200 p-4 rounded-lg text-red-800 text-sm">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
            </svg>
            {error}
          </div>
        </div>
      )}
      
      {success && (
        <div className="bg-green-50 border border-green-200 p-4 rounded-lg text-green-800 text-sm">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
            </svg>
            Employee created successfully! Redirecting to employees list...
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Personal Information Section */}
        <div className="space-y-6">
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-medium text-gray-900">Personal Information</h3>
            <p className="text-sm text-gray-500">Basic employee details and contact information.</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium text-gray-700">
                Full Name *
              </Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="John Doe"
                required
                className="h-10"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="email" className="text-sm font-medium text-gray-700">
                Email Address *
              </Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="john.doe@company.com"
                required
                className="h-10"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="position" className="text-sm font-medium text-gray-700">
                Position *
              </Label>
              <Input
                id="position"
                name="position"
                value={formData.position}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="Software Engineer"
                required
                className="h-10"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium text-gray-700">
                Phone Number
              </Label>
              <Input
                id="phone"
                name="phone"
                type="tel"
                value={formData.phone}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="+20 123 456 7890"
                className="h-10"
              />
            </div>
          </div>
        </div>

        {/* System Information Section */}
        <div className="space-y-6">
          <div className="border-b border-gray-200 pb-4">
            <h3 className="text-lg font-medium text-gray-900">System Information</h3>
            <p className="text-sm text-gray-500">Attendance tracking and payroll configuration.</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="fingerprintId" className="text-sm font-medium text-gray-700">
              Fingerprint Device ID *
            </Label>
            <Input
              id="fingerprintId"
              name="fingerprintId"
              value={formData.fingerprintId}
              onChange={handleChange}
              disabled={isSubmitting}
              placeholder="EMP001, 12345, etc."
              required
              className="h-10"
            />
            <p className="text-xs text-gray-500 mt-1">
              Enter the unique ID used in attendance device exports. This must be unique across all employees.
            </p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="dailyRate" className="text-sm font-medium text-gray-700">
                Daily Rate (L.E) *
              </Label>
              <Input
                id="dailyRate"
                name="dailyRate"
                type="number"
                value={formData.dailyRate}
                onChange={handleChange}
                disabled={isSubmitting}
                placeholder="250.00"
                step="0.01"
                min="0"
                inputMode="decimal"
                required
                className="h-10"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="paymentBasis" className="text-sm font-medium text-gray-700">
                Payment Basis *
              </Label>
              <Select
                disabled={isSubmitting}
                value={formData.paymentBasis}
                onValueChange={(value) => handleSelectChange('paymentBasis', value)}
              >
                <SelectTrigger className="h-10">
                  <SelectValue placeholder="Select payment schedule" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Weekly">Weekly</SelectItem>
                  <SelectItem value="Biweekly">Biweekly</SelectItem>
                  <SelectItem value="Monthly">Monthly</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
        
        {/* Action Buttons */}
        <div className="flex justify-end gap-3 pt-6 border-t border-gray-200">
          <Button 
            type="button" 
            variant="outline" 
            disabled={isSubmitting}
            onClick={() => router.push('/dashboard/employees')}
            className="px-6"
          >
            Cancel
          </Button>
          <Button 
            type="submit" 
            disabled={isSubmitting}
            className="px-6 bg-blue-600 hover:bg-blue-700"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : (
              'Create Employee'
            )}
          </Button>
        </div>
      </form>
    </div>
  );
} 