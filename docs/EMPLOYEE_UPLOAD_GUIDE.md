# Employee Upload Guide

This guide explains how to upload employee data using CSV files.

## CSV Format

The CSV file should contain exactly **2 columns**:

1. **Employee Name** - Full name of the employee
2. **Hourly Rate** - Employee's hourly rate in Egyptian Pounds (L.E)

### Example CSV Content:

```csv
Employee Name,Hourly Rate
John Smith,25.50
Jane Doe,30.00
Ahmed Hassan,22.75
Sarah Johnson,28.00
Omar Ali,26.25
```

## Important Notes

- **Header Row**: The first row should contain column headers as shown above
- **Hourly Rate**: Should be a positive number (can include decimal places)
- **Automatic Email Generation**: Employee emails will be automatically generated in the format: `firstname.lastname@solid-metals.com`
- **Default Position**: All uploaded employees will have "Employee" as their default position
- **Payment Basis**: All employees default to "Monthly" payment basis

## Upload Process

1. Navigate to the Employees page in the dashboard
2. Click "Upload CSV" button
3. Select your properly formatted CSV file
4. Review the upload results
5. Check that all employees were created successfully

## Error Handling

The system will report errors for:
- Missing or invalid employee names
- Invalid hourly rates (non-numeric or zero/negative values)
- Duplicate employee names (which would create duplicate emails)
- Improperly formatted CSV files

## Tips

- Use a spreadsheet application (Excel, Google Sheets) to create your CSV
- Ensure hourly rates are realistic values
- Double-check employee names for accuracy before uploading
- Keep a backup of your CSV file before uploading 