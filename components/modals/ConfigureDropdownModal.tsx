"use client";

import React, { useState, useEffect } from "react";
import { ColumnDef } from "@/lib/types";
import { DEFAULT_FOLLOWUP_OPTIONS, DEFAULT_LEAD_SOURCES, DEFAULT_STATUS_FILTER_VISIBILITY, DEFAULT_SOURCE_FILTER_VISIBILITY } from "@/lib/defaults";
import { X, Plus, Trash2, Check, Settings2, Sparkles, Clock, Globe } from "lucide-react";

interface ColumnConfigState {
  options: string[];
  filterVisibility: Record<string, boolean>;
}

interface ConfigureDropdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  column: ColumnDef | null;
  columns?: ColumnDef[];
  isAdmin?: boolean;
  onSaveOptions: (
    columnId: string,
    options: string[],
    filterVisibility?: Record<string, boolean>,
    allColumnsToUpdate?: { columnId: string; options: string[]; filterVisibility: Record<string, boolean> }[]
  ) => Promise<void>;
}

export function ConfigureDropdownModal({
  isOpen,
  onClose,
  column,
  columns = [],
  isAdmin = true,
  onSaveOptions,
}: ConfigureDropdownModalProps) {
  // Find distinct configurable dropdown columns (consolidate follow-ups 1-4 into 1st Follow Up)
  const dropdownCols = React.useMemo(() => {
    const list: ColumnDef[] = [];
    const addedIds = new Set<string>();

    // 1. Follow-up status
    const followupCol =
      columns.find((c) => c.type === "dropdown" && c.id.includes("followup")) ||
      (column && column.id.includes("followup") ? column : null);

    if (followupCol) {
      list.push({
        ...followupCol,
        id: "col_followup_1",
        name: "Follow-Up Status",
      });
      addedIds.add("col_followup_1");
      addedIds.add("col_followup_2");
      addedIds.add("col_followup_3");
      addedIds.add("col_followup_4");
    }

    // 2. Lead Source
    const sourceCol =
      columns.find((c) => c.id === "col_lead_source" || c.name.toLowerCase().includes("source")) ||
      (column && (column.id === "col_lead_source" || column.name.toLowerCase().includes("source")) ? column : null);

    if (sourceCol) {
      list.push(sourceCol);
      addedIds.add(sourceCol.id);
    }

    // 3. Any remaining custom dropdown columns
    columns.forEach((c) => {
      if (c.type === "dropdown" && !addedIds.has(c.id)) {
        list.push(c);
        addedIds.add(c.id);
      }
    });

    if (column && !addedIds.has(column.id)) {
      list.push(column);
    }

    return list;
  }, [columns, column]);

  // Initial active column id
  const [activeColId, setActiveColId] = useState<string>("col_followup_1");

  // Multi-column config state
  const [configState, setConfigState] = useState<Record<string, ColumnConfigState>>({});
  const [newOption, setNewOption] = useState("");
  const [showInFilterBarDefault, setShowInFilterBarDefault] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Sync state whenever modal opens or column changes
  useEffect(() => {
    if (!isOpen) return;

    const initialMap: Record<string, ColumnConfigState> = {};

    dropdownCols.forEach((c) => {
      const isSource = c.id === "col_lead_source" || c.name.toLowerCase().includes("source");
      const isStatus = c.id.includes("followup") || c.name.toLowerCase().includes("status");

      const defaultOptions = isSource ? DEFAULT_LEAD_SOURCES : isStatus ? DEFAULT_FOLLOWUP_OPTIONS : [];
      const defaultVisibility = isSource ? DEFAULT_SOURCE_FILTER_VISIBILITY : isStatus ? DEFAULT_STATUS_FILTER_VISIBILITY : {};

      const currentOptions = Array.isArray(c.options) && c.options.length > 0 ? c.options : defaultOptions;
      const currentVis = c.filterVisibility || { ...defaultVisibility };

      // Ensure every option has a boolean visibility setting
      currentOptions.forEach((opt) => {
        if (currentVis[opt] === undefined) {
          currentVis[opt] = defaultVisibility[opt] !== undefined ? defaultVisibility[opt] : false;
        }
      });

      initialMap[c.id] = {
        options: [...currentOptions],
        filterVisibility: { ...currentVis },
      };
    });

    setConfigState(initialMap);

    // Pick target column: column passed in, or default to first
    if (column) {
      const match = dropdownCols.find((c) => c.id === column.id || (column.id.includes("followup") && c.id.includes("followup")));
      if (match) setActiveColId(match.id);
      else if (dropdownCols.length > 0) setActiveColId(dropdownCols[0].id);
    } else if (dropdownCols.length > 0) {
      setActiveColId(dropdownCols[0].id);
    }
  }, [isOpen, column, dropdownCols]);

  if (!isOpen) return null;

  const currentCol = dropdownCols.find((c) => c.id === activeColId) || dropdownCols[0];
  const currentConfig: ColumnConfigState = (currentCol && configState[currentCol.id]) || {
    options: [],
    filterVisibility: {},
  };

  const handleAddOption = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    const trimmed = newOption.trim();
    if (!trimmed) {
      setErrorMsg("Option name cannot be empty.");
      return;
    }
    if (!currentCol) return;

    // Strict case-insensitive duplicate check
    const isDuplicate = currentConfig.options.some(
      (opt) => opt.trim().toLowerCase() === trimmed.toLowerCase()
    );
    if (isDuplicate) {
      setErrorMsg(`"${trimmed}" already exists in ${currentCol.name}.`);
      return;
    }

    setConfigState((prev) => {
      const colId = currentCol.id;
      const existing = prev[colId] || { options: [], filterVisibility: {} };
      return {
        ...prev,
        [colId]: {
          options: [...existing.options, trimmed],
          // Respect the user's chosen default for filter bar visibility
          filterVisibility: {
            ...existing.filterVisibility,
            [trimmed]: showInFilterBarDefault,
          },
        },
      };
    });
    setNewOption("");
    setErrorMsg(null);
  };

  const handleToggleVisibility = (opt: string, isVisible: boolean) => {
    if (!currentCol) return;
    setConfigState((prev) => {
      const colId = currentCol.id;
      const existing = prev[colId] || { options: [], filterVisibility: {} };
      return {
        ...prev,
        [colId]: {
          ...existing,
          filterVisibility: {
            ...existing.filterVisibility,
            [opt]: isVisible,
          },
        },
      };
    });
  };

  const handleRemoveOption = (index: number) => {
    if (!currentCol) return;
    const optToRemove = currentConfig.options[index];
    setConfigState((prev) => {
      const colId = currentCol.id;
      const existing = prev[colId] || { options: [], filterVisibility: {} };
      const nextVis = { ...existing.filterVisibility };
      delete nextVis[optToRemove];
      return {
        ...prev,
        [colId]: {
          options: existing.options.filter((_, i) => i !== index),
          filterVisibility: nextVis,
        },
      };
    });
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const allToUpdate = Object.entries(configState).map(([colId, state]) => ({
        columnId: colId,
        options: state.options,
        filterVisibility: state.filterVisibility,
      }));

      await onSaveOptions(
        activeColId,
        currentConfig.options,
        currentConfig.filterVisibility,
        allToUpdate
      );
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const visibleCount = currentConfig.options.filter(
    (opt) => currentConfig.filterVisibility[opt] !== false
  ).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-3 sm:p-4">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Settings2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Customize Dropdowns & Filter Bar</h3>
              <p className="text-xs text-slate-300">
                Admin Control: Choose which chips appear in the top filter bar
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

        {/* Global Layout Notice for Admins */}
        <div className="px-6 py-2 bg-amber-50 border-b border-amber-200 flex items-center gap-2 text-xs text-amber-900 shrink-0">
          <Globe className="h-3.5 w-3.5 text-amber-600 shrink-0" />
          <span>
            <strong>Global Admin Setting:</strong> Changes saved here will instantly update the dashboard filter bar layout across all team member tabs.
          </span>
        </div>

        {/* Tabs for Column Selection */}
        {dropdownCols.length > 1 && (
          <div className="flex items-center gap-1 px-6 pt-3 border-b border-slate-200 bg-slate-50/70 shrink-0">
            {dropdownCols.map((col) => {
              const isSource = col.id === "col_lead_source" || col.name.toLowerCase().includes("source");
              const isSelected = activeColId === col.id;
              return (
                <button
                  type="button"
                  key={col.id}
                  onClick={() => {
                    setActiveColId(col.id);
                    setErrorMsg(null);
                  }}
                  className={`px-3.5 py-2 text-xs font-semibold rounded-t-lg border-b-2 flex items-center gap-1.5 transition-all cursor-pointer ${
                    isSelected
                      ? "border-amber-500 text-slate-900 bg-white shadow-2xs font-bold"
                      : "border-transparent text-slate-500 hover:text-slate-800 hover:bg-slate-100"
                  }`}
                >
                  {isSource ? (
                    <Sparkles className="h-3.5 w-3.5 text-indigo-500" />
                  ) : (
                    <Clock className="h-3.5 w-3.5 text-amber-500" />
                  )}
                  <span>{col.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1">
          {/* Instructions and Live Summary Pill */}
          <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
            <div>
              <h4 className="text-xs font-bold text-slate-800">
                {currentCol?.name} Options
              </h4>
              <p className="text-[11px] text-slate-500">
                Toggle the checkbox to show or hide the chip from the top dashboard bar.
              </p>
            </div>
            <div className="px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-[11px] font-semibold text-slate-700">
              <span className="text-emerald-700 font-bold">{visibleCount}</span> of {currentConfig.options.length} visible as chips
            </div>
          </div>

          {/* Add Option Form */}
          <form onSubmit={handleAddOption} className="space-y-2 mb-4">
            <div className="flex gap-2">
              <input
                type="text"
                placeholder={`Add new ${currentCol?.name.toLowerCase()} option (e.g. Hoarding)...`}
                value={newOption}
                onChange={(e) => {
                  setNewOption(e.target.value);
                  if (errorMsg) setErrorMsg(null);
                }}
                className={`flex-1 px-3 py-2 text-xs border rounded-lg focus:outline-none focus:ring-2 text-slate-800 font-medium ${
                  errorMsg
                    ? "border-rose-300 focus:ring-rose-500 bg-rose-50/20"
                    : "border-slate-300 focus:ring-amber-500"
                }`}
              />
              <button
                type="submit"
                disabled={!newOption.trim()}
                className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-bold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-2xs cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add</span>
              </button>
            </div>

            <div className="flex items-center justify-between px-1">
              <label className="flex items-center gap-2 text-[11px] font-semibold text-slate-600 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={showInFilterBarDefault}
                  onChange={(e) => setShowInFilterBarDefault(e.target.checked)}
                  className="h-3.5 w-3.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer accent-amber-500"
                />
                <span>Show in Dashboard Filter Bar by default</span>
              </label>

              {errorMsg && (
                <span className="text-[11px] font-bold text-rose-600 flex items-center gap-1">
                  ⚠️ {errorMsg}
                </span>
              )}
            </div>
          </form>

          {/* Options List with Checkbox Toggle */}
          <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 bg-slate-50/50 max-h-72 overflow-y-auto shadow-2xs">
            {currentConfig.options.length === 0 ? (
              <div className="p-6 text-center text-xs text-slate-400">
                No dropdown options configured. Add your first option above.
              </div>
            ) : (
              currentConfig.options.map((opt, idx) => {
                const isVisibleInBar = currentConfig.filterVisibility[opt] !== false;

                return (
                  <div
                    key={idx}
                    className={`px-3.5 py-2.5 flex items-center justify-between gap-3 transition-colors ${
                      isVisibleInBar ? "bg-white hover:bg-amber-50/30" : "bg-slate-50/80 hover:bg-slate-100/70"
                    }`}
                  >
                    {/* Left: Option Name */}
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span
                        className={`h-2 w-2 rounded-full shrink-0 ${
                          isVisibleInBar ? "bg-emerald-500" : "bg-slate-300"
                        }`}
                      />
                      <span className="text-xs font-semibold text-slate-800 truncate" title={opt}>
                        {opt}
                      </span>
                    </div>

                    {/* Right: Visibility Checkbox Toggle & Delete Button */}
                    <div className="flex items-center gap-2 shrink-0">
                      <label
                        className={`flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[11px] font-semibold transition-all cursor-pointer select-none ${
                          isVisibleInBar
                            ? "bg-emerald-50 border-emerald-300 text-emerald-800 shadow-2xs"
                            : "bg-slate-100 border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
                        }`}
                        title={
                          isVisibleInBar
                            ? "Currently showing as a quick chip in the top dashboard bar"
                            : "Currently hidden from quick chips (accessible under More Filters dropdown)"
                        }
                      >
                        <input
                          type="checkbox"
                          checked={isVisibleInBar}
                          onChange={(e) => handleToggleVisibility(opt, e.target.checked)}
                          className="h-3.5 w-3.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer accent-amber-500"
                        />
                        <span className="hidden sm:inline">Show in Dashboard Filter Bar</span>
                        <span className="sm:hidden">{isVisibleInBar ? "Shown" : "Hidden"}</span>
                      </label>

                      <button
                        type="button"
                        onClick={() => handleRemoveOption(idx)}
                        className="text-slate-400 hover:text-rose-600 p-1 rounded-md hover:bg-rose-50 transition-colors"
                        title="Remove option"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2.5 shrink-0">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Unselected options remain accessible via the <strong>&quot;More Filters&quot;</strong> dropdown.
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 text-xs font-bold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50 cursor-pointer"
            >
              {saving ? (
                <span className="inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              )}
              <span>Save & Apply Globally</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
