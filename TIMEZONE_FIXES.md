# Timezone and Environment Variable Fixes

## Issues Addressed

### 1. Missing Environment Variables
**Problem**: The logs showed "Missing Hikvision configuration: URL=false, Username=false, Password=false"
**Cause**: No `.env` file existed in the project root

**Fix**: 
- Created `.env` file from `env.template`
- Updated environment template to remove quotes around values
- Added validation and better error messages

### 2. Timezone Mismatch Issues
**Problem**: Complex timezone conversions were causing mismatches between machine time and app records
**Cause**: Multiple timezone conversion functions were adjusting timestamps unnecessarily

**Fixes Applied**:

#### A. Simplified `lib/timezone.ts`
- **REMOVED**: All timezone conversion libraries (`date-fns-tz`)
- **REMOVED**: Complex UTC ↔ Egypt timezone conversions
- **CHANGED**: `parseEgyptTimeToUtc()` now uses timestamps as-is without conversion
- **CHANGED**: `formatEgyptTime()` simplified to basic formatting without timezone adjustment
- **CHANGED**: `getWorkDateForEvent()` uses local date components directly

#### B. Updated Attendance Processing
- **`lib/attendance-pull-service.ts`**: Removed timezone adjustments in date grouping
- **`app/api/attendance/upload/route.ts`**: Simplified timestamp parsing to use values as-is
- **`app/api/debug/recalculate-attendance/route.ts`**: Removed UTC-to-local conversions

#### C. Updated Hikvision API Clients
- **`lib/hikvision-client.ts`**: Simplified date formatting for API calls
- **`lib/hikvision-curl.ts`**: Removed timezone adjustments in date formatting

#### D. Fixed UI Components
Updated all components to use the new `formatEgyptTime()` signature:
- `app/components/PayoutAdjustments.tsx`
- `app/dashboard/payouts/page.tsx`
- `app/dashboard/employees/[id]/page.tsx`
- `app/dashboard/employees/[id]/payouts/page.tsx`
- `app/dashboard/employees/[id]/attendance/page.tsx`

## Key Changes Summary

### Before (Complex Timezone Handling)
```typescript
// OLD: Complex timezone conversion
const egyptDate = new Date();
egyptDate.setFullYear(parseInt(year));
// ... set time components
return fromZonedTime(egyptDate, EGYPT_TIMEZONE);

// OLD: UTC to Egypt conversion for display  
const egyptTime = toZonedTime(date, EGYPT_TIMEZONE);
```

### After (Simple As-Is Handling)
```typescript
// NEW: Use timestamp as-is
const date = new Date(
  parseInt(year),
  parseInt(month) - 1,
  parseInt(day),
  parseInt(hours),
  parseInt(minutes),
  parseInt(seconds)
);
return date;

// NEW: No timezone conversion
return typeof date === 'string' ? new Date(date) : date;
```

## Environment Variables Setup

### Template Updated (`env.template`)
```bash
# OLD (with quotes)
HIKVISION_URL="http://solid-form.ddns.net:80"

# NEW (without quotes)
HIKVISION_URL=http://solid-form.ddns.net:80
```

### Validation Added
All Hikvision clients now validate required configuration:
```typescript
if (!hikvisionUrl || !hikvisionUsername || !hikvisionPassword) {
  throw new Error(`Missing Hikvision configuration: URL=${!!hikvisionUrl}, Username=${!!hikvisionUsername}, Password=${!!hikvisionPassword}`);
}
```

## Benefits

1. **No More Timezone Mismatches**: Timestamps from machines are used exactly as provided
2. **Simplified Debugging**: No complex timezone conversion logic to trace through
3. **Better Error Messages**: Clear validation of environment variables
4. **Consistent Time Handling**: All parts of the system use the same approach
5. **Reduced Complexity**: Removed dependency on timezone libraries

## Testing

1. **Environment Variables**: All Hikvision clients now provide clear error messages if config is missing
2. **Timezone Handling**: Times are processed as-is without conversion
3. **Build Success**: All TypeScript errors resolved
4. **UI Compatibility**: All time display components updated to work with simplified functions

## Next Steps for Production

1. **Update Production Environment Variables**: Remove quotes from all Hikvision configuration
2. **Deploy Changes**: The URL formatting issues from the original logs should be resolved
3. **Monitor Logs**: Should now see proper attendance data being saved to database
4. **Verify Time Accuracy**: Attendance times should match machine timestamps exactly 