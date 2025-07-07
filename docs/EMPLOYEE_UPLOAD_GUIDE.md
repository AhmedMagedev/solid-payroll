# Employee Upload with CSV/Excel Files

## Overview

The employee upload system allows you to bulk import employee data using CSV or Excel files. This feature streamlines the process of adding multiple employees to the system at once.

## Features

### 🚀 Supported File Formats
- **CSV Files** (`.csv`) - Fully supported
- **Excel Files** (`.xlsx`, `.xls`) - Convert to CSV format first

### 🔄 Smart Processing
- **Automatic Email Generation** - Creates emails from employee names
- **Duplicate Prevention** - Checks for existing emails and device IDs
- **Data Validation** - Validates all required fields before processing
- **Error Reporting** - Detailed feedback on any issues found

## How It Works

### Step 1: Prepare Your File
Create a CSV file with the following columns in this exact order:
1. **Employee Name** - Full name as it should appear in the system
2. **Device ID** - Unique fingerprint device identifier (numbers only)
3. **Hourly Rate** - Numeric value for daily compensation
4. **Payment Basis** - Either "Monthly" or "Weekly"

### Step 2: File Format Example
```csv
Employee Name,Device ID,Hourly Rate,Payment Basis
Hassan Mohamed Hassan,2,250,Monthly
Mustafa Mohamed,3,270,Weekly
Ibrahim Ahmed Abdalaal,4,293,Monthly
Mustafa Shaaban,6,150,Monthly
Saif eddien,10,220,Monthly
```

### Step 3: Upload Process
1. Navigate to **Dashboard → Employees → Upload Employees**
2. Select your CSV file
3. Click "Upload and Process Employees"
4. Review the results and any error messages

### Step 4: Results Review
The system will show:
- Number of employees found in file
- Number of employees successfully created
- Number of employees skipped (with reasons)

## Data Processing Rules

### Automatic Fields
- **Email**: Generated from name (e.g., "John Smith" → "john.smith@solid-metals.com")
- **Position**: Defaults to "Employee" for all uploaded records
- **Phone**: Not included in upload (can be added manually later)

### Validation Rules
1. **Employee Name**: Must be provided and non-empty
2. **Device ID**: Must be unique across all employees in the system
3. **Hourly Rate**: Must be a valid number (positive value)
4. **Payment Basis**: Must be exactly "Monthly" or "Weekly"

### Duplicate Handling
- **Email Conflicts**: If generated email already exists, employee is skipped
- **Device ID Conflicts**: If device ID already exists, employee is skipped
- **File Duplicates**: Duplicate device IDs within the same file are rejected

## File Preparation Tips

### CSV Format Best Practices
- Use proper CSV formatting with commas as separators
- Enclose text containing commas in quotes (e.g., "Smith, John Jr.")
- Ensure consistent data formatting across all rows
- Include a header row for clarity (will be automatically detected)

### Common Issues to Avoid
- **Missing Values**: Ensure all four columns have values for each employee
- **Invalid Payment Basis**: Must be exactly "Monthly" or "Weekly" (case-sensitive)
- **Non-numeric Rates**: Hourly Rate must be a valid number without currency symbols
- **Duplicate Device IDs**: Each device ID must be unique within the file

### Data Cleaning Checklist
- [ ] Names are properly formatted and complete
- [ ] Device IDs are unique numbers
- [ ] Hourly Rates are numeric values only
- [ ] Payment basis is either "Monthly" or "Weekly"
- [ ] No empty rows or incomplete data

## Troubleshooting

### Common Error Messages

**"No valid employee data found in file"**
- Check that your file has the correct format
- Ensure you have data rows (not just headers)
- Verify all required columns are present

**"Duplicate device IDs found in file"**
- Review your file for repeated device ID values
- Each employee must have a unique device ID

**"Employee with device ID X already exists"**
- The device ID is already assigned to another employee
- Use a different device ID or check existing employees

**"Invalid payment basis"**
- Ensure payment basis is exactly "Monthly" or "Weekly"
- Check for typos or extra spaces

### File Format Issues
- Save Excel files as CSV before uploading
- Use UTF-8 encoding to avoid character issues
- Remove any special formatting or formulas

## Integration with Attendance System

Once employees are uploaded with device IDs:
- Device IDs link employees to attendance records
- Attendance uploads will automatically match to employees
- Payroll calculations use the uploaded Hourly Rates and payment basis

## Best Practices

### Planning Your Upload
1. **Start Small**: Test with a few employees first
2. **Clean Data**: Review and clean your data before upload
3. **Sequential IDs**: Use sequential device IDs for better organization
4. **Backup**: Keep a backup of your original data file

### Post-Upload Actions
1. **Review Results**: Check that all employees were created successfully
2. **Update Missing Info**: Add phone numbers and other details manually
3. **Test Attendance**: Verify device IDs work with attendance uploads
4. **Update Profiles**: Add profile pictures and additional information as needed

---

## Quick Reference

### Required Columns (in order)
1. Employee Name
2. Device ID  
3. Hourly Rate
4. Payment Basis

### Valid Payment Basis Values
- `Monthly`
- `Weekly`

### Generated Fields
- Email: `firstname.lastname@solid-metals.com`
- Position: `Employee`
- Created/Updated timestamps: Current date/time

The employee upload system is designed to make bulk employee creation fast and reliable while maintaining data integrity and preventing duplicates. 