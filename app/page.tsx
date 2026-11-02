"use client";

import React from "react";
import { AuthProvider, useAuth } from "@/components/auth/AuthContext";
import { AuthScreen } from "@/components/auth/AuthScreen";
import { SpreadsheetApp } from "@/components/spreadsheet/SpreadsheetApp";
import { RefreshCw } from "lucide-react";

function MainContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-3">
        <RefreshCw className="h-8 w-8 text-amber-400 animate-spin" />
        <span className="text-sm font-semibold tracking-wide">
          Verifying Session & Privileges...
        </span>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <SpreadsheetApp />;
}

export default function Page() {
  return (
    <AuthProvider>
      <MainContent />
    </AuthProvider>
  );
}
