// Configuration for auto-creating employees from Hikvision attendance data

export interface HikvisionEmployeeDefaults {
  position: string;
}

// Default settings for auto-created employees
export const HIKVISION_EMPLOYEE_DEFAULTS: HikvisionEmployeeDefaults = {
  position: 'Employee', // Default job position
};

// Generate default employee name if not provided by Hikvision
export function generateEmployeeName(employeeNo: string): string {
  return `Employee ${employeeNo}`;
}

// Validate and sanitize employee name from Hikvision
export function sanitizeEmployeeName(name: string | undefined, employeeNo: string): string {
  if (!name || name.trim().length === 0) {
    return generateEmployeeName(employeeNo);
  }
  
  // Clean up the name - remove extra spaces, ensure proper capitalization
  return name.trim()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
}

// Environment variable overrides
export function getHikvisionConfig(): HikvisionEmployeeDefaults {
  return {
    position: process.env.HIKVISION_DEFAULT_POSITION || 
      HIKVISION_EMPLOYEE_DEFAULTS.position,
  };
} 