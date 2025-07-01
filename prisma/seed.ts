import { PrismaClient } from '../app/generated/prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  // Check if admin user already exists
  const existingAdmin = await prisma.user.findUnique({
    where: { username: 'admin' }
  });

  if (!existingAdmin) {
    // Hash the password
    const hashedPassword = await bcrypt.hash('123!Admin', 10);

    // Create the admin user
    const admin = await prisma.user.create({
      data: {
        username: 'admin',
        password: hashedPassword,
        isAdmin: true,
      },
    });

    console.log('Default admin user created:', admin.username);
  } else {
    // Update existing admin user to ensure isAdmin is true
    if (!existingAdmin.isAdmin) {
      const updatedAdmin = await prisma.user.update({
        where: { username: 'admin' },
        data: { isAdmin: true },
      });
      console.log('Updated admin user with isAdmin flag:', updatedAdmin.username);
    } else {
      console.log('Admin user already exists and has admin privileges.');
    }
  }

  // Check if system settings exist
  const existingSettings = await prisma.systemSettings.findFirst();

  if (!existingSettings) {
    // Create default system settings
    const settings = await prisma.systemSettings.create({
      data: {
        lateAllowanceMinutes: 30,
        workDaySunday: true,
        workDayMonday: true,
        workDayTuesday: true,
        workDayWednesday: true,
        workDayThursday: true,
        workDayFriday: false,
        workDaySaturday: true,
        workingHoursPerDay: 9,
        workingHoursStart: '09:00', // 9 AM working hours
        workingHoursEnd: '18:00',   // 6 PM working hours
        overtimeMultiplier: 1.5,
        weekendOvertimeMultiplier: 2.0,
        penaltyMinor30Min: 60,    // 1 hour deduction for minor penalty
        penaltyModerate90Min: 180, // 3 hours deduction for moderate penalty
        penaltyMajor150Min: 0.5,   // Half day for major penalty
        penaltyFullDay: 1.0,       // Full day for severe penalty
        allowMakeupTime: true,
        makeupTimeDeadlineHours: 24,
      },
    });

    console.log('Default system settings created:', settings.id);
  } else {
    console.log('System settings already exist.');
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  }); 