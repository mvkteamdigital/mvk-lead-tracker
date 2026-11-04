"use client";

import React, { useMemo } from "react";
import { SheetDetail, RowData, ColumnDef } from "@/lib/types";
import {
  isValidLead,
  getLeadStatus,
  getLeadFollowupDate,
  getLeadSource,
  isUnattendedLead,
  rowMatchesStatusFilter,
  rowMatchesDateFilter,
  formatDateDisplay,
} from "@/lib/leads";
import { STATUS_COLORS, SOURCE_COLORS } from "@/lib/defaults";
import {
  User,
  Phone,
  ChevronRight,
  Plus,
  Users,
  Search,
  Sparkles,
  Calendar,
  Building,
  X,
} from "lucide-react";

interface MobileLeadListViewProps {
  sheet: SheetDetail;
  searchQuery: string;
  onSearchChange?: (query: string) => void;
  statusFilter?: string | null;
  dateFilter?: string | null;
  onSelectDate?: (date: string | null) => void;
  onEditLead: (row: RowData) => void;
  onAddNewLead: () => void;
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
}: MobileLeadListViewProps) {
  // Filter only rows that have actual valid lead data (name, number, project, or other non-empty field)
  // and sort by creation date descending (newest leads always at the top of the mobile card feed)
  const leads = useMemo(() => {
    return sheet.rows
      .filter((r) => {
        if (!isValidLead(r.data)) return false;

        // Filter by date added if set
        if (dateFilter && !rowMatchesDateFilter(r.createdAt, dateFilter)) {
          return false;
        }

        if (statusFilter && !rowMatchesStatusFilter(r.data, statusFilter, sheet.columns)) {
          return false;
        }

        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return Object.values(r.data || {}).some((val) =>
          String(val || "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
  }, [sheet.rows, searchQuery, statusFilter, dateFilter, sheet.columns]);

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
      <div className="p-2.5 sm:p-4 space-y-2">
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
                className="mt-4 px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs rounded-xl flex items-center gap-1.5 shadow-md active:scale-95 transition-all"
              >
                <Plus className="h-4 w-4 text-amber-400" />
                <span>Add First Lead</span>
              </button>
            )}
          </div>
        ) : (
          leads.map((row, idx) => {
            const nameCol = sheet.columns.find((c) => c.id === "col_name") || sheet.columns[4];
            const numberCol = sheet.columns.find((c) => c.id === "col_number") || sheet.columns[5];
            const nameKey = nameCol ? nameCol.id : "col_name";
            const numberKey = numberCol ? numberCol.id : "col_number";
            const name = row.data[nameKey] || "Unnamed Lead";
            const number = row.data[numberKey] || "No Phone Number";
            const initial = name.charAt(0).toUpperCase() || "?";

            const projectCol = sheet.columns.find((c) => c.id === "col_project_name") || sheet.columns[0];
            const projectName = projectCol ? row.data[projectCol.id] : row.data["col_project_name"];

            const latestStatus = getLeadStatus(row.data, sheet.columns);
            const latestDate = getLeadFollowupDate(row.data, sheet.columns);
            const statusStyle = latestStatus !== "Unassigned" ? STATUS_COLORS[latestStatus] : null;

            const leadSource = getLeadSource(row.data);
            const sourceStyle = leadSource ? SOURCE_COLORS[leadSource] : null;

            return (
              <div
                key={row.id}
                onClick={() => onEditLead(row)}
                className="bg-white rounded-xl p-3 sm:p-3.5 border border-slate-200 shadow-2xs hover:shadow-xs active:bg-slate-50 active:scale-[0.99] transition-all flex items-center justify-between gap-2.5 cursor-pointer select-none"
              >
                {/* Left: Compact Avatar Initial & Details */}
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-slate-900 to-slate-800 text-amber-400 font-bold text-xs flex items-center justify-center shrink-0 shadow-inner border border-slate-700">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    {/* 1. Top Line: Inline Lead Name & Project Name */}
                    <div className="flex flex-row items-center gap-1.5 min-w-0 leading-tight">
                      <h4 className="text-sm font-bold text-slate-900 truncate max-w-[55%] shrink-0" title={name}>
                        {name}
                      </h4>
                      {projectName && (
                        <div className="flex items-center gap-1.5 min-w-0 flex-1 font-sans text-xs text-slate-500 font-medium">
                          <span className="text-slate-300 shrink-0">•</span>
                          <span className="truncate" title={projectName}>
                            {projectName}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* 2. Middle Line: Phone Number & Follow-up Status */}
                    <div className="flex flex-row items-center gap-2 text-xs text-slate-600 mt-1 flex-wrap">
                      <div className="flex items-center gap-1 font-mono text-[11px] text-slate-600 shrink-0">
                        <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                        <span>{number}</span>
                      </div>

                      {/* Status / Unattended Badge */}
                      {isUnattendedLead(row.data, sheet.columns) ? (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 bg-rose-50 text-rose-800 border-rose-300 shadow-2xs">
                          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-pulse" />
                          <span>Unattended</span>
                        </span>
                      ) : latestStatus !== "Unassigned" ? (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 shadow-2xs ${
                            statusStyle?.bg || "bg-slate-100"
                          } ${statusStyle?.text || "text-slate-800"} ${
                            statusStyle?.border || "border-slate-300"
                          }`}
                        >
                          <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                          <span className="truncate max-w-[130px]">{latestStatus}</span>
                        </span>
                      ) : null}

                      {/* Follow-Up Date */}
                      {latestDate && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1 shadow-2xs">
                          <Calendar className="h-2.5 w-2.5 text-blue-600" />
                          <span>{latestDate}</span>
                        </span>
                      )}
                    </div>

                    {/* 3. Bottom Line: Inline Primary Lead Source & Added Date */}
                    {(leadSource || row.createdAt) && (
                      <div className="flex flex-row items-center justify-between gap-2 mt-1.5 pt-1.5 border-t border-slate-100 text-[10px]">
                        {/* Primary Single Lead Source Badge */}
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

                        {/* Added Date */}
                        {row.createdAt && (
                          <span
                            className="text-slate-400 font-medium flex items-center gap-1 shrink-0 ml-auto"
                            title={`Lead added on ${new Date(row.createdAt).toLocaleString("en-IN")}`}
                          >
                            <Calendar className="h-2.5 w-2.5 text-slate-400" />
                            <span>Added {new Date(row.createdAt).toLocaleDateString("en-IN", { month: "short", day: "numeric" })}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Quick Call & Edit Arrow */}
                <div className="flex items-center gap-1.5 shrink-0">
                  {number && number !== "No Phone Number" && (
                    <a
                      href={`tel:${number}`}
                      onClick={(e) => e.stopPropagation()}
                      className="h-7 w-7 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200 transition-colors"
                      title="Call Lead"
                    >
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                  )}
                  <div className="h-7 w-7 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center">
                    <ChevronRight className="h-3.5 w-3.5" />
                  </div>
                </div>
              </div>
            );
          })
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
