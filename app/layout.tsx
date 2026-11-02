import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MVK Lead Tracker - Google Sheets Edition",
  description: "Production-ready full-stack Google Sheets-style Team Lead Tracker with role-based access control",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen w-full overflow-x-hidden bg-slate-50 antialiased text-slate-800">
        {children}
      </body>
    </html>
  );
}
