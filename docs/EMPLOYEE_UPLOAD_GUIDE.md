# Employee Upload Guide

## Overview
Upload multiple employees to the system using CSV files. This feature allows bulk importing of employee data including names and daily rates. All employees are automatically set to monthly payment basis.

## File Requirements

### Supported Formats
- CSV files (.csv)
- Maximum file size: 5MB
- Maximum 1000 employees per upload
- **Duplicate Prevention** - Checks for existing emails

### CSV Structure
The CSV file should contain 2 columns in this exact order:

1. **Employee Name** - Full name of the employee
2. **Daily Rate** - Numeric daily wage (numbers only)

### Sample Format
```csv
Employee Name,Daily Rate
John Smith,200
Jane Doe,250
Ahmed Hassan,180
```

## Validation Rules

### Required Fields
1. **Employee Name**: Cannot be empty or contain only spaces
2. **Daily Rate**: Must be a positive number

### Auto-Generated Fields
- **Email**: Automatically generated from employee name (e.g., "john.smith@solid-metals.com")
- **Position**: Set to "Employee" by default
- **Payment Basis**: Automatically set to "Monthly"
- **Employee ID**: System auto-generated

### Duplicate Handling
- **Email Conflicts**: If generated email already exists, employee is skipped
- **File Duplicates**: Duplicate names within the same file are rejected

## Upload Process

### Step 1: Prepare Your File
- Use the sample format above
- Ensure all required fields are filled
- **Unique Names**: Each employee name should be unique within the file
- Remove any special characters that might affect email generation

### Step 2: Upload
1. Go to Dashboard → Employees → Upload
2. Click "Choose File" and select your CSV
3. Review the file preview
4. Click "Upload Employees"

### Step 3: Review Results
The system will display:
- Number of employees successfully created
- Number of errors/skips
- Detailed error messages for failed records

## Common Issues & Solutions

### Upload Errors

**"Duplicate employee names found in file"**
- Review your file for repeated names
- Each employee must have a unique name

**"Employee with email X already exists"**
- The generated email is already assigned to another employee
- Use a different name variation or check existing employees

**"Invalid daily rate"**
- Ensure daily rate is a positive number
- Remove any currency symbols or text

**"Invalid payment basis"**
- Must be exactly "Monthly" or "Weekly" (case-sensitive)
- Check for extra spaces or typos

### File Format Issues
- Save file as CSV format (not Excel)
- Ensure proper encoding (UTF-8)
- Avoid special characters in names that might affect email generation

## After Upload

Once employees are uploaded:
- Employees will be available in the employee list
- Generated emails will be used for system identification
- Default position will be set to "Employee"
- You can edit individual employees to add more details

### Next Steps
1. **Review Employees**: Check the employee list for accuracy
2. **Edit Details**: Add additional information like phone numbers, specific positions
3. **Set Up Attendance**: Employees are ready for attendance tracking using their Employee IDs

### CSV Template
Use this template for your uploads:

| Column | Type | Required | Example |
|--------|------|----------|---------|
| A | Employee Name | Yes | John Smith |
| B | Daily Rate | Yes | 200 |

## Best Practices

1. **Validate Data**: Double-check names and rates before upload
2. **Test Small Batches**: Start with a few employees to test the process
3. **Sequential Processing**: Upload employees in batches rather than all at once for better tracking 