'use client';

import Sidebar from '@/app/components/Sidebar';
import { useEffect } from 'react';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  useEffect(() => {
    // Set up cookie monitoring
    const checkCookie = () => {
      const cookies = document.cookie.split(';');
      const authCookie = cookies.find(c => c.trim().startsWith('auth_session='));
      console.log(`[Client] Cookie check: ${authCookie ? 'Found auth cookie' : 'NO auth cookie found'}`);
    };
    
    // Check immediately
    checkCookie();
    
    // Check every 5 seconds
    const interval = setInterval(checkCookie, 5000);
    
    return () => clearInterval(interval);
  }, []);
  return (
    <div className="flex h-screen bg-[#d3d3d3]">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
} 