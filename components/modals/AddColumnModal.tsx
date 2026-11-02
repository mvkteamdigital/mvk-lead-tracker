"use client";

import React, { useState } from "react";
import { ColumnDef } from "@/lib/types";
import { X, Columns, Check } from "lucide-react";

interface AddColumnModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAddColumn: (col: ColumnDef) => Promise<void>;
}

export function AddColumnModal({
  isOpen,
  onClose,
  onAddColumn,
}: AddColumnModalProps) {
  if (!isOpen) return null;

  const [name, setName] = useState("");
  const [type, setType] = useState<"text" | "dropdown" | "number">("text");
  const [headerStyle, setHeaderStyle] = useState<"gold" | "navy" | "emerald" | "purple" | "default">("gold");
  const [dropdownOptionsText, setDropdownOptionsText] = useState("Interested, Call Back, Closed");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please provide a column name");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const colId = `col_${Date.now()}_${name.toLowerCase().replace(/[^a-z0-9]/g, "_")}`;
      const options =
        type === "dropdown"
          ? dropdownOptionsText
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];

      await onAddColumn({
        id: colId,
        name: name.trim(),
        type,
        width: 180,
        headerStyle,
        options,
      });

      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to add column");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="h-8 w-8 rounded-lg bg-amber-500/20 text-amber-400 flex items-center justify-center">
              <Columns className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Add New Column</h3>
              <p className="text-xs text-slate-300">Insert custom field to active sheet</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Column Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Lead Source, Property Type"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Column Data Type
            </label>
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: "text", label: "Text" },
                { id: "dropdown", label: "Dropdown" },
                { id: "number", label: "Number" },
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setType(item.id as any)}
                  className={`py-2 text-xs font-semibold rounded-lg border text-center transition-all ${
                    type === item.id
                      ? "bg-slate-900 text-white border-slate-900 shadow-sm"
                      : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                  }`}
                >
                  {item.label}
                </button>
              ))}
            </div>
          </div>

          {type === "dropdown" && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
                Initial Dropdown Choices (Comma-separated)
              </label>
              <textarea
                rows={3}
                value={dropdownOptionsText}
                onChange={(e) => setDropdownOptionsText(e.target.value)}
                placeholder="Option 1, Option 2, Option 3"
                className="w-full px-3.5 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
              />
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Header Color Theme
            </label>
            <div className="grid grid-cols-4 gap-2">
              {[
                { id: "gold", label: "Gold", bg: "bg-amber-100 border-amber-300 text-amber-900" },
                { id: "navy", label: "Navy", bg: "bg-slate-800 border-slate-900 text-white" },
                { id: "emerald", label: "Emerald", bg: "bg-emerald-100 border-emerald-300 text-emerald-900" },
                { id: "purple", label: "Purple", bg: "bg-purple-100 border-purple-300 text-purple-900" },
              ].map((style) => (
                <button
                  type="button"
                  key={style.id}
                  onClick={() => setHeaderStyle(style.id as any)}
                  className={`p-2 rounded-lg border text-xs font-medium text-center transition-all ${style.bg} ${
                    headerStyle === style.id ? "ring-2 ring-slate-900 ring-offset-1" : "opacity-75 hover:opacity-100"
                  }`}
                >
                  {style.label}
                </button>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? (
                <span className="inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <Check className="h-3.5 w-3.5 text-emerald-400" />
              )}
              <span>Create Column</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
