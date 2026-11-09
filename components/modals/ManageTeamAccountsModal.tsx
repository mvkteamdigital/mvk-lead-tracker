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
  Plus,
  Eye,
  EyeOff,
  Copy,
  User,
  Layers,
  ArrowRightLeft,
  AlertTriangle,
} from "lucide-react";

interface SheetItem {
  id: string;
  name: string;
  order?: number;
  color?: string | null;
  validRowCount?: number;
  _count?: { rows: number };
}

interface UserRecord {
  id: string;
  name: string;
  email: string;
  role: string;
  status?: string;
  displayPassword?: string;
  mustChangePassword: boolean;
  sheets: SheetItem[];
  totalLeadCount?: number;
}

interface AdminStats {
  totalAccounts: number;
  totalLeads: number;
  unassignedLeads: number;
  totalSheets: number;
}

interface SheetOption {
  id: string;
  name: string;
  color?: string | null;
  userId: string | null;
  validRowCount?: number;
}

interface ManageTeamAccountsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onRefreshSheets?: () => void;
  onUserUpdated?: (user: any) => void;
}

export function ManageTeamAccountsModal({
  isOpen,
  onClose,
  onRefreshSheets,
  onUserUpdated,
}: ManageTeamAccountsModalProps) {
  const { user } = useAuth();

  // Strict RBAC: Never render anything if not authenticated or role is not ADMIN
  if (!isOpen || user?.role !== "ADMIN") return null;

  const [users, setUsers] = useState<UserRecord[]>([]);
  const [availableSheets, setAvailableSheets] = useState<SheetOption[]>([]);
  const [stats, setStats] = useState<AdminStats>({
    totalAccounts: 0,
    totalLeads: 0,
    unassignedLeads: 0,
    totalSheets: 0,
  });
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [notification, setNotification] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [savingAction, setSavingAction] = useState(false);

  // 1. Add New Member State (Full Account Creation)
  const [isAddMemberOpen, setIsAddMemberOpen] = useState(false);
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberPassword, setNewMemberPassword] = useState("");
  const [newMemberRole, setNewMemberRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [newMemberSheetOption, setNewMemberSheetOption] = useState<string>("new");
  const [showAddPassword, setShowAddPassword] = useState(false);

  // 2. Assign / Create Sheet Tab for Existing Member State
  const [isAddTabOpen, setIsAddTabOpen] = useState(false);
  const [selectedMemberForTab, setSelectedMemberForTab] = useState<string>("");
  const [newTabSheetName, setNewTabSheetName] = useState<string>("");

  // 3. Manage / View Password Dialog State
  const [managingPasswordUser, setManagingPasswordUser] = useState<UserRecord | null>(null);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [newCustomPassword, setNewCustomPassword] = useState("");
  const [showNewCustomPassword, setShowNewCustomPassword] = useState(false);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  // 4. Edit User Details Dialog State
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"MEMBER" | "ADMIN">("MEMBER");
  const [editSheetId, setEditSheetId] = useState<string>("none");

  // 5. Dedicated Sheet Management States (Rename, Reassign, Delete)
  const [renamingSheet, setRenamingSheet] = useState<{ id: string; name: string } | null>(null);
  const [renameInputVal, setRenameInputVal] = useState("");

  const [reassigningSheet, setReassigningSheet] = useState<{ id: string; name: string; currentUserId?: string } | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState("");

  const [deletingSheet, setDeletingSheet] = useState<{ id: string; name: string; leadCount: number } | null>(null);

  // Fetch all users and sheets
  const fetchData = async () => {
    try {
      setLoading(true);
      const [usersRes, sheetsRes] = await Promise.all([
        fetch("/api/users"),
        fetch("/api/sheets"),
      ]);

      if (usersRes.ok) {
        const uData = await usersRes.json();
        setUsers(uData.users || []);
        if (uData.stats) {
          setStats(uData.stats);
        }
      }
      if (sheetsRes.ok) {
        const sData = await sheetsRes.json();
        setAvailableSheets(sData.sheets || []);
      }
    } catch (err) {
      console.error("Failed to load user management data", err);
    } finally {
      setLoading(false);
    }
  };

  // Re-fetch data every time modal is opened to prevent stale data
  useEffect(() => {
    if (isOpen) {
      fetchData();
    }
  }, [isOpen]);

  // --- SHEET MANAGEMENT ACTION HANDLERS ---
  const handleSaveRenameSheet = async () => {
    if (!renamingSheet || !renameInputVal.trim()) return;
    setSavingAction(true);
    setNotification(null);
    try {
      const res = await fetch(`/api/sheets/${renamingSheet.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: renameInputVal.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to rename sheet.");
      setNotification({
        type: "success",
        msg: `Sheet renamed to "${renameInputVal.trim()}" successfully.`,
      });
      setRenamingSheet(null);
      await fetchData();
      if (onRefreshSheets) onRefreshSheets();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to rename sheet." });
    } finally {
      setSavingAction(false);
    }
  };

  const handleConfirmReassignSheet = async () => {
    if (!reassigningSheet || !reassignTargetId) return;
    setSavingAction(true);
    setNotification(null);
    try {
      const res = await fetch(`/api/sheets/${reassigningSheet.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: reassignTargetId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reassign sheet.");
      const targetUser = users.find((u) => u.id === reassignTargetId);
      setNotification({
        type: "success",
        msg: `Sheet "${reassigningSheet.name}" reassigned to ${targetUser?.name || "new member"} successfully.`,
      });
      setReassigningSheet(null);
      await fetchData();
      if (onRefreshSheets) onRefreshSheets();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to reassign sheet." });
    } finally {
      setSavingAction(false);
    }
  };

  const handleConfirmDeleteSheet = async () => {
    if (!deletingSheet) return;
    setSavingAction(true);
    setNotification(null);
    try {
      const res = await fetch(`/api/sheets/${deletingSheet.id}`, {
        method: "DELETE",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to delete sheet.");
      setNotification({
        type: "success",
        msg: `Sheet "${deletingSheet.name}" and its leads were permanently deleted.`,
      });
      setDeletingSheet(null);
      await fetchData();
      if (onRefreshSheets) onRefreshSheets();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to delete sheet." });
    } finally {
      setSavingAction(false);
    }
  };

  // --- ASSIGN / CREATE SHEET TAB FOR EXISTING MEMBER HANDLER ---
  const handleCreateTabForMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMemberForTab) {
      setNotification({ type: "error", msg: "Please select a team member." });
      return;
    }
    if (!newTabSheetName.trim()) {
      setNotification({ type: "error", msg: "Please enter a sheet tab name." });
      return;
    }

    setSavingAction(true);
    setNotification(null);

    try {
      const res = await fetch("/api/sheets", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newTabSheetName.trim(),
          userId: selectedMemberForTab,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create sheet tab.");

      const targetMember = users.find((u) => u.id === selectedMemberForTab);
      setNotification({
        type: "success",
        msg: `Sheet tab "${newTabSheetName.trim()}" created and assigned to ${targetMember?.name || "member"}!`,
      });

      setNewTabSheetName("");
      setSelectedMemberForTab("");
      setIsAddTabOpen(false);

      await fetchData();
      if (onRefreshSheets) onRefreshSheets();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to create sheet tab." });
    } finally {
      setSavingAction(false);
    }
  };

  const handleQuickAddTab = (u: UserRecord) => {
    setSelectedMemberForTab(u.id);
    setNewTabSheetName(`${u.name} (Source)`);
    setIsAddTabOpen(true);
    setIsAddMemberOpen(false);
    setEditingUser(null);
    setManagingPasswordUser(null);
    setNotification(null);
  };

  // --- ADD NEW MEMBER HANDLER ---
  const handleCreateNewMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMemberName.trim()) {
      setNotification({ type: "error", msg: "Please enter the member's name." });
      return;
    }
    if (!newMemberEmail.trim()) {
      setNotification({ type: "error", msg: "Please enter a valid email address." });
      return;
    }
    if (!newMemberPassword.trim() || newMemberPassword.trim().length < 6) {
      setNotification({ type: "error", msg: "Password must be at least 6 characters long." });
      return;
    }

    setSavingAction(true);
    setNotification(null);

    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newMemberName.trim(),
          email: newMemberEmail.trim(),
          password: newMemberPassword.trim(),
          role: newMemberRole,
          sheetOption: newMemberSheetOption,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create team member.");

      setNotification({
        type: "success",
        msg: `Team member "${newMemberName.trim()}" created successfully! Login credentials saved.`,
      });

      // Reset form and close
      setNewMemberName("");
      setNewMemberEmail("");
      setNewMemberPassword("");
      setNewMemberRole("MEMBER");
      setNewMemberSheetOption("new");
      setIsAddMemberOpen(false);

      // Immediately update local state array with returned user object
      if (data.user) {
        setUsers((prev) => [...prev, data.user]);
        if (onUserUpdated) onUserUpdated(data.user);
      }

      // Refresh list immediately without page reload
      await fetchData();
      if (onRefreshSheets) onRefreshSheets();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to create team member." });
    } finally {
      setSavingAction(false);
    }
  };

  // --- EDIT USER DETAILS HANDLER ---
  const handleOpenEditUser = (u: UserRecord) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRole((u.role as "MEMBER" | "ADMIN") || "MEMBER");
    setEditSheetId("none");
    setNotification(null);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editName.trim()) {
      setNotification({ type: "error", msg: "Name cannot be empty." });
      return;
    }
    if (!editEmail.trim()) {
      setNotification({ type: "error", msg: "Email cannot be empty." });
      return;
    }

    setSavingAction(true);
    setNotification(null);

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingUser.id,
          name: editName.trim(),
          email: editEmail.trim(),
          role: editRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update member details.");

      setNotification({
        type: "success",
        msg: `Member details for "${editName.trim()}" updated successfully!`,
      });
      setEditingUser(null);

      // Immediately invalidate and update local state array with returned updated user object
      if (data.user) {
        setUsers((prev) =>
          prev.map((u) => (u.id === data.user.id ? { ...u, ...data.user } : u))
        );
        if (onUserUpdated) {
          onUserUpdated(data.user);
        }
      }

      await fetchData();
      if (onRefreshSheets) onRefreshSheets();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to update details." });
    } finally {
      setSavingAction(false);
    }
  };

  const handleUnassignSheetFromEditUser = async (sheetId: string) => {
    if (!editingUser) return;
    setSavingAction(true);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingUser.id,
          unassignSheetId: sheetId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unassign sheet.");
      setNotification({
        type: "success",
        msg: "Sheet tab successfully unassigned from member.",
      });
      if (data.user) {
        setEditingUser(data.user);
      }
      await fetchData();
      if (onRefreshSheets) onRefreshSheets();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to unassign sheet." });
    } finally {
      setSavingAction(false);
    }
  };

  const handleAssignSheetToEditUser = async (sheetId: string) => {
    if (!editingUser || !sheetId || sheetId === "none") return;
    setSavingAction(true);
    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: editingUser.id,
          assignSheetId: sheetId,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign sheet.");
      setNotification({
        type: "success",
        msg: "Sheet tab successfully assigned to member!",
      });
      if (data.user) {
        setEditingUser(data.user);
      }
      setEditSheetId("none");
      await fetchData();
      if (onRefreshSheets) onRefreshSheets();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to assign sheet." });
    } finally {
      setSavingAction(false);
    }
  };

  // --- MANAGE / SET CUSTOM PASSWORD HANDLER ---
  const handleSaveCustomPassword = async () => {
    if (!managingPasswordUser) return;
    if (!newCustomPassword.trim() || newCustomPassword.trim().length < 6) {
      setNotification({ type: "error", msg: "New password must be at least 6 characters long." });
      return;
    }

    setSavingAction(true);
    setNotification(null);

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: managingPasswordUser.id,
          newPassword: newCustomPassword.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update password.");

      setNotification({
        type: "success",
        msg: `Custom password for ${managingPasswordUser.name} set successfully! Credentials updated.`,
      });

      // Update local state for the modal
      setManagingPasswordUser({
        ...managingPasswordUser,
        displayPassword: newCustomPassword.trim(),
        mustChangePassword: false,
      });
      setNewCustomPassword("");
      await fetchData();
      if (onRefreshSheets) onRefreshSheets();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to reset password." });
    } finally {
      setSavingAction(false);
    }
  };

  const handleCopyCredentials = (u: UserRecord) => {
    const pwd =
      u.displayPassword ||
      (u.mustChangePassword ? `${u.name.toLowerCase()}mvkleads12345` : "••••••••");
    const textToCopy = `MVK Lead Tracker Login Credentials:\nEmail: ${u.email}\nPassword: ${pwd}\nPortal URL: ${window.location.origin}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedCredentials(true);
    setTimeout(() => setCopiedCredentials(false), 2500);
  };

  // --- ACCESS REVOCATION & RESTORATION ---
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
        msg:
          newStatus === "REVOKED"
            ? "Account access revoked immediately. Active user session is blocked."
            : "Account access restored successfully.",
      });
      await fetchData();
      if (onRefreshSheets) onRefreshSheets();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to update status." });
    } finally {
      setSavingAction(false);
    }
  };

  // --- REMOVE USER HANDLER ---
  const handleRemoveUser = async (userId: string, email: string) => {
    if (
      !confirm(
        `Are you sure you want to permanently remove member account "${email}"? Associated sheet tabs and client lead records will remain safely preserved.`
      )
    ) {
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
      await fetchData();
      if (onRefreshSheets) onRefreshSheets();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to remove user." });
    } finally {
      setSavingAction(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.sheets?.[0]?.name.toLowerCase().includes(q)
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-5xl w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 sm:px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center border border-amber-500/30">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-sm sm:text-base tracking-tight flex items-center gap-2">
                <span>Manage Team Accounts & Credentials</span>
                <span className="px-2 py-0.5 rounded-full bg-purple-500/30 text-purple-300 text-[10px] font-bold border border-purple-400/40">
                  Admin
                </span>
              </h3>
              <p className="text-xs text-slate-300 mt-0.5">
                Full Member Management: Add members, edit credentials, view/set passwords, and assign sheets
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1.5 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Sub-bar: Search, Add Member Button, Stats */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-xs sm:max-w-sm">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, or sheet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 shadow-2xs"
              />
            </div>

            {/* Quick Refresh */}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
              title="Refresh users list"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-amber-500" : ""}`} />
            </button>
          </div>

          {/* Action Buttons: Add New Member & Add Tab for Member & Summary Metrics */}
          <div className="flex items-center gap-2.5 flex-wrap justify-between sm:justify-end">
            {/* 1. Add New Member Button */}
            <button
              onClick={() => {
                setIsAddMemberOpen(!isAddMemberOpen);
                setIsAddTabOpen(false);
                setEditingUser(null);
                setManagingPasswordUser(null);
                setNotification(null);
              }}
              className="px-3.5 py-1.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-600 hover:to-amber-700 text-slate-950 font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95"
            >
              <Plus className="h-4 w-4 stroke-[3]" />
              <span>Add New Member</span>
            </button>

            {/* 2. Assign / Add Tab to Existing Member Button */}
            <button
              onClick={() => {
                setIsAddTabOpen(!isAddTabOpen);
                setIsAddMemberOpen(false);
                setEditingUser(null);
                setManagingPasswordUser(null);
                setNotification(null);
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95"
              title="Add an additional sheet tab to an existing member (e.g. Sanjana 99acres)"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>+ Add Tab to Member</span>
            </button>

            {/* 3. Summary Metric: Total Accounts */}
            <div className="text-xs text-slate-700 flex items-center gap-1.5 font-bold bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-xl shadow-2xs">
              <Shield className="h-3.5 w-3.5 text-purple-600" />
              <span>{stats.totalAccounts || users.length} Accounts</span>
            </div>

            {/* 4. Prominent New Summary Metric: TOTAL LEADS */}
            <div className="text-xs flex items-center gap-1.5 font-extrabold bg-gradient-to-r from-amber-100 to-amber-200/90 border border-amber-400 text-amber-950 px-3 py-1 rounded-xl shadow-2xs">
              <Layers className="h-3.5 w-3.5 text-amber-800" />
              <span>TOTAL LEADS:</span>
              <span className="bg-amber-600 text-white px-2 py-0.5 rounded-md font-black text-xs">
                {stats.totalLeads}
              </span>
            </div>

            {/* 5. Unassigned Leads Alert (if any exist) */}
            {stats.unassignedLeads > 0 && (
              <div className="text-xs text-rose-700 flex items-center gap-1 font-bold bg-rose-50 border border-rose-300 px-2.5 py-1 rounded-xl">
                <span>⚠️ {stats.unassignedLeads} Unassigned Leads</span>
              </div>
            )}
          </div>
        </div>

        {/* Notifications */}
        {notification && (
          <div
            className={`px-5 py-2.5 text-xs font-semibold flex items-center justify-between shrink-0 ${
              notification.type === "success"
                ? "bg-emerald-50 text-emerald-900 border-b border-emerald-200"
                : "bg-rose-50 text-rose-900 border-b border-rose-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <Check className="h-4 w-4 shrink-0" />
              <span>{notification.msg}</span>
            </div>
            <button
              onClick={() => setNotification(null)}
              className="hover:underline text-[11px] ml-4 font-bold"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Collapsible "Assign / Add Sheet Tab to Existing Member" Panel */}
        {isAddTabOpen && (
          <div className="p-4 sm:p-5 bg-gradient-to-br from-purple-50/80 to-slate-50 border-b-2 border-purple-300 shrink-0 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-purple-600 text-white flex items-center justify-center font-bold text-xs">
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                </div>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                  Assign or Create Additional Sheet Tab for Existing Member
                </h4>
              </div>
              <button
                onClick={() => setIsAddTabOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-600 mb-3">
              One member account can have multiple sheet tabs (e.g. Sanjana Meta, Sanjana 99acres).
              This preserves the member&apos;s existing login credentials while providing access to multiple independent sheets.
            </p>

            <form onSubmit={handleCreateTabForMember} className="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
              {/* 1. Select Existing Member */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Select Team Member *
                </label>
                <select
                  required
                  value={selectedMemberForTab}
                  onChange={(e) => {
                    setSelectedMemberForTab(e.target.value);
                    const selected = users.find((u) => u.id === e.target.value);
                    if (selected && !newTabSheetName) {
                      setNewTabSheetName(`${selected.name} (Source)`);
                    }
                  }}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold text-slate-900"
                >
                  <option value="">-- Choose Member --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) - {u.sheets.length} current {u.sheets.length === 1 ? "sheet" : "sheets"}
                    </option>
                  ))}
                </select>
              </div>

              {/* 2. Custom Sheet Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Custom Sheet Tab Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Sanjana (99acres) or Q4 Meta"
                  value={newTabSheetName}
                  onChange={(e) => setNewTabSheetName(e.target.value)}
                  className="w-full px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium text-slate-900"
                />
              </div>

              {/* 3. Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={savingAction}
                  className="flex-1 py-1.5 px-3 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white font-bold text-xs rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Check className="h-3.5 w-3.5 text-amber-300" />
                  <span>{savingAction ? "Creating..." : "Create & Assign Tab"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddTabOpen(false)}
                  className="py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Collapsible "Add New Member" Form Panel */}
        {isAddMemberOpen && (
          <div className="p-4 sm:p-5 bg-gradient-to-br from-amber-50/70 to-slate-50 border-b-2 border-amber-300 shrink-0 animate-in slide-in-from-top-2 duration-150">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-lg bg-amber-500 text-slate-950 flex items-center justify-center font-bold text-xs">
                  +
                </div>
                <h4 className="text-xs sm:text-sm font-extrabold text-slate-900">
                  Create New Team Member Account
                </h4>
              </div>
              <button
                onClick={() => setIsAddMemberOpen(false)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleCreateNewMember} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 items-end">
              {/* Full Name */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Member Name *
                </label>
                <div className="relative">
                  <User className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    placeholder="e.g. Kavya"
                    value={newMemberName}
                    onChange={(e) => {
                      setNewMemberName(e.target.value);
                      if (!newMemberEmail && e.target.value.trim()) {
                        setNewMemberEmail(
                          `${e.target.value.trim().toLowerCase()}@mvkleads.com`
                        );
                      }
                      if (!newMemberPassword && e.target.value.trim()) {
                        setNewMemberPassword(
                          `${e.target.value.trim().toLowerCase()}mvkleads12345`
                        );
                      }
                    }}
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-900"
                  />
                </div>
              </div>

              {/* Email Address */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Email ID *
                </label>
                <div className="relative">
                  <Mail className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="email"
                    required
                    placeholder="e.g. kavya@mvkleads.com"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    className="w-full pl-8 pr-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-900 font-mono"
                  />
                </div>
              </div>

              {/* Password */}
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Password *
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type={showAddPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Min 6 characters"
                    value={newMemberPassword}
                    onChange={(e) => setNewMemberPassword(e.target.value)}
                    className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-900 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setShowAddPassword(!showAddPassword)}
                    className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                    title={showAddPassword ? "Hide password" : "Show password"}
                  >
                    {showAddPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Role & Sheet Tab Selection */}
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Role
                  </label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as "MEMBER" | "ADMIN")}
                    className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-slate-900"
                  >
                    <option value="MEMBER">Member</option>
                    <option value="ADMIN">Admin</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 truncate" title="Assigned Sheet Tab">
                    Sheet Tab
                  </label>
                  <select
                    value={newMemberSheetOption}
                    onChange={(e) => setNewMemberSheetOption(e.target.value)}
                    className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-900"
                  >
                    <option value="new">➕ Create New Tab</option>
                    <option value="none">None (No Sheet)</option>
                    {availableSheets.map((sh) => (
                      <option key={sh.id} value={sh.id}>
                        {sh.name} {sh.userId ? "(Assigned)" : "(Available)"}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Submit & Cancel Buttons */}
              <div className="flex items-center gap-2">
                <button
                  type="submit"
                  disabled={savingAction}
                  className="flex-1 py-1.5 px-3 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-lg transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Check className="h-3.5 w-3.5 text-amber-400" />
                  <span>{savingAction ? "Creating..." : "Save Member"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddMemberOpen(false)}
                  className="py-1.5 px-3 bg-white hover:bg-slate-100 text-slate-600 border border-slate-300 rounded-lg text-xs font-semibold"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        {/* Main Users Table */}
        <div className="flex-1 overflow-auto p-4 sm:p-6 bg-slate-100/50">
          {loading ? (
            <div className="h-48 flex items-center justify-center gap-2 text-slate-500">
              <RefreshCw className="h-5 w-5 animate-spin text-amber-500" />
              <span className="text-xs font-medium">Loading team accounts & credentials...</span>
            </div>
          ) : (
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs bg-white">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-700 uppercase font-extrabold tracking-wider text-[11px] border-b border-slate-200 select-none">
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
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-8 text-center text-slate-400">
                        No team member accounts found matching &quot;{searchQuery}&quot;.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => {
                      const sheet = u.sheets?.[0];
                      const pwd =
                        u.displayPassword ||
                        (u.mustChangePassword
                          ? `${u.name.toLowerCase()}mvkleads12345`
                          : null);

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors">
                          {/* 1. Member Name */}
                          <td className="py-3 px-4 font-bold text-slate-900">
                            <div className="flex items-center gap-2.5">
                              <div
                                className={`h-8 w-8 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 shadow-2xs ${
                                  u.role === "ADMIN"
                                    ? "bg-purple-100 text-purple-800 border border-purple-300"
                                    : "bg-slate-200 text-slate-800 border border-slate-300"
                                }`}
                              >
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div>
                                <div className="font-bold text-slate-900 truncate">{u.name}</div>
                                {u.email === user?.email && (
                                  <span className="text-[10px] text-amber-700 font-semibold">(Your Account)</span>
                                )}
                              </div>
                            </div>
                          </td>

                          {/* 2. Email ID */}
                          <td className="py-3 px-4 text-slate-700 font-mono text-[11px]">
                            {u.email}
                          </td>

                          {/* 3. Role */}
                          <td className="py-3 px-4">
                            <span
                              className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border shadow-2xs ${
                                u.role === "ADMIN"
                                  ? "bg-purple-100 text-purple-800 border-purple-200"
                                  : "bg-blue-100 text-blue-800 border-blue-200"
                              }`}
                            >
                              {u.role}
                            </span>
                          </td>

                          {/* 4. Access Status */}
                          <td className="py-3 px-4">
                            {u.status === "REVOKED" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full shadow-2xs">
                                <Ban className="h-3 w-3 text-rose-600" />
                                <span>Revoked</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full shadow-2xs">
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span>Active</span>
                              </span>
                            )}
                          </td>

                          {/* 5. Sheet Tab(s) & Individual Lead Counts & Sheet Actions */}
                          <td className="py-3 px-4 text-slate-700 min-w-[260px]">
                            {(!u.sheets || u.sheets.length === 0) ? (
                              <div className="flex items-center gap-1.5">
                                <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                                <button
                                  type="button"
                                  onClick={() => handleQuickAddTab(u)}
                                  className="text-[10px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded transition-colors"
                                  title={`Assign a sheet tab to ${u.name}`}
                                >
                                  + Tab
                                </button>
                              </div>
                            ) : (
                              (() => {
                                const total =
                                  u.totalLeadCount ??
                                  u.sheets.reduce(
                                    (sum, s) => sum + (s.validRowCount ?? s._count?.rows ?? 0),
                                    0
                                  );

                                return (
                                  <div className="space-y-1.5 py-0.5">
                                    {/* Combined Member Summary Header */}
                                    <div className="flex items-center justify-between gap-1.5">
                                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-950 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-md shadow-2xs">
                                        <Layers className="h-3 w-3 text-amber-700 shrink-0" />
                                        <span>
                                          {total} {total === 1 ? "Lead" : "Combined Leads"}
                                        </span>
                                        <span className="text-[10px] font-semibold text-amber-800">
                                          ({u.sheets.length} {u.sheets.length === 1 ? "sheet" : "sheets"})
                                        </span>
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleQuickAddTab(u)}
                                        className="text-[10px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded transition-colors flex items-center gap-0.5"
                                        title={`Add an additional sheet tab for ${u.name}`}
                                      >
                                        <Plus className="h-2.5 w-2.5 stroke-[3]" />
                                        <span>Tab</span>
                                      </button>
                                    </div>

                                    {/* Individual Sheets List with Actions */}
                                    <div className="space-y-1">
                                      {u.sheets.map((s) => {
                                        const sLeads =
                                          s.validRowCount !== undefined
                                            ? s.validRowCount
                                            : s._count?.rows ?? 0;
                                        return (
                                          <div
                                            key={s.id}
                                            className="group/sheet flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 px-2 py-1 rounded-lg border border-slate-200/80 text-[11px] transition-colors"
                                          >
                                            <div className="flex items-center gap-1.5 min-w-0 mr-1.5">
                                              {/* Tab Color Indicator */}
                                              {s.color ? (
                                                <span
                                                  className="h-2 w-2 rounded-full shrink-0 shadow-2xs"
                                                  style={{ backgroundColor: s.color }}
                                                />
                                              ) : (
                                                <FileSpreadsheet className="h-3 w-3 text-slate-400 shrink-0" />
                                              )}
                                              <span
                                                className="font-bold text-slate-900 truncate"
                                                title={s.name}
                                              >
                                                {s.name}
                                              </span>
                                              <span className="text-slate-600 font-mono text-[10px] bg-white px-1.5 py-0.2 rounded border border-slate-200 font-semibold shrink-0">
                                                {sLeads} {sLeads === 1 ? "lead" : "leads"}
                                              </span>
                                            </div>

                                            {/* Sheet Quick Actions: Rename, Reassign, Delete */}
                                            <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover/sheet:opacity-100 transition-opacity">
                                              {/* Rename Sheet */}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setRenamingSheet({ id: s.id, name: s.name });
                                                  setRenameInputVal(s.name);
                                                }}
                                                className="p-1 hover:bg-white text-slate-500 hover:text-blue-600 rounded transition-colors"
                                                title={`Rename sheet "${s.name}"`}
                                              >
                                                <Edit2 className="h-3 w-3" />
                                              </button>

                                              {/* Reassign Sheet */}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setReassigningSheet({
                                                    id: s.id,
                                                    name: s.name,
                                                    currentUserId: u.id,
                                                  });
                                                  setReassignTargetId(
                                                    users.find((other) => other.id !== u.id)?.id || ""
                                                  );
                                                }}
                                                className="p-1 hover:bg-white text-slate-500 hover:text-amber-600 rounded transition-colors"
                                                title={`Reassign sheet "${s.name}" to another member`}
                                              >
                                                <ArrowRightLeft className="h-3 w-3" />
                                              </button>

                                              {/* Delete Sheet */}
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setDeletingSheet({
                                                    id: s.id,
                                                    name: s.name,
                                                    leadCount: sLeads,
                                                  });
                                                }}
                                                className="p-1 hover:bg-white text-slate-500 hover:text-rose-600 rounded transition-colors"
                                                title={`Delete sheet "${s.name}"`}
                                              >
                                                <Trash2 className="h-3 w-3" />
                                              </button>
                                            </div>
                                          </div>
                                        );
                                      })}
                                    </div>
                                  </div>
                                );
                              })()
                            )}
                          </td>

                          {/* 6. Password Status & Quick View */}
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-1.5">
                              {u.mustChangePassword ? (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                  <Lock className="h-3 w-3 text-amber-600" />
                                  <span>Default Starting Password</span>
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                                  <UserCheck className="h-3 w-3 text-emerald-600" />
                                  <span>Custom Password Set</span>
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 7. Action Buttons */}
                          <td className="py-3 px-4 text-right">
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              {/* Action 1: Edit User Details */}
                              <button
                                onClick={() => handleOpenEditUser(u)}
                                className="p-1.5 sm:px-2.5 sm:py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-[11px] border border-slate-300 flex items-center gap-1 transition-colors"
                                title="Edit user details (Name, Email, Role, Sheet)"
                              >
                                <Edit2 className="h-3 w-3 text-blue-600" />
                                <span className="hidden sm:inline">Edit Details</span>
                              </button>

                              {/* Action 2: Password Action Button (Key Icon) - View & Set Custom Password */}
                              <button
                                onClick={() => {
                                  setManagingPasswordUser(u);
                                  setShowCurrentPassword(false);
                                  setNewCustomPassword("");
                                  setShowNewCustomPassword(false);
                                  setNotification(null);
                                }}
                                className="p-1.5 sm:px-2.5 sm:py-1 bg-amber-50 hover:bg-amber-100 text-amber-900 rounded-lg font-bold text-[11px] border border-amber-300 flex items-center gap-1 transition-colors shadow-2xs"
                                title="View current password or set new custom password"
                              >
                                <KeyRound className="h-3.5 w-3.5 text-amber-700" />
                                <span className="hidden sm:inline">Password</span>
                              </button>

                              {/* Action 3: Revoke / Restore Access (Non-admins only) */}
                              {u.role !== "ADMIN" && (
                                <button
                                  onClick={() => handleToggleRevokeAccess(u.id, u.status)}
                                  disabled={savingAction}
                                  className={`p-1.5 sm:px-2 sm:py-1 rounded-lg font-semibold text-[11px] border flex items-center gap-1 transition-colors ${
                                    u.status === "REVOKED"
                                      ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                                      : "bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300"
                                  }`}
                                  title={
                                    u.status === "REVOKED"
                                      ? "Restore account access"
                                      : "Immediately revoke access and block login session"
                                  }
                                >
                                  {u.status === "REVOKED" ? (
                                    <>
                                      <UserCheck className="h-3 w-3 text-emerald-600" />
                                      <span className="hidden md:inline">Restore</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserX className="h-3 w-3 text-rose-600" />
                                      <span className="hidden md:inline">Revoke</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* Action 4: Remove User Permanently (Non-admins only) */}
                              {u.role !== "ADMIN" && (
                                <button
                                  onClick={() => handleRemoveUser(u.id, u.email)}
                                  disabled={savingAction}
                                  className="p-1.5 sm:px-2 sm:py-1 bg-slate-50 hover:bg-rose-50 hover:text-rose-700 text-slate-500 rounded-lg font-semibold text-[11px] border border-slate-200 transition-colors"
                                  title="Permanently remove user account (sheets and lead data safely retained)"
                                >
                                  <Trash2 className="h-3 w-3" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <span>
            Changes made in this management panel update Neon PostgreSQL in real-time.
          </span>
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold text-xs transition-colors shadow-xs"
          >
            Close
          </button>
        </div>

      </div>

      {/* --- MODAL 1: VIEW & SET PASSWORD MODAL --- */}
      {managingPasswordUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-100">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-200">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Credential Management
                  </h4>
                  <p className="text-xs text-slate-500">
                    {managingPasswordUser.name} ({managingPasswordUser.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setManagingPasswordUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Section 1: View Current Password */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700">
                  Current Password Record
                </label>
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="text-xs text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-1"
                >
                  {showCurrentPassword ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      <span>View Password</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono text-xs font-bold text-slate-900 tracking-wider">
                  {showCurrentPassword
                    ? managingPasswordUser.displayPassword ||
                      (managingPasswordUser.mustChangePassword
                        ? `${managingPasswordUser.name.toLowerCase()}mvkleads12345`
                        : "No saved plaintext")
                    : "••••••••••••"}
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyCredentials(managingPasswordUser)}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-800 font-bold text-xs rounded-lg flex items-center gap-1 transition-all"
                  title="Copy full login credentials (email & password)"
                >
                  {copiedCredentials ? (
                    <>
                      <Check className="h-3.5 w-3.5 text-emerald-600" />
                      <span className="text-emerald-700">Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      <span>Copy</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Section 2: Set New Custom Password */}
            <div className="border-t border-slate-100 pt-3">
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Set New Custom Password
              </label>
              <div className="relative mb-3">
                <KeyRound className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type={showNewCustomPassword ? "text" : "password"}
                  placeholder="Enter new password (min 6 chars)..."
                  value={newCustomPassword}
                  onChange={(e) => setNewCustomPassword(e.target.value)}
                  className="w-full pl-9 pr-8 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-medium text-slate-900"
                />
                <button
                  type="button"
                  onClick={() => setShowNewCustomPassword(!showNewCustomPassword)}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  {showNewCustomPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleSaveCustomPassword}
                  disabled={savingAction || !newCustomPassword.trim()}
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>{savingAction ? "Saving..." : "Save New Password"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setManagingPasswordUser(null)}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: RENAME SHEET MODAL --- */}
      {renamingSheet && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Edit2 className="h-4 w-4 text-blue-600" />
                <h4 className="font-extrabold text-sm text-slate-900">Rename Sheet Tab</h4>
              </div>
              <button
                onClick={() => setRenamingSheet(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveRenameSheet();
              }}
              className="space-y-3"
            >
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Sheet Tab Name *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={renameInputVal}
                  onChange={(e) => setRenameInputVal(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium text-slate-900"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingAction || !renameInputVal.trim()}
                  className="flex-1 py-2 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>{savingAction ? "Saving..." : "Save Name"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setRenamingSheet(null)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 4: REASSIGN SHEET MODAL --- */}
      {reassigningSheet && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-amber-600" />
                <h4 className="font-extrabold text-sm text-slate-900">Reassign Sheet Tab</h4>
              </div>
              <button
                onClick={() => setReassigningSheet(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleConfirmReassignSheet();
              }}
              className="space-y-3"
            >
              <p className="text-xs text-slate-600 leading-relaxed">
                Transfer ownership of sheet <strong className="text-slate-900">&quot;{reassigningSheet.name}&quot;</strong> to another team member:
              </p>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Destination Team Member *
                </label>
                <select
                  required
                  value={reassignTargetId}
                  onChange={(e) => setReassignTargetId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-slate-900"
                >
                  <option value="">-- Choose Member --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email}) - {u.sheets.length} current sheets
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={savingAction || !reassignTargetId}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>{savingAction ? "Reassigning..." : "Confirm Reassign"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setReassigningSheet(null)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* --- MODAL 5: DELETE SHEET CONFIRMATION MODAL --- */}
      {deletingSheet && (
        <div className="fixed inset-0 z-70 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 max-w-sm w-full p-5 animate-in zoom-in-95 duration-100">
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">Delete Sheet Tab?</h4>
                <p className="text-xs text-rose-600 font-semibold">Irreversible Action</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to permanently delete sheet{" "}
              <strong className="text-slate-900">&quot;{deletingSheet.name}&quot;</strong>?
              All <strong>{deletingSheet.leadCount} lead records</strong> in this tab will be permanently removed from the database.
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={savingAction}
                onClick={handleConfirmDeleteSheet}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                <span>{savingAction ? "Deleting..." : "Permanently Delete"}</span>
              </button>
              <button
                type="button"
                onClick={() => setDeletingSheet(null)}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {editingUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-100">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center border border-blue-200">
                  <Edit2 className="h-4 w-4" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Edit Member Details
                  </h4>
                  <p className="text-xs text-slate-500">
                    Update profile, email ID, role, or assign sheet tab
                  </p>
                </div>
              </div>
              <button
                onClick={() => setEditingUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveEditUser} className="space-y-3">
              {/* Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name
                </label>
                <input
                  type="text"
                  required
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-medium text-slate-900"
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Email Address (Login ID)
                </label>
                <input
                  type="email"
                  required
                  value={editEmail}
                  onChange={(e) => setEditEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-slate-900"
                />
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as "MEMBER" | "ADMIN")}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-slate-900"
                >
                  <option value="MEMBER">Member (Assigned Sheet Only)</option>
                  <option value="ADMIN">Admin (Full System & All Sheets Access)</option>
                </select>
              </div>

              {/* Assigned Sheet Tabs List & Manager */}
              <div className="bg-slate-50 rounded-xl p-3 border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <FileSpreadsheet className="h-3.5 w-3.5 text-purple-600" />
                    <span>Assigned Sheet Tabs ({editingUser.sheets?.length || 0})</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingUser(null);
                      handleQuickAddTab(editingUser);
                    }}
                    className="text-[10px] font-bold text-purple-700 hover:text-purple-900 bg-white hover:bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-lg transition-colors flex items-center gap-1"
                  >
                    <Plus className="h-3 w-3 stroke-[3]" />
                    <span>New Tab for Member</span>
                  </button>
                </div>

                {(!editingUser.sheets || editingUser.sheets.length === 0) ? (
                  <p className="text-[11px] text-slate-400 italic">No sheets currently assigned to this member.</p>
                ) : (
                  <div className="space-y-1.5">
                    {editingUser.sheets.map((s) => {
                      const count = s.validRowCount !== undefined ? s.validRowCount : (s._count?.rows ?? 0);
                      return (
                        <div
                          key={s.id}
                          className="flex items-center justify-between bg-white px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs shadow-2xs"
                        >
                          <div className="flex items-center gap-2 min-w-0 mr-2">
                            {s.color ? (
                              <span
                                className="h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs"
                                style={{ backgroundColor: s.color }}
                              />
                            ) : (
                              <FileSpreadsheet className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                            )}
                            <span className="font-bold text-slate-900 truncate" title={s.name}>
                              {s.name}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.2 rounded font-mono border border-slate-200 shrink-0">
                              {count} {count === 1 ? "lead" : "leads"}
                            </span>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            {/* Rename */}
                            <button
                              type="button"
                              onClick={() => {
                                setRenamingSheet({ id: s.id, name: s.name });
                                setRenameInputVal(s.name);
                              }}
                              className="p-1 text-slate-500 hover:text-blue-600 hover:bg-slate-100 rounded transition-colors"
                              title="Rename this sheet"
                            >
                              <Edit2 className="h-3 w-3" />
                            </button>

                            {/* Reassign */}
                            <button
                              type="button"
                              onClick={() => {
                                setReassigningSheet({
                                  id: s.id,
                                  name: s.name,
                                  currentUserId: editingUser.id,
                                });
                                setReassignTargetId(
                                  users.find((u) => u.id !== editingUser.id)?.id || ""
                                );
                              }}
                              className="p-1 text-slate-500 hover:text-amber-600 hover:bg-slate-100 rounded transition-colors"
                              title="Reassign to another member"
                            >
                              <ArrowRightLeft className="h-3 w-3" />
                            </button>

                            {/* Unassign */}
                            <button
                              type="button"
                              onClick={() => handleUnassignSheetFromEditUser(s.id)}
                              disabled={savingAction}
                              className="text-[10px] text-slate-500 hover:text-amber-700 hover:bg-amber-50 px-1.5 py-0.5 rounded font-semibold transition-colors"
                              title="Unlink this sheet from this member"
                            >
                              Unlink
                            </button>

                            {/* Delete */}
                            <button
                              type="button"
                              onClick={() => {
                                setDeletingSheet({
                                  id: s.id,
                                  name: s.name,
                                  leadCount: count,
                                });
                              }}
                              className="p-1 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                              title="Permanently delete sheet"
                            >
                              <Trash2 className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Assign Available Sheet */}
                {availableSheets.filter((sh) => !sh.userId || sh.userId !== editingUser.id).length > 0 && (
                  <div className="pt-2 border-t border-slate-200 flex items-center gap-2">
                    <select
                      value={editSheetId}
                      onChange={(e) => setEditSheetId(e.target.value)}
                      className="flex-1 px-2.5 py-1 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-medium text-slate-800"
                    >
                      <option value="none">-- Assign Existing Sheet --</option>
                      {availableSheets
                        .filter((sh) => !sh.userId)
                        .map((sh) => (
                          <option key={sh.id} value={sh.id}>
                            {sh.name} (Unassigned)
                          </option>
                        ))}
                    </select>
                    <button
                      type="button"
                      disabled={savingAction || editSheetId === "none"}
                      onClick={() => handleAssignSheetToEditUser(editSheetId)}
                      className="px-2.5 py-1 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs"
                    >
                      Assign
                    </button>
                  </div>
                )}
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={savingAction}
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5"
                >
                  <Check className="h-4 w-4 text-amber-400" />
                  <span>{savingAction ? "Saving Changes..." : "Save Changes"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingUser(null)}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
