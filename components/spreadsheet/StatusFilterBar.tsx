"use client";

import React, { useRef } from "react";
import { STATUS_COLORS } from "@/lib/defaults";
import { Users, Filter, X, ChevronLeft, ChevronRight, Settings2 } from "lucide-react";

interface StatusFilterBarProps {
  totalLeads: number;
  availableStatuses: string[];
  statusCounts: Record<string, number>;
  activeFilter: string | null;
  onSelectFilter: (status: string | null) => void;
  onOpenDropdownModal?: () => void;
}

// Fallback color palettes for custom dropdown options added dynamically by users
const FALLBACK_PALETTES = [
  { bg: "bg-cyan-50", text: "text-cyan-800 font-medium", border: "border-cyan-300" },
  { bg: "bg-teal-50", text: "text-teal-800 font-medium", border: "border-teal-300" },
  { bg: "bg-violet-50", text: "text-violet-800 font-medium", border: "border-violet-300" },
  { bg: "bg-pink-50", text: "text-pink-800 font-medium", border: "border-pink-300" },
  { bg: "bg-lime-50", text: "text-lime-800 font-medium", border: "border-lime-300" },
  { bg: "bg-fuchsia-50", text: "text-fuchsia-800 font-medium", border: "border-fuchsia-300" },
];

export function StatusFilterBar({
  totalLeads,
  availableStatuses,
  statusCounts,
  activeFilter,
  onSelectFilter,
  onOpenDropdownModal,
}: StatusFilterBarProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  const scroll = (direction: "left" | "right") => {
    if (scrollRef.current) {
      const offset = direction === "left" ? -200 : 200;
      scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
    }
  };

  const getStatusColor = (status: string, index: number) => {
    if (STATUS_COLORS[status]) return STATUS_COLORS[status];
    return FALLBACK_PALETTES[index % FALLBACK_PALETTES.length];
  };

  const unassignedCount = statusCounts["Unassigned"] || 0;

  return (
    <div className="bg-white border-b border-slate-200 px-3 sm:px-4 py-2 flex items-center gap-2 select-none shadow-2xs shrink-0 z-20">
      
      {/* Filter Label Icon on Desktop */}
      <div className="hidden sm:flex items-center gap-1 text-slate-400 shrink-0 text-xs font-semibold mr-1">
        <Filter className="h-3.5 w-3.5 text-amber-500" />
        <span className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Status:</span>
      </div>

      {/* Scroll Left Button */}
      <button
        type="button"
        onClick={() => scroll("left")}
        className="hidden md:flex p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
        title="Scroll status filters left"
      >
        <ChevronLeft className="h-3.5 w-3.5" />
      </button>

      {/* Main Filter Badges Scroll Container */}
      <div
        ref={scrollRef}
        className="flex-1 flex items-center gap-1.5 overflow-x-auto no-scrollbar scroll-smooth py-0.5"
        style={{ scrollbarWidth: "none" }}
      >
        {/* 1. Total Lead Count Badge (e.g., "29 Leads" / All Filter) */}
        <button
          type="button"
          onClick={() => onSelectFilter(null)}
          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 shrink-0 cursor-pointer ${
            activeFilter === null
              ? "bg-slate-900 text-white shadow-xs ring-2 ring-slate-900 ring-offset-1"
              : "bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200"
          }`}
          title="Show all leads"
        >
          <Users className="h-3.5 w-3.5 text-amber-400 shrink-0" />
          <span className="whitespace-nowrap">{totalLeads} {totalLeads === 1 ? "Lead" : "Leads"}</span>
          <span
            className={`text-[10px] px-1.5 py-0.2 rounded-full font-extrabold ${
              activeFilter === null
                ? "bg-amber-400 text-slate-950"
                : "bg-slate-200 text-slate-700"
            }`}
          >
            All
          </span>
        </button>

        <div className="h-4 w-px bg-slate-200 shrink-0 mx-1" />

        {/* 2. Dynamic Status Badges with Live Summary Counts */}
        {availableStatuses.map((status, idx) => {
          const count = statusCounts[status] || 0;
          const isSelected = activeFilter === status;
          const color = getStatusColor(status, idx);

          return (
            <button
              type="button"
              key={status}
              onClick={() => onSelectFilter(isSelected ? null : status)}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer ${
                isSelected
                  ? `ring-2 ring-blue-600 font-bold shadow-xs ${color.bg} ${color.text} ${color.border}`
                  : `${color.bg} ${color.text} ${color.border} hover:brightness-95 opacity-90 hover:opacity-100`
              }`}
              title={`Filter by ${status} (${count} leads)`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80 shrink-0" />
              <span className="truncate max-w-[150px] sm:max-w-none">{status}:</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                  isSelected
                    ? "bg-slate-900 text-white"
                    : "bg-white/90 text-slate-900 shadow-2xs border border-slate-200/60"
                }`}
              >
                {count}
              </span>
              {isSelected && (
                <X className="h-3 w-3 ml-0.5 opacity-70 hover:opacity-100" />
              )}
            </button>
          );
        })}

        {/* 3. Unassigned / Pending Count Badge (if any leads without status exist) */}
        {unassignedCount > 0 && (
          <button
            type="button"
            onClick={() => onSelectFilter(activeFilter === "Unassigned" ? null : "Unassigned")}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 border cursor-pointer ${
              activeFilter === "Unassigned"
                ? "ring-2 ring-blue-600 font-bold shadow-xs bg-slate-200 text-slate-900 border-slate-400"
                : "bg-slate-100 text-slate-600 border-slate-300 hover:bg-slate-200"
            }`}
            title={`Filter by Pending / Unassigned (${unassignedCount} leads)`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-slate-400 shrink-0" />
            <span className="whitespace-nowrap">Pending / New:</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                activeFilter === "Unassigned"
                  ? "bg-slate-900 text-white"
                  : "bg-white text-slate-800 border border-slate-200"
              }`}
            >
              {unassignedCount}
            </span>
            {activeFilter === "Unassigned" && (
              <X className="h-3 w-3 ml-0.5 opacity-70 hover:opacity-100" />
            )}
          </button>
        )}
      </div>

      {/* Scroll Right Button */}
      <button
        type="button"
        onClick={() => scroll("right")}
        className="hidden md:flex p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-700 transition-colors shrink-0"
        title="Scroll status filters right"
      >
        <ChevronRight className="h-3.5 w-3.5" />
      </button>

      {/* Clear Filter Shortcut (if active) */}
      {activeFilter && (
        <button
          type="button"
          onClick={() => onSelectFilter(null)}
          className="text-xs text-rose-600 hover:text-rose-700 font-bold px-2 py-1 rounded hover:bg-rose-50 transition-colors shrink-0 flex items-center gap-1"
          title="Reset filter to show all leads"
        >
          <X className="h-3 w-3" />
          <span className="hidden sm:inline">Clear Filter</span>
        </button>
      )}

      {/* Customize Dropdowns Button Shortcut */}
      {onOpenDropdownModal && (
        <button
          type="button"
          onClick={onOpenDropdownModal}
          className="hidden xl:flex items-center gap-1 text-[11px] font-semibold text-slate-500 hover:text-amber-700 hover:bg-amber-50 px-2 py-1 rounded border border-dashed border-slate-300 transition-colors shrink-0"
          title="Add or edit dropdown choices in the Customize Dropdowns menu"
        >
          <Settings2 className="h-3 w-3 text-amber-600" />
          <span>Customize Options</span>
        </button>
      )}

    </div>
  );
}
