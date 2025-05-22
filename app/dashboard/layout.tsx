'use client';

import Sidebar from '@/app/components/Sidebar';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  
  useEffect(() => {
    // Check for token on mount and redirect if not found
    const checkAuth = () => {
      const token = localStorage.getItem('auth_token');
      if (!token) {
        console.log('[Client] No auth token found, redirecting to login');
        router.push('/login');
      } else {
        console.log('[Client] Auth token found, staying on dashboard');
      }
    };
    
    // Set up token monitoring to detect if token is removed
    const tokenCheck = () => {
      const token = localStorage.getItem('auth_token');
      console.log(`[Client] Token check: ${token ? 'Token exists' : 'NO token found'}`);
    };
    
    // Check immediately
    checkAuth();
    tokenCheck();
    
    // Check periodically
    const interval = setInterval(tokenCheck, 5000);
    
    return () => clearInterval(interval);
  }, [router]);
  
  return (
    <div className="flex h-screen bg-[#d3d3d3]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
} 