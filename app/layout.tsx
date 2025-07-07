import type { Metadata } from "next";
// import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/app/components/ui/sonner";

// const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "نظام الرواتب ",
  description: "نظام إدارة الرواتب والموظفين",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className="rtl">
      <body className="arabic-text">
        {children}
        <Toaster />
      </body>
    </html>
  );
}
