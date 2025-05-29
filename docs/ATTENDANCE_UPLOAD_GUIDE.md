# Attendance Upload with Automatic Payout Calculation

## Overview

The attendance upload system has been enhanced to automatically calculate and update employee payouts when attendance data is uploaded. This eliminates the need for manual payout calculations and ensures that payroll data is always up-to-date.

## Features

### 🚀 Automatic Workflow
1. **Upload Attendance Data** - Upload `.dat` or `.txt` files with employee attendance records
2. **Smart Record Processing** - Only adds new attendance records, updates existing ones
3. **Automatic Payout Calculation** - Calculates payouts based on attendance data
4. **Database Updates** - Creates new payouts or updates existing ones with accurate amounts

### 🔄 Intelligent Updates
- **Duplicate Prevention**: Only adds new attendance records, avoids duplicates
- **Smart Payout Logic**: Updates existing payouts only when amounts change
- **Comprehensive Tracking**: Maintains audit trail of all calculations

## How It Works

### Step 1: File Upload
Navigate to **Dashboard → Attendance → Upload Attendance Logs** and upload your attendance file.

### Step 2: File Processing
The system processes each line of the attendance file:
- Extracts employee ID and timestamp
- Groups records by employee and date
- Calculates check-in, check-out, and hours worked
- Uses `upsert` operations to prevent duplicates

### Step 3: Automatic Payout Calculation
For each employee with new/updated attendance data:
- Retrieves all attendance records for the employee
- Groups attendance by month (based on payment basis)
- Calculates total days worked and hours
- Computes payout amount: `days_worked × daily_rate`
- Creates new payouts or updates existing ones

### Step 4: Results Display
The upload results show:
- Number of attendance records processed
- Number of payouts created
- Number of payouts updated
- Total payouts processed

## File Format

### Required Format
```
<DeviceID> <YYYY-MM-DD HH:MM:SS> [optional data]
```

### Example
```
1	2025-01-14 09:00:00	2	0	1	0
1	2025-01-14 17:30:00	2	0	1	0
2	2025-01-14 08:30:15	2	0	1	0
2	2025-01-14 16:35:22	2	0	1	0
```

### Processing Rules
- **Device ID Mapping**: The first field should be the employee's fingerprint device ID (simple numbers like 1, 2, 3, etc.)
- **Employee Matching**: System looks up employees by their "Fingerprint Device ID" field
- **Missing Employees**: Records with unmatched device IDs are skipped with a log message
- **Field Separation**: Fields can be separated by spaces or tabs
- First record per day = Check-in time
- Last record per day = Check-out time
- Hours worked = Difference between check-out and check-in
- Multiple records per day are automatically handled

### Important Notes
- **Device ID Required**: All employees must have a valid fingerprint device ID set in their profile (e.g., "1", "2", "3")
- **Exact Match**: Device IDs in the file must exactly match the "Fingerprint Device ID" field
- **Numeric Format**: Device IDs are typically simple numbers (1, 2, 3, 5, 6, 7, etc.)
- **No Duplicates**: System prevents duplicate attendance records for the same employee and date

## Payout Calculation Logic

### Monthly Basis (Default)
- Groups attendance by calendar month
- Calculates total days worked in each month
- Amount = `days_worked × employee.dailyRate`
- Creates period from first to last day of month

### Weekly/Biweekly Basis
- Groups attendance by payment periods
- Supports configurable payment schedules
- Maintains proper period boundaries

### Update Strategy
- **Existing Payouts**: Updates only if calculated amount differs
- **New Payouts**: Creates with `isPaid: false` status
- **Comments**: Auto-generated with calculation details

## API Response Format

### Success Response
```json
{
  "success": true,
  "message": "Successfully processed 5 attendance records and updated payouts.",
  "recordsCount": 5,
  "payouts": {
    "created": 2,
    "updated": 1,
    "total": 3
  }
}
```

### Error Response
```json
{
  "error": "Failed to process attendance log",
  "details": "Specific error message"
}
```

## Testing

### Manual Testing
1. Use the web interface at `/dashboard/attendance/upload`
2. Upload a test attendance file
3. Verify results in the success message
4. Check payouts in the employee dashboard

### Automated Testing
The system includes built-in validation and error handling. Test your uploads with small sample files before processing large datasets.

## Database Schema

### Attendance Records
- Unique constraint on `(employeeId, date)`
- Automatic upsert prevents duplicates
- Stores check-in, check-out, and calculated hours

### Payout Records
- Unique constraint on `(employeeId, periodStart, periodEnd)`
- Automatic calculation based on attendance
- Maintains audit trail with comments

## Security Features

### Authentication
- Requires valid auth token (cookie or Bearer header)
- Validates user session before processing
- Logs all upload attempts

### Data Validation
- Validates employee existence before creating records
- Handles malformed data gracefully
- Prevents SQL injection and data corruption

## Error Handling

### File Processing Errors
- Skips invalid lines gracefully
- Continues processing valid records
- Reports comprehensive error details

### Database Errors
- Transactional operations where applicable
- Detailed error logging
- Graceful failure recovery

## Best Practices

### File Preparation
1. Ensure consistent date/time format
2. Verify employee IDs exist in system
3. Remove duplicate entries before upload
4. Test with small files first

### Regular Monitoring
1. Check upload success messages
2. Verify payout calculations
3. Monitor for missing employees
4. Review automated comments

### Backup Strategy
1. Backup database before large uploads
2. Keep original attendance files
3. Test restore procedures regularly

## Troubleshooting

### Common Issues

**File Upload Fails**
- Check file format and encoding
- Verify authentication status
- Ensure file size is reasonable

**Missing Payouts**
- Verify employee exists in system
- Check attendance date ranges
- Review calculation logic

**Incorrect Amounts**
- Verify daily rates are current
- Check attendance record accuracy
- Review payment basis settings

### Debug Tools
- Use the web interface to monitor upload results
- Check the browser developer console for detailed logs
- Review payout calculations in the employee dashboard

## Future Enhancements

### Planned Features
- Support for overtime calculations
- Configurable payment periods
- Bulk attendance corrections
- Advanced reporting features

### API Extensions
- Webhook notifications
- Batch processing endpoints
- Real-time upload status
- Enhanced error reporting

---

## Quick Start

1. **Upload File**: Go to Dashboard → Attendance → Upload
2. **Select File**: Choose your `.dat` or `.txt` attendance file
3. **Process**: Click "Upload and Process Attendance"
4. **Review**: Check the success message for processing results
5. **Verify**: Navigate to employee payouts to see calculated amounts

The system handles everything automatically - no manual intervention required! 