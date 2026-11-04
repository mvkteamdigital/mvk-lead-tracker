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
} from "lucide-react";

interface BottomTabBarProps {
  sheets: SheetMeta[];
  activeSheetId: string | null;
  onSelectSheet: (id: string) => void;
  isAdmin: boolean;
  onOpenNewSheetModal: () => void;
  onRenameSheet: (id: string, newName: string) => Promise<void>;
  onDeleteSheet: (id: string) => Promise<void>;
  onReorderSheets?: (reorderedSheets: SheetMeta[]) => Promise<void> | void;
}

export function BottomTabBar({
  sheets,
  activeSheetId,
  onSelectSheet,
  isAdmin,
  onOpenNewSheetModal,
  onRenameSheet,
  onDeleteSheet,
  onReorderSheets,
}: BottomTabBarProps) {
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const [menuSheetId, setMenuSheetId] = useState<string | null>(null);
  const [renamingSheetId, setRenamingSheetId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Drag and drop tab reordering state
  const [draggedSheetIdx, setDraggedSheetIdx] = useState<number | null>(null);
  const [dragOverSheetIdx, setDragOverSheetIdx] = useState<number | null>(null);

  // Close context menu on outside click
  useEffect(() => {
    const handleDocumentClick = () => {
      setMenuSheetId(null);
    };
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
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

  // Move sheet left or right programmatically (great for mobile/touch or quick sorting)
  const handleMoveSheet = async (sheetIndex: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? sheetIndex - 1 : sheetIndex + 1;
    if (targetIndex < 0 || targetIndex >= sheets.length) return;
    const updated = [...sheets];
    const [moved] = updated.splice(sheetIndex, 1);
    updated.splice(targetIndex, 0, moved);
    if (onReorderSheets) {
      await onReorderSheets(updated);
    }
    setMenuSheetId(null);
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
    setMenuSheetId(null);
  };

  const handleSaveRename = async (id: string) => {
    if (renameValue.trim()) {
      await onRenameSheet(id, renameValue.trim());
    }
    setRenamingSheetId(null);
  };

  return (
    <footer className="h-10 bg-slate-900 border-t border-slate-800 text-white flex items-stretch select-none shrink-0 sticky bottom-0 z-30 shadow-lg w-full">
      
      {/* Left Role & Mode Badge (Compact) */}
      <div className="px-2 sm:px-2.5 flex items-center gap-1.5 border-r border-slate-800 bg-slate-950/70 shrink-0">
        {isAdmin ? (
          <div className="flex items-center gap-1.5" title="Admin Role: CEO / Manager with global access to all team sheets">
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
          <div className="flex items-center gap-1.5" title="Member Role: Private Sheet (All other team tabs hidden)">
            <div className="h-5 w-5 rounded bg-blue-500/20 text-blue-400 border border-blue-500/30 flex items-center justify-center shrink-0">
              <Lock className="h-3 w-3" />
            </div>
            <div className="hidden sm:block">
              <div className="text-[10px] font-bold text-blue-400 uppercase tracking-wider leading-none">
                Private
              </div>
              <div className="text-[9px] text-slate-400 leading-none mt-0.5">Private Sheet</div>
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

      {/* Main Large Sheet Tabs Scroll Container with Touch Scrolling */}
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
              className={`group relative flex items-center gap-1.5 px-2.5 sm:px-3 py-1 cursor-grab active:cursor-grabbing border-r border-slate-800 transition-all min-w-[95px] sm:min-w-[120px] max-w-[210px] shrink-0 active:bg-slate-850 select-none ${
                isActive
                  ? "bg-slate-800 text-white font-bold border-b-2 border-b-amber-400 shadow-inner"
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
              title={`${s.name} (drag left/right to reorder)`}
            >
              {/* Active Tab Accent Bar */}
              {isActive && (
                <div className="absolute top-0 left-0 right-0 h-0.5 bg-amber-400" />
              )}

              {/* Grip Vertical Handle Icon */}
              {!isRenaming && (
                <GripVertical className="h-3 w-3 text-slate-500 group-hover:text-amber-400 opacity-30 group-hover:opacity-90 shrink-0 transition-opacity" />
              )}

              {/* Tab Title or Inline Rename Input */}
              {isRenaming ? (
                <div
                  className="flex items-center gap-1 flex-1"
                  onClick={(e) => e.stopPropagation()}
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
                    className="p-0.5 hover:text-emerald-400"
                  >
                    <Check className="h-3 w-3" />
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5 flex-1 truncate">
                  <span className="text-xs sm:text-sm tracking-tight truncate leading-none">
                    {s.name}
                  </span>
                  
                  {/* Lead Count Badge */}
                  {s.rowCount !== undefined && (
                    <span
                      className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold shrink-0 min-w-[16px] text-center leading-tight ${
                        isActive
                          ? "bg-amber-400 text-slate-950"
                          : "bg-slate-800 text-slate-400 group-hover:bg-slate-700"
                      }`}
                    >
                      {s.rowCount}
                    </span>
                  )}
                </div>
              )}

              {/* Tab Options / Actions Trigger */}
              {!isRenaming && (
                <div
                  className="relative shrink-0"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() =>
                      setMenuSheetId(menuSheetId === s.id ? null : s.id)
                    }
                    className="p-0.5 rounded text-slate-500 hover:text-white hover:bg-slate-700 transition-colors opacity-40 group-hover:opacity-100"
                    title="Tab options & reorder"
                  >
                    <MoreVertical className="h-3 w-3" />
                  </button>

                  {/* Dropdown Menu */}
                  {menuSheetId === s.id && (
                    <div className="absolute bottom-full right-0 mb-1.5 w-44 bg-white rounded-xl shadow-2xl border border-slate-200 py-1 z-50 text-slate-800 animate-in fade-in zoom-in-95 text-xs">
                      <div className="px-2.5 py-1 text-[9px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 truncate">
                        Tab: {s.name}
                      </div>

                      {/* Move Left / Right actions (Great for mobile & accessibility) */}
                      {idx > 0 && (
                        <button
                          onClick={() => handleMoveSheet(idx, "left")}
                          className="w-full px-2.5 py-1.5 text-left hover:bg-slate-100 flex items-center gap-1.5 font-medium text-slate-700"
                        >
                          <ArrowLeft className="h-3 w-3 text-amber-600" />
                          <span>Move Tab Left</span>
                        </button>
                      )}
                      {idx < sheets.length - 1 && (
                        <button
                          onClick={() => handleMoveSheet(idx, "right")}
                          className="w-full px-2.5 py-1.5 text-left hover:bg-slate-100 flex items-center gap-1.5 font-medium text-slate-700"
                        >
                          <ArrowRight className="h-3 w-3 text-amber-600" />
                          <span>Move Tab Right</span>
                        </button>
                      )}

                      {isAdmin && (
                        <>
                          <div className="border-t border-slate-100 my-0.5" />
                          <button
                            onClick={() => handleStartRename(s)}
                            className="w-full px-2.5 py-1 text-left hover:bg-slate-100 flex items-center gap-1.5 font-medium"
                          >
                            <Edit2 className="h-3 w-3 text-blue-600" />
                            <span>Rename Sheet</span>
                          </button>
                          {sheets.length > 1 && (
                            <button
                              onClick={() => {
                                if (
                                  confirm(
                                    `Are you sure you want to delete tab "${s.name}"? All lead records in this tab will be permanently removed.`
                                  )
                                ) {
                                  onDeleteSheet(s.id);
                                }
                                setMenuSheetId(null);
                              }}
                              className="w-full px-2.5 py-1 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-1.5 font-medium"
                            >
                              <Trash2 className="h-3 w-3" />
                              <span>Delete Sheet</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
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
  );
}
