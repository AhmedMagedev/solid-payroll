# Attendance Upload Guide

This guide explains how to upload attendance data to the system using text files.

## File Format

### Basic Structure
Each line in the attendance file should contain:
```
<EmployeeID> <YYYY-MM-DD> <HH:MM:SS> [optional data]
```

### Example File Content
```
1 2024-03-15 08:30:00
1 2024-03-15 17:45:00
2 2024-03-15 09:00:00
2 2024-03-15 18:00:00
3 2024-03-15 08:45:00
3 2024-03-15 17:30:00
```

## Field Descriptions

### Employee ID (Required)
- **Employee ID Mapping**: The first field should be the employee's system ID (numbers like 1, 2, 3, etc.)
- **Employee Matching**: System looks up employees by their ID field
- **Missing Employees**: Records with unmatched employee IDs are skipped with a log message

### Date and Time (Required)
- **Date Format**: YYYY-MM-DD (e.g., 2024-03-15)
- **Time Format**: HH:MM:SS in 24-hour format (e.g., 08:30:00)
- **Timezone**: All times are processed as Egypt local time

## Employee Setup Requirements

Before uploading attendance data:
- **Employee ID Required**: All employees must have a valid system ID
- **Exact Match**: Employee IDs in the file must exactly match the system ID field
- **Numeric Format**: Employee IDs are typically simple numbers (1, 2, 3, 5, 6, 7, etc.)

## How It Works

### Processing Logic
1. **File Parsing**: Each line is split by spaces
2. **Employee Lookup**: System finds employee by ID
3. **Time Processing**: Converts Egypt time to UTC for storage
4. **Grouping**: Groups multiple records by employee and date
5. **Check-in/out Detection**: First record = check-in, last record = check-out
6. **Hours Calculation**: Calculates working hours and applies penalty rules

### Grace Period & Penalties
- Configurable grace period for late arrivals
- Automatic penalty calculation based on system rules
- Tracks deductions for late arrivals and early departures

### Data Validation
- Skips invalid timestamps
- Logs missing employee records
- Handles duplicate records by date/employee

## Upload Process

1. **Navigate** to Dashboard → Attendance → Upload
2. **Select File** containing attendance records
3. **Upload** and wait for processing
4. **Review Results** for any errors or skipped records

## Example Upload Result
```
Processed 45 attendance records
- Created: 20 new records
- Updated: 15 existing records  
- Skipped: 10 records (employee not found)
```

The system will show detailed logs of which records were processed and any issues encountered. 