'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { HelpCircle, LogOut, Settings, Home, Users, Calendar } from 'lucide-react';
import Image from 'next/image';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  
  const handleLogout = async () => {
    try {
      // Clear token from localStorage first
      localStorage.removeItem('auth_token');
      console.log('[Sidebar] Token removed from localStorage');
      
      // Call logout API to clear server-side session
      await fetch('/api/logout', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      console.log('[Sidebar] Logout API called');
      
      // Redirect to login page
      router.push('/login');
    } catch (error) {
      console.error('[Sidebar] Error logging out:', error);
      // Redirect to login even if the API call fails
      router.push('/login');
    }
  };

  const isActive = (path: string) => {
    if (path === '/dashboard' && pathname === '/dashboard') {
      return true;
    }
    if (path !== '/dashboard' && pathname?.startsWith(path)) {
      return true;
    }
    return false;
  };

  return (
    <div className="bg-white h-full w-[300px] flex flex-col shadow-md hidden md:flex">
      <div className="p-4">
        <div className="flex items-center gap-3 mb-8">
          <Image 
            src="/images/solidLogo.webp" 
            alt="Solid Payroll" 
            width={40} 
            height={40}
            className="rounded"
          />
          <h1 className="text-xl font-bold">Solid HR</h1>
        </div>
        
        <nav className="space-y-1">
          <Link 
            href="/dashboard" 
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              isActive('/dashboard') 
                ? 'bg-primary text-white' 
                : 'text-slate-700 hover:bg-gray-100'
            }`}
          >
            <Home size={18} />
            Dashboard
          </Link>
          
          <Link 
            href="/dashboard/employees" 
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              isActive('/dashboard/employees') 
                ? 'bg-primary text-white' 
                : 'text-slate-700 hover:bg-gray-100'
            }`}
          >
            <Users size={18} />
            Employees
          </Link>
          
          <Link 
            href="/dashboard/attendance" 
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              isActive('/dashboard/attendance') 
                ? 'bg-primary text-white' 
                : 'text-slate-700 hover:bg-gray-100'
            }`}
          >
            <Calendar size={18} />
            Attendance
          </Link>
          
          <Link 
            href="/dashboard/settings" 
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              isActive('/dashboard/settings') 
                ? 'bg-primary text-white' 
                : 'text-slate-700 hover:bg-gray-100'
            }`}
          >
            <Settings size={18} />
            Settings
          </Link>
        </nav>
      </div>
      
      <div className="mt-auto p-4">
        <hr className="my-4 border-t border-gray-200" />
        <div className="space-y-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-red-600 hover:bg-red-50"
          >
            <LogOut size={18} />
            Logout
          </button>
          
          <Link 
            href="/dashboard/help" 
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              isActive('/dashboard/help') 
                ? 'bg-primary text-white' 
                : 'text-slate-700 hover:bg-gray-100'
            }`}
          >
            <HelpCircle size={18} />
            Help
          </Link>
        </div>
      </div>
    </div>
  );
} 