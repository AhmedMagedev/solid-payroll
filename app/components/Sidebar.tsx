'use client';

import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
// import Image from 'next/image'; // Using standard img tag for simplicity

const menuItems = [
  { name: 'Dashboard', href: '/dashboard' },
  { name: 'Employees', href: '/dashboard/employees' }, 
  // Add more menu items here as needed
];

export default function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col bg-[#003366] text-white">
      <div className=" px-4 text-center">
        <Link href="/dashboard" className="flex items-center justify-center">
          <Image src="/images/solidLogo.webp" alt="Solid Payroll Logo" width={120} height={24} className="object-contain" />
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-4">
        {menuItems.map((item) => (
          <Link
            key={item.name}
            href={item.href}
            className={`
              flex items-center rounded-md px-3 py-2.5 text-base font-medium 
              transition-colors duration-150 ease-in-out
              ${pathname === item.href 
                ? 'bg-[#002244] text-white' 
                : 'text-gray-300 hover:bg-[#002244] hover:text-white'
              }
            `}
          >
            {/* Add icons here if you have them */}
            <span>{item.name}</span>
          </Link>
        ))}
      </nav>
      <div className="p-4 mt-auto mb-4">
        <Link
          href="/api/logout" // Updated logout link
          className="flex w-full items-center justify-center rounded-md bg-[#002244] px-3 py-2.5 text-base font-medium text-white hover:bg-red-700 transition-colors duration-150 ease-in-out"
        >
          Logout
        </Link>
      </div>
    </div>
  );
} 