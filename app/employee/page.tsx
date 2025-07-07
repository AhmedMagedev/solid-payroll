'use client';

import Link from "next/link";

export default function EmployeePage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 to-blue-100 flex items-center justify-center p-4" dir="rtl">
      <div className="bg-white p-8 rounded-lg shadow-lg w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">
          بوابة الموظفين
        </h1>
        <p className="text-gray-600 mb-8">
          مرحباً بك في نظام إدارة الحضور والرواتب
        </p>
        
        <div className="space-y-4">
          <Link
            href="/employee/login"
            className="w-full bg-green-600 hover:bg-green-700 text-white font-medium py-3 px-4 rounded-lg transition duration-200 block"
          >
            تسجيل الدخول
          </Link>
          
          <Link
            href="/login"
            className="w-full bg-gray-200 hover:bg-gray-300 text-gray-800 font-medium py-3 px-4 rounded-lg transition duration-200 block"
          >
            العودة للصفحة الرئيسية
          </Link>
        </div>

        <div className="mt-6 text-center text-sm text-gray-500">
          <p>للمساعدة، تواصل مع إدارة النظام</p>
        </div>
      </div>
    </div>
  );
} 