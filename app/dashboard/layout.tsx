'use client';

import Sidebar from '@/app/components/Sidebar';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  
  useEffect(() => {
    // Check authentication status via API call
    const checkAuth = async () => {
      try {
        const response = await fetch('/api/auth/verify', {
          method: 'GET',
          credentials: 'include', // Include cookies
        });
        
        if (response.ok) {
          console.log('[Client] Authentication verified');
          setIsAuthenticated(true);
        } else {
          console.log('[Client] Authentication failed, redirecting to login');
          setIsAuthenticated(false);
          router.push('/login');
        }
      } catch (error) {
        console.error('[Client] Auth check error:', error);
        setIsAuthenticated(false);
        router.push('/login');
      }
    };
    
    // Check immediately
    checkAuth();
    
    // Check periodically
    const interval = setInterval(checkAuth, 30000); // Check every 30 seconds
    
    return () => clearInterval(interval);
  }, [router]);

  // Show loading while checking authentication
  if (isAuthenticated === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Only render dashboard if authenticated
  if (!isAuthenticated) {
    return null; // Redirect is happening
  }
  
  return (
    <div className="flex h-screen bg-[#d3d3d3] flex-row-reverse">
      <Sidebar />
      <main className="flex-1 overflow-y-auto">
        {children}
      </main>
    </div>
  );
} 