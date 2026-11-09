"use client";

import React, { useRef, useState, useEffect } from "react";
import { SheetMeta } from "@/lib/types";
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Shield,
  Lock,
  MoreVertical,
  Trash2,
  Edit2,
  Users,
  Check,
  GripVertical,
  ArrowLeft,
  ArrowRight,
  Copy,
  Palette,
  ArrowRightLeft,
  X,
  FileSpreadsheet,
  AlertTriangle,
} from "lucide-react";

export const PRESET_TAB_COLORS = [
  { name: "Default (None)", value: null },
  { name: "Red", value: "#ef4444" },
  { name: "Orange", value: "#f97316" },
  { name: "Amber", value: "#f59e0b" },
  { name: "Emerald", value: "#10b981" },
  { name: "Teal", value: "#14b8a6" },
  { name: "Blue", value: "#3b82f6" },
  { name: "Indigo", value: "#6366f1" },
  { name: "Purple", value: "#a855f7" },
  { name: "Rose", value: "#f43f5e" },
  { name: "Slate", value: "#64748b" },
];

interface UserItem {
  id: string;
  name: string;
  email: string;
  role: string;
}

interface BottomTabBarProps {
  sheets: SheetMeta[];
  activeSheetId: string | null;
  onSelectSheet: (id: string) => void;
  isAdmin: boolean;
  users?: UserItem[];
  onOpenNewSheetModal: () => void;
  onRenameSheet: (id: string, newName: string) => Promise<void>;
  onDeleteSheet: (id: string) => Promise<void>;
  onReorderSheets?: (reorderedSheets: SheetMeta[]) => Promise<void> | void;
  onDuplicateSheet?: (id: string, newName: string, includeLeads: boolean) => Promise<void>;
  onChangeSheetColor?: (id: string, color: string | null) => Promise<void>;
  onCopySheetToUser?: (id: string, targetUserId: string, newName: string, includeLeads: boolean) => Promise<void>;
  onMoveSheetToUser?: (id: string, targetUserId: string) => Promise<void>;
  onOpenManageAccounts?: () => void;
}

export function BottomTabBar({
  sheets,
  activeSheetId,
  onSelectSheet,
  isAdmin,
  users = [],
  onOpenNewSheetModal,
  onRenameSheet,
  onDeleteSheet,
  onReorderSheets,
  onDuplicateSheet,
  onChangeSheetColor,
  onCopySheetToUser,
  onMoveSheetToUser,
  onOpenManageAccounts,
}: BottomTabBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Floating Context Menu state (anchored via fixed coordinates)
  const [menuAnchor, setMenuAnchor] = useState<{
    sheet: SheetMeta;
    index: number;
    bottom: number;
    left: number;
  } | null>(null);

  // Submenu / Dialog states
  const [colorPickerSheet, setColorPickerSheet] = useState<SheetMeta | null>(null);
  const [duplicateModalSheet, setDuplicateModalSheet] = useState<SheetMeta | null>(null);
  const [duplicateName, setDuplicateName] = useState("");
  const [duplicateIncludeLeads, setDuplicateIncludeLeads] = useState(true);

  const [copyModalSheet, setCopyModalSheet] = useState<SheetMeta | null>(null);
  const [copyTargetUserId, setCopyTargetUserId] = useState("");
  const [copySheetName, setCopySheetName] = useState("");
  const [copyIncludeLeads, setCopyIncludeLeads] = useState(true);

  const [moveModalSheet, setMoveModalSheet] = useState<SheetMeta | null>(null);
  const [moveTargetUserId, setMoveTargetUserId] = useState("");

  const [deleteConfirmSheet, setDeleteConfirmSheet] = useState<SheetMeta | null>(null);

  const [isProcessing, setIsProcessing] = useState(false);

  // Inline rename state
  const [renamingSheetId, setRenamingSheetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Drag and drop tab reordering state
  const [draggedSheetIdx, setDraggedSheetIdx] = useState<number | null>(null);
  const [dragOverSheetIdx, setDragOverSheetIdx] = useState<number | null>(null);

  // Close context menu on outside click or scroll or Escape key
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      // If clicking inside a modal or popup, do not dismiss
      const target = e.target as HTMLElement;
      if (target.closest("[data-tab-menu]") || target.closest("[data-tab-modal]")) {
        return;
      }
      setMenuAnchor(null);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMenuAnchor(null);
        setColorPickerSheet(null);
        setDuplicateModalSheet(null);
        setCopyModalSheet(null);
        setMoveModalSheet(null);
        setDeleteConfirmSheet(null);
      }
    };

    document.addEventListener("mousedown", handleDocumentClick);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  // HTML5 Drag-and-Drop handlers
  const handleDragStart = (e: React.DragEvent, index: number) => {
    if (renamingSheetId !== null) {
      e.preventDefault();
      return;
    }
    setDraggedSheetIdx(index);
    e.dataTransfer.setData("text/plain", String(index));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverSheetIdx !== index) {
      setDragOverSheetIdx(index);
    }
  };

  const handleDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedSheetIdx !== null && draggedSheetIdx !== targetIndex) {
      const updated = [...sheets];
      const [moved] = updated.splice(draggedSheetIdx, 1);
      updated.splice(targetIndex, 0, moved);
      if (onReorderSheets) {
        await onReorderSheets(updated);
      }
    }
    setDraggedSheetIdx(null);
    setDragOverSheetIdx(null);
  };

  const handleDragEnd = () => {
    setDraggedSheetIdx(null);
    setDragOverSheetIdx(null);
  };

  // Move sheet left or right programmatically
  const handleMoveSheet = async (sheetIndex: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? sheetIndex - 1 : sheetIndex + 1;
    if (targetIndex < 0 || targetIndex >= sheets.length) return;
    const updated = [...sheets];
    const [moved] = updated.splice(sheetIndex, 1);
    updated.splice(targetIndex, 0, moved);
    if (onReorderSheets) {
      await onReorderSheets(updated);
    }
    setMenuAnchor(null);
  };

  // Auto-scroll active tab into view on mobile & desktop
  useEffect(() => {
    if (activeSheetId && scrollContainerRef.current) {
      const activeEl = scrollContainerRef.current.querySelector<HTMLElement>('[data-active="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });
      }
    }
  }, [activeSheetId]);

  const scroll = (direction: "left" | "right") => {
    if (scrollContainerRef.current) {
      const offset = direction === "left" ? -240 : 240;
      scrollContainerRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  const handleStartRename = (sheet: SheetMeta) => {
    setRenamingSheetId(sheet.id);
    setRenameValue(sheet.name);
    setMenuAnchor(null);
  };

  const handleSaveRename = async (id: string) => {
    if (renameValue.trim()) {
      await onRenameSheet(id, renameValue.trim());
    }
    setRenamingSheetId(null);
  };

  // Open context menu from three-dot button
  const handleOpenMenu = (e: React.MouseEvent, sheet: SheetMeta, index: number) => {
    e.stopPropagation();
    e.preventDefault();
    const btn = e.currentTarget as HTMLElement;
    const rect = btn.getBoundingClientRect();
    const menuWidth = 230;
    const padding = 8;
    const left = Math.max(padding, Math.min(rect.left, window.innerWidth - menuWidth - padding));
    const bottom = window.innerHeight - rect.top + 6;

    setMenuAnchor({
      sheet,
      index,
      bottom,
      left,
    });
  };

  // Right-click Google Sheets feel
  const handleContextMenu = (e: React.MouseEvent, sheet: SheetMeta, index: number) => {
    e.preventDefault();
    e.stopPropagation();
    const menuWidth = 230;
    const padding = 8;
    const left = Math.max(padding, Math.min(e.clientX, window.innerWidth - menuWidth - padding));
    const bottom = window.innerHeight - e.clientY + 6;

    setMenuAnchor({
      sheet,
      index,
      bottom,
      left,
    });
  };

  // Confirm duplication
  const handleConfirmDuplicate = async () => {
    if (!duplicateModalSheet || !duplicateName.trim()) return;
    setIsProcessing(true);
    try {
      if (onDuplicateSheet) {
        await onDuplicateSheet(duplicateModalSheet.id, duplicateName.trim(), duplicateIncludeLeads);
      }
      setDuplicateModalSheet(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm copy to user
  const handleConfirmCopy = async () => {
    if (!copyModalSheet || !copyTargetUserId || !copySheetName.trim()) return;
    setIsProcessing(true);
    try {
      if (onCopySheetToUser) {
        await onCopySheetToUser(
          copyModalSheet.id,
          copyTargetUserId,
          copySheetName.trim(),
          copyIncludeLeads
        );
      }
      setCopyModalSheet(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm move to user
  const handleConfirmMove = async () => {
    if (!moveModalSheet || !moveTargetUserId) return;
    setIsProcessing(true);
    try {
      if (onMoveSheetToUser) {
        await onMoveSheetToUser(moveModalSheet.id, moveTargetUserId);
      }
      setMoveModalSheet(null);
    } finally {
      setIsProcessing(false);
    }
  };

  // Confirm delete
  const handleConfirmDelete = async () => {
    if (!deleteConfirmSheet) return;
    setIsProcessing(true);
    try {
      await onDeleteSheet(deleteConfirmSheet.id);
      setDeleteConfirmSheet(null);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <>
      <footer className="h-10 bg-slate-900 border-t border-slate-800 text-white flex items-stretch select-none shrink-0 sticky bottom-0 z-30 shadow-lg w-full">
        {/* Left Role & Mode Badge (Compact) */}
        <div className="px-2 sm:px-2.5 flex items-center gap-1.5 border-r border-slate-800 bg-slate-950/70 shrink-0">
          {isAdmin ? (
            <div
              className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
              onClick={onOpenManageAccounts}
              title="Admin Role: CEO / Manager with global access to all team sheets (Click to manage)"
            >
              <div className="h-5 w-5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
                <Shield className="h-3 w-3" />
              </div>
              <div className="hidden sm:block">
                <div className="text-[10px] font-bold text-amber-400 uppercase tracking-wider leading-none">
                  Admin
                </div>
                <div className="text-[9px] text-slate-400 leading-none mt-0.5">
                  {sheets.length} Sheets
                </div>
              </div>
            </div>
          ) : (
            <div
              className="flex items-center gap-1.5"
              title="Member Role: Assigned Sheets Only"
            >
              <div className="h-5 w-5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
                <Lock className="h-3 w-3" />
              </div>
              <div className="hidden sm:block">
                <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider leading-none">
                  Member
                </div>
                <div className="text-[9px] text-slate-400 leading-none mt-0.5">
                  {sheets.length} {sheets.length === 1 ? "Sheet" : "Sheets"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Admin Action: Add New Tab (+) */}
        {isAdmin && (
          <div className="flex items-center px-1 border-r border-slate-800 shrink-0 bg-slate-900/90">
            <button
              onClick={onOpenNewSheetModal}
              className="h-6 px-1.5 sm:px-2 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold rounded flex items-center gap-1 transition-colors shadow-xs text-xs"
              title="Create new sheet tab for a team member"
            >
              <Plus className="h-3 w-3 stroke-[3]" />
              <span className="hidden md:inline font-bold text-[10px]">New Tab</span>
            </button>
          </div>
        )}

        {/* Scroll Left Button */}
        <button
          onClick={() => scroll("left")}
          className="px-1.5 text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors shrink-0"
          title="Scroll tabs left"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        {/* Main Sheet Tabs Scroll Container */}
        <div
          ref={scrollContainerRef}
          className="flex-1 flex items-stretch overflow-x-auto no-scrollbar scroll-smooth touch-pan-x"
          style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
        >
          {sheets.map((s, idx) => {
            const isActive = s.id === activeSheetId;
            const isRenaming = renamingSheetId === s.id;
            const isBeingDragged = draggedSheetIdx === idx;
            const isDropTarget = dragOverSheetIdx === idx && draggedSheetIdx !== idx;
            const tabColor = s.color || null;

            return (
              <div
                key={s.id}
                data-active={isActive}
                draggable={!isRenaming}
                onDragStart={(e) => handleDragStart(e, idx)}
                onDragOver={(e) => handleDragOver(e, idx)}
                onDrop={(e) => handleDrop(e, idx)}
                onDragEnd={handleDragEnd}
                onClick={() => onSelectSheet(s.id)}
                onDoubleClick={() => handleStartRename(s)}
                onContextMenu={(e) => handleContextMenu(e, s, idx)}
                className={`group relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1 cursor-pointer border-r border-slate-800 transition-all min-w-[105px] sm:min-w-[130px] max-w-[230px] shrink-0 select-none ${
                  isActive
                    ? "bg-slate-800 text-white font-bold shadow-inner"
                    : "bg-slate-900/80 text-slate-400 hover:bg-slate-850 hover:text-slate-200 font-medium"
                } ${
                  isBeingDragged
                    ? "opacity-30 scale-95 border-amber-400 border-dashed bg-slate-950"
                    : ""
                } ${
                  isDropTarget
                    ? "border-l-4 border-l-amber-400 bg-slate-800 ring-2 ring-amber-400/60 shadow-md"
                    : ""
                }`}
                title={`${s.name} (Right-click or click ⋮ for options)`}
              >
                {/* Active Tab Accent Bar (Uses tabColor if available, else amber) */}
                {isActive && (
                  <div
                    className="absolute top-0 left-0 right-0 h-0.5"
                    style={{ backgroundColor: tabColor || "#fbbf24" }}
                  />
                )}

                {/* Persistent Tab Color Strip at bottom (Google Sheets style) */}
                {tabColor && (
                  <div
                    className="absolute bottom-0 left-0 right-0 h-[3px] rounded-t-sm"
                    style={{ backgroundColor: tabColor }}
                  />
                )}

                {/* Drag Grip Handle */}
                {!isRenaming && (
                  <GripVertical className="h-3 w-3 text-slate-500 group-hover:text-amber-400 opacity-20 group-hover:opacity-80 shrink-0 transition-opacity cursor-grab active:cursor-grabbing" />
                )}

                {/* Tab Title or Inline Rename Input */}
                {isRenaming ? (
                  <div
                    className="flex items-center gap-1 flex-1 min-w-0"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <input
                      type="text"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveRename(s.id);
                        if (e.key === "Escape") setRenamingSheetId(null);
                      }}
                      autoFocus
                      className="w-full px-1.5 py-0.5 text-xs bg-slate-950 text-white rounded border border-amber-400 outline-none select-text"
                    />
                    <button
                      onClick={() => handleSaveRename(s.id)}
                      className="p-0.5 hover:text-emerald-400 text-slate-400"
                      title="Save sheet name"
                    >
                      <Check className="h-3 w-3" />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5 flex-1 min-w-0 truncate">
                    {/* Tab Color Indicator Circle */}
                    {tabColor && (
                      <span
                        className="h-2 w-2 rounded-full shrink-0 shadow-2xs"
                        style={{ backgroundColor: tabColor }}
                      />
                    )}
                    <span className="text-xs sm:text-sm tracking-tight truncate leading-none">
                      {s.name}
                    </span>

                    {/* Lead Count Badge */}
                    {s.rowCount !== undefined && (
                      <span
                        className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 min-w-[16px] text-center leading-tight ${
                          isActive
                            ? "bg-amber-400 text-slate-950 font-extrabold"
                            : "bg-slate-800 text-slate-400 group-hover:bg-slate-700"
                        }`}
                      >
                        {s.rowCount}
                      </span>
                    )}
                  </div>
                )}

                {/* Three-Dot Menu Trigger */}
                {!isRenaming && (
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      e.stopPropagation();
                    }}
                    onClick={(e) => handleOpenMenu(e, s, idx)}
                    className="p-1 rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors opacity-40 group-hover:opacity-100 shrink-0"
                    title="Sheet options (Rename, Duplicate, Tab Color, Copy, Delete)"
                  >
                    <MoreVertical className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        {/* Scroll Right Button */}
        <button
          onClick={() => scroll("right")}
          className="px-1.5 text-slate-400 hover:text-white hover:bg-slate-800 flex items-center justify-center transition-colors shrink-0 border-l border-slate-800"
          title="Scroll tabs right"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>

        {/* Right Stats Info */}
        <div className="hidden lg:flex items-center px-2.5 bg-slate-950/70 border-l border-slate-800 text-[10px] text-slate-400 shrink-0 gap-1.5">
          <Users className="h-3 w-3 text-slate-500" />
          <span>{sheets.length} Sheets</span>
        </div>
      </footer>

      {/* ============================================================== */}
      {/* FLOATING GOOGLE SHEETS TAB CONTEXT MENU (Immune to scroll clip) */}
      {/* ============================================================== */}
      {menuAnchor && (
        <div
          data-tab-menu="true"
          style={{
            position: "fixed",
            bottom: `${menuAnchor.bottom}px`,
            left: `${menuAnchor.left}px`,
            zIndex: 9999,
          }}
          className="w-56 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 text-slate-800 text-xs animate-in fade-in zoom-in-95 duration-100"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Menu Header with Tab Name */}
          <div className="px-3 py-1.5 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
            <span className="truncate max-w-[170px]">{menuAnchor.sheet.name}</span>
            {menuAnchor.sheet.color && (
              <span
                className="h-2.5 w-2.5 rounded-full shrink-0 shadow-2xs"
                style={{ backgroundColor: menuAnchor.sheet.color }}
              />
            )}
          </div>

          <div className="py-1">
            {/* A. Rename Sheet */}
            <button
              onClick={() => handleStartRename(menuAnchor.sheet)}
              className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium text-slate-700 transition-colors"
            >
              <Edit2 className="h-3.5 w-3.5 text-blue-600 shrink-0" />
              <span>Rename Sheet</span>
            </button>

            {/* B. Duplicate Sheet */}
            <button
              onClick={() => {
                setDuplicateModalSheet(menuAnchor.sheet);
                setDuplicateName(`${menuAnchor.sheet.name} (Copy)`);
                setDuplicateIncludeLeads(true);
                setMenuAnchor(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium text-slate-700 transition-colors"
            >
              <Copy className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
              <span>Duplicate Sheet...</span>
            </button>

            {/* C. Change Tab Colour */}
            <button
              onClick={() => {
                setColorPickerSheet(menuAnchor.sheet);
                setMenuAnchor(null);
              }}
              className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium text-slate-700 transition-colors"
            >
              <Palette className="h-3.5 w-3.5 text-purple-600 shrink-0" />
              <div className="flex items-center justify-between flex-1">
                <span>Change Tab Colour</span>
                {menuAnchor.sheet.color ? (
                  <span
                    className="h-2.5 w-2.5 rounded-full border border-slate-300"
                    style={{ backgroundColor: menuAnchor.sheet.color }}
                  />
                ) : (
                  <span className="text-[10px] text-slate-400">None</span>
                )}
              </div>
            </button>

            {/* D. Copy to Member (Admin only) */}
            {isAdmin && users.length > 0 && (
              <button
                onClick={() => {
                  setCopyModalSheet(menuAnchor.sheet);
                  setCopySheetName(`${menuAnchor.sheet.name}`);
                  setCopyTargetUserId(users[0]?.id || "");
                  setCopyIncludeLeads(true);
                  setMenuAnchor(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium text-slate-700 transition-colors"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 text-indigo-600 shrink-0" />
                <span>Copy Sheet to Member...</span>
              </button>
            )}

            {/* E. Move / Reassign Sheet (Admin only) */}
            {isAdmin && users.length > 0 && (
              <button
                onClick={() => {
                  setMoveModalSheet(menuAnchor.sheet);
                  setMoveTargetUserId(menuAnchor.sheet.userId || users[0]?.id || "");
                  setMenuAnchor(null);
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium text-slate-700 transition-colors"
              >
                <ArrowRightLeft className="h-3.5 w-3.5 text-amber-600 shrink-0" />
                <span>Reassign Sheet Owner...</span>
              </button>
            )}

            {/* F. Manage Sheet Access */}
            {isAdmin && onOpenManageAccounts && (
              <button
                onClick={() => {
                  setMenuAnchor(null);
                  onOpenManageAccounts();
                }}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium text-slate-700 transition-colors"
              >
                <Shield className="h-3.5 w-3.5 text-purple-700 shrink-0" />
                <span>Manage Sheet Access</span>
              </button>
            )}

            {/* Move Tab Left / Right */}
            <div className="border-t border-slate-100 my-1" />
            {menuAnchor.index > 0 && (
              <button
                onClick={() => handleMoveSheet(menuAnchor.index, "left")}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium text-slate-700 transition-colors"
              >
                <ArrowLeft className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span>Move Left</span>
              </button>
            )}
            {menuAnchor.index < sheets.length - 1 && (
              <button
                onClick={() => handleMoveSheet(menuAnchor.index, "right")}
                className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2.5 font-medium text-slate-700 transition-colors"
              >
                <ArrowRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                <span>Move Right</span>
              </button>
            )}

            {/* G. Delete Sheet (Admin only) */}
            {isAdmin && sheets.length > 1 && (
              <>
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => {
                    setDeleteConfirmSheet(menuAnchor.sheet);
                    setMenuAnchor(null);
                  }}
                  className="w-full px-3 py-1.5 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2.5 font-semibold transition-colors"
                >
                  <Trash2 className="h-3.5 w-3.5 shrink-0" />
                  <span>Delete Sheet...</span>
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 1. COLOR PICKER MODAL / POPUP                                  */}
      {/* ============================================================== */}
      {colorPickerSheet && (
        <div
          data-tab-modal="true"
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 animate-in fade-in duration-100"
          onClick={() => setColorPickerSheet(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-xs w-full p-4.5 animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Palette className="h-4 w-4 text-purple-600" />
                <h4 className="font-extrabold text-xs text-slate-900">
                  Tab Colour: {colorPickerSheet.name}
                </h4>
              </div>
              <button
                onClick={() => setColorPickerSheet(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <p className="text-[11px] text-slate-500 mb-3">
              Select a color to highlight this sheet tab, or reset to default:
            </p>

            {/* Color Palette Grid */}
            <div className="grid grid-cols-4 gap-2 mb-4">
              {PRESET_TAB_COLORS.map((col) => {
                const isSelected = (colorPickerSheet.color || null) === col.value;
                return (
                  <button
                    key={col.name}
                    type="button"
                    onClick={async () => {
                      if (onChangeSheetColor) {
                        await onChangeSheetColor(colorPickerSheet.id, col.value);
                      }
                      setColorPickerSheet(null);
                    }}
                    className={`h-9 rounded-xl flex items-center justify-center transition-all border ${
                      isSelected
                        ? "ring-2 ring-purple-600 scale-105 shadow-md border-transparent"
                        : "border-slate-200 hover:scale-105 hover:shadow-xs"
                    }`}
                    style={{
                      backgroundColor: col.value || "#f1f5f9",
                    }}
                    title={col.name}
                  >
                    {col.value === null ? (
                      <span className="text-[10px] font-bold text-slate-500">None</span>
                    ) : isSelected ? (
                      <Check className="h-4 w-4 text-white stroke-[3] drop-shadow-xs" />
                    ) : null}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={async () => {
                if (onChangeSheetColor) {
                  await onChangeSheetColor(colorPickerSheet.id, null);
                }
                setColorPickerSheet(null);
              }}
              className="w-full py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold text-xs rounded-xl transition-colors"
            >
              Reset to Default (No Colour)
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 2. DUPLICATE SHEET MODAL                                       */}
      {/* ============================================================== */}
      {duplicateModalSheet && (
        <div
          data-tab-modal="true"
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 animate-in fade-in duration-100"
          onClick={() => setDuplicateModalSheet(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <Copy className="h-4 w-4 text-emerald-600" />
                <h4 className="font-extrabold text-sm text-slate-900">Duplicate Sheet</h4>
              </div>
              <button
                onClick={() => setDuplicateModalSheet(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  New Sheet Name *
                </label>
                <input
                  type="text"
                  required
                  value={duplicateName}
                  onChange={(e) => setDuplicateName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                />
              </div>

              {/* Duplication Mode Option */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="dupMode"
                    checked={duplicateIncludeLeads}
                    onChange={() => setDuplicateIncludeLeads(true)}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Include All Leads & Data
                    </span>
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      Clones all {duplicateModalSheet.rowCount ?? 0} leads with sequential IDs and column setup.
                    </span>
                  </div>
                </label>

                <div className="border-t border-slate-200" />

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="dupMode"
                    checked={!duplicateIncludeLeads}
                    onChange={() => setDuplicateIncludeLeads(false)}
                    className="mt-0.5 text-emerald-600 focus:ring-emerald-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Structure Only (Empty Sheet)
                    </span>
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      Clones column definitions, dropdown choices & styles with zero leads.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isProcessing || !duplicateName.trim()}
                  onClick={handleConfirmDuplicate}
                  className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>{isProcessing ? "Duplicating..." : "Duplicate Sheet"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setDuplicateModalSheet(null)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. COPY SHEET TO MEMBER MODAL                                  */}
      {/* ============================================================== */}
      {copyModalSheet && (
        <div
          data-tab-modal="true"
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 animate-in fade-in duration-100"
          onClick={() => setCopyModalSheet(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-indigo-600" />
                <h4 className="font-extrabold text-sm text-slate-900">Copy Sheet to Member</h4>
              </div>
              <button
                onClick={() => setCopyModalSheet(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Destination Team Member *
                </label>
                <select
                  required
                  value={copyTargetUserId}
                  onChange={(e) => setCopyTargetUserId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-semibold text-slate-900"
                >
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  Sheet Tab Name for Member *
                </label>
                <input
                  type="text"
                  required
                  value={copySheetName}
                  onChange={(e) => setCopySheetName(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 font-medium text-slate-900"
                />
              </div>

              {/* Copy Mode */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="copyMode"
                    checked={copyIncludeLeads}
                    onChange={() => setCopyIncludeLeads(true)}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Include Existing Leads
                    </span>
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      Copies all {copyModalSheet.rowCount ?? 0} leads to destination member.
                    </span>
                  </div>
                </label>

                <div className="border-t border-slate-200" />

                <label className="flex items-start gap-2.5 cursor-pointer">
                  <input
                    type="radio"
                    name="copyMode"
                    checked={!copyIncludeLeads}
                    onChange={() => setCopyIncludeLeads(false)}
                    className="mt-0.5 text-indigo-600 focus:ring-indigo-500"
                  />
                  <div>
                    <span className="text-xs font-bold text-slate-900 block">
                      Structure Only (Clean Tab)
                    </span>
                    <span className="text-[11px] text-slate-500 block leading-tight">
                      Creates a clean, blank sheet with identical column definitions.
                    </span>
                  </div>
                </label>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isProcessing || !copySheetName.trim() || !copyTargetUserId}
                  onClick={handleConfirmCopy}
                  className="flex-1 py-2 bg-indigo-600 hover:bg-indigo-700 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>{isProcessing ? "Copying..." : "Copy to Member"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCopyModalSheet(null)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 4. REASSIGN SHEET OWNER MODAL                                  */}
      {/* ============================================================== */}
      {moveModalSheet && (
        <div
          data-tab-modal="true"
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 backdrop-blur-2xs p-4 animate-in fade-in duration-100"
          onClick={() => setMoveModalSheet(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-5 animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 mb-3">
              <div className="flex items-center gap-2">
                <ArrowRightLeft className="h-4 w-4 text-amber-600" />
                <h4 className="font-extrabold text-sm text-slate-900">Reassign Sheet Owner</h4>
              </div>
              <button
                onClick={() => setMoveModalSheet(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3">
              <p className="text-xs text-slate-600">
                Transfer ownership of sheet <strong className="text-slate-900">&quot;{moveModalSheet.name}&quot;</strong> and its{" "}
                <strong>{moveModalSheet.rowCount ?? 0} leads</strong> to another team member:
              </p>

              <div>
                <label className="block text-[11px] font-bold text-slate-700 mb-1">
                  New Assigned Member *
                </label>
                <select
                  required
                  value={moveTargetUserId}
                  onChange={(e) => setMoveTargetUserId(e.target.value)}
                  className="w-full px-3 py-2 text-xs bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-500 font-semibold text-slate-900"
                >
                  <option value="">-- Choose Member --</option>
                  {users.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  disabled={isProcessing || !moveTargetUserId}
                  onClick={handleConfirmMove}
                  className="flex-1 py-2 bg-amber-600 hover:bg-amber-700 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
                >
                  <Check className="h-4 w-4" />
                  <span>{isProcessing ? "Reassigning..." : "Confirm Reassign"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setMoveModalSheet(null)}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* 5. DELETE SHEET CONFIRMATION MODAL                             */}
      {/* ============================================================== */}
      {deleteConfirmSheet && (
        <div
          data-tab-modal="true"
          className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/50 backdrop-blur-2xs p-4 animate-in fade-in duration-100"
          onClick={() => setDeleteConfirmSheet(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl border border-rose-200 max-w-sm w-full p-5 animate-in zoom-in-95 duration-100"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 mb-3">
              <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div>
                <h4 className="font-extrabold text-sm text-slate-900">Delete Sheet Tab?</h4>
                <p className="text-xs text-rose-600 font-semibold">Destructive Action</p>
              </div>
            </div>

            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Are you sure you want to permanently delete sheet{" "}
              <strong className="text-slate-900">&quot;{deleteConfirmSheet.name}&quot;</strong>?
              All <strong>{deleteConfirmSheet.rowCount ?? 0} lead records</strong> in this tab will be permanently removed from the database. This action cannot be undone.
            </p>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={isProcessing}
                onClick={handleConfirmDelete}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 active:scale-95 disabled:opacity-50 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                <Trash2 className="h-4 w-4" />
                <span>{isProcessing ? "Deleting..." : "Permanently Delete"}</span>
              </button>
              <button
                type="button"
                onClick={() => setDeleteConfirmSheet(null)}
                className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-xl"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}