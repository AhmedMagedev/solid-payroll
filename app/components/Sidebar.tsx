'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { HelpCircle, LogOut, Settings, Home, Users, Calendar, BookOpen, DollarSign, UserCog } from 'lucide-react';
import Image from 'next/image';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    // Check if user is admin from localStorage token
    const token = localStorage.getItem('auth_token');
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        console.log('[Sidebar] Token payload:', payload);
        console.log('[Sidebar] isAdmin value:', payload.isAdmin);
        setIsAdmin(payload.isAdmin || false);
      } catch (error) {
        console.error('Error parsing token:', error);
        setIsAdmin(false);
      }
    }
  }, []);
  
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
          {isAdmin && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">Admin</span>}
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
          
          {isAdmin && (
            <Link 
              href="/dashboard/payouts" 
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive('/dashboard/payouts') 
                  ? 'bg-primary text-white' 
                  : 'text-slate-700 hover:bg-gray-100'
              }`}
            >
              <DollarSign size={18} />
              Payouts
            </Link>
          )}
          
          <Link 
            href="/dashboard/rules" 
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
              isActive('/dashboard/rules') 
                ? 'bg-primary text-white' 
                : 'text-slate-700 hover:bg-gray-100'
            }`}
          >
            <BookOpen size={18} />
            Rules & Policies
          </Link>
          
          {isAdmin && (
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
          )}
          
          {isAdmin && (
            <Link 
              href="/dashboard/admin/users" 
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors ${
                isActive('/dashboard/admin/users') 
                  ? 'bg-primary text-white' 
                  : 'text-slate-700 hover:bg-gray-100'
              }`}
            >
              <UserCog size={18} />
              User Management
            </Link>
          )}
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