"use client";

import React, { useState, useRef, useEffect } from "react";
import { useAuth } from "../auth/AuthContext";
import { SheetDetail, CellStyle } from "@/lib/types";
import {
  FileSpreadsheet,
  Download,
  Plus,
  Columns,
  Settings2,
  Bold,
  Italic,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Palette,
  Type,
  LogOut,
  Search,
  CheckCircle2,
  RefreshCw,
  FileDown,
  Layers,
  Shield,
  ChevronDown,
  KeyRound,
  Users,
  User,
  Undo2,
  Redo2,
  X,
} from "lucide-react";

interface TopToolbarProps {
  sheet: SheetDetail | null;
  savingStatus: "saved" | "saving" | "error";
  searchQuery: string;
  onSearchChange: (query: string) => void;
  onAddRow: () => void;
  onOpenAddColumnModal: () => void;
  onOpenDropdownModal: () => void;
  onApplyStyle: (style: Partial<CellStyle>) => void;
  selectedCellStyle?: CellStyle;
  onOpenChangePasswordModal: () => void;
  onOpenManageAccountsModal: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
  totalLeads?: number;
  dateFilter?: string | null;
  onRefresh?: () => void;
  isRefreshing?: boolean;
}

export function TopToolbar({
  sheet,
  savingStatus,
  searchQuery,
  onSearchChange,
  onAddRow,
  onOpenAddColumnModal,
  onOpenDropdownModal,
  onApplyStyle,
  selectedCellStyle = {},
  onOpenChangePasswordModal,
  onOpenManageAccountsModal,
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  totalLeads,
  dateFilter = null,
  onRefresh,
  isRefreshing = false,
}: TopToolbarProps) {
  const { user, logout } = useAuth();
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [showBgColorMenu, setShowBgColorMenu] = useState(false);
  const [showTextColorMenu, setShowTextColorMenu] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const exportRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);

  // Close popovers on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (exportRef.current && !exportRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
      if (bgRef.current && !bgRef.current.contains(e.target as Node)) {
        setShowBgColorMenu(false);
      }
      if (textRef.current && !textRef.current.contains(e.target as Node)) {
        setShowTextColorMenu(false);
      }
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setShowProfileMenu(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExport = (format: "xlsx" | "csv") => {
    if (!sheet) return;
    window.open(`/api/sheets/${sheet.id}/export?format=${format}`, "_blank");
    setShowExportMenu(false);
  };

  const handleExportAll = () => {
    window.open(`/api/sheets/export-all`, "_blank");
    setShowExportMenu(false);
  };

  const bgColors = [
    { label: "None", value: "" },
    { label: "Soft Yellow", value: "#fef08a" },
    { label: "Light Green", value: "#dcfce7" },
    { label: "Light Blue", value: "#e0f2fe" },
    { label: "Light Red", value: "#ffe4e6" },
    { label: "Light Purple", value: "#f3e8ff" },
    { label: "Light Slate", value: "#f1f5f9" },
  ];

  const textColors = [
    { label: "Default", value: "" },
    { label: "Dark Slate", value: "#0f172a" },
    { label: "Blue", value: "#1d4ed8" },
    { label: "Green", value: "#15803d" },
    { label: "Red", value: "#b91c1c" },
    { label: "Purple", value: "#7e22ce" },
    { label: "Amber", value: "#b45309" },
  ];

  return (
    <header className="bg-white border-b border-slate-200 select-none shadow-sm flex flex-col shrink-0">
      {/* Top Banner Row */}
      <div className="h-14 px-3 sm:px-4 py-2 flex items-center justify-between gap-2 sm:gap-4 border-b border-slate-100">
        
        {/* Left: Brand & Sheet Title (Single line, compact on mobile) */}
        <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1 sm:flex-initial">
          <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-lg bg-emerald-600 text-white flex items-center justify-center shadow-sm shrink-0">
            <FileSpreadsheet className="h-4 w-4 sm:h-5 sm:w-5" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="font-bold text-slate-900 text-xs sm:text-sm tracking-tight whitespace-nowrap">
                MVK Lead Tracker
              </span>
              <span className="text-[10px] sm:text-[11px] px-1.5 sm:px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-semibold border border-slate-200 truncate max-w-[90px] sm:max-w-none">
                {sheet?.name ? `Sheet: ${sheet.name}` : "Loading..."}
              </span>
              {totalLeads !== undefined && (
                <span className="text-[10px] sm:text-[11px] px-2 py-0.5 rounded-full bg-amber-100 text-amber-950 font-bold border border-amber-300 whitespace-nowrap shadow-2xs flex items-center gap-1">
                  <span>{totalLeads} {totalLeads === 1 ? "Lead" : "Leads"}</span>
                  {dateFilter && (
                    <span className="text-[9px] px-1 py-0.2 bg-amber-300 text-amber-950 font-black rounded">
                      Filtered
                    </span>
                  )}
                </span>
              )}
              {sheet?.user && (
                <span className="text-[10px] text-slate-500 hidden sm:inline truncate">
                  (Owner: {sheet.user.name})
                </span>
              )}
            </div>
            
            {/* Auto-save Status Indicator & Real-Time Sync (Compact on mobile) */}
            <div className="flex items-center gap-2 text-[10px] sm:text-[11px] text-slate-500 mt-0.5 whitespace-nowrap">
              {savingStatus === "saving" ? (
                <>
                  <RefreshCw className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-amber-500 animate-spin shrink-0" />
                  <span className="text-amber-600 font-medium">Saving...</span>
                </>
              ) : savingStatus === "error" ? (
                <span className="text-rose-600 font-medium">Error saving</span>
              ) : (
                <div className="flex items-center gap-1" title="All changes saved to database">
                  <CheckCircle2 className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-emerald-500 shrink-0" />
                  <span className="text-slate-500 sm:hidden">Saved</span>
                  <span className="text-slate-500 hidden sm:inline">All changes saved</span>
                </div>
              )}

              {/* Instant Manual Sync with Neon PostgreSQL */}
              {onRefresh && (
                <button
                  type="button"
                  onClick={onRefresh}
                  disabled={isRefreshing}
                  className="flex items-center gap-1 text-[10px] font-semibold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-1.5 py-0.5 rounded transition-colors"
                  title="Force re-sync data directly from Neon database"
                >
                  <RefreshCw className={`h-2.5 w-2.5 text-blue-600 ${isRefreshing ? "animate-spin" : ""}`} />
                  <span className="hidden sm:inline">Sync DB</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Center: In-Profile Lead Search Bar (filters instantly by phone, name, or project details) */}
        <div className="hidden md:flex items-center flex-1 max-w-sm relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
          <input
            type="text"
            placeholder={
              sheet?.name
                ? `Search ${sheet.name}'s leads (phone, name, project)...`
                : "Search leads (phone, name, project)..."
            }
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-100/90 hover:bg-slate-100 focus:bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 transition-all text-slate-800 shadow-2xs"
            title="Instant in-profile lead search without resetting selections"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange("")}
              className="absolute right-2.5 top-2 p-1 text-slate-400 hover:text-slate-700 rounded-full"
              title="Clear search filter"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>

        {/* Right: Export & User Menu */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0">
          
          {/* Export Dropdown Button - Compact Icon-only on mobile, full text on desktop */}
          <div className="relative" ref={exportRef}>
            <button
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="p-2 sm:px-3 sm:py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs rounded-lg shadow-sm hover:shadow transition-all flex items-center gap-1.5"
              title="Export Sheet (.xlsx / .csv)"
            >
              <Download className="h-4 w-4 sm:h-3.5 sm:w-3.5" />
              <span className="hidden md:inline">Export Sheet (.xlsx / .csv)</span>
              <ChevronDown className="h-3 w-3 opacity-80 hidden md:inline" />
            </button>

            {showExportMenu && (
              <div className="absolute right-0 mt-1.5 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-50 animate-in fade-in zoom-in-95">
                <div className="px-3 py-1 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
                  Active Sheet ({sheet?.name})
                </div>
                <button
                  onClick={() => handleExport("xlsx")}
                  className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2 font-medium transition-colors"
                >
                  <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
                  <div>
                    <div>Export as Excel (.xlsx)</div>
                    <span className="text-[10px] text-slate-400">Formatted workbook</span>
                  </div>
                </button>
                <button
                  onClick={() => handleExport("csv")}
                  className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 flex items-center gap-2 font-medium transition-colors"
                >
                  <FileDown className="h-4 w-4 text-slate-500" />
                  <div>
                    <div>Export as CSV (.csv)</div>
                    <span className="text-[10px] text-slate-400">Comma-separated values</span>
                  </div>
                </button>

                {user?.role === "ADMIN" && (
                  <>
                    <div className="my-1 border-t border-slate-100" />
                    <div className="px-3 py-1 text-[11px] font-semibold text-amber-600 uppercase tracking-wider flex items-center gap-1">
                      <Shield className="h-3 w-3" /> Admin Only
                    </div>
                    <button
                      onClick={handleExportAll}
                      className="w-full px-3 py-2 text-left text-xs text-slate-900 bg-amber-50/50 hover:bg-amber-100/70 flex items-center gap-2 font-semibold transition-colors"
                    >
                      <Layers className="h-4 w-4 text-amber-600" />
                      <div>
                        <div>Export All Sheets (.xlsx)</div>
                        <span className="text-[10px] text-slate-500 font-normal">
                          Multi-tab Excel workbook of all 7+ members
                        </span>
                      </div>
                    </button>
                  </>
                )}
              </div>
            )}
          </div>

          {/* Admin Team Management Button */}
          {user?.role === "ADMIN" && (
            <button
              onClick={onOpenManageAccountsModal}
              className="p-2 sm:px-2.5 sm:py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-900 border border-purple-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-2xs"
              title="Admin: Manage Team Accounts, Emails & Password Resets"
            >
              <Users className="h-4 w-4 sm:h-3.5 sm:w-3.5 text-purple-700" />
              <span className="hidden lg:inline">Manage Accounts</span>
            </button>
          )}

          {/* User Profile Avatar & Dropdown Menu */}
          <div className="relative pl-1 sm:pl-2 border-l border-slate-200" ref={profileRef}>
            <button
              onClick={() => setShowProfileMenu(!showProfileMenu)}
              className="flex items-center gap-1.5 p-0.5 rounded-full hover:ring-2 hover:ring-slate-300 focus:outline-none transition-all cursor-pointer"
              title="User Account & Profile Menu"
              aria-label="User Profile Menu"
            >
              {/* Circular Avatar */}
              <div
                className={`h-8 w-8 sm:h-9 sm:w-9 rounded-full flex items-center justify-center font-extrabold text-xs sm:text-sm shadow-xs transition-transform active:scale-95 ${
                  user?.role === "ADMIN"
                    ? "bg-gradient-to-tr from-purple-700 to-indigo-600 text-white border-2 border-purple-200/80"
                    : "bg-gradient-to-tr from-amber-600 to-amber-500 text-slate-950 border-2 border-amber-200/80"
                }`}
              >
                {user?.name ? user.name.trim().charAt(0).toUpperCase() : <User className="h-4 w-4" />}
              </div>
              <ChevronDown className="h-3 w-3 text-slate-400 hidden sm:block" />
            </button>

            {/* Profile Dropdown Menu */}
            {showProfileMenu && (
              <div className="absolute right-0 mt-2 w-64 sm:w-72 bg-white rounded-2xl shadow-2xl border border-slate-200 py-1 z-50 animate-in fade-in zoom-in-95 overflow-hidden">
                {/* User Details Header */}
                <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex items-center gap-3">
                  <div
                    className={`h-10 w-10 rounded-full flex items-center justify-center font-black text-sm shrink-0 shadow-inner ${
                      user?.role === "ADMIN"
                        ? "bg-gradient-to-tr from-purple-700 to-indigo-600 text-white"
                        : "bg-gradient-to-tr from-amber-600 to-amber-500 text-slate-950"
                    }`}
                  >
                    {user?.name ? user.name.trim().charAt(0).toUpperCase() : <User className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-extrabold text-sm text-slate-900 truncate" title={user?.name}>
                      {user?.name || "User"}
                    </div>
                    <div className="text-xs text-slate-500 truncate" title={user?.email}>
                      {user?.email || "No email"}
                    </div>
                    <div className="mt-1">
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wider uppercase border ${
                          user?.role === "ADMIN"
                            ? "bg-purple-100 text-purple-800 border-purple-200"
                            : "bg-blue-100 text-blue-800 border-blue-200"
                        }`}
                      >
                        {user?.role === "ADMIN" && <Shield className="h-2.5 w-2.5" />}
                        <span>{user?.role || "MEMBER"}</span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Section */}
                <div className="p-1.5 space-y-0.5">
                  {/* Change Password */}
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      onOpenChangePasswordModal();
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-amber-50 hover:text-amber-900 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                  >
                    <KeyRound className="h-4 w-4 text-amber-600 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-800">Change Password</div>
                      <div className="text-[10px] text-slate-400">Update your sign-in password</div>
                    </div>
                  </button>

                  {/* Admin Team Accounts shortcut */}
                  {user?.role === "ADMIN" && (
                    <button
                      onClick={() => {
                        setShowProfileMenu(false);
                        onOpenManageAccountsModal();
                      }}
                      className="w-full px-3 py-2 text-left text-xs text-slate-700 hover:bg-purple-50 hover:text-purple-900 rounded-xl flex items-center gap-2.5 font-medium transition-colors cursor-pointer"
                    >
                      <Users className="h-4 w-4 text-purple-600 shrink-0" />
                      <div>
                        <div className="font-semibold text-slate-800">Manage Team Accounts</div>
                        <div className="text-[10px] text-slate-400">Team credentials & resets</div>
                      </div>
                    </button>
                  )}
                </div>

                {/* Sign Out Footer */}
                <div className="border-t border-slate-100 p-1.5 bg-slate-50/50">
                  <button
                    onClick={() => {
                      setShowProfileMenu(false);
                      logout();
                    }}
                    className="w-full px-3 py-2 text-left text-xs text-rose-600 hover:bg-rose-50 rounded-xl flex items-center gap-2.5 font-bold transition-colors cursor-pointer"
                  >
                    <LogOut className="h-4 w-4 text-rose-500 shrink-0" />
                    <span>Sign Out</span>
                  </button>
                </div>
              </div>
            )}
          </div>

        </div>
      </div>

      {/* Formatting & Controls Sub-Toolbar (Desktop only: hidden md:flex) */}
      <div className="hidden md:flex h-10 px-4 bg-slate-50/80 items-center justify-between text-xs text-slate-600 overflow-x-auto gap-4">
        
        {/* Left: Row & Column Action Buttons */}
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            onClick={onAddRow}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-md font-medium text-xs flex items-center gap-1 shadow-2xs transition-colors"
            title="Add a new lead row at the bottom"
          >
            <Plus className="h-3.5 w-3.5 text-emerald-600" />
            <span>Add Row</span>
          </button>

          <button
            onClick={onOpenAddColumnModal}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-md font-medium text-xs flex items-center gap-1 shadow-2xs transition-colors"
            title="Insert a custom column to this sheet"
          >
            <Columns className="h-3.5 w-3.5 text-blue-600" />
            <span>Add Column</span>
          </button>

          <button
            onClick={onOpenDropdownModal}
            className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-800 border border-slate-200 rounded-md font-medium text-xs flex items-center gap-1 shadow-2xs transition-colors"
            title="Configure follow-up dropdown choices"
          >
            <Settings2 className="h-3.5 w-3.5 text-amber-600" />
            <span>Customize Dropdowns</span>
          </button>
        </div>

        {/* Right: Text and Cell Formatting Controls */}
        <div className="flex items-center gap-1 shrink-0 pl-3 border-l border-slate-200">
          {/* Undo */}
          {onUndo && (
            <button
              onClick={onUndo}
              disabled={!canUndo}
              className={`p-1.5 rounded transition-colors ${
                canUndo ? "hover:bg-slate-200 text-slate-700 cursor-pointer" : "text-slate-300 cursor-not-allowed"
              }`}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="h-3.5 w-3.5" />
            </button>
          )}

          {/* Redo */}
          {onRedo && (
            <button
              onClick={onRedo}
              disabled={!canRedo}
              className={`p-1.5 rounded transition-colors ${
                canRedo ? "hover:bg-slate-200 text-slate-700 cursor-pointer" : "text-slate-300 cursor-not-allowed"
              }`}
              title="Redo (Ctrl+Y or Ctrl+Shift+Z)"
            >
              <Redo2 className="h-3.5 w-3.5" />
            </button>
          )}

          <div className="h-4 w-px bg-slate-200 mx-0.5" />

          {/* Bold */}
          <button
            onClick={() => onApplyStyle({ bold: !selectedCellStyle.bold })}
            className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
              selectedCellStyle.bold ? "bg-slate-200 text-slate-900 font-bold" : "text-slate-600"
            }`}
            title="Bold (Ctrl+B)"
          >
            <Bold className="h-3.5 w-3.5" />
          </button>

          {/* Italic */}
          <button
            onClick={() => onApplyStyle({ italic: !selectedCellStyle.italic })}
            className={`p-1.5 rounded hover:bg-slate-200 transition-colors ${
              selectedCellStyle.italic ? "bg-slate-200 text-slate-900" : "text-slate-600"
            }`}
            title="Italic (Ctrl+I)"
          >
            <Italic className="h-3.5 w-3.5" />
          </button>

          {/* Alignment */}
          <div className="flex items-center border border-slate-200 rounded bg-white overflow-hidden mx-1">
            <button
              onClick={() => onApplyStyle({ align: "left" })}
              className={`p-1 hover:bg-slate-100 transition-colors ${
                selectedCellStyle.align === "left" || !selectedCellStyle.align ? "bg-slate-100 text-slate-900" : "text-slate-500"
              }`}
              title="Align Left"
            >
              <AlignLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onApplyStyle({ align: "center" })}
              className={`p-1 hover:bg-slate-100 transition-colors ${
                selectedCellStyle.align === "center" ? "bg-slate-100 text-slate-900" : "text-slate-500"
              }`}
              title="Align Center"
            >
              <AlignCenter className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => onApplyStyle({ align: "right" })}
              className={`p-1 hover:bg-slate-100 transition-colors ${
                selectedCellStyle.align === "right" ? "bg-slate-100 text-slate-900" : "text-slate-500"
              }`}
              title="Align Right"
            >
              <AlignRight className="h-3.5 w-3.5" />
            </button>
          </div>

          {/* Text Color Picker */}
          <div className="relative" ref={textRef}>
            <button
              onClick={() => setShowTextColorMenu(!showTextColorMenu)}
              className="p-1.5 rounded hover:bg-slate-200 text-slate-700 flex items-center gap-0.5 transition-colors"
              title="Text Color"
            >
              <Type className="h-3.5 w-3.5" />
              <div
                className="w-2.5 h-1 rounded-sm border border-slate-400"
                style={{ backgroundColor: selectedCellStyle.color || "#0f172a" }}
              />
            </button>

            {showTextColorMenu && (
              <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-xl border border-slate-200 p-2 z-50">
                <span className="text-[10px] text-slate-400 font-semibold block mb-1">Text Color</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {textColors.map((c) => (
                    <button
                      key={c.label}
                      onClick={() => {
                        onApplyStyle({ color: c.value });
                        setShowTextColorMenu(false);
                      }}
                      className="w-6 h-6 rounded border border-slate-300 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c.value || "#0f172a" }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Background Fill Color Picker */}
          <div className="relative" ref={bgRef}>
            <button
              onClick={() => setShowBgColorMenu(!showBgColorMenu)}
              className="p-1.5 rounded hover:bg-slate-200 text-slate-700 flex items-center gap-0.5 transition-colors"
              title="Fill Color"
            >
              <Palette className="h-3.5 w-3.5" />
              <div
                className="w-2.5 h-1 rounded-sm border border-slate-400"
                style={{ backgroundColor: selectedCellStyle.bgColor || "#ffffff" }}
              />
            </button>

            {showBgColorMenu && (
              <div className="absolute right-0 mt-1 w-36 bg-white rounded-lg shadow-xl border border-slate-200 p-2 z-50">
                <span className="text-[10px] text-slate-400 font-semibold block mb-1">Fill Color</span>
                <div className="grid grid-cols-4 gap-1.5">
                  {bgColors.map((c) => (
                    <button
                      key={c.label}
                      onClick={() => {
                        onApplyStyle({ bgColor: c.value });
                        setShowBgColorMenu(false);
                      }}
                      className="w-6 h-6 rounded border border-slate-300 hover:scale-110 transition-transform"
                      style={{ backgroundColor: c.value || "#ffffff" }}
                      title={c.label}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>

        </div>

      </div>
    </header>
  );
}
