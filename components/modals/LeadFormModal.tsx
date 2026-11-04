"use client";

import React, { useState, useEffect } from "react";
import { RowData, ColumnDef } from "@/lib/types";
import { DEFAULT_FOLLOWUP_OPTIONS } from "@/lib/defaults";
import {
  X,
  Check,
  Trash2,
  Phone,
  User,
  Building,
  Maximize2,
  DollarSign,
  MapPin,
  Calendar,
  MessageSquare,
  Sparkles,
  AlertTriangle,
  AlertCircle,
} from "lucide-react";

interface LeadFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  lead: RowData | null;
  columns: ColumnDef[];
  sheetName: string;
  onSave: (data: Record<string, string>, rowId?: string) => Promise<void>;
  onDelete?: (rowId: string) => Promise<void>;
}

export function LeadFormModal({
  isOpen,
  onClose,
  lead,
  columns,
  sheetName,
  onSave,
  onDelete,
}: LeadFormModalProps) {
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [duplicateAlert, setDuplicateAlert] = useState<{ message: string } | null>(null);

  // Dynamic column lookup: by id first, then fallback to column position index
  const getCol = (colId: string, indexFallback?: number): ColumnDef | undefined => {
    const byId = columns.find((c) => c.id === colId);
    if (byId) return byId;
    if (indexFallback !== undefined && columns[indexFallback]) {
      return columns[indexFallback];
    }
    return undefined;
  };

  // Dynamic header label lookup bound directly to the desktop grid's column header state
  const getColName = (colId: string, indexFallback: number, fallback: string): string => {
    const col = getCol(colId, indexFallback);
    return col?.name?.trim() ? col.name : fallback;
  };

  // Dynamic dropdown options lookup bound to the column state
  const getColOptions = (colId: string, indexFallback: number): string[] => {
    const col = getCol(colId, indexFallback);
    return col?.options && col.options.length > 0 ? col.options : DEFAULT_FOLLOWUP_OPTIONS;
  };

  // Detect any additional custom columns added beyond the standard 16
  const standardIds = new Set([
    "col_name",
    "col_number",
    "col_lead_source",
    "col_project_name",
    "col_plot_size",
    "col_budget",
    "col_location",
    "col_followup_1",
    "col_followup_1_date",
    "col_followup_2",
    "col_followup_2_date",
    "col_followup_3",
    "col_followup_3_date",
    "col_followup_4",
    "col_followup_4_date",
    "col_remarks",
  ]);

  const customColumns = columns.filter(
    (col) => !standardIds.has(col.id)
  );

  useEffect(() => {
    if (lead) {
      setFormData({ ...lead.data });
    } else {
      setFormData({});
    }
    setError(null);
  }, [lead, isOpen]);

  if (!isOpen) return null;

  const handleChange = (columnId: string, value: string) => {
    setFormData((prev) => ({
      ...prev,
      [columnId]: value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const nameLabel = getColName("col_name", 4, "Name");
    const numberLabel = getColName("col_number", 5, "Number");

    if (!formData["col_name"]?.trim() && !formData["col_number"]?.trim()) {
      setError(`Please provide at least a ${nameLabel} or ${numberLabel} for the lead.`);
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onSave(formData, lead ? lead.id : undefined);
      onClose();
    } catch (err: any) {
      const msg = err.message || "Failed to save lead";
      setError(msg);
      if (msg.toLowerCase().includes("duplicate") || msg.toLowerCase().includes("already exists")) {
        setDuplicateAlert({ message: msg });
      }
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!lead || !onDelete) return;
    if (confirm("Are you sure you want to delete this lead?")) {
      setDeleting(true);
      try {
        await onDelete(lead.id);
        onClose();
      } catch (err: any) {
        setError(err.message || "Failed to delete lead");
      } finally {
        setDeleting(false);
      }
    }
  };

  const isEditing = !!lead;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-xs p-0 sm:p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg max-h-[92vh] sm:max-h-[88vh] flex flex-col overflow-hidden animate-in slide-in-from-bottom-8 sm:zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-amber-500/20 text-amber-400 flex items-center justify-center shrink-0 border border-amber-400/30">
              <User className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                {isEditing ? "Edit Lead Details" : "Add New Lead"}
              </h3>
              <p className="text-xs text-slate-300">
                Sheet: <span className="text-amber-400 font-semibold">{sheetName}</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Scrollable Form Body (All Fields Dynamically Bound to Grid Headers) */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
          {error && (
            <div
              className={`p-3.5 text-xs rounded-xl flex items-start gap-2.5 font-medium border animate-in fade-in ${
                error.toLowerCase().includes("duplicate") || error.toLowerCase().includes("already exists")
                  ? "bg-rose-50 border-rose-300 text-rose-900 ring-2 ring-rose-200"
                  : "bg-rose-50 border-rose-200 text-rose-700"
              }`}
            >
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div className="flex-1">
                <div className="font-bold">
                  {error.toLowerCase().includes("duplicate") || error.toLowerCase().includes("already exists")
                    ? "Duplicate Lead Conflict:"
                    : "Error:"}
                </div>
                <div className="mt-0.5 text-xs font-semibold">{error}</div>
              </div>
            </div>
          )}

          {/* Quick Call Action if editing and number exists */}
          {isEditing && formData["col_number"] && (
            <div className="flex items-center justify-between p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-emerald-900">
              <div className="flex items-center gap-2">
                <Phone className="h-4 w-4 text-emerald-600" />
                <span className="font-semibold text-xs">{formData["col_number"]}</span>
              </div>
              <a
                href={`tel:${formData["col_number"]}`}
                className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1 shadow-xs"
              >
                Call Now
              </a>
            </div>
          )}

          {/* SECTION 1: Lead Contact Information */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <User className="h-3.5 w-3.5 text-amber-600" />
              <span>Contact Details</span>
            </div>

            {/* Name Column - Dynamically bound to grid header */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {getColName("col_name", 4, "Name")} <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                required
                placeholder={`Enter ${getColName("col_name", 4, "Name").toLowerCase()}...`}
                value={formData["col_name"] || ""}
                onChange={(e) => handleChange("col_name", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
              />
            </div>

            {/* Number Column - Dynamically bound to grid header with duplicate validation highlight */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {getColName("col_number", 5, "Number")} <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Phone
                  className={`absolute left-3 top-2.5 h-4 w-4 ${
                    error && (error.toLowerCase().includes("duplicate") || error.toLowerCase().includes("already exists"))
                      ? "text-rose-500"
                      : "text-slate-400"
                  }`}
                />
                <input
                  type="tel"
                  placeholder="+91 98450 12345"
                  value={formData["col_number"] || ""}
                  onChange={(e) => {
                    handleChange("col_number", e.target.value);
                    if (error) setError(null);
                  }}
                  className={`w-full pl-9 pr-3 py-2 text-sm bg-white rounded-lg focus:outline-none focus:ring-2 text-slate-800 transition-all ${
                    error && (error.toLowerCase().includes("duplicate") || error.toLowerCase().includes("already exists"))
                      ? "border-2 border-rose-500 focus:ring-rose-400 bg-rose-50/40 text-rose-950 font-bold"
                      : "border border-slate-300 focus:ring-amber-500"
                  }`}
                />
              </div>
              {error && (error.toLowerCase().includes("duplicate") || error.toLowerCase().includes("already exists")) && (
                <p className="text-[11px] text-rose-600 font-bold mt-1 flex items-center gap-1">
                  <AlertTriangle className="h-3 w-3 shrink-0" />
                  <span>Conflict: This number already exists in the system</span>
                </p>
              )}
            </div>

            {/* Lead Source - Dynamically bound to grid header */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {getColName("col_lead_source", 6, "Lead Source")}
              </label>
              <select
                value={formData["col_lead_source"] || ""}
                onChange={(e) => handleChange("col_lead_source", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
              >
                <option value="">-- Select Lead Source --</option>
                {getColOptions("col_lead_source", 6).map((src) => (
                  <option key={src} value={src}>
                    {src}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* SECTION 2: Project & Requirement Information */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <Building className="h-3.5 w-3.5 text-blue-600" />
              <span>Project & Requirement</span>
            </div>

            {/* Project Name Column - Dynamically bound to grid header */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {getColName("col_project_name", 0, "Project Name")}
              </label>
              <input
                type="text"
                placeholder="e.g. Green Valley Phase 2, Urban Palms"
                value={formData["col_project_name"] || ""}
                onChange={(e) => handleChange("col_project_name", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
              />
            </div>

            {/* Enquired Plot Size Column - Dynamically bound to grid header */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                {getColName("col_plot_size", 1, "Enquired Plot Size")}
              </label>
              <input
                type="text"
                placeholder="e.g. 1200 sqft (30x40), 1500 sqft"
                value={formData["col_plot_size"] || ""}
                onChange={(e) => handleChange("col_plot_size", e.target.value)}
                className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Client Budget Column - Dynamically bound to grid header */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {getColName("col_budget", 2, "Client Budget")}
                </label>
                <input
                  type="text"
                  placeholder="e.g. ₹30-40 lakhs, ₹50-75L"
                  value={formData["col_budget"] || ""}
                  onChange={(e) => handleChange("col_budget", e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                />
              </div>

              {/* Client Location Column - Dynamically bound to grid header */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  {getColName("col_location", 3, "Client Location")}
                </label>
                <input
                  type="text"
                  placeholder="e.g. Whitefield, Sarjapur, HSR"
                  value={formData["col_location"] || ""}
                  onChange={(e) => handleChange("col_location", e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                />
              </div>
            </div>
          </div>

          {/* SECTION 3: The 4 Follow-Up Dropdowns & Date Pickers */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center justify-between">
              <div className="flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-purple-600" />
                <span>Follow-Up Stages & Scheduled Dates</span>
              </div>
              <span className="text-[10px] text-slate-400 font-normal">Next step reminders</span>
            </div>

            {/* 1st Follow Up */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">
                  {getColName("col_followup_1", 6, "1st Follow Up")}
                </span>
                <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-bold border border-purple-200">
                  Stage 1
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Status</label>
                  <select
                    value={formData["col_followup_1"] || ""}
                    onChange={(e) => handleChange("col_followup_1", e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                  >
                    <option value="">-- Select Status --</option>
                    {getColOptions("col_followup_1", 6).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    {getColName("col_followup_1_date", 7, "1st Follow Up Date")}
                  </label>
                  <input
                    type="date"
                    value={formData["col_followup_1_date"] || ""}
                    onChange={(e) => handleChange("col_followup_1_date", e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* 2nd Follow Up */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">
                  {getColName("col_followup_2", 8, "2nd Follow Up")}
                </span>
                <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-bold border border-purple-200">
                  Stage 2
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Status</label>
                  <select
                    value={formData["col_followup_2"] || ""}
                    onChange={(e) => handleChange("col_followup_2", e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                  >
                    <option value="">-- Select Status --</option>
                    {getColOptions("col_followup_2", 8).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    {getColName("col_followup_2_date", 9, "2nd Follow Up Date")}
                  </label>
                  <input
                    type="date"
                    value={formData["col_followup_2_date"] || ""}
                    onChange={(e) => handleChange("col_followup_2_date", e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* 3rd Follow Up */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">
                  {getColName("col_followup_3", 10, "3rd Follow Up")}
                </span>
                <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-bold border border-purple-200">
                  Stage 3
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Status</label>
                  <select
                    value={formData["col_followup_3"] || ""}
                    onChange={(e) => handleChange("col_followup_3", e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                  >
                    <option value="">-- Select Status --</option>
                    {getColOptions("col_followup_3", 10).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    {getColName("col_followup_3_date", 11, "3rd Follow Up Date")}
                  </label>
                  <input
                    type="date"
                    value={formData["col_followup_3_date"] || ""}
                    onChange={(e) => handleChange("col_followup_3_date", e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 font-medium"
                  />
                </div>
              </div>
            </div>

            {/* 4th Follow Up */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 shadow-2xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-xs text-slate-800">
                  {getColName("col_followup_4", 12, "4th Follow Up")}
                </span>
                <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded-full font-bold border border-purple-200">
                  Stage 4
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">Status</label>
                  <select
                    value={formData["col_followup_4"] || ""}
                    onChange={(e) => handleChange("col_followup_4", e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                  >
                    <option value="">-- Select Status --</option>
                    {getColOptions("col_followup_4", 12).map((opt) => (
                      <option key={opt} value={opt}>
                        {opt}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-500 mb-1">
                    {getColName("col_followup_4_date", 13, "4th Follow Up Date")}
                  </label>
                  <input
                    type="date"
                    value={formData["col_followup_4_date"] || ""}
                    onChange={(e) => handleChange("col_followup_4_date", e.target.value)}
                    className="w-full px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 font-medium"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: Remarks - Dynamically bound to grid header */}
          <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-2">
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
              <MessageSquare className="h-3.5 w-3.5 text-emerald-600" />
              <span>{getColName("col_remarks", 10, "Remarks")}</span>
            </div>
            <textarea
              rows={3}
              placeholder={`Enter ${getColName("col_remarks", 10, "Remarks").toLowerCase()}...`}
              value={formData["col_remarks"] || ""}
              onChange={(e) => handleChange("col_remarks", e.target.value)}
              className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
            />
          </div>

          {/* SECTION 5: Additional Custom Columns (if created by Admin) */}
          {customColumns.length > 0 && (
            <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200 space-y-3">
              <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-amber-600" />
                <span>Additional Fields</span>
              </div>
              {customColumns.map((col) => (
                <div key={col.id}>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    {col.name}
                  </label>
                  {col.type === "dropdown" ? (
                    <select
                      value={formData[col.id] || ""}
                      onChange={(e) => handleChange(col.id, e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                    >
                      <option value="">-- Select Option --</option>
                      {(col.options || []).map((opt) => (
                        <option key={opt} value={opt}>
                          {opt}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={col.type === "number" ? "number" : "text"}
                      placeholder={`Enter ${col.name.toLowerCase()}...`}
                      value={formData[col.id] || ""}
                      onChange={(e) => handleChange(col.id, e.target.value)}
                      className="w-full px-3 py-2 text-sm bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                    />
                  )}
                </div>
              ))}
            </div>
          )}
        </form>

        {/* Sticky Action Footer */}
        <div className="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3 shrink-0">
          {isEditing && onDelete ? (
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="px-3.5 py-2.5 text-rose-600 hover:bg-rose-50 rounded-xl font-semibold text-xs flex items-center gap-1.5 transition-colors border border-rose-200"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span>Delete</span>
            </button>
          ) : (
            <div />
          )}

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-slate-600 hover:text-slate-900 rounded-xl font-semibold text-xs transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSubmit}
              disabled={saving}
              className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-md hover:shadow-lg transition-all flex items-center gap-1.5 disabled:opacity-50"
            >
              {saving ? (
                <span className="inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="h-4 w-4 text-emerald-400" />
              )}
              <span>{isEditing ? "Save / Update Lead" : "Create Lead"}</span>
            </button>
          </div>
        </div>

      </div>

      {/* Prominent Duplicate Lead Popup Alert Modal */}
      {duplicateAlert && (
        <div className="fixed inset-0 z-60 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
          <div className="bg-white rounded-2xl shadow-2xl border-2 border-rose-300 max-w-md w-full p-5 flex flex-col gap-3.5 animate-in zoom-in-95 duration-100">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0 border border-rose-200 shadow-2xs">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <h4 className="font-extrabold text-sm sm:text-base text-rose-950 leading-tight">
                  Duplicate Lead Conflict
                </h4>
                <p className="text-[11px] text-rose-700 font-semibold mt-0.5">
                  Global Phone Number Match Detected
                </p>
              </div>
              <button
                type="button"
                onClick={() => setDuplicateAlert(null)}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-xs text-rose-900 font-bold leading-relaxed shadow-2xs">
              {duplicateAlert.message}
            </div>

            <p className="text-xs text-slate-600 font-normal leading-relaxed">
              Your entered lead information (client name, budget, plot size, remarks, etc.) has been <strong>safely preserved</strong> in this form. Please correct the phone number or verify if it was a typo.
            </p>

            <div className="pt-2 border-t border-slate-100 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setDuplicateAlert(null)}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 active:scale-95 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                <span>Edit &amp; Correct Number</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
