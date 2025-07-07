import { PrismaClient } from '../app/generated/prisma/index.js';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function createSampleEmployees() {
  console.log('Creating sample employees...');

  // Sample employee data
  const employees = [
    {
      name: 'John Smith',
      email: 'john.smith@company.com',
      password: 'password123',
      position: 'Software Engineer',
      department: 'Engineering',
      phone: '+1-555-0101',
      employeeId: 'EMP001',
      hourlyRate: 45.00,
      canWorkRemotely: true,
      canAccessPortal: true,
      isActive: true,
      preferredLanguage: 'en',
      timezone: 'America/New_York',
      emailNotifications: true,
      hireDate: new Date('2023-01-15'),
    },
    {
      name: 'Sarah Johnson',
      email: 'sarah.johnson@company.com',
      password: 'password123',
      position: 'Marketing Manager',
      department: 'Marketing',
      phone: '+1-555-0102',
      employeeId: 'EMP002',
      hourlyRate: 40.00,
      canWorkRemotely: true,
      canAccessPortal: true,
      isActive: true,
      preferredLanguage: 'en',
      timezone: 'America/Los_Angeles',
      emailNotifications: true,
      hireDate: new Date('2023-02-20'),
    },
    {
      name: 'Michael Chen',
      email: 'michael.chen@company.com',
      password: 'password123',
      position: 'Data Analyst',
      department: 'Analytics',
      phone: '+1-555-0103',
      employeeId: 'EMP003',
      hourlyRate: 38.00,
      canWorkRemotely: false,
      canAccessPortal: true,
      isActive: true,
      preferredLanguage: 'en',
      timezone: 'America/Chicago',
      emailNotifications: false,
      hireDate: new Date('2023-03-10'),
    },
    {
      name: 'Emily Davis',
      email: 'emily.davis@company.com',
      password: 'password123',
      position: 'HR Specialist',
      department: 'Human Resources',
      phone: '+1-555-0104',
      employeeId: 'EMP004',
      hourlyRate: 35.00,
      canWorkRemotely: true,
      canAccessPortal: true,
      isActive: true,
      preferredLanguage: 'en',
      timezone: 'America/New_York',
      emailNotifications: true,
      hireDate: new Date('2023-04-05'),
    },
    {
      name: 'David Rodriguez',
      email: 'david.rodriguez@company.com',
      password: 'password123',
      position: 'Sales Representative',
      department: 'Sales',
      phone: '+1-555-0105',
      employeeId: 'EMP005',
      hourlyRate: 32.00,
      canWorkRemotely: true,
      canAccessPortal: true,
      isActive: true,
      preferredLanguage: 'es',
      timezone: 'America/Denver',
      emailNotifications: true,
      hireDate: new Date('2023-05-12'),
    },
    {
      name: 'Lisa Thompson',
      email: 'lisa.thompson@company.com',
      password: 'password123',
      position: 'Graphic Designer',
      department: 'Design',
      phone: '+1-555-0106',
      employeeId: 'EMP006',
      hourlyRate: 36.00,
      canWorkRemotely: true,
      canAccessPortal: true,
      isActive: true,
      preferredLanguage: 'en',
      timezone: 'America/Los_Angeles',
      emailNotifications: true,
      hireDate: new Date('2023-06-18'),
    }
  ];

  for (const employee of employees) {
    try {
      // Hash the password
      const hashedPassword = await bcrypt.hash(employee.password, 12);
      
      // Check if employee already exists
      const existingEmployee = await prisma.employee.findUnique({
        where: { email: employee.email }
      });

      if (existingEmployee) {
        console.log(`Employee ${employee.name} (${employee.email}) already exists, skipping...`);
        continue;
      }

      // Create the employee
      const createdEmployee = await prisma.employee.create({
        data: {
          name: employee.name,
          email: employee.email,
          password: hashedPassword,
          position: employee.position,
          department: employee.department,
          phone: employee.phone,
          employeeId: employee.employeeId,
          hourlyRate: employee.hourlyRate,
          canWorkRemotely: employee.canWorkRemotely,
          canAccessPortal: employee.canAccessPortal,
          isActive: employee.isActive,
          preferredLanguage: employee.preferredLanguage,
          timezone: employee.timezone,
          emailNotifications: employee.emailNotifications,
          hireDate: employee.hireDate,
          createdAt: new Date(),
          updatedAt: new Date(),
        }
      });

      console.log(`✓ Created employee: ${createdEmployee.name} (${createdEmployee.email})`);
      
    } catch (error) {
      console.error(`Error creating employee ${employee.name}:`, error);
    }
  }
}

async function main() {
  try {
    await createSampleEmployees();
    console.log('\n🎉 Sample employees created successfully!');
    console.log('\nYou can now test the employee portal with these credentials:');
    console.log('Email: john.smith@company.com | Password: password123');
    console.log('Email: sarah.johnson@company.com | Password: password123');
    console.log('Email: michael.chen@company.com | Password: password123');
    console.log('Email: emily.davis@company.com | Password: password123');
    console.log('Email: david.rodriguez@company.com | Password: password123');
    console.log('Email: lisa.thompson@company.com | Password: password123');
    console.log('\n📱 Access the employee portal at: http://localhost:3000/employee');
    console.log('\n📝 Note: No attendance records were created. You can test check-in/out functionality manually.');
  } catch (error) {
    console.error('Error creating sample data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main(); 