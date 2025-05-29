# 📊 Multiple Payout Adjustments - User Guide

## 🎯 **Where to Access the New Multiple Adjustments Feature**

### **Method 1: Through Employee Payouts Page**
1. **Navigate to:** `/dashboard/employees/{employee-id}/payouts`
2. **Steps:**
   - Go to **Dashboard** → **Employees**
   - Click on any employee's name
   - Click on **"Payouts"** tab
   - Scroll down to any payout period card
   - You'll see the new **"Adjustments"** section with multiple adjustment support

### **Method 2: Direct URL Examples**
- Employee ID 1: `http://localhost:3000/dashboard/employees/1/payouts`
- Employee ID 5: `http://localhost:3000/dashboard/employees/5/payouts`
- Replace `{id}` with any valid employee ID

---

## ✨ **New Features Overview**

### **🆕 Multiple Adjustments Component**
- **Add Multiple Adjustments** per payout
- **Different Types**: Bonus, Deduction, Overtime, Other
- **Detailed Reasons** for each adjustment
- **Real-time Total Calculation**
- **Edit/Delete** existing adjustments

### **🔄 Backward Compatibility**
- **Legacy adjustments** still work (single adjustment field)
- **Combined totals** include both old and new adjustments
- **No data loss** - existing adjustments preserved

---

## 🎮 **How to Use**

### **Adding a New Adjustment**
1. Go to any payout period card
2. Find the **"Adjustments"** section
3. Click **"Add Adjustment"** button
4. Fill in:
   - **Type**: Bonus, Deduction, Overtime, or Other
   - **Amount**: Positive for bonuses, negative for deductions
   - **Reason**: Detailed explanation
5. Click **"Add Adjustment"**

### **Example Adjustments**
```
Type: Bonus
Amount: 150.00
Reason: Excellent performance this month

Type: Overtime  
Amount: 75.50
Reason: Weekend overtime work

Type: Deduction
Amount: -25.00
Reason: Late arrival penalty

Type: Other
Amount: 50.00
Reason: Completion bonus for project
```

### **Managing Existing Adjustments**
- **Edit**: Click the pencil icon ✏️
- **Delete**: Click the trash icon 🗑️
- **View History**: Timestamps show when adjustments were made

---

## 📊 **Calculation Examples**

### **Before (Single Adjustment)**
```
Base Payout: L.E 400.00
Legacy Adjustment: L.E 50.00
Total: L.E 450.00
```

### **After (Multiple Adjustments)**
```
Base Payout: L.E 400.00
Legacy Adjustment: L.E 50.00
Multiple Adjustments:
  + Bonus: L.E 150.00
  + Overtime: L.E 75.50
  - Late Penalty: L.E -25.00
  + Project Completion: L.E 50.00
Adjustments Total: L.E 250.50
FINAL TOTAL: L.E 700.50
```

---

## 🔧 **API Endpoints (for developers)**

```
GET    /api/payouts/{id}/adjustments       - List adjustments
POST   /api/payouts/{id}/adjustments       - Create adjustment
PUT    /api/payouts/adjustments/{id}       - Update adjustment  
DELETE /api/payouts/adjustments/{id}       - Delete adjustment
GET    /api/payouts/{id}                   - Get payout with totals
```

---

## 🎯 **Key Benefits**

✅ **Granular Tracking** - Multiple adjustment types per payout  
✅ **Audit Trail** - Timestamps and detailed reasons  
✅ **Flexible Categories** - Bonus, Deduction, Overtime, Other  
✅ **Real-time Totals** - Automatic calculation updates  
✅ **User-Friendly** - Intuitive add/edit/delete interface  
✅ **Backward Compatible** - No disruption to existing data  

---

## 🚀 **Getting Started**

1. **Go to any employee's payouts page**
2. **Find a payout period with an existing payout**
3. **Look for the "Adjustments" section**
4. **Click "Add Adjustment"** to start using the new feature!

The new multiple adjustments system is now live and ready to use! 🎉 