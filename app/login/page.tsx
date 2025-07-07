"use client";

import Image from "next/image";

export default function LoginSelectionPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-primary/20 flex items-center justify-center" dir="rtl">
      <div className="bg-white p-8 rounded-xl shadow-2xl w-full max-w-md border border-primary/10">
        <div className="text-center mb-8">
          {/* Solid Logo */}
          <div className="flex justify-center mb-6">
            <Image
              src="/solidLogo.webp"
              alt="Solid Logo"
              width={120}
              height={120}
              className="object-contain"
              priority
            />
          </div>
          
          <h1 className="text-3xl font-bold text-primary mb-2">
            سوليد للرواتب
          </h1>
          <p className="text-muted-foreground">
            اختر نوع تسجيل الدخول
          </p>
        </div>

        <div className="space-y-4">
          <a
            href="/employee/login"
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-medium py-4 px-6 rounded-lg transition-all duration-200 block text-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5"
          >
            <div className="flex items-center justify-center gap-3">

              تسجيل دخول الموظف
            </div>
          </a>
          
          <a
            href="/admin/login"
            className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground font-medium py-4 px-6 rounded-lg transition-all duration-200 block text-center shadow-md hover:shadow-lg transform hover:-translate-y-0.5 border border-secondary"
          >
            <div className="flex items-center justify-center gap-3">

              تسجيل دخول الإدارة
            </div>
          </a>
        </div>

        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground mb-2">نظام إدارة الحضور والرواتب</p>
          <div className="h-px bg-gradient-to-r from-transparent via-primary/20 to-transparent"></div>
        </div>
      </div>
    </div>
  );
} 