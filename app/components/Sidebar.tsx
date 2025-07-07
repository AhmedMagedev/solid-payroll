'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { HelpCircle, LogOut, Settings, Home, Users, Calendar, BookOpen, DollarSign, UserCog, MapPin } from 'lucide-react';
import Image from 'next/image';

export default function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [, setUserInfo] = useState<{username: string; isAdmin: boolean} | null>(null);

  useEffect(() => {
    // Check authentication status and get user info via API
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'GET',
          credentials: 'include',
        });
        
        if (response.ok) {
          const data = await response.json();
          setUserInfo(data.user);
          setIsAdmin(data.user.isAdmin || false);
          console.log('[Sidebar] User info:', data.user);
        } else {
          console.log('[Sidebar] Auth verification failed');
          setIsAdmin(false);
          setUserInfo(null);
        }
      } catch (error) {
        console.error('[Sidebar] Error checking auth:', error);
        setIsAdmin(false);
        setUserInfo(null);
      }
    };

    checkAuth();
  }, []);
  
  const handleLogout = async () => {
    try {
      // Call logout API to clear server-side session
      await fetch('/api/logout', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include', // Include cookies
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
        <div className="flex items-center gap-3 mb-8 flex-row-reverse">
          <Image 
            src="/images/solidLogo.webp" 
            alt="نظام الرواتب " 
            width={40} 
            height={40}
            className="rounded"
          />
          <h1 className="text-xl font-bold">الموارد البشرية </h1>
          {isAdmin && <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">مدير</span>}
        </div>
        
        <nav className="space-y-1">
          <Link 
            href="/dashboard" 
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors flex-row-reverse ${
              isActive('/dashboard') 
                ? 'bg-primary text-white' 
                : 'text-slate-700 hover:bg-gray-100'
            }`}
          >
            <Home size={18} />
            لوحة التحكم
          </Link>
          
          <Link 
            href="/dashboard/employees" 
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors flex-row-reverse ${
              isActive('/dashboard/employees') 
                ? 'bg-primary text-white' 
                : 'text-slate-700 hover:bg-gray-100'
            }`}
          >
            <Users size={18} />
            الموظفون
          </Link>
          
          <Link 
            href="/dashboard/attendance" 
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors flex-row-reverse ${
              isActive('/dashboard/attendance') 
                ? 'bg-primary text-white' 
                : 'text-slate-700 hover:bg-gray-100'
            }`}
          >
            <Calendar size={18} />
            الحضور والانصراف
          </Link>
          
          {isAdmin && (
            <Link 
              href="/dashboard/payouts" 
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors flex-row-reverse ${
                isActive('/dashboard/payouts') 
                  ? 'bg-primary text-white' 
                  : 'text-slate-700 hover:bg-gray-100'
              }`}
            >
              <DollarSign size={18} />
              المدفوعات
            </Link>
          )}
          
          {isAdmin && (
            <Link 
              href="/dashboard/locations" 
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors flex-row-reverse ${
                isActive('/dashboard/locations') 
                  ? 'bg-primary text-white' 
                  : 'text-slate-700 hover:bg-gray-100'
              }`}
            >
              <MapPin size={18} />
              مواقع العمل
            </Link>
          )}
          
          <Link 
            href="/dashboard/rules" 
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors flex-row-reverse ${
              isActive('/dashboard/rules') 
                ? 'bg-primary text-white' 
                : 'text-slate-700 hover:bg-gray-100'
            }`}
          >
            <BookOpen size={18} />
            القواعد والسياسات
          </Link>
          
          {isAdmin && (
            <Link 
              href="/dashboard/settings" 
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors flex-row-reverse ${
                isActive('/dashboard/settings') 
                  ? 'bg-primary text-white' 
                  : 'text-slate-700 hover:bg-gray-100'
              }`}
            >
              <Settings size={18} />
              الإعدادات
            </Link>
          )}
          
          {isAdmin && (
            <Link 
              href="/dashboard/admin/users" 
              className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors flex-row-reverse ${
                isActive('/dashboard/admin/users') 
                  ? 'bg-primary text-white' 
                  : 'text-slate-700 hover:bg-gray-100'
              }`}
            >
              <UserCog size={18} />
              إدارة المستخدمين
            </Link>
          )}
        </nav>
      </div>
      
      <div className="mt-auto p-4">
        <hr className="my-4 border-t border-gray-200" />
        <div className="space-y-1">
          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md transition-colors text-red-600 hover:bg-red-50 flex-row-reverse"
          >
            <LogOut size={18} />
            تسجيل الخروج
          </button>
          
          <Link 
            href="/dashboard/help" 
            className={`flex items-center gap-3 px-3 py-2 rounded-md transition-colors flex-row-reverse ${
              isActive('/dashboard/help') 
                ? 'bg-primary text-white' 
                : 'text-slate-700 hover:bg-gray-100'
            }`}
          >
            <HelpCircle size={18} />
            المساعدة
          </Link>
        </div>
      </div>
    </div>
  );
} 