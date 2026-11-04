"use client";

import React, { useState, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import {
  X,
  Users,
  Search,
  KeyRound,
  Mail,
  Check,
  Edit2,
  RefreshCw,
  Shield,
  Lock,
  UserCheck,
  UserX,
  Trash2,
  Ban,
  FileSpreadsheet,
} from "lucide-react";

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  mustChangePassword: boolean;
  sheets: { id: string; name: string; _count: { rows: number } }[];
}

interface ManageTeamAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ManageTeamAccountsModal({
  isOpen,
  onClose,
}: ManageTeamAccountsModalProps) {
  const { user } = useAuth();

  // Strict RBAC: Never render anything if not authenticated or role is not ADMIN
  if (!isOpen || user?.role !== "ADMIN") return null;

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [notification, setNotification] = useState<{ type: "success" | "error"; msg: string } | null>(null);

  // Editing Email State
  const [editingEmailUserId, setEditingEmailUserId] = useState<string | null>(null);
  const [newEmailValue, setNewEmailValue] = useState("");

  // Resetting Password State
  const [resettingPasswordUserId, setResettingPasswordUserId] = useState<string | null>(null);
  const [newPasswordValue, setNewPasswordValue] = useState("");
  const [savingAction, setSavingAction] = useState(false);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const res = await fetch("/api/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleUpdateEmail = async (userId: string) => {
    if (!newEmailValue.trim()) return;
    setSavingAction(true);
    setNotification(null);

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          email: newEmailValue.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update email.");

      setNotification({ type: "success", msg: `Email updated to ${newEmailValue.trim()} successfully!` });
      setEditingEmailUserId(null);
      await fetchUsers();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to update email." });
    } finally {
      setSavingAction(false);
    }
  };

  const handleResetPassword = async (userId: string) => {
    if (!newPasswordValue.trim() || newPasswordValue.trim().length < 6) {
      setNotification({ type: "error", msg: "Password must be at least 6 characters long." });
      return;
    }

    setSavingAction(true);
    setNotification(null);

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          newPassword: newPasswordValue.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password.");

      setNotification({
        type: "success",
        msg: `Password for member reset successfully! The member can now log in with the new password.`,
      });
      setResettingPasswordUserId(null);
      setNewPasswordValue("");
      await fetchUsers();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to reset password." });
    } finally {
      setSavingAction(false);
    }
  };

  const handleToggleRevokeAccess = async (userId: string, currentStatus?: string) => {
    const newStatus = currentStatus === "REVOKED" ? "ACTIVE" : "REVOKED";
    setSavingAction(true);
    setNotification(null);

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId,
          status: newStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update account status.");

      setNotification({
        type: "success",
        msg: newStatus === "REVOKED"
          ? "Account access has been immediately revoked. User session is now blocked."
          : "Account access restored successfully.",
      });
      await fetchUsers();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to update status." });
    } finally {
      setSavingAction(false);
    }
  };

  const handleRemoveUser = async (userId: string, email: string) => {
    if (!confirm(`Are you sure you want to permanently remove member account "${email}"? Their sheet tabs and lead data will remain safely preserved.`)) {
      return;
    }

    setSavingAction(true);
    setNotification(null);

    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove user account.");

      setNotification({
        type: "success",
        msg: `User account "${email}" removed successfully.`,
      });
      await fetchUsers();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to remove user." });
    } finally {
      setSavingAction(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-4xl w-full max-h-[88vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base">
                Manage Team Accounts & Credentials
              </h3>
              <p className="text-xs text-slate-300">
                Admin Control: View members, update email addresses, and reset member passwords
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sub-bar with search and alert */}
        <div className="p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3 shrink-0">
          <div className="relative w-full sm:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search member by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
            />
          </div>

          <div className="text-xs text-slate-500 flex items-center gap-1.5 self-end sm:self-center">
            <Shield className="h-3.5 w-3.5 text-amber-600" />
            <span>Admin privileges active ({filteredUsers.length} accounts)</span>
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <div
            className={`px-6 py-2.5 text-xs font-medium flex items-center justify-between shrink-0 ${
              notification.type === "success"
                ? "bg-emerald-50 text-emerald-800 border-b border-emerald-200"
                : "bg-rose-50 text-rose-800 border-b border-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0" />
              <span>{notification.msg}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="hover:underline text-[11px] ml-4"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Table Content */}
        <div className="flex-1 overflow-auto p-4 sm:p-6">
          {loading ? (
            <div className="h-48 flex items-center justify-center gap-2 text-slate-500">
              <RefreshCw className="h-5 w-5 animate-spin text-amber-500" />
              <span className="text-xs font-medium">Loading team accounts...</span>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 uppercase font-bold tracking-wider text-[11px] border-b border-slate-200">
                    <th className="py-3 px-4">Member Name</th>
                    <th className="py-3 px-4">Email ID</th>
                    <th className="py-3 px-4">Role</th>
                    <th className="py-3 px-4">Access Status</th>
                    <th className="py-3 px-4">Sheet Tab</th>
                    <th className="py-3 px-4">Password Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {filteredUsers.map((u) => {
                    const sheet = u.sheets?.[0];
                    const isEditingEmail = editingEmailUserId === u.id;
                    const isResettingPass = resettingPasswordUserId === u.id;

                    return (
                      <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Name */}
                        <td className="py-3 px-4 font-semibold text-slate-900 flex items-center gap-2">
                          <div className="h-7 w-7 rounded-full bg-slate-200 text-slate-700 font-bold flex items-center justify-center text-xs shrink-0">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <span className="truncate">{u.name}</span>
                        </td>

                        {/* Email / Inline Edit */}
                        <td className="py-3 px-4 text-slate-700">
                          {isEditingEmail ? (
                            <div className="flex items-center gap-1.5">
                              <input
                                type="email"
                                value={newEmailValue}
                                onChange={(e) => setNewEmailValue(e.target.value)}
                                className="px-2 py-1 text-xs border border-amber-500 rounded bg-white outline-none w-48"
                                autoFocus
                              />
                              <button
                                onClick={() => handleUpdateEmail(u.id)}
                                disabled={savingAction}
                                className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-[11px] font-semibold"
                              >
                                Save
                              </button>
                              <button
                                onClick={() => setEditingEmailUserId(null)}
                                className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[11px]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 group">
                              <span className="font-mono text-slate-600">{u.email}</span>
                              <button
                                onClick={() => {
                                  setEditingEmailUserId(u.id);
                                  setNewEmailValue(u.email);
                                  setResettingPasswordUserId(null);
                                }}
                                className="text-slate-400 hover:text-blue-600 p-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                                title="Edit Email"
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                            </div>
                          )}
                        </td>

                        {/* Role */}
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase ${
                              u.role === "ADMIN"
                                ? "bg-purple-100 text-purple-800 border border-purple-200"
                                : "bg-blue-100 text-blue-800 border border-blue-200"
                            }`}
                          >
                            {u.role}
                          </span>
                        </td>

                        {/* Access Status */}
                        <td className="py-3 px-4">
                          {u.status === "REVOKED" ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                              <Ban className="h-3 w-3 text-rose-600" />
                              <span>Revoked</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <Check className="h-3 w-3 text-emerald-600" />
                              <span>Active</span>
                            </span>
                          )}
                        </td>

                        {/* Assigned Sheet */}
                        <td className="py-3 px-4 text-slate-600">
                          {sheet ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-slate-100 border border-slate-200 font-medium text-[11px]">
                              <FileSpreadsheet className="h-3 w-3 text-emerald-600" />
                              <span>{sheet.name}</span>
                              <span className="text-[10px] text-slate-400">
                                ({sheet._count.rows} leads)
                              </span>
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">None</span>
                          )}
                        </td>

                        {/* Password Status */}
                        <td className="py-3 px-4">
                          {u.mustChangePassword ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                              <Lock className="h-3 w-3 text-amber-500" />
                              <span>Starting Password (Unchanged)</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                              <UserCheck className="h-3 w-3 text-emerald-500" />
                              <span>Custom Password</span>
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          {isResettingPass ? (
                            <div className="flex items-center justify-end gap-1.5">
                              <input
                                type="text"
                                placeholder="New password"
                                value={newPasswordValue}
                                onChange={(e) => setNewPasswordValue(e.target.value)}
                                className="px-2 py-1 text-xs border border-amber-500 rounded bg-white outline-none w-36"
                                autoFocus
                              />
                              <button
                                onClick={() => handleResetPassword(u.id)}
                                disabled={savingAction || !newPasswordValue.trim()}
                                className="px-2.5 py-1 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded text-[11px] shadow-2xs"
                              >
                                Reset
                              </button>
                              <button
                                onClick={() => {
                                  setResettingPasswordUserId(null);
                                  setNewPasswordValue("");
                                }}
                                className="px-2 py-1 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded text-[11px]"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                onClick={() => {
                                  setResettingPasswordUserId(u.id);
                                  setNewPasswordValue("");
                                  setEditingEmailUserId(null);
                                }}
                                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded font-semibold text-[11px] border border-slate-300 flex items-center gap-1 transition-colors"
                              >
                                <KeyRound className="h-3 w-3 text-amber-600" />
                                <span>Reset Password</span>
                              </button>

                              {u.role !== "ADMIN" && (
                                <>
                                  <button
                                    onClick={() => handleToggleRevokeAccess(u.id, u.status)}
                                    disabled={savingAction}
                                    className={`px-2.5 py-1 rounded font-semibold text-[11px] border flex items-center gap-1 transition-colors ${
                                      u.status === "REVOKED"
                                        ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                                        : "bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300"
                                    }`}
                                    title={u.status === "REVOKED" ? "Restore account access" : "Immediately revoke access and block login session"}
                                  >
                                    {u.status === "REVOKED" ? (
                                      <>
                                        <UserCheck className="h-3 w-3 text-emerald-600" />
                                        <span>Restore Access</span>
                                      </>
                                    ) : (
                                      <>
                                        <UserX className="h-3 w-3 text-amber-700" />
                                        <span>Revoke Access</span>
                                      </>
                                    )}
                                  </button>

                                  <button
                                    onClick={() => handleRemoveUser(u.id, u.email)}
                                    disabled={savingAction}
                                    className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 rounded font-semibold text-[11px] border border-rose-200 flex items-center gap-1 transition-colors"
                                    title="Permanently remove user account (sheets and leads are safely retained)"
                                  >
                                    <Trash2 className="h-3 w-3 text-rose-600" />
                                    <span>Remove User</span>
                                  </button>
                                </>
                              )}
                            </div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            Passwords reset by Admin are updated immediately in the database.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold text-xs transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
}
