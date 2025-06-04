import { toZonedTime, fromZonedTime, format as formatTz } from 'date-fns-tz';
import { format } from 'date-fns';

// Egypt timezone
export const EGYPT_TIMEZONE = 'Africa/Cairo';

/**
 * Parse a time string (from attendance file) as Egypt local time and convert to UTC for storage
 */
export function parseEgyptTimeToUtc(timeString: string): Date | null {
  try {
    const match = timeString.match(/(\d{4})-(\d{2})-(\d{2})\s+(\d{2}):(\d{2}):(\d{2})/);
    if (!match) return null;

    const [, year, month, day, hours, minutes, seconds] = match;
    
    // Create a date object representing Egypt local time
    const localDate = new Date(
      parseInt(year),
      parseInt(month) - 1,
      parseInt(day),
      parseInt(hours),
      parseInt(minutes),
      parseInt(seconds)
    );

    // Convert Egypt local time to UTC for storage
    return fromZonedTime(localDate, EGYPT_TIMEZONE);
  } catch (error) {
    console.error('Error parsing Egypt time:', error);
    return null;
  }
}

/**
 * Convert UTC time (from database) to Egypt local time for display
 */
export function utcToEgyptTime(utcDate: Date | string): Date {
  const date = typeof utcDate === 'string' ? new Date(utcDate) : utcDate;
  return toZonedTime(date, EGYPT_TIMEZONE);
}

/**
 * Format a UTC time as Egypt local time string
 */
export function formatEgyptTime(utcDate: Date | string, formatString: string = 'h:mm a'): string {
  try {
    const egyptTime = utcToEgyptTime(utcDate);
    return format(egyptTime, formatString);
  } catch (error) {
    console.error('Error formatting Egypt time:', error);
    return 'Invalid time';
  }
}

/**
 * Check if a UTC check-in time is beyond the grace period in Egypt timezone
 */
export function isCheckInBeyondGracePeriod(
  utcCheckInTime: Date | string,
  workingHoursStart: string,
  lateAllowanceMinutes: number
): boolean {
  try {
    // Convert UTC check-in time to Egypt local time
    const egyptCheckIn = utcToEgyptTime(utcCheckInTime);
    
    // Parse working hours start time
    const [hours, minutes] = workingHoursStart.split(':');
    
    // Create grace end time for the same day in Egypt timezone
    const graceEndTime = new Date(egyptCheckIn);
    graceEndTime.setHours(parseInt(hours), parseInt(minutes) + lateAllowanceMinutes, 0, 0);
    
    console.log(`[Grace Check] Egypt CheckIn: ${formatTz(egyptCheckIn, 'yyyy-MM-dd HH:mm:ss zzz', { timeZone: EGYPT_TIMEZONE })}, Grace End: ${formatTz(graceEndTime, 'yyyy-MM-dd HH:mm:ss zzz', { timeZone: EGYPT_TIMEZONE })}, Late: ${egyptCheckIn > graceEndTime}`);
    
    return egyptCheckIn > graceEndTime;
  } catch (error) {
    console.error('Error checking grace period:', error);
    return false;
  }
}

/**
 * Get current date/time in Egypt timezone
 */
export function getNowInEgypt(): Date {
  return toZonedTime(new Date(), EGYPT_TIMEZONE);
} 