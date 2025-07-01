'use client';

import { useState, FormEvent, ChangeEvent } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Toaster } from "@/components/ui/sonner";
import { toast } from "sonner";
import { Loader2 } from "lucide-react"; // For loading spinner in button

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const response = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store the token in localStorage for client-side authentication
        if (data.token) {
          localStorage.setItem('auth_token', data.token);
          console.log('[Login Page] Token stored in localStorage');
        }
        
        console.log('[Login Page] Login successful, redirecting to /dashboard');
        toast.success("تم تسجيل الدخول بنجاح!", { description: "جاري التوجيه إلى لوحة التحكم..." });
        router.push('/dashboard');
      } else {
        console.log('[Login Page] Login failed:', data.message);
        toast.error("فشل تسجيل الدخول", {
          description: data.message || 'فشل في تسجيل الدخول. يرجى المحاولة مرة أخرى.',
        });
      }
    } catch (err) {
      console.error('[Login Page] Error during login:', err);
      toast.error("خطأ", {
        description: 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-primary p-4">
      <Toaster richColors />
      <Card className="w-full max-w-md bg-card text-card-foreground shadow-2xl">
        <CardHeader className="space-y-4 text-center p-6 sm:p-8">
          <div className="flex justify-center">
            <Image src="/images/solidLogo.webp" alt="شعار نظام الرواتب" width={100} height={30} className="rounded-md" />
          </div>
          <CardTitle className="text-2xl sm:text-3xl font-bold text-primary">بوابة الموارد البشرية</CardTitle>
        </CardHeader>
        <CardContent className="p-6 sm:p-8">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="username" className="sr-only">اسم المستخدم</Label>
              <Input
                id="username"
                name="username"
                type="text"
                required
                placeholder="اسم المستخدم"
                value={username}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setUsername(e.target.value)}
                disabled={loading}
                className="bg-card text-right"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password" className="sr-only">كلمة المرور</Label>
              <Input
                id="password"
                name="password"
                type="password"
                required
                placeholder="كلمة المرور"
                value={password}
                onChange={(e: ChangeEvent<HTMLInputElement>) => setPassword(e.target.value)}
                disabled={loading}
                className="bg-card text-right"
              />
            </div>
            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-primary-foreground" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري تسجيل الدخول...
                </>
              ) : (
                'تسجيل الدخول'
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
} 