"use client";

import React, { useState } from "react";
import { useAuth } from "./AuthContext";
import {
  FileSpreadsheet,
  Lock,
  Mail,
  User as UserIcon,
  ShieldCheck,
  UserPlus,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export function AuthScreen() {
  const { login, register } = useAuth();
  const [isRegistering, setIsRegistering] = useState(false);

  // Form fields
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      if (isRegistering) {
        if (!name.trim()) {
          setError("Please enter your Full Name");
          setLoading(false);
          return;
        }
        const result = await register(name, email, password);
        if (!result.success) {
          setError(result.error || "Registration failed");
        }
      } else {
        const result = await login(email, password);
        if (!result.success) {
          setError(result.error || "Invalid email or password");
        }
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full overflow-y-auto flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 p-4 sm:p-6 lg:p-8 py-8 sm:py-12">
      <div className="w-full max-w-4xl flex flex-col md:grid md:grid-cols-12 bg-transparent md:bg-white rounded-3xl md:rounded-2xl md:shadow-2xl md:border md:border-slate-700/30 gap-6 md:gap-0">
        
        {/* Left Hero Section (Brand & RBAC Highlights) - First at the top on mobile, Left on desktop */}
        <div className="md:col-span-5 bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white p-6 sm:p-8 rounded-2xl md:rounded-none md:rounded-l-2xl shadow-xl md:shadow-none border border-slate-700/50 md:border-none flex flex-col justify-between relative overflow-hidden">
          <div className="absolute -top-12 -right-12 w-48 h-48 bg-amber-500/10 rounded-full blur-2xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-48 h-48 bg-blue-500/10 rounded-full blur-2xl pointer-events-none" />

          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-11 w-11 rounded-xl bg-amber-500/20 border border-amber-400/40 flex items-center justify-center text-amber-400 shadow-inner">
                <FileSpreadsheet className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-xl font-bold tracking-tight text-white flex items-center gap-1.5">
                  MVK Lead Tracker <span className="text-xs px-2 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-semibold border border-amber-400/30">Sheets</span>
                </h1>
                <p className="text-xs text-slate-400">Enterprise Role-Based CRM</p>
              </div>
            </div>

            <h2 className="text-2xl font-bold text-white mb-3 leading-snug">
              Strict Sheet-Wise Access Control & Two-Way Sync
            </h2>
            <p className="text-sm text-slate-300 mb-6 leading-relaxed">
              Google Sheets-style lead management designed for sales teams with strict member privacy and executive-level oversight.
            </p>

            <div className="space-y-3">
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <ShieldCheck className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Admin Privileges:</strong> Manager & CEO can see all team tabs, edit live data, and export multi-sheet workbooks.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <ShieldCheck className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Member Privacy:</strong> Team members see strictly their own sheet tab. All others are blocked at UI & server level.
                </span>
              </div>
              <div className="flex items-start gap-2.5 text-xs text-slate-300">
                <Sparkles className="h-4 w-4 text-blue-400 shrink-0 mt-0.5" />
                <span>
                  <strong className="text-white">Auto-Sheet Creation:</strong> New registrations instantly provision a custom spreadsheet tab.
                </span>
              </div>
            </div>
          </div>

          <div className="relative z-10 pt-6 mt-6 border-t border-slate-700/60 text-xs text-slate-400 flex items-center justify-between">
            <span>Next.js • SQLite • SheetJS</span>
          </div>
        </div>

        {/* Right Form Section - Second below hero on mobile, Right on desktop */}
        <div className="md:col-span-7 bg-white rounded-2xl md:rounded-none md:rounded-r-2xl p-6 sm:p-8 md:p-10 shadow-xl md:shadow-none flex flex-col justify-center">
          <div className="max-w-md mx-auto w-full">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-2xl font-bold text-slate-900">
                  {isRegistering ? "Create New Account" : "Sign In to Tracker"}
                </h3>
                <p className="text-sm text-slate-500 mt-1">
                  {isRegistering
                    ? "Enter your details to claim your pre-seeded sheet or create a new one"
                    : "Access your assigned leads or administrative dashboard"}
                </p>
              </div>
            </div>

            {error && (
              <div className="mb-5 p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-sm flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegistering && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                    1. Full Name
                  </label>
                  <div className="relative">
                    <UserIcon className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow"
                    />
                  </div>
                  <span className="text-[11px] text-slate-500 mt-1 block">
                    * If a pre-seeded tab (e.g. Likhita, Pushpa, Sanjana) exists, your account claims it directly. Otherwise, a new sheet is created.
                  </span>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  {isRegistering ? "2. Email ID" : "Email ID"}
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder={isRegistering ? "name@mvkleads.com or name@gmail.com" : "name@mvkleads.com or name@mvk.com"}
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                  {isRegistering ? "3. Password" : "Password"}
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-3 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-amber-500 transition-shadow"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white font-medium text-sm rounded-lg shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2 disabled:opacity-50 mt-2"
              >
                {loading ? (
                  <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : isRegistering ? (
                  <>
                    <UserPlus className="h-4 w-4" />
                    <span>Create Account & Provision Sheet</span>
                  </>
                ) : (
                  <>
                    <span>Sign In</span>
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </form>

            {/* Toggle Button for New User Registration */}
            <div className="mt-5 text-center pt-4 border-t border-slate-200">
              {isRegistering ? (
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(false);
                    setError(null);
                  }}
                  className="text-sm text-slate-600 hover:text-slate-900 font-medium inline-flex items-center gap-1.5"
                >
                  Already have an account? <span className="text-amber-600 font-semibold underline underline-offset-2">Sign In here</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setIsRegistering(true);
                    setError(null);
                  }}
                  className="w-full py-2.5 px-4 border border-dashed border-amber-500/80 bg-amber-50/50 hover:bg-amber-100/60 text-amber-900 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <UserPlus className="h-4 w-4 text-amber-700" />
                  <span>New User Registration</span>
                </button>
              )}
            </div>

          </div>
        </div>

      </div>
    </div>
  );
}
