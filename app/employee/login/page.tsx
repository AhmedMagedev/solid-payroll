"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

export default function EmployeeLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch("/api/employee/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (response.ok) {
        toast.success("تم تسجيل الدخول بنجاح");
        router.push("/employee/dashboard");
      } else {
        const data = await response.json();
        toast.error(data.error || "فشل تسجيل الدخول");
      }
    } catch {
      toast.error("حدث خطأ في الشبكة");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-secondary/10 to-primary/10 flex items-center justify-center p-4" dir="rtl">
      <Card className="w-full max-w-md bg-white shadow-2xl border border-primary/10">
        <CardHeader className="space-y-4 text-center p-6 sm:p-8 pb-4">
          <div className="flex justify-between items-center mb-4">
            <Link href="/login" className="text-muted-foreground hover:text-primary transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="flex-1"></div>
          </div>
          
          {/* Solid Logo */}
          <div className="flex justify-center mb-4">
            <Image
              src="/solidLogo.webp"
              alt="Solid Logo"
              width={100}
              height={100}
              className="object-contain"
              priority
            />
          </div>
          
          <div className="flex items-center justify-center gap-3 mb-2">
            <CardTitle className="text-2xl sm:text-3xl font-bold text-primary">
              بوابة الموظفين
            </CardTitle>
          </div>
          <p className="text-muted-foreground">تسجيل الدخول للموظفين</p>
        </CardHeader>
        
        <CardContent className="p-6 sm:p-8 pt-2">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="text-left block text-foreground">
                البريد الإلكتروني
              </Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="text-left border-primary/20 focus:border-primary focus:ring-primary/20"
                dir="ltr"
                placeholder="أدخل البريد الإلكتروني"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="password" className="text-left block text-foreground">
                كلمة المرور
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="text-left border-primary/20 focus:border-primary focus:ring-primary/20"
                dir="ltr"
                placeholder="أدخل كلمة المرور"
              />
            </div>
            
            <Button 
              type="submit" 
              className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-3 h-12 font-medium shadow-md hover:shadow-lg transition-all duration-200"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري تسجيل الدخول...
                </>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  
                  تسجيل الدخول
                </div>
              )}
            </Button>
          </form>
          
          <div className="mt-6 text-center">
            <Link 
              href="/admin/login" 
              className="text-sm text-primary hover:text-primary/80 underline transition-colors"
            >
              إداري؟ سجل الدخول هنا
            </Link>
          </div>
          
          <div className="mt-6 pt-4 border-t border-primary/10 text-center">
            <p className="text-xs text-muted-foreground">نظام إدارة الحضور والرواتب - سوليد</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 