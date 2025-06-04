'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, DollarSign } from 'lucide-react';
import { formatEgyptTime } from '@/lib/timezone';

interface PayoutAdjustment {
  id: number;
  payoutId: number;
  type: string;
  amount: number;
  reason: string;
  createdAt: string;
  updatedAt: string;
}

interface Payout {
  id: number;
  employeeId: number;
  periodStart: string;
  periodEnd: string;
  amount: number;
  isPaid: boolean;
  comment: string | null;
  paymentDate: string | null;
  adjustmentAmount?: number;
  adjustmentReason?: string;
  adjustments?: PayoutAdjustment[];
  adjustmentsTotal?: number;
  totalAmount?: number;
}

interface PayoutAdjustmentsProps {
  payoutId: number | null;
  adjustments: PayoutAdjustment[];
  onAdjustmentsChange: (adjustments: PayoutAdjustment[]) => void;
  onPayoutCreated?: (newPayout: Payout) => void;
  periodStart?: Date;
  periodEnd?: Date;
  employeeId?: number;
  calculatedAmount?: number;
}

const ADJUSTMENT_TYPES = [
  { value: 'bonus', label: 'Bonus', color: 'bg-green-100 text-green-800' },
  { value: 'deduction', label: 'Deduction', color: 'bg-red-100 text-red-800' },
  { value: 'overtime', label: 'Overtime', color: 'bg-blue-100 text-blue-800' },
  { value: 'other', label: 'Other', color: 'bg-gray-100 text-gray-800' }
];

export default function PayoutAdjustments({ 
  payoutId, 
  adjustments, 
  onAdjustmentsChange,
  onPayoutCreated,
  periodStart,
  periodEnd,
  employeeId,
  calculatedAmount
}: PayoutAdjustmentsProps) {
  const [isAddingNew, setIsAddingNew] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState({
    type: '',
    amount: '',
    reason: ''
  });
  const [isLoading, setIsLoading] = useState(false);

  const getTypeConfig = (type: string) => {
    return ADJUSTMENT_TYPES.find(t => t.value === type) || ADJUSTMENT_TYPES[3];
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.type || !formData.amount || !formData.reason) return;

    setIsLoading(true);
    try {
      let currentPayoutId = payoutId;
      
      // If no payout exists, create one first
      if (!currentPayoutId && onPayoutCreated && periodStart && periodEnd && employeeId !== undefined && calculatedAmount !== undefined) {
        const createPayoutResponse = await fetch('/api/payouts', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({
            employeeId,
            periodStart,
            periodEnd,
            amount: calculatedAmount,
            isPaid: false,
            comment: '',
          })
        });

        if (!createPayoutResponse.ok) {
          throw new Error('Failed to create payout');
        }

        const newPayout = await createPayoutResponse.json();
        currentPayoutId = newPayout.id;
        onPayoutCreated(newPayout);
      }

      if (!currentPayoutId) {
        throw new Error('No payout ID available');
      }

      const url = editingId 
        ? `/api/payouts/adjustments/${editingId}`
        : `/api/payouts/${currentPayoutId}/adjustments`;
      
      const method = editingId ? 'PUT' : 'POST';
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('Failed to save adjustment');
      }

      // Refresh adjustments
      await fetchAdjustments(currentPayoutId);
      
      // Reset form
      setFormData({ type: '', amount: '', reason: '' });
      setIsAddingNew(false);
      setEditingId(null);
    } catch (error) {
      console.error('Error saving adjustment:', error);
      alert('Failed to save adjustment');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (adjustment: PayoutAdjustment) => {
    setFormData({
      type: adjustment.type,
      amount: adjustment.amount.toString(),
      reason: adjustment.reason
    });
    setEditingId(adjustment.id);
    setIsAddingNew(true);
  };

  const handleDelete = async (adjustmentId: number) => {
    if (!confirm('Are you sure you want to delete this adjustment?')) return;

    setIsLoading(true);
    try {
      const response = await fetch(`/api/payouts/adjustments/${adjustmentId}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (!response.ok) {
        throw new Error('Failed to delete adjustment');
      }

      // Refresh adjustments
      if (payoutId) {
        await fetchAdjustments(payoutId);
      }
    } catch (error) {
      console.error('Error deleting adjustment:', error);
      alert('Failed to delete adjustment');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchAdjustments = async (currentPayoutId: number) => {
    try {
      const response = await fetch(`/api/payouts/${currentPayoutId}/adjustments`, {
        credentials: 'include'
      });

      if (response.ok) {
        const data = await response.json();
        onAdjustmentsChange(data);
      }
    } catch (error) {
      console.error('Error fetching adjustments:', error);
    }
  };

  const calculateTotal = () => {
    return adjustments.reduce((sum, adj) => sum + adj.amount, 0);
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-lg">
            <DollarSign className="h-5 w-5 text-primary" />
            Adjustments ({adjustments.length})
          </CardTitle>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-xs text-muted-foreground">Total</div>
              <div className="text-lg font-bold text-primary">
                L.E {calculateTotal().toFixed(2)}
              </div>
            </div>
            <Button
              onClick={() => setIsAddingNew(true)}
              size="sm"
              disabled={isAddingNew}
              className="h-9 px-4"
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Adjustment
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent className={`${adjustments.length === 0 && !isAddingNew ? 'space-y-3' : 'space-y-6'}`}>
        {/* Add/Edit Form */}
        {isAddingNew && (
          <Card className="border-2 border-dashed border-primary/30 bg-primary/5">
            <CardContent className="pt-6">
              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  <div className="space-y-2">
                    <Label htmlFor="type" className="text-sm font-medium">Type</Label>
                    <Select 
                      value={formData.type} 
                      onValueChange={(value) => setFormData(prev => ({ ...prev, type: value }))}
                    >
                      <SelectTrigger className="h-10">
                        <SelectValue placeholder="Select adjustment type" />
                      </SelectTrigger>
                      <SelectContent>
                        {ADJUSTMENT_TYPES.map(type => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex items-center gap-2">
                              <div className={`w-3 h-3 rounded-full ${type.color.replace('bg-', 'bg-').replace('text-', 'border-')}`}></div>
                              {type.label}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="amount" className="text-sm font-medium">Amount (L.E)</Label>
                    <Input
                      id="amount"
                      type="number"
                      step="0.01"
                      value={formData.amount}
                      onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                      placeholder="0.00"
                      className="h-10"
                      required
                    />
                  </div>
                  
                  <div className="space-y-2 md:col-span-2 lg:col-span-1">
                    <Label htmlFor="reason" className="text-sm font-medium">Reason</Label>
                    <Input
                      id="reason"
                      value={formData.reason}
                      onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
                      placeholder="Brief description of adjustment"
                      className="h-10"
                      required
                    />
                  </div>
                </div>
                
                <div className="flex justify-end gap-3 pt-4 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsAddingNew(false);
                      setEditingId(null);
                      setFormData({ type: '', amount: '', reason: '' });
                    }}
                    disabled={isLoading}
                    className="px-6"
                  >
                    Cancel
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={isLoading || !formData.type || !formData.amount || !formData.reason}
                    className="px-6"
                  >
                    {isLoading ? 'Saving...' : editingId ? 'Update' : 'Add'} Adjustment
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>
        )}

        {/* Adjustments List */}
        {adjustments.length === 0 ? (
          <div className="text-center py-6 text-muted-foreground">
            <div className="text-sm mb-1">
              {payoutId ? 'No adjustments added yet.' : 'No adjustments yet.'}
            </div>
            <div className="text-xs text-muted-foreground/70">
              {payoutId ? 'Click "Add Adjustment" to get started.' : 'Add your first adjustment to create this payout.'}
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {adjustments.map((adjustment) => {
              const typeConfig = getTypeConfig(adjustment.type);
              return (
                <div
                  key={adjustment.id}
                  className="flex items-center justify-between p-4 bg-muted/30 rounded-xl border border-border/50 hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    <Badge className={`${typeConfig.color} text-xs font-medium px-3 py-1`}>
                      {typeConfig.label}
                    </Badge>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-base">
                          L.E {Math.abs(adjustment.amount).toFixed(2)}
                        </span>
                        {adjustment.amount < 0 && (
                          <span className="text-xs text-red-600 bg-red-50 px-2 py-0.5 rounded">
                            Deduction
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground mb-1">
                        {adjustment.reason}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatEgyptTime(adjustment.createdAt, 'MMM dd, yyyy hh:mm a')}
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(adjustment)}
                      disabled={isLoading}
                      className="h-8 w-8 p-0 hover:bg-blue-50 hover:text-blue-600"
                    >
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(adjustment.id)}
                      disabled={isLoading}
                      className="h-8 w-8 p-0 hover:bg-red-50 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
} 