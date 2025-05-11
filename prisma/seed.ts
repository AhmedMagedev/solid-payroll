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
      },
    });

    console.log('Default admin user created:', admin.username);
  } else {
    console.log('Admin user already exists.');
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