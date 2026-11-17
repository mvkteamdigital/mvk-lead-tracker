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
  AlertCircle,
  Info,
  CheckCircle2,
  UserCog,
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
  role: "ADMIN" | "MEMBER" | "VIEWER";
  status?: string;
  displayPassword?: string | null;
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
  const [newMemberRole, setNewMemberRole] = useState<"MEMBER" | "ADMIN" | "VIEWER">("MEMBER");
  const [newMemberSheetOption, setNewMemberSheetOption] = useState<string>("new");
  const [showAddPassword, setShowAddPassword] = useState(false);

  // 2. Assign / Create Sheet Tab for Existing Member State
  const [isAddTabOpen, setIsAddTabOpen] = useState(false);
  const [selectedMemberForTab, setSelectedMemberForTab] = useState<string>("");
  const [newTabSheetName, setNewTabSheetName] = useState<string>("");

  // 3. Reset Password Modal State
  const [resetPasswordUser, setResetPasswordUser] = useState<UserRecord | null>(null);
  const [newPasswordVal, setNewPasswordVal] = useState("");
  const [confirmPasswordVal, setConfirmPasswordVal] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [copiedCredentials, setCopiedCredentials] = useState(false);

  // 4. Role Change Confirmation Modal State
  const [roleChangeTarget, setRoleChangeTarget] = useState<{
    user: UserRecord;
    newRole: "ADMIN" | "MEMBER" | "VIEWER";
  } | null>(null);

  // 5. Remove Member Account Modal State
  const [removeMemberTarget, setRemoveMemberTarget] = useState<UserRecord | null>(null);
  const [removeReassignOption, setRemoveReassignOption] = useState<"reassign" | "unassigned">("unassigned");
  const [removeReassignTargetId, setRemoveReassignTargetId] = useState<string>("");

  // 6. Edit User Credentials Dialog State
  const [editingUser, setEditingUser] = useState<UserRecord | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editRole, setEditRole] = useState<"MEMBER" | "ADMIN" | "VIEWER">("MEMBER");
  const [editStatus, setEditStatus] = useState<"ACTIVE" | "REVOKED">("ACTIVE");
  const [editSheetId, setEditSheetId] = useState<string>("none");
  const [editNewPassword, setEditNewPassword] = useState("");
  const [editConfirmPassword, setEditConfirmPassword] = useState("");
  const [showEditPassword, setShowEditPassword] = useState(false);
  const [showEditConfirmPassword, setShowEditConfirmPassword] = useState(false);

  // 7. Dedicated Sheet Management States (Rename, Reassign, Delete)
  const [renamingSheet, setRenamingSheet] = useState<{ id: string; name: string } | null>(null);
  const [renameInputVal, setRenameInputVal] = useState("");

  const [reassigningSheet, setReassigningSheet] = useState<{ id: string; name: string; currentUserId?: string } | null>(null);
  const [reassignTargetId, setReassignTargetId] = useState("");

  const [deletingSheet, setDeletingSheet] = useState<{ id: string; name: string; leadCount: number } | null>(null);

  // 8. Password visibility in main table & toolbar
  const [showAllPasswords, setShowAllPasswords] = useState(false);
  const [revealedPasswords, setRevealedPasswords] = useState<Record<string, boolean>>({});
  const [copiedRowUserId, setCopiedRowUserId] = useState<string | null>(null);

  const toggleRowPassword = (userId: string) => {
    setRevealedPasswords((prev) => ({
      ...prev,
      [userId]: !prev[userId],
    }));
  };

  const handleCopyRowCredentials = (u: UserRecord) => {
    const pwd =
      u.displayPassword ||
      (u.mustChangePassword ? `${u.name.toLowerCase()}mvkleads12345` : "••••••••");
    const textToCopy = `MVK Lead Tracker Login Credentials:\nName: ${u.name}\nEmail: ${u.email}\nPassword: ${pwd}\nPortal URL: ${window.location.origin}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedRowUserId(u.id);
    setTimeout(() => setCopiedRowUserId(null), 2500);
  };

  // Active admin count helper to enforce safeguards
  const activeAdminCount = users.filter((u) => u.role === "ADMIN" && u.status !== "REVOKED").length;

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
    setResetPasswordUser(null);
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
          sheetOption: newMemberRole === "VIEWER" ? "none" : newMemberSheetOption,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create team member.");

      setNotification({
        type: "success",
        msg: `Team member "${newMemberName.trim()}" created successfully as ${newMemberRole}.`,
      });

      // Reset form and close
      setNewMemberName("");
      setNewMemberEmail("");
      setNewMemberPassword("");
      setNewMemberRole("MEMBER");
      setNewMemberSheetOption("new");
      setIsAddMemberOpen(false);

      if (data.user) {
        setUsers((prev) => [...prev, data.user]);
        if (onUserUpdated) onUserUpdated(data.user);
      }

      await fetchData();
      if (onRefreshSheets) onRefreshSheets();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to create team member." });
    } finally {
      setSavingAction(false);
    }
  };

  // --- EDIT USER CREDENTIALS HANDLER ---
  const handleOpenEditUser = (u: UserRecord) => {
    setEditingUser(u);
    setEditName(u.name);
    setEditEmail(u.email);
    setEditRole(u.role);
    setEditStatus((u.status as "ACTIVE" | "REVOKED") || "ACTIVE");
    setEditSheetId("none");
    setEditNewPassword("");
    setEditConfirmPassword("");
    setShowEditPassword(false);
    setShowEditConfirmPassword(false);
    setShowCurrentPassword(true);
    setCopiedCredentials(false);
    setNotification(null);
  };

  const handleSaveEditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    if (!editName.trim()) {
      setNotification({ type: "error", msg: "Full name cannot be empty." });
      return;
    }
    if (!editEmail.trim()) {
      setNotification({ type: "error", msg: "Login email cannot be empty." });
      return;
    }

    // Password validation if entered
    if (editNewPassword.trim()) {
      if (editNewPassword.trim().length < 6) {
        setNotification({ type: "error", msg: "New password must be at least 6 characters long." });
        return;
      }
      if (editNewPassword.trim() !== editConfirmPassword.trim()) {
        setNotification({ type: "error", msg: "Passwords do not match. Please verify both password fields." });
        return;
      }
    }

    // Role safeguard check
    if (editingUser.role === "ADMIN" && editRole !== "ADMIN" && activeAdminCount <= 1) {
      setNotification({ type: "error", msg: "Cannot demote the last active Administrator account." });
      return;
    }
    if (editingUser.id === user?.id && editRole !== "ADMIN") {
      setNotification({ type: "error", msg: "Cannot change your own administrative role." });
      return;
    }
    if (editingUser.id === user?.id && editStatus === "REVOKED") {
      setNotification({ type: "error", msg: "Cannot revoke your own account access." });
      return;
    }

    setSavingAction(true);
    setNotification(null);

    try {
      const payload: any = {
        userId: editingUser.id,
        name: editName.trim(),
        email: editEmail.trim(),
        role: editRole,
        status: editStatus,
      };
      if (editNewPassword.trim()) {
        payload.newPassword = editNewPassword.trim();
      }

      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update member credentials.");

      setNotification({
        type: "success",
        msg: `Credentials for "${editName.trim()}" updated successfully!`,
      });
      setEditingUser(null);

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
      setNotification({ type: "error", msg: err.message || "Failed to update credentials." });
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

  const handleCopyCredentials = (u: UserRecord) => {
    const pwd =
      u.displayPassword ||
      (u.mustChangePassword ? `${u.name.toLowerCase()}mvkleads12345` : "••••••••");
    const textToCopy = `MVK Lead Tracker Login Credentials:\nName: ${u.name}\nEmail: ${u.email}\nPassword: ${pwd}\nPortal URL: ${window.location.origin}`;
    navigator.clipboard.writeText(textToCopy);
    setCopiedCredentials(true);
    setTimeout(() => setCopiedCredentials(false), 2500);
  };

  // --- PASSWORD RESET HANDLER (SECURE ADMIN RESET & VIEW RECORD) ---
  const handleOpenResetPassword = (u: UserRecord) => {
    setResetPasswordUser(u);
    setNewPasswordVal("");
    setConfirmPasswordVal("");
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setShowCurrentPassword(true);
    setCopiedCredentials(false);
    setNotification(null);
  };

  const handleSaveResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetPasswordUser) return;
    if (newPasswordVal.trim().length < 6) {
      setNotification({ type: "error", msg: "Password must be at least 6 characters long." });
      return;
    }
    if (newPasswordVal.trim() !== confirmPasswordVal.trim()) {
      setNotification({ type: "error", msg: "Passwords do not match. Please verify both fields." });
      return;
    }

    setSavingAction(true);
    setNotification(null);

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: resetPasswordUser.id,
          newPassword: newPasswordVal.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reset password.");

      setNotification({
        type: "success",
        msg: `Password for "${resetPasswordUser.name}" reset successfully. The account is updated.`,
      });

      setResetPasswordUser(null);
      setNewPasswordVal("");
      setConfirmPasswordVal("");

      await fetchData();
      if (onRefreshSheets) onRefreshSheets();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to reset password." });
    } finally {
      setSavingAction(false);
    }
  };

  // --- ROLE MANAGEMENT HANDLERS ---
  const handleInitiateRoleChange = (targetUser: UserRecord, newRole: "ADMIN" | "MEMBER" | "VIEWER") => {
    if (targetUser.role === newRole) return;

    if (targetUser.id === user?.id) {
      setNotification({ type: "error", msg: "You cannot change your own administrative role." });
      return;
    }

    if (targetUser.role === "ADMIN" && newRole !== "ADMIN" && activeAdminCount <= 1) {
      setNotification({ type: "error", msg: "Cannot demote the last active Administrator account." });
      return;
    }

    setRoleChangeTarget({ user: targetUser, newRole });
  };

  const handleConfirmRoleChange = async () => {
    if (!roleChangeTarget) return;
    const { user: targetUser, newRole } = roleChangeTarget;

    setSavingAction(true);
    setNotification(null);

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUser.id,
          role: newRole,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to change user role.");

      setNotification({
        type: "success",
        msg: `Role for "${targetUser.name}" updated to ${newRole} successfully.`,
      });

      setRoleChangeTarget(null);
      await fetchData();
      if (onRefreshSheets) onRefreshSheets();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to change user role." });
    } finally {
      setSavingAction(false);
    }
  };

  // --- SAFE MEMBER REMOVAL HANDLERS ---
  const handleOpenRemoveMember = (targetUser: UserRecord) => {
    if (targetUser.id === user?.id) {
      setNotification({ type: "error", msg: "You cannot delete your own account." });
      return;
    }

    if (targetUser.role === "ADMIN" && activeAdminCount <= 1) {
      setNotification({ type: "error", msg: "Cannot delete the last active Administrator account." });
      return;
    }

    setRemoveMemberTarget(targetUser);
    setRemoveReassignOption("unassigned");
    const otherMember = users.find((u) => u.id !== targetUser.id && u.status !== "REVOKED");
    setRemoveReassignTargetId(otherMember ? otherMember.id : "");
  };

  const handleConfirmRemoveMember = async () => {
    if (!removeMemberTarget) return;

    setSavingAction(true);
    setNotification(null);

    const reassignToUserId =
      removeReassignOption === "reassign" && removeReassignTargetId
        ? removeReassignTargetId
        : null;

    try {
      const res = await fetch("/api/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: removeMemberTarget.id,
          reassignToUserId,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove member account.");

      setNotification({
        type: "success",
        msg: `Member account "${removeMemberTarget.email}" removed successfully. Lead data remained completely safe.`,
      });

      setRemoveMemberTarget(null);
      await fetchData();
      if (onRefreshSheets) onRefreshSheets();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to remove member account." });
    } finally {
      setSavingAction(false);
    }
  };

  // --- ACCESS REVOCATION & RESTORATION ---
  const handleToggleRevokeAccess = async (targetUser: UserRecord) => {
    if (targetUser.id === user?.id) {
      setNotification({ type: "error", msg: "You cannot revoke your own account access." });
      return;
    }

    const newStatus = targetUser.status === "REVOKED" ? "ACTIVE" : "REVOKED";

    if (targetUser.role === "ADMIN" && newStatus === "REVOKED" && activeAdminCount <= 1) {
      setNotification({ type: "error", msg: "Cannot revoke the last active Administrator account." });
      return;
    }

    setSavingAction(true);
    setNotification(null);

    try {
      const res = await fetch("/api/users", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: targetUser.id,
          status: newStatus,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update account status.");

      setNotification({
        type: "success",
        msg:
          newStatus === "REVOKED"
            ? `Access for "${targetUser.name}" has been revoked immediately.`
            : `Access for "${targetUser.name}" has been restored.`,
      });
      await fetchData();
      if (onRefreshSheets) onRefreshSheets();
    } catch (err: any) {
      setNotification({ type: "error", msg: err.message || "Failed to update status." });
    } finally {
      setSavingAction(false);
    }
  };

  // Helper for role permissions change explanation
  const getRoleChangeDetails = (oldRole: string, newRole: string) => {
    const gains: string[] = [];
    const losses: string[] = [];

    if (newRole === "ADMIN") {
      gains.push("Full administrative access across all team sheets and leads");
      gains.push("Team account and credential management (password resets, additions & removals)");
      gains.push("Sheet tab creation, duplication, renaming, and permanent deletion");
      gains.push("Global organization-wide lead export");
    } else if (newRole === "MEMBER") {
      if (oldRole === "VIEWER") {
        gains.push("Permission to create and add new leads in assigned sheet(s)");
        gains.push("Permission to edit cells, modify lead data, and update follow-up statuses");
        gains.push("Permission to delete rows and paste multi-cell spreadsheet data");
        losses.push("Will only have access to their own assigned sheet(s) instead of all team sheets");
      } else if (oldRole === "ADMIN") {
        losses.push("Will lose administrative panel access and user credential controls");
        losses.push("Will only have access to their own assigned sheet(s)");
        losses.push("Cannot manage or delete sheet tabs across the workspace");
      }
    } else if (newRole === "VIEWER") {
      if (oldRole === "MEMBER") {
        gains.push("Team Lead visibility: access to all sales team members' sheets across the organization");
        gains.push("Ability to view all leads, follow-up statuses, and total team metrics");
      }
      losses.push("Read-only access: cannot add, edit, or delete leads or modify cells");
      losses.push("Cannot change follow-up statuses or paste data");
      if (oldRole === "ADMIN") {
        losses.push("Will lose administrative panel access and user credential controls");
        losses.push("Cannot create, rename, duplicate, or delete sheet tabs");
      }
    }

    return { gains, losses };
  };

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      u.name.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.role.toLowerCase().includes(q) ||
      u.sheets?.some((s) => s.name.toLowerCase().includes(q))
    );
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-3 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-7xl 2xl:max-w-[1440px] w-full max-h-[92vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-150">
        
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
                Full Member Management: Add members, edit details, reset passwords, modify roles, and manage sheet assignments
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

        {/* Sub-bar: Search, Show Passwords, Add Member Button, Stats */}
        <div className="p-3 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 flex-1">
            {/* Search */}
            <div className="relative flex-1 max-w-xs sm:max-w-sm">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by name, email, role, or sheet..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 shadow-2xs"
              />
            </div>

            {/* Quick Refresh */}
            <button
              onClick={fetchData}
              disabled={loading}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
              title="Refresh users list"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin text-amber-500" : ""}`} />
            </button>

            {/* Show / Hide All Passwords Toggle */}
            <button
              type="button"
              onClick={() => {
                setShowAllPasswords(!showAllPasswords);
                setRevealedPasswords({});
              }}
              className={`px-3 py-1.5 rounded-xl font-bold text-xs flex items-center gap-1.5 transition-all border shadow-2xs shrink-0 cursor-pointer ${
                showAllPasswords
                  ? "bg-amber-100 text-amber-900 border-amber-300"
                  : "bg-white text-slate-700 hover:bg-slate-100 border-slate-300"
              }`}
              title={showAllPasswords ? "Hide all member passwords" : "Show all member passwords"}
            >
              {showAllPasswords ? (
                <>
                  <EyeOff className="h-3.5 w-3.5 text-amber-700" />
                  <span>Hide Passwords</span>
                </>
              ) : (
                <>
                  <Eye className="h-3.5 w-3.5 text-slate-600" />
                  <span>Show Passwords</span>
                </>
              )}
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
                setResetPasswordUser(null);
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
                setResetPasswordUser(null);
                setNotification(null);
              }}
              className="px-3 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-bold text-xs rounded-xl shadow-md flex items-center gap-1.5 transition-all active:scale-95"
              title="Add an additional sheet tab to an existing member"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>+ Add Tab to Member</span>
            </button>

            {/* 3. Summary Metric: Total Accounts */}
            <div className="text-xs text-slate-700 flex items-center gap-1.5 font-bold bg-slate-100 border border-slate-300 px-2.5 py-1 rounded-xl shadow-2xs">
              <Shield className="h-3.5 w-3.5 text-purple-600" />
              <span>{stats.totalAccounts || users.length} Accounts</span>
            </div>

            {/* 4. Prominent Summary Metric: TOTAL LEADS */}
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
                  {users
                    .filter((u) => u.role !== "VIEWER")
                    .map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} ({u.email}) [{u.role}] - {u.sheets.length} current {u.sheets.length === 1 ? "sheet" : "sheets"}
                      </option>
                    ))}
                </select>
              </div>

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
                  Create New Team Account
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

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Role *
                  </label>
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value as "MEMBER" | "ADMIN" | "VIEWER")}
                    className="w-full px-2 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-slate-900"
                  >
                    <option value="MEMBER">Member (Edit Assigned)</option>
                    <option value="VIEWER">Viewer / Team Lead (Read-Only All Sheets)</option>
                    <option value="ADMIN">Admin (Full System Access)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 mb-1 truncate" title="Assigned Sheet Tab">
                    Sheet Tab
                  </label>
                  {newMemberRole === "VIEWER" ? (
                    <div className="px-2 py-1.5 text-[11px] bg-slate-100 border border-slate-200 rounded-lg text-slate-500 font-semibold truncate">
                      Team-Wide (No Individual Sheet)
                    </div>
                  ) : (
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
                  )}
                </div>
              </div>

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
            <div className="border border-slate-200 rounded-xl overflow-x-auto shadow-2xs bg-white">
              <table className="w-full min-w-[1330px] text-left border-collapse text-xs table-fixed">
                <colgroup>
                  <col style={{ width: "170px" }} />
                  <col style={{ width: "200px" }} />
                  <col style={{ width: "110px" }} />
                  <col style={{ width: "100px" }} />
                  <col style={{ width: "270px" }} />
                  <col style={{ width: "240px" }} />
                  <col style={{ width: "240px" }} />
                </colgroup>
                <thead>
                  <tr className="bg-slate-100 text-slate-700 uppercase font-extrabold tracking-wider text-[11px] border-b border-slate-200 select-none">
                    <th className="py-3 px-4 text-left">Member Name</th>
                    <th className="py-3 px-4 text-left">Email ID</th>
                    <th className="py-3 px-4 text-left">Role</th>
                    <th className="py-3 px-4 text-left">Access Status</th>
                    <th className="py-3 px-4 text-left">Sheet Tab(s) & Leads</th>
                    <th className="py-3 px-3 text-left">Password & Credentials</th>
                    <th className="py-3 px-4 text-right sticky right-0 bg-slate-100 z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">Actions</th>
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
                      const isCurrentUser = u.id === user?.id;

                      return (
                        <tr key={u.id} className="hover:bg-slate-50/80 transition-colors group">
                          {/* 1. Member Name */}
                          <td className="py-3.5 px-4 align-middle">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`h-8 w-8 rounded-full flex items-center justify-center font-extrabold text-xs shrink-0 shadow-2xs ${
                                  u.role === "ADMIN"
                                    ? "bg-purple-100 text-purple-800 border border-purple-300"
                                    : u.role === "VIEWER"
                                    ? "bg-amber-100 text-amber-800 border border-amber-300"
                                    : "bg-blue-100 text-blue-800 border border-blue-300"
                                }`}
                              >
                                {u.name.charAt(0).toUpperCase()}
                              </div>
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="font-bold text-slate-900 truncate" title={u.name}>
                                    {u.name}
                                  </span>
                                  {isCurrentUser && (
                                    <span className="text-[10px] text-amber-700 font-semibold shrink-0">(You)</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>

                          {/* 2. Email ID */}
                          <td className="py-3.5 px-4 align-middle text-slate-700 font-mono text-[11px]">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <span className="truncate" title={u.email}>{u.email}</span>
                              <button
                                type="button"
                                onClick={() => handleOpenEditUser(u)}
                                className="p-1 text-slate-400 hover:text-blue-600 rounded transition-colors shrink-0 cursor-pointer"
                                title={`Edit credentials for ${u.name}`}
                              >
                                <Edit2 className="h-3 w-3" />
                              </button>
                            </div>
                          </td>

                          {/* 3. Role Selector */}
                          <td className="py-3.5 px-4 align-middle">
                            {isCurrentUser ? (
                              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold tracking-wider uppercase border shadow-2xs bg-purple-100 text-purple-800 border-purple-300 whitespace-nowrap">
                                <Shield className="h-3 w-3" />
                                <span>ADMIN</span>
                              </span>
                            ) : (
                              <select
                                value={u.role}
                                onChange={(e) =>
                                  handleInitiateRoleChange(
                                    u,
                                    e.target.value as "ADMIN" | "MEMBER" | "VIEWER"
                                  )
                                }
                                className={`px-2 py-1 rounded-lg text-[10px] font-bold uppercase border shadow-2xs cursor-pointer focus:outline-none focus:ring-2 focus:ring-purple-400 transition-colors w-full ${
                                  u.role === "ADMIN"
                                    ? "bg-purple-50 text-purple-800 border-purple-300 font-extrabold"
                                    : u.role === "VIEWER"
                                    ? "bg-slate-100 text-slate-800 border-slate-300 font-bold"
                                    : "bg-blue-50 text-blue-800 border-blue-300 font-bold"
                                }`}
                                title="Change member role (ADMIN / MEMBER / VIEWER)"
                              >
                                <option value="ADMIN">ADMIN</option>
                                <option value="MEMBER">MEMBER</option>
                                <option value="VIEWER">VIEWER</option>
                              </select>
                            )}
                          </td>

                          {/* 4. Access Status */}
                          <td className="py-3.5 px-4 align-middle">
                            {u.status === "REVOKED" ? (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-1 rounded-full shadow-2xs whitespace-nowrap">
                                <Ban className="h-3 w-3 text-rose-600" />
                                <span>Revoked</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full shadow-2xs whitespace-nowrap">
                                <Check className="h-3 w-3 text-emerald-600" />
                                <span>Active</span>
                              </span>
                            )}
                          </td>

                          {/* 5. Sheet Tab(s) & Individual Lead Counts & Sheet Actions */}
                          <td className="py-3.5 px-4 align-middle text-slate-700">
                            {u.role === "VIEWER" ? (
                              <div className="py-1">
                                <span className="inline-flex items-center gap-1.5 text-[11px] font-bold text-amber-950 bg-amber-100/90 border border-amber-300 px-2.5 py-1 rounded-lg shadow-2xs whitespace-nowrap">
                                  <Eye className="h-3.5 w-3.5 text-amber-700 shrink-0" />
                                  <span>Organization-Wide (All Sheets)</span>
                                </span>
                              </div>
                            ) : (!u.sheets || u.sheets.length === 0) ? (
                              <div className="flex items-center justify-between bg-slate-50 border border-dashed border-slate-300 px-2.5 py-1.5 rounded-lg">
                                <span className="text-slate-400 italic text-[11px]">Unassigned</span>
                                <button
                                  type="button"
                                  onClick={() => handleQuickAddTab(u)}
                                  className="text-[10px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-2 py-0.5 rounded transition-colors flex items-center gap-1 cursor-pointer"
                                  title={`Assign a sheet tab to ${u.name}`}
                                >
                                  <Plus className="h-2.5 w-2.5 stroke-[3]" />
                                  <span>Tab</span>
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
                                      <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-amber-950 bg-amber-100/90 border border-amber-300 px-2 py-0.5 rounded-md shadow-2xs whitespace-nowrap">
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
                                        className="text-[10px] font-bold text-purple-700 hover:text-purple-900 bg-purple-50 hover:bg-purple-100 border border-purple-200 px-1.5 py-0.5 rounded transition-colors flex items-center gap-0.5 shrink-0 cursor-pointer"
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
                                            className="group/sheet flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 px-2 py-1 rounded-lg border border-slate-200/80 text-[11px] transition-colors gap-1.5"
                                          >
                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
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
                                            </div>

                                            <div className="flex items-center gap-1 shrink-0">
                                              <span className="text-slate-600 font-mono text-[10px] bg-white px-1.5 py-0.5 rounded border border-slate-200 font-semibold shrink-0">
                                                {sLeads} {sLeads === 1 ? "lead" : "leads"}
                                              </span>

                                              <div className="flex items-center gap-0.5 shrink-0 opacity-80 group-hover/sheet:opacity-100 transition-opacity">
                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setRenamingSheet({ id: s.id, name: s.name });
                                                    setRenameInputVal(s.name);
                                                  }}
                                                  className="p-1 hover:bg-white text-slate-500 hover:text-blue-600 rounded transition-colors cursor-pointer"
                                                  title={`Rename sheet "${s.name}"`}
                                                >
                                                  <Edit2 className="h-3 w-3" />
                                                </button>

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
                                                  className="p-1 hover:bg-white text-slate-500 hover:text-amber-600 rounded transition-colors cursor-pointer"
                                                  title={`Reassign sheet "${s.name}" to another member`}
                                                >
                                                  <ArrowRightLeft className="h-3 w-3" />
                                                </button>

                                                <button
                                                  type="button"
                                                  onClick={() => {
                                                    setDeletingSheet({
                                                      id: s.id,
                                                      name: s.name,
                                                      leadCount: sLeads,
                                                    });
                                                  }}
                                                  className="p-1 hover:bg-white text-slate-500 hover:text-rose-600 rounded transition-colors cursor-pointer"
                                                  title={`Delete sheet "${s.name}"`}
                                                >
                                                  <Trash2 className="h-3 w-3" />
                                                </button>
                                              </div>
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

                          {/* 6. Password & Login Credentials */}
                          <td className="py-3.5 px-3 align-middle">
                            {(() => {
                              const isRevealed = showAllPasswords || !!revealedPasswords[u.id];
                              const pwd =
                                u.displayPassword ||
                                (u.mustChangePassword
                                  ? `${u.name.toLowerCase()}mvkleads12345`
                                  : "Not saved");
                              const isCopied = copiedRowUserId === u.id;

                              return (
                                <div className="flex items-center gap-1.5 whitespace-nowrap">
                                  {/* Password Display Box */}
                                  <div
                                    className="flex items-center gap-1.5 px-2 py-1 bg-slate-100 rounded-lg border border-slate-200 min-w-0 max-w-[130px]"
                                    title={isRevealed ? pwd : "Click eye icon to reveal password"}
                                  >
                                    <KeyRound className="h-3 w-3 text-amber-600 shrink-0" />
                                    <span className="font-mono text-xs font-bold text-slate-800 tracking-wider truncate select-all">
                                      {isRevealed ? pwd : "••••••••"}
                                    </span>
                                  </div>

                                  {/* Eye Toggle Button */}
                                  <button
                                    type="button"
                                    onClick={() => toggleRowPassword(u.id)}
                                    className="p-1 text-slate-500 hover:text-amber-800 hover:bg-slate-100 rounded-md transition-colors shrink-0 cursor-pointer"
                                    title={isRevealed ? "Hide password" : "Show password"}
                                  >
                                    {isRevealed ? (
                                      <EyeOff className="h-3.5 w-3.5 text-amber-700" />
                                    ) : (
                                      <Eye className="h-3.5 w-3.5" />
                                    )}
                                  </button>

                                  {/* Copy Credentials Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleCopyRowCredentials(u)}
                                    className="p-1 text-slate-500 hover:text-blue-700 hover:bg-slate-100 rounded-md transition-colors shrink-0 cursor-pointer"
                                    title="Copy full login credentials (Email & Password)"
                                  >
                                    {isCopied ? (
                                      <Check className="h-3.5 w-3.5 text-emerald-600 font-bold" />
                                    ) : (
                                      <Copy className="h-3.5 w-3.5" />
                                    )}
                                  </button>

                                  {/* Quick Reset Button */}
                                  <button
                                    type="button"
                                    onClick={() => handleOpenResetPassword(u)}
                                    className="text-[10px] font-bold text-amber-800 hover:text-amber-950 bg-amber-50 hover:bg-amber-100 border border-amber-300 px-1.5 py-0.5 rounded transition-colors shadow-2xs shrink-0 cursor-pointer ml-auto"
                                    title={`Reset password for ${u.name}`}
                                  >
                                    Reset
                                  </button>
                                </div>
                              );
                            })()}
                          </td>

                          {/* 7. Action Buttons (Sticky Right) */}
                          <td className="py-3.5 px-4 text-right align-middle sticky right-0 bg-white group-hover:bg-slate-50 z-10 shadow-[-4px_0_6px_-2px_rgba(0,0,0,0.06)]">
                            <div className="flex items-center justify-end gap-2 whitespace-nowrap flex-nowrap">
                              {/* Action 1: Edit Account Credentials */}
                              <button
                                type="button"
                                onClick={() => handleOpenEditUser(u)}
                                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 active:scale-95 text-white rounded-lg font-bold text-[11px] flex items-center gap-1.5 transition-all shadow-xs shrink-0 cursor-pointer"
                                title="Edit user credentials (Name, Email, Password, Role, Status, Sheets)"
                              >
                                <Edit2 className="h-3 w-3" />
                                <span>Edit Account</span>
                              </button>

                              {/* Action 2: Revoke / Restore Access */}
                              {!isCurrentUser && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleRevokeAccess(u)}
                                  disabled={savingAction}
                                  className={`px-2.5 py-1.5 rounded-lg font-bold text-[11px] border flex items-center gap-1 transition-all shadow-2xs shrink-0 cursor-pointer active:scale-95 ${
                                    u.status === "REVOKED"
                                      ? "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300"
                                      : "bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300"
                                  }`}
                                  title={
                                    u.status === "REVOKED"
                                      ? "Restore account access"
                                      : "Immediately revoke access and block login"
                                  }
                                >
                                  {u.status === "REVOKED" ? (
                                    <>
                                      <UserCheck className="h-3 w-3 text-emerald-600" />
                                      <span>Restore</span>
                                    </>
                                  ) : (
                                    <>
                                      <UserX className="h-3 w-3 text-rose-600" />
                                      <span>Revoke</span>
                                    </>
                                  )}
                                </button>
                              )}

                              {/* Action 3: Remove Member Permanently */}
                              {!isCurrentUser && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenRemoveMember(u)}
                                  disabled={savingAction}
                                  className="p-1.5 bg-slate-50 hover:bg-rose-50 hover:text-rose-700 text-slate-500 rounded-lg font-semibold text-[11px] border border-slate-200 transition-colors shrink-0 cursor-pointer active:scale-95"
                                  title="Permanently remove user account (sheets and lead data safely retained or reassigned)"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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

      {/* --- MODAL 1: DEDICATED PASSWORD RESET MODAL --- */}
      {resetPasswordUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center border border-amber-200">
                  <KeyRound className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Reset Member Password
                  </h4>
                  <p className="text-xs text-slate-500">
                    {resetPasswordUser.name} ({resetPasswordUser.email})
                  </p>
                </div>
              </div>
              <button
                onClick={() => setResetPasswordUser(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Section 1: View Current / Old Password */}
            <div className="bg-slate-50 rounded-xl p-3.5 border border-slate-200">
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                  <span>Current / Old Password Record</span>
                </label>
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="text-xs text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-1 cursor-pointer"
                >
                  {showCurrentPassword ? (
                    <>
                      <EyeOff className="h-3.5 w-3.5" />
                      <span>Hide</span>
                    </>
                  ) : (
                    <>
                      <Eye className="h-3.5 w-3.5" />
                      <span>Show Password</span>
                    </>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-white rounded-lg border border-slate-300 font-mono text-xs font-bold text-slate-900 tracking-wider select-all truncate">
                  {showCurrentPassword
                    ? resetPasswordUser.displayPassword ||
                      (resetPasswordUser.mustChangePassword
                        ? `${resetPasswordUser.name.toLowerCase()}mvkleads12345`
                        : "No saved password")
                    : "••••••••••••"}
                </div>
                <button
                  type="button"
                  onClick={() => handleCopyCredentials(resetPasswordUser)}
                  className="px-3 py-2 bg-slate-200 hover:bg-slate-300 active:scale-95 text-slate-800 font-bold text-xs rounded-lg flex items-center gap-1 transition-all cursor-pointer shrink-0"
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
            <div className="border-t border-slate-100 pt-2 space-y-2">
              <label className="block text-xs font-bold text-slate-700">
                Set New Custom Password
              </label>

            <form onSubmit={handleSaveResetPassword} className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  New Password *
                </label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Min 6 characters..."
                    value={newPasswordVal}
                    onChange={(e) => setNewPasswordVal(e.target.value)}
                    className="w-full pl-9 pr-9 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-medium text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    title={showNewPassword ? "Hide password" : "Show password"}
                  >
                    {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Confirm Password *
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={6}
                    placeholder="Re-enter new password..."
                    value={confirmPasswordVal}
                    onChange={(e) => setConfirmPasswordVal(e.target.value)}
                    className="w-full pl-9 pr-9 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono font-medium text-slate-900"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                    title={showConfirmPassword ? "Hide password" : "Show password"}
                  >
                    {showConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Password Requirements Checklist */}
              <div className="bg-slate-50 rounded-xl p-2.5 border border-slate-200 text-[11px] space-y-1">
                <div className="flex items-center gap-1.5">
                  <Check
                    className={`h-3.5 w-3.5 ${
                      newPasswordVal.trim().length >= 6 ? "text-emerald-600 font-bold" : "text-slate-300"
                    }`}
                  />
                  <span
                    className={
                      newPasswordVal.trim().length >= 6 ? "text-slate-700 font-semibold" : "text-slate-400"
                    }
                  >
                    At least 6 characters
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check
                    className={`h-3.5 w-3.5 ${
                      newPasswordVal.trim().length >= 6 && newPasswordVal.trim() === confirmPasswordVal.trim()
                        ? "text-emerald-600 font-bold"
                        : "text-slate-300"
                    }`}
                  />
                  <span
                    className={
                      newPasswordVal.trim().length >= 6 && newPasswordVal.trim() === confirmPasswordVal.trim()
                        ? "text-slate-700 font-semibold"
                        : "text-slate-400"
                    }
                  >
                    Passwords match
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="submit"
                  disabled={
                    savingAction ||
                    newPasswordVal.trim().length < 6 ||
                    newPasswordVal.trim() !== confirmPasswordVal.trim()
                  }
                  className="flex-1 py-2 bg-amber-500 hover:bg-amber-600 active:scale-95 text-slate-950 font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="h-4 w-4 stroke-[3]" />
                  <span>{savingAction ? "Resetting Password..." : "Set New Password"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setResetPasswordUser(null)}
                  className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </form>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 2: ROLE CHANGE CONFIRMATION MODAL --- */}
      {roleChangeTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-2xl border border-purple-200 max-w-md w-full p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-100">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="h-10 w-10 rounded-xl bg-purple-100 text-purple-700 flex items-center justify-center border border-purple-200 shrink-0">
                <Shield className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">
                  Role Change Confirmation
                </h4>
                <p className="text-xs text-slate-500">
                  {roleChangeTarget.user.name} ({roleChangeTarget.user.email})
                </p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-3 py-2 bg-slate-50 rounded-xl border border-slate-200">
              <span className="px-3 py-1 rounded-lg text-xs font-bold uppercase bg-slate-200 text-slate-800">
                {roleChangeTarget.user.role}
              </span>
              <span className="text-slate-400 font-bold">➔</span>
              <span
                className={`px-3 py-1 rounded-lg text-xs font-bold uppercase ${
                  roleChangeTarget.newRole === "ADMIN"
                    ? "bg-purple-100 text-purple-800 border border-purple-300"
                    : roleChangeTarget.newRole === "VIEWER"
                    ? "bg-slate-200 text-slate-800 border border-slate-300"
                    : "bg-blue-100 text-blue-800 border border-blue-300"
                }`}
              >
                {roleChangeTarget.newRole}
              </span>
            </div>

            {/* Permissions Details */}
            {(() => {
              const { gains, losses } = getRoleChangeDetails(
                roleChangeTarget.user.role,
                roleChangeTarget.newRole
              );

              return (
                <div className="space-y-3 text-xs">
                  {gains.length > 0 && (
                    <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                      <div className="font-bold text-emerald-900 mb-1 flex items-center gap-1">
                        <Check className="h-3.5 w-3.5 text-emerald-600" />
                        <span>Permissions Gained:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-emerald-800 text-[11px]">
                        {gains.map((g, idx) => (
                          <li key={idx}>{g}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {losses.length > 0 && (
                    <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                      <div className="font-bold text-amber-900 mb-1 flex items-center gap-1">
                        <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                        <span>Permissions Lost:</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-amber-800 text-[11px]">
                        {losses.map((l, idx) => (
                          <li key={idx}>{l}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              );
            })()}

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={savingAction}
                onClick={handleConfirmRoleChange}
                className="flex-1 py-2 bg-purple-700 hover:bg-purple-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                <Check className="h-4 w-4" />
                <span>{savingAction ? "Updating Role..." : "Confirm Role Change"}</span>
              </button>
              <button
                type="button"
                onClick={() => setRoleChangeTarget(null)}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 3: SAFE MEMBER REMOVAL MODAL --- */}
      {removeMemberTarget && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-2xl border border-rose-200 max-w-md w-full p-5 flex flex-col gap-4 animate-in zoom-in-95 duration-100">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
              <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">
                  Remove Member Account
                </h4>
                <p className="text-xs text-rose-600 font-semibold">
                  {removeMemberTarget.name} ({removeMemberTarget.email})
                </p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs text-rose-900 space-y-1">
              <div className="font-bold flex items-center gap-1 text-rose-950">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>Removal Consequences:</span>
              </div>
              <ul className="list-disc list-inside space-y-0.5 text-[11px] text-rose-800">
                <li>This user will lose all access to the system immediately.</li>
                <li><strong>Lead data will NOT be deleted.</strong> All existing lead records remain safe.</li>
              </ul>
            </div>

            {/* Assigned Sheets Summary & Reassignment Options */}
            {removeMemberTarget.sheets && removeMemberTarget.sheets.length > 0 ? (
              <div className="space-y-3">
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                  <div className="flex items-center justify-between text-xs font-bold text-slate-800 mb-2">
                    <span>Assigned Sheets ({removeMemberTarget.sheets.length}):</span>
                    <span className="text-amber-800 font-extrabold">
                      {removeMemberTarget.totalLeadCount || 0} Total Leads Safe
                    </span>
                  </div>
                  <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
                    {removeMemberTarget.sheets.map((s) => (
                      <div
                        key={s.id}
                        className="flex items-center justify-between text-[11px] bg-white px-2.5 py-1 rounded-lg border border-slate-200"
                      >
                        <span className="font-semibold text-slate-800 truncate">{s.name}</span>
                        <span className="text-slate-500 font-mono">
                          {s.validRowCount ?? s._count?.rows ?? 0} leads
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5">
                    What should happen to these sheet tabs?
                  </label>
                  <div className="space-y-2">
                    <label className="flex items-start gap-2 p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="reassignOption"
                        checked={removeReassignOption === "unassigned"}
                        onChange={() => setRemoveReassignOption("unassigned")}
                        className="mt-0.5 text-purple-600"
                      />
                      <div>
                        <div className="font-bold text-slate-900">Retain as Unassigned Sheets</div>
                        <div className="text-[11px] text-slate-500">
                          Sheets stay intact and can be reassigned later by an administrator.
                        </div>
                      </div>
                    </label>

                    <label className="flex items-start gap-2 p-2.5 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 cursor-pointer text-xs">
                      <input
                        type="radio"
                        name="reassignOption"
                        checked={removeReassignOption === "reassign"}
                        onChange={() => setRemoveReassignOption("reassign")}
                        className="mt-0.5 text-purple-600"
                      />
                      <div className="flex-1">
                        <div className="font-bold text-slate-900">Reassign Sheets to Another Member</div>
                        {removeReassignOption === "reassign" && (
                          <div className="mt-2">
                            <select
                              value={removeReassignTargetId}
                              onChange={(e) => setRemoveReassignTargetId(e.target.value)}
                              className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500 font-semibold text-slate-900"
                            >
                              <option value="">-- Select Member or Admin --</option>
                              {users
                                .filter((u) => u.id !== removeMemberTarget.id && u.status !== "REVOKED")
                                .map((u) => (
                                  <option key={u.id} value={u.id}>
                                    {u.name} ({u.email}) [{u.role}]
                                  </option>
                                ))}
                            </select>
                          </div>
                        )}
                      </div>
                    </label>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500 italic">
                This member has no sheets assigned. Removing the account will not affect any sheets.
              </p>
            )}

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                disabled={
                  savingAction ||
                  (removeReassignOption === "reassign" &&
                    removeMemberTarget.sheets?.length > 0 &&
                    !removeReassignTargetId)
                }
                onClick={handleConfirmRemoveMember}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Trash2 className="h-4 w-4" />
                <span>{savingAction ? "Removing..." : "Confirm & Remove Member"}</span>
              </button>
              <button
                type="button"
                onClick={() => setRemoveMemberTarget(null)}
                className="py-2 px-4 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* --- MODAL 4: RENAME SHEET MODAL --- */}
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

      {/* --- MODAL 5: REASSIGN SHEET MODAL --- */}
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
                      {u.name} ({u.email}) [{u.role}] - {u.sheets.length} current sheets
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

      {/* --- MODAL 6: DELETE SHEET CONFIRMATION MODAL --- */}
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

      {/* --- MODAL 7: EDIT USER CREDENTIALS MODAL --- */}
      {editingUser && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 flex flex-col gap-4 animate-in zoom-in-95 duration-100">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="h-9 w-9 rounded-xl bg-blue-100 text-blue-800 flex items-center justify-center border border-blue-200 shrink-0">
                  <UserCog className="h-5 w-5" />
                </div>
                <div>
                  <h4 className="font-extrabold text-sm text-slate-900">
                    Edit User Credentials
                  </h4>
                  <p className="text-xs text-slate-500">
                    {editingUser.name} &bull; <span className="font-mono">{editingUser.email}</span>
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

            <form onSubmit={handleSaveEditUser} className="space-y-4">
              {/* 1. Full Name */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Full Name *
                </label>
                <div className="relative">
                  <User className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="text"
                    required
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                    placeholder="e.g. Sanjana"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-900"
                  />
                </div>
              </div>

              {/* 2. Login Email ID */}
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Login Email ID (Authentication Identity) *
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                  <input
                    type="email"
                    required
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="e.g. sanjana@mvkleads.com"
                    className="w-full pl-9 pr-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-slate-900 font-medium"
                  />
                </div>
                <p className="text-[10px] text-slate-500 mt-1">
                  Used for login authentication. Modifying this updates their login identity immediately in the database without affecting their ID, sheets, or lead data.
                </p>
              </div>

              {/* 3. Password (Set or Reset) - Optional */}
              <div className="bg-amber-50/50 border border-amber-200/80 rounded-xl p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <KeyRound className="h-3.5 w-3.5 text-amber-600" />
                    <span>Set or Reset Password</span>
                  </label>
                  <span className="text-[10px] font-semibold text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-full border border-amber-200">
                    Optional
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Leave blank to keep existing password unchanged. Passwords are encrypted before storage and take effect immediately.
                </p>

                {/* Current / Old Password Display */}
                <div className="bg-white rounded-lg p-2.5 border border-amber-200 flex items-center justify-between gap-2 shadow-2xs">
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider shrink-0">
                      Current Password:
                    </span>
                    <span className="font-mono text-xs font-bold text-slate-900 tracking-wider truncate select-all">
                      {showCurrentPassword
                        ? editingUser.displayPassword ||
                          (editingUser.mustChangePassword
                            ? `${editingUser.name.toLowerCase()}mvkleads12345`
                            : "No saved password")
                        : "••••••••••••"}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="text-xs text-amber-700 hover:text-amber-800 font-semibold flex items-center gap-1 cursor-pointer"
                    >
                      {showCurrentPassword ? (
                        <>
                          <EyeOff className="h-3 w-3" />
                          <span>Hide</span>
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3" />
                          <span>Show</span>
                        </>
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleCopyCredentials(editingUser)}
                      className="px-2 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                      title="Copy credentials"
                    >
                      {copiedCredentials ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      <span>{copiedCredentials ? "Copied" : "Copy"}</span>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      New Password
                    </label>
                    <div className="relative">
                      <KeyRound className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type={showEditPassword ? "text" : "password"}
                        placeholder="Leave blank to keep"
                        value={editNewPassword}
                        onChange={(e) => setEditNewPassword(e.target.value)}
                        className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-slate-900 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditPassword(!showEditPassword)}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                        title={showEditPassword ? "Hide password" : "Show password"}
                      >
                        {showEditPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-700 mb-1">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                      <input
                        type={showEditConfirmPassword ? "text" : "password"}
                        placeholder="Re-enter to confirm"
                        value={editConfirmPassword}
                        onChange={(e) => setEditConfirmPassword(e.target.value)}
                        className="w-full pl-8 pr-8 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 font-mono text-slate-900 font-medium"
                      />
                      <button
                        type="button"
                        onClick={() => setShowEditConfirmPassword(!showEditConfirmPassword)}
                        className="absolute right-2 top-2 text-slate-400 hover:text-slate-600"
                        title={showEditConfirmPassword ? "Hide password" : "Show password"}
                      >
                        {showEditConfirmPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {editNewPassword.trim().length > 0 && (
                  <div className="bg-white rounded-lg p-2 border border-amber-200 text-[11px] space-y-1 mt-1">
                    <div className="flex items-center gap-1.5">
                      <Check
                        className={`h-3.5 w-3.5 ${
                          editNewPassword.trim().length >= 6 ? "text-emerald-600 font-bold" : "text-slate-300"
                        }`}
                      />
                      <span
                        className={
                          editNewPassword.trim().length >= 6 ? "text-slate-700 font-semibold" : "text-slate-400"
                        }
                      >
                        At least 6 characters
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Check
                        className={`h-3.5 w-3.5 ${
                          editNewPassword.trim().length >= 6 && editNewPassword.trim() === editConfirmPassword.trim()
                            ? "text-emerald-600 font-bold"
                            : "text-slate-300"
                        }`}
                      />
                      <span
                        className={
                          editNewPassword.trim().length >= 6 && editNewPassword.trim() === editConfirmPassword.trim()
                            ? "text-slate-700 font-semibold"
                            : "text-slate-400"
                        }
                      >
                        Passwords match
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* 4. Role & Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    User Role *
                  </label>
                  <select
                    value={editRole}
                    disabled={editingUser.id === user?.id}
                    onChange={(e) => setEditRole(e.target.value as "MEMBER" | "ADMIN" | "VIEWER")}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-900 disabled:opacity-50"
                  >
                    <option value="MEMBER">Member (Full Edit on Assigned)</option>
                    <option value="VIEWER">Viewer / Team Lead (Read-Only All Sheets)</option>
                    <option value="ADMIN">Admin (Full System Access)</option>
                  </select>
                  {editingUser.id === user?.id && (
                    <p className="text-[10px] text-slate-400 mt-1 italic">
                      You cannot change your own administrative role.
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 mb-1">
                    Account Status *
                  </label>
                  <select
                    value={editStatus}
                    disabled={editingUser.id === user?.id}
                    onChange={(e) => setEditStatus(e.target.value as "ACTIVE" | "REVOKED")}
                    className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-900 disabled:opacity-50"
                  >
                    <option value="ACTIVE">Active (Login Allowed)</option>
                    <option value="REVOKED">Inactive / Revoked (Blocked)</option>
                  </select>
                  {editingUser.id === user?.id && (
                    <p className="text-[10px] text-slate-400 mt-1 italic">
                      You cannot revoke your own account access.
                    </p>
                  )}
                </div>
              </div>

              {/* 5. Assigned Sheet Tabs & Lead Permissions */}
              {editRole === "VIEWER" ? (
                <div className="bg-amber-50/70 border border-amber-200/90 rounded-xl p-3.5 space-y-1.5">
                  <div className="flex items-center gap-2 text-amber-950 font-bold text-xs">
                    <Eye className="h-4 w-4 text-amber-600 shrink-0" />
                    <span>Organization-Wide Read-Only Visibility</span>
                  </div>
                  <p className="text-[11px] text-amber-900 leading-relaxed">
                    The <strong>Viewer</strong> role is intended for the Team Lead / Sales Supervisor. Viewers automatically have organization-wide visibility across all sales team members&apos; sheets. Individual sheet tabs are not assigned to Viewer accounts.
                  </p>
                </div>
              ) : (
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

                              <button
                                type="button"
                                onClick={() => handleUnassignSheetFromEditUser(s.id)}
                                disabled={savingAction}
                                className="text-[10px] text-slate-500 hover:text-amber-700 hover:bg-amber-50 px-1.5 py-0.5 rounded font-semibold transition-colors"
                                title="Unlink this sheet from this member"
                              >
                                Unlink
                              </button>

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
              )}

              {/* Form Submission Footer */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <button
                  type="submit"
                  disabled={
                    savingAction ||
                    (editNewPassword.trim().length > 0 &&
                      (editNewPassword.trim().length < 6 ||
                        editNewPassword.trim() !== editConfirmPassword.trim()))
                  }
                  className="flex-1 py-2 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl transition-all shadow-xs flex items-center justify-center gap-1.5 disabled:opacity-50 cursor-pointer"
                >
                  <Check className="h-4 w-4 text-amber-400 stroke-[3]" />
                  <span>{savingAction ? "Saving Changes..." : "Save User Credentials"}</span>
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
