# Employee Data Removal Scripts

This directory contains scripts for removing all employee data from the database. **Use with extreme caution!**

## ⚠️ Important Warnings

- **This operation is IRREVERSIBLE** - all employee data will be permanently deleted
- **Cascading deletion** - removes employees, attendance records, and payout records
- **Always backup your database** before running these scripts
- **Test in development environment** first

## Option 1: Standalone Script

### Usage

```bash
# From the project root directory
npx ts-node scripts/remove-all-employees.ts
```

### Features

- Interactive confirmation prompt
- Shows current data summary before deletion
- Requires exact confirmation text: `DELETE ALL EMPLOYEES`
- Proper error handling and logging
- Safe deletion order (respects foreign key constraints)

### Example Output

```
🔍 Checking current employee count...

📊 Current data summary:
   • Employees: 15
   • Attendance records: 342
   • Payout records: 45

⚠️  WARNING: This will permanently delete ALL employees and their related data (attendance, payouts).
This action cannot be undone!

Type "DELETE ALL EMPLOYEES" to confirm: DELETE ALL EMPLOYEES

🗑️  Starting deletion process...
   ✓ Deleted 342 attendance records
   ✓ Deleted 45 payout records
   ✓ Deleted 15 employees

✅ All employees and related data have been successfully removed!

🏁 Script completed.
```

## Option 2: API Endpoint

### Endpoint Information

- **URL**: `/api/admin/remove-all-employees`
- **Authentication**: Required (uses existing auth system)
- **Methods**: `GET` (info), `DELETE` (execute)

### Get Data Summary

```bash
curl -X GET https://your-domain.com/api/admin/remove-all-employees \
  -H "Cookie: auth_token=your_token_here"
```

### Execute Deletion

```bash
curl -X DELETE https://your-domain.com/api/admin/remove-all-employees \
  -H "Content-Type: application/json" \
  -H "Cookie: auth_token=your_token_here" \
  -d '{"confirmation": "DELETE ALL EMPLOYEES"}'
```

### Response Examples

**GET Response (Data Summary):**
```json
{
  "summary": {
    "employees": 15,
    "attendance": 342,
    "payouts": 45
  },
  "instructions": {
    "endpoint": "DELETE /api/admin/remove-all-employees",
    "required_body": {
      "confirmation": "DELETE ALL EMPLOYEES"
    },
    "warning": "This operation permanently deletes ALL employee data and cannot be undone!"
  }
}
```

**DELETE Response (Success):**
```json
{
  "message": "All employees and related data have been successfully removed",
  "deleted": {
    "employees": 15,
    "attendance": 342,
    "payouts": 45
  },
  "timestamp": "2024-01-15T10:30:45.123Z"
}
```

## Safety Features

1. **Authentication Required**: API endpoint requires valid authentication
2. **Explicit Confirmation**: Must provide exact confirmation text
3. **Data Summary**: Shows what will be deleted before execution
4. **Proper Order**: Deletes in correct order to respect foreign key constraints
5. **Error Handling**: Comprehensive error handling and logging
6. **No Accidental Execution**: Multiple confirmation steps

## Database Deletion Order

The script deletes data in this order to avoid foreign key constraint violations:

1. **Attendance Records** (`attendance` table)
2. **Payout Records** (`payouts` table)
3. **Employees** (`employees` table)

## Prerequisites

- Node.js and npm/yarn installed
- Prisma client generated (`npx prisma generate`)
- Valid database connection
- For API endpoint: Authentication token required

## Backup Recommendations

Before running this script, always create a database backup:

```bash
# PostgreSQL backup example
pg_dump -h localhost -U username -d database_name > backup_$(date +%Y%m%d_%H%M%S).sql

# Or use your hosting provider's backup tools
```

## Recovery

If you need to recover data after accidental deletion:

1. Stop the application immediately
2. Restore from your most recent backup
3. Check data integrity
4. Restart the application

## Development vs Production

- **Development**: Test the script thoroughly
- **Staging**: Verify behavior with production-like data
- **Production**: Use with extreme caution, ensure backups exist 