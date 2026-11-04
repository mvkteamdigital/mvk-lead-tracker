"use client";

import React, { useMemo } from "react";
import { SheetDetail, RowData, ColumnDef } from "@/lib/types";
import { isValidLead, getLeadStatus, getLeadFollowupDate, rowMatchesStatusFilter } from "@/lib/leads";
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
  onEditLead: (row: RowData) => void;
  onAddNewLead: () => void;
}

export function MobileLeadListView({
  sheet,
  searchQuery,
  onSearchChange,
  statusFilter = null,
  onEditLead,
  onAddNewLead,
}: MobileLeadListViewProps) {
  // Filter only rows that have actual valid lead data (name, number, project, or other non-empty field)
  const leads = useMemo(() => {
    return sheet.rows.filter((r) => {
      if (!isValidLead(r.data)) return false;

      if (statusFilter && !rowMatchesStatusFilter(r.data, statusFilter, sheet.columns)) {
        return false;
      }

      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return Object.values(r.data || {}).some((val) =>
        String(val || "").toLowerCase().includes(q)
      );
    });
  }, [sheet.rows, searchQuery, statusFilter, sheet.columns]);

  return (
    <div className="flex-1 flex flex-col bg-slate-100 overflow-y-auto relative pb-28">
      {/* Mobile Top Summary Pill */}
      <div className="px-4 py-2.5 bg-white border-b border-slate-200 flex items-center justify-between text-xs shadow-2xs sticky top-0 z-20">
        <div className="flex items-center gap-2">
          <span className="font-bold text-slate-900">{sheet.name}</span>
          <span className="px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[10px] border border-amber-300">
            {leads.length} {leads.length === 1 ? "Lead" : "Leads"}
          </span>
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
      <div className="p-3 sm:p-4 space-y-2.5">
        {leads.length === 0 ? (
          <div className="mt-8 p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 shadow-xs flex flex-col items-center">
            <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-3">
              <Users className="h-6 w-6" />
            </div>
            <h4 className="text-sm font-bold text-slate-800">
              {searchQuery ? "No matching leads found" : "No leads in this sheet yet"}
            </h4>
            <p className="text-xs text-slate-500 mt-1 max-w-xs">
              {searchQuery
                ? "Try searching for a different name or number."
                : "Tap the \"➕ Add Lead\" button below to record your first client in this sheet."}
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

            const leadSource = row.data["col_lead_source"];
            const sourceStyle = leadSource ? SOURCE_COLORS[leadSource] : null;

            return (
              <div
                key={row.id}
                onClick={() => onEditLead(row)}
                className="bg-white rounded-xl p-3.5 border border-slate-200 shadow-2xs hover:shadow-xs active:bg-slate-50 active:scale-[0.99] transition-all flex items-center justify-between gap-3 cursor-pointer select-none"
              >
                {/* Left: Avatar Initial & Name + Details */}
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-slate-900 to-slate-800 text-amber-400 font-bold text-sm flex items-center justify-center shrink-0 shadow-inner border border-slate-700">
                    {initial}
                  </div>
                  <div className="min-w-0 flex-1">
                    {/* Name */}
                    <h4 className="text-sm font-bold text-slate-900 truncate leading-snug">
                      {name}
                    </h4>

                    {/* Number & Project */}
                    <div className="flex items-center gap-2 text-xs text-slate-600 font-mono mt-0.5 flex-wrap">
                      <div className="flex items-center gap-1">
                        <Phone className="h-3 w-3 text-slate-400 shrink-0" />
                        <span className="truncate">{number}</span>
                      </div>
                      {projectName && (
                        <div className="flex items-center gap-1 font-sans text-slate-500 font-normal">
                          <span className="text-slate-300">•</span>
                          <span className="truncate max-w-[120px]">{projectName}</span>
                        </div>
                      )}
                    </div>

                    {/* Badges: Lead Source, Status & Follow-Up Date */}
                    {(latestStatus !== "Unassigned" || latestDate || leadSource) && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-2">
                        {leadSource && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 shadow-2xs ${
                              sourceStyle?.bg || "bg-indigo-50"
                            } ${sourceStyle?.text || "text-indigo-800 font-semibold"} ${
                              sourceStyle?.border || "border-indigo-200"
                            }`}
                          >
                            <Sparkles className="h-2.5 w-2.5 text-amber-500 shrink-0" />
                            <span className="truncate max-w-[120px]">{leadSource}</span>
                          </span>
                        )}
                        {latestStatus !== "Unassigned" && (
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold border flex items-center gap-1 ${
                              statusStyle?.bg || "bg-slate-100"
                            } ${statusStyle?.text || "text-slate-800"} ${
                              statusStyle?.border || "border-slate-300"
                            }`}
                          >
                            <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
                            <span className="truncate max-w-[140px]">{latestStatus}</span>
                          </span>
                        )}
                        {latestDate && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-50 text-blue-800 border border-blue-200 flex items-center gap-1">
                            <Calendar className="h-2.5 w-2.5 text-blue-600" />
                            <span>{latestDate}</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Quick Call & Edit Arrow */}
                <div className="flex items-center gap-2 shrink-0">
                  {number && number !== "No Phone Number" && (
                    <a
                      href={`tel:${number}`}
                      onClick={(e) => e.stopPropagation()}
                      className="h-8 w-8 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 flex items-center justify-center border border-emerald-200 transition-colors"
                      title="Call Lead"
                    >
                      <Phone className="h-4 w-4" />
                    </a>
                  )}
                  <div className="h-8 w-8 rounded-lg bg-slate-100 text-slate-400 flex items-center justify-center">
                    <ChevronRight className="h-4 w-4" />
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
