"use client";

import React, { useMemo } from "react";
import { SheetDetail, RowData, ColumnDef } from "@/lib/types";
import {
  isValidLead,
  getLeadSource,
  getLeadStatus,
  isUnattendedLead,
  isFollowupEmpty,
  rowMatchesStatusFilter,
  rowMatchesDateFilter,
  formatDateDisplay,
  filterSheetRows,
} from "@/lib/leads";
import { SOURCE_COLORS, STATUS_COLORS, DEFAULT_FOLLOWUP_OPTIONS } from "@/lib/defaults";
import {
  Phone,
  ChevronRight,
  ChevronDown,
  Plus,
  Users,
  Search,
  Sparkles,
  Calendar,
  X,
} from "lucide-react";

function formatAddedDate(createdAt?: string | Date | null): string {
  if (!createdAt) return "";
  const d = new Date(createdAt);
  if (isNaN(d.getTime())) return "";
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const now = new Date();
  if (d.getFullYear() !== now.getFullYear()) {
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }
  return `${d.getDate()} ${months[d.getMonth()]}`;
}

interface MobileLeadCardProps {
  lead: RowData;
  columns: ColumnDef[];
  onEditLead: (row: RowData) => void;
  onUpdateCell?: (rowId: string, columnId: string, value: string, order?: number) => Promise<void>;
  onUpdateLead?: (rowId: string, data: Record<string, string>, order?: number) => Promise<void>;
}

const MobileLeadCard = ({
  lead,
  columns,
  onEditLead,
  onUpdateCell,
  onUpdateLead,
}: MobileLeadCardProps) => {
  const nameCol = columns.find((c) => c.id === "col_name") || columns[4];
  const numberCol = columns.find((c) => c.id === "col_number") || columns[5];
  const nameKey = nameCol ? nameCol.id : "col_name";
  const numberKey = numberCol ? numberCol.id : "col_number";
  const name = lead.data[nameKey] || "Unnamed Lead";
  const number = lead.data[numberKey] || "No Phone Number";
  const initial = name.charAt(0).toUpperCase() || "?";

  const projectCol = columns.find(
    (c) => c.id === "col_project_name" || c.name.toLowerCase().includes("project")
  );
  const projectName =
    (projectCol ? lead.data[projectCol.id] : null) ||
    lead.data.col_project_name ||
    lead.data["Project Name"] ||
    lead.data["project_name"] ||
    null;

  const leadSource = getLeadSource(lead.data);
  const sourceStyle = leadSource ? SOURCE_COLORS[leadSource] : null;
  const addedDate = formatAddedDate(lead.createdAt);

  // Status tracking: synchronously derived from lead data and column definitions
  const currentStatus = getLeadStatus(lead.data, columns);
  const isUnattended = isUnattendedLead(lead.data, columns);
  const statusColors = currentStatus !== "Unassigned" ? STATUS_COLORS[currentStatus] : null;

  // Find all follow-up status dropdown columns in sequential order (1st, 2nd, 3rd, 4th)
  const followUpCols = useMemo(() => {
    return (columns || []).filter((c) => {
      const idLower = c.id.toLowerCase();
      const nameLower = c.name.toLowerCase();
      if (idLower.includes("source") || nameLower.includes("source")) return false;
      if (idLower.includes("budget") || nameLower.includes("budget")) return false;
      if (idLower.includes("date") || nameLower.includes("date")) return false;
      return (
        (c.type === "dropdown" && (idLower.includes("followup") || nameLower.includes("follow up"))) ||
        idLower.includes("followup")
      );
    });
  }, [columns]);

  // Find the active follow-up column (the latest one that has a recorded status, matching getLeadStatus)
  const activeFollowupCol = useMemo(() => {
    for (let i = followUpCols.length - 1; i >= 0; i--) {
      const col = followUpCols[i];
      const val = lead.data[col.id];
      if (val !== undefined && val !== null && !isFollowupEmpty(val)) {
        return col;
      }
    }
    return (
      followUpCols[0] || {
        id: "col_followup_1",
        name: "1st Follow Up",
        options: DEFAULT_FOLLOWUP_OPTIONS,
      }
    );
  }, [followUpCols, lead.data]);

  const followupOptions = useMemo(() => {
    return activeFollowupCol.options && activeFollowupCol.options.length > 0
      ? activeFollowupCol.options
      : DEFAULT_FOLLOWUP_OPTIONS;
  }, [activeFollowupCol]);

  return (
    <div
      onClick={() => onEditLead(lead)}
      className="bg-white rounded-xl px-3 py-2 sm:px-3.5 sm:py-2.5 border border-slate-200 shadow-2xs hover:shadow-xs active:bg-slate-50 transition-all cursor-pointer select-none"
    >
      <div className="flex items-center gap-2.5">
        {/* Left: Compact Avatar Initial */}
        <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-900 to-slate-800 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0 shadow-inner border border-slate-700">
          {initial}
        </div>

        {/* Center: Main Content (3 rows) */}
        <div className="min-w-0 flex-1 flex flex-col gap-1 leading-tight">
          {/* 1. Top Row: Strictly Lead Name & Status Dropdown / Badge */}
          <div className="flex items-center justify-between gap-1.5 min-w-0">
            <h4 className="text-sm font-bold text-slate-900 truncate leading-tight" title={name}>
              {name}
            </h4>

            {/* Quick Status Dropdown Pill: Triggers unified onUpdateCell handler */}
            <div
              className="relative inline-flex items-center shrink-0"
              onClick={(e) => e.stopPropagation()}
            >
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 shadow-2xs select-none transition-colors ${
                  isUnattended || currentStatus === "Unassigned"
                    ? "bg-amber-50 text-amber-900 border-amber-300"
                    : statusColors
                    ? `${statusColors.bg} ${statusColors.text} ${statusColors.border}`
                    : "bg-slate-100 text-slate-700 border-slate-300"
                }`}
              >
                <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                <span className="truncate max-w-[95px] sm:max-w-[130px]">
                  {isUnattended || currentStatus === "Unassigned" ? "Unattended" : currentStatus}
                </span>
                <ChevronDown className="h-2.5 w-2.5 opacity-60 shrink-0" />
              </span>

              {onUpdateCell && (
                <select
                  value={!isUnattended && currentStatus !== "Unassigned" ? currentStatus : ""}
                  onChange={async (e) => {
                    e.stopPropagation();
                    const newStatus = e.target.value;
                    if (!newStatus) {
                      // User selected Unattended / Clear status -> clear all follow-up columns so lead is truly unattended!
                      if (onUpdateLead) {
                        const cleared: Record<string, string> = {};
                        followUpCols.forEach((col) => {
                          cleared[col.id] = "";
                        });
                        await onUpdateLead(lead.id, cleared, lead.order);
                      } else if (onUpdateCell) {
                        await onUpdateCell(lead.id, activeFollowupCol.id, "", lead.order);
                      }
                    } else {
                      // Update the active follow-up column (or 1st follow up if unattended)
                      if (onUpdateCell) {
                        await onUpdateCell(lead.id, activeFollowupCol.id, newStatus, lead.order);
                      }
                    }
                  }}
                  onClick={(e) => e.stopPropagation()}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-xs"
                  title="Tap to change follow-up status"
                >
                  <option value="">Unattended (Clear status)</option>
                  {followupOptions.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              )}
            </div>
          </div>

          {/* 2. Middle Row: Phone Number + Project Name (left) & Call Button (right) */}
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
              <div className="flex items-center gap-1 font-mono text-[11px] sm:text-xs text-slate-600 shrink-0">
                <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                <span>{number}</span>
              </div>
              {projectName && (
                <>
                  <span className="text-slate-300 shrink-0">•</span>
                  <span
                    className="text-[11px] sm:text-xs text-slate-600 font-medium truncate"
                    title={`Project: ${projectName}`}
                  >
                    {projectName}
                  </span>
                </>
              )}
            </div>

            {number && number !== "No Phone Number" && (
              <a
                href={`tel:${number}`}
                onClick={(e) => e.stopPropagation()}
                className="h-8.5 w-8.5 sm:h-9 sm:w-9 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-300 transition-all shrink-0 shadow-xs active:scale-90"
                title={`Call ${number}`}
                aria-label={`Call ${number}`}
              >
                <Phone className="h-4.5 w-4.5 text-emerald-600 fill-emerald-100/40" />
              </a>
            )}
          </div>

          {/* 3. Bottom Row: Source + Date Only */}
          {(leadSource || addedDate) && (
            <div className="flex items-center justify-between gap-2 text-[10px] min-w-0 leading-tight pt-1 border-t border-slate-100">
              {leadSource ? (
                <span
                  className={`px-2 py-0.5 rounded-full font-semibold border flex items-center gap-1 shadow-2xs truncate max-w-[55%] ${
                    sourceStyle?.bg || "bg-indigo-50"
                  } ${sourceStyle?.text || "text-indigo-800 font-semibold"} ${
                    sourceStyle?.border || "border-indigo-200"
                  }`}
                  title={`Lead Source: ${leadSource}`}
                >
                  <Sparkles className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                  <span className="truncate">{leadSource}</span>
                </span>
              ) : (
                <span />
              )}

              {addedDate && (
                <span
                  className="text-slate-400 font-medium flex items-center gap-1 shrink-0 ml-auto whitespace-nowrap"
                  title={lead.createdAt ? `Lead added on ${new Date(lead.createdAt).toLocaleString("en-IN")}` : undefined}
                >
                  <Calendar className="h-2.5 w-2.5 text-slate-400" />
                  <span>Added {addedDate}</span>
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Strict memoization checking lead object and data references for zero-lag reactivity
const MemoizedMobileLeadCard = React.memo(
  MobileLeadCard,
  (prev, next) => {
    if (prev.lead !== next.lead) return false;
    if (prev.lead.id !== next.lead.id) return false;
    if (prev.lead.data !== next.lead.data) return false;
    if (JSON.stringify(prev.lead.data) !== JSON.stringify(next.lead.data)) return false;
    if (prev.lead.updatedAt !== next.lead.updatedAt) return false;
    if (prev.lead.createdAt !== next.lead.createdAt) return false;
    if (prev.columns !== next.columns) return false;
    if (prev.onUpdateCell !== next.onUpdateCell) return false;
    if (prev.onUpdateLead !== next.onUpdateLead) return false;
    if (prev.onEditLead !== next.onEditLead) return false;
    return true;
  }
);

interface MobileLeadListViewProps {
  sheet: SheetDetail;
  searchQuery: string;
  onSearchChange?: (query: string) => void;
  statusFilter?: string | null;
  dateFilter?: string | null;
  onSelectDate?: (date: string | null) => void;
  onEditLead: (row: RowData) => void;
  onAddNewLead: () => void;
  onUpdateCell?: (rowId: string, columnId: string, value: string, order?: number) => Promise<void>;
  onUpdateLead?: (rowId: string, data: Record<string, string>, order?: number) => Promise<void>;
}

export function MobileLeadListView({
  sheet,
  searchQuery,
  onSearchChange,
  statusFilter = null,
  dateFilter = null,
  onSelectDate,
  onEditLead,
  onAddNewLead,
  onUpdateCell,
  onUpdateLead,
}: MobileLeadListViewProps) {
  // Filter only rows that have actual valid lead data (name, number, project, or other non-empty field)
  // in their default sequential order as returned from the database
  const leads = useMemo(() => {
    return filterSheetRows(sheet.rows, sheet.columns, {
      dateFilter,
      statusFilter,
      searchQuery,
    });
  }, [sheet.rows, sheet.columns, searchQuery, statusFilter, dateFilter]);

  return (
    <div className="flex-1 flex flex-col bg-slate-100 overflow-y-auto relative pb-28">
      {/* Mobile Top Summary Pill */}
      <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between text-xs shadow-2xs sticky top-0 z-20">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-bold text-slate-900">{sheet.name}</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px] border border-amber-300">
            {leads.length} {leads.length === 1 ? "Lead" : "Leads"}
          </span>
          {dateFilter && (
            <span className="px-2 py-0.5 rounded-full bg-amber-50 text-amber-900 font-semibold text-[10px] border border-amber-300 flex items-center gap-1 shadow-2xs">
              <Calendar className="h-3 w-3 text-amber-600" />
              <span>{formatDateDisplay(dateFilter)}</span>
              <button
                type="button"
                onClick={() => onSelectDate?.(null)}
                className="p-0.5 hover:text-rose-600 rounded-full"
                title="Clear date filter"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
        </div>
        <span className="text-[11px] text-slate-500">Tap card to edit</span>
      </div>

      {/* Mobile In-Profile Search Bar: Instant search by name, number, or project */}
      {onSearchChange && (
        <div className="px-3 py-2 bg-white border-b border-slate-200 shadow-2xs sticky top-[41px] z-10">
          <div className="relative flex items-center">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="text"
              placeholder={`Search ${sheet.name}'s leads (phone, name, project)...`}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-9 pr-8 py-1.5 text-xs bg-slate-100 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange("")}
                className="absolute right-2.5 top-2 p-1 text-slate-400 hover:text-slate-700 rounded-full"
                title="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Cards List */}
      <div className="p-2 sm:p-3 space-y-1.5">
        {leads.length === 0 ? (
          <div className="mt-8 p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 shadow-xs flex flex-col items-center">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
              <Users className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              {searchQuery
                ? "No matching leads found"
                : statusFilter === "Unattended"
                ? "All leads have been attended! 🎉"
                : statusFilter
                ? `No leads with status "${statusFilter}"`
                : dateFilter
                ? `No leads added on ${formatDateDisplay(dateFilter)}`
                : "No leads in this sheet yet"}
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              {searchQuery
                ? "Try searching for a different name or number."
                : statusFilter === "Unattended"
                ? "Every lead in this sheet has at least one follow-up recorded."
                : statusFilter
                ? "Try selecting a different status option."
                : 'Tap the "➕ Add Lead" button below to record your first client in this sheet.'}
            </p>
            {!searchQuery && (
              <button
                onClick={onAddNewLead}
                className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all cursor-pointer"
              >
                <Plus className="h-4 w-4 text-amber-400" />
                <span>Add First Lead</span>
              </button>
            )}
          </div>
        ) : (
          leads.map((row) => (
            <MemoizedMobileLeadCard
              key={row.id}
              lead={row}
              columns={sheet.columns}
              onEditLead={onEditLead}
              onUpdateCell={onUpdateCell}
              onUpdateLead={onUpdateLead}
            />
          ))
        )}
      </div>

      {/* Floating Action Button (FAB) for Mobile View: ➕ Add Lead (Floats cleanly above compact bottom tab bar) */}
      <button
        onClick={onAddNewLead}
        className="fixed bottom-16 right-4 sm:right-6 z-40 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold px-4 py-3 rounded-full shadow-2xl border-2 border-amber-400/60 flex items-center gap-2 transition-all cursor-pointer group"
      >
        <div className="h-5 w-5 rounded-full bg-amber-400 text-slate-950 flex items-center justify-center font-extrabold text-xs">
          +
        </div>
        <span className="text-xs tracking-wide text-amber-300 font-bold">Add Lead</span>
      </button>
    </div>
  );
}
