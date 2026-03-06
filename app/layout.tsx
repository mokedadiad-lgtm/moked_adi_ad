import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "מערכת שאלות ותשובות",
  description: "מערכת ניהול שאלות אנונימיות",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className="min-h-screen bg-background text-slate-700 antialiased">
        {children}
      </body>
    </html>
  );
}
