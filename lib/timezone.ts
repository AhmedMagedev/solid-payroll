// Simplified timezone handling - NO timezone conversions, use times as-is
// This prevents mismatches between machine time and app records

/**
 * Parse a time string directly without timezone conversion
 * Use the timestamp exactly as provided by the machine
 */
export function parseEgyptTime(timeString: string): Date | null {
  // Parse as local time (no Z, no UTC)
  const match = timeString.match(/(\\d{4})-(\\d{2})-(\\d{2})\\s+(\\d{2}):(\\d{2}):(\\d{2})/);
  if (!match) return null;
  const [, year, month, day, hours, minutes, seconds] = match;
  // This will be interpreted as local time
  return new Date(`${year}-${month}-${day}T${hours}:${minutes}:${seconds}`);
}

/**
 * Return date as-is without timezone conversion
 */
export function utcToEgyptTime(date: Date | string): Date {
  return typeof date === 'string' ? new Date(date) : date;
}

/**
 * Format time without timezone conversion
 */
export function formatEgyptTime(date: Date | string): string {
  try {
    const d = typeof date === 'string' ? new Date(date) : date;
    return d.toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit',
      hour12: true 
    });
  } catch (error) {
    console.error('Error formatting time:', error);
    return 'Invalid time';
  }
}

/**
 * Check if check-in time is beyond grace period - no timezone conversion
 */
export function isCheckInBeyondGracePeriod(
  checkInTime: Date | string,
  workingHoursStart: string,
  lateAllowanceMinutes: number
): boolean {
  try {
    const checkIn = typeof checkInTime === 'string' ? new Date(checkInTime) : checkInTime;
    
    // Parse working hours start time
    const [hours, minutes] = workingHoursStart.split(':');
    
    // Create grace end time for the same day
    const graceEndTime = new Date(checkIn);
    graceEndTime.setHours(parseInt(hours), parseInt(minutes) + lateAllowanceMinutes, 0, 0);
    
    console.log(`[Grace Check] CheckIn: ${checkIn.toISOString()}, Grace End: ${graceEndTime.toISOString()}, Late: ${checkIn > graceEndTime}`);
    
    return checkIn > graceEndTime;
  } catch (error) {
    console.error('Error checking grace period:', error);
    return false;
  }
}

/**
 * Get current date/time as-is
 */
export function getNowInEgypt(): Date {
  return new Date();
}

/**
 * Get the work date for an attendance event - simplified
 * Times after midnight but before 6 AM are assigned to the previous work day
 */
export function getWorkDateForEvent(eventTime: Date): Date {
  // If the time is between midnight and 6 AM, assign to previous day
  if (eventTime.getHours() >= 0 && eventTime.getHours() < 6) {
    const workDate = new Date(eventTime);
    workDate.setDate(workDate.getDate() - 1);
    // Set to midnight for the work date
    return new Date(workDate.getFullYear(), workDate.getMonth(), workDate.getDate(), 0, 0, 0, 0);
  } else {
    // Normal case - use the same date
    return new Date(eventTime.getFullYear(), eventTime.getMonth(), eventTime.getDate(), 0, 0, 0, 0);
  }
} 