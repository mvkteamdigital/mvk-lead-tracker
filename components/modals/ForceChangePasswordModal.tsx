"use client";

import React, { useState } from "react";
import { Eye, EyeOff, ShieldAlert, ShieldCheck, ArrowRight, LogOut } from "lucide-react";
import { useAuth } from "../auth/AuthContext";

interface ForceChangePasswordModalProps {
  userName: string;
  onSuccess: () => void;
}

export function ForceChangePasswordModal({
  userName,
  onSuccess,
}: ForceChangePasswordModalProps) {
  const { refreshUser, logout } = useAuth();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [saving, setSaving] = useState(false);
  const [bypassing, setBypassing] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          newPassword,
          isFirstLogin: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to update password.");
      }

      await refreshUser();
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to set password.");
    } finally {
      setSaving(false);
    }
  };

  const handleContinueDefaultPassword = async () => {
    setError(null);
    setBypassing(true);

    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bypassDefault: true,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "Failed to continue with default password.");
      }

      await refreshUser();
      onSuccess();
    } catch (err: any) {
      setError(err.message || "Failed to proceed.");
    } finally {
      setBypassing(false);
    }
  };

  const handleBackToLogin = async () => {
    setError(null);
    setLoggingOut(true);
    try {
      await logout();
    } catch (err: any) {
      setError(err.message || "Failed to log out.");
      setLoggingOut(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="px-6 py-5 bg-gradient-to-r from-amber-600 via-amber-500 to-amber-600 text-slate-950 flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-white/30 backdrop-blur-xs flex items-center justify-center shadow-inner">
            <ShieldAlert className="h-6 w-6 text-slate-950" />
          </div>
          <div>
            <h3 className="font-extrabold text-base leading-tight">
              Create Your Personal Password
            </h3>
            <p className="text-xs font-semibold text-slate-900/80">
              Mandatory First-Time Security Setup
            </p>
          </div>
        </div>

        {/* Form Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="bg-amber-50 border border-amber-200/80 rounded-xl p-3.5 text-xs text-amber-900 leading-relaxed">
            Welcome, <strong className="font-bold text-slate-950">{userName}</strong>! You are currently using the default system password. To protect your lead tracker data, please create a private personal password before opening your sheet.
          </div>

          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {error}
            </div>
          )}

          {/* New Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Choose New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="At least 6 characters"
                className="w-full pl-3.5 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                {showNew ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Confirm New Password */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type={showConfirm ? "text" : "password"}
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter chosen password"
                className="w-full pl-3.5 pr-10 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
              />
              <button
                type="button"
                onClick={() => setShowConfirm(!showConfirm)}
                className="absolute right-3 top-3 text-slate-400 hover:text-slate-600"
              >
                {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="pt-2 space-y-2.5">
            <button
              type="submit"
              disabled={saving || bypassing || loggingOut}
              className="w-full py-3 px-4 bg-slate-900 hover:bg-slate-800 text-white font-bold text-sm rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <span className="inline-block h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <ShieldCheck className="h-5 w-5 text-emerald-400" />
              )}
              <span>Save Private Password & Open Sheet</span>
            </button>

            {/* Option 1: Continue with default password */}
            <button
              type="button"
              disabled={saving || bypassing || loggingOut}
              onClick={handleContinueDefaultPassword}
              className="w-full py-2.5 px-4 bg-amber-50 hover:bg-amber-100/90 text-amber-950 border border-amber-300 font-semibold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
            >
              {bypassing ? (
                <span className="inline-block h-3.5 w-3.5 border-2 border-amber-900 border-t-transparent rounded-full animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4 text-amber-700" />
              )}
              <span>Continue with same default password</span>
            </button>

            {/* Option 2: Back to Login */}
            <div className="pt-1 flex items-center justify-center">
              <button
                type="button"
                disabled={saving || bypassing || loggingOut}
                onClick={handleBackToLogin}
                className="w-full py-2 px-3 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg text-xs font-semibold transition-colors flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
              >
                {loggingOut ? (
                  <span className="inline-block h-3 w-3 border-2 border-slate-500 border-t-transparent rounded-full animate-spin" />
                ) : (
                  <LogOut className="h-3.5 w-3.5 text-slate-400" />
                )}
                <span>Back to Login</span>
              </button>
            </div>
          </div>
        </form>

      </div>
    </div>
  );
}
