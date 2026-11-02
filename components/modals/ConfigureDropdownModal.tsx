"use client";

import React, { useState } from "react";
import { ColumnDef } from "@/lib/types";
import { X, Plus, Trash2, Check, Settings2, Sparkles } from "lucide-react";

interface ConfigureDropdownModalProps {
  isOpen: boolean;
  onClose: () => void;
  column: ColumnDef | null;
  onSaveOptions: (columnId: string, options: string[]) => Promise<void>;
}

export function ConfigureDropdownModal({
  isOpen,
  onClose,
  column,
  onSaveOptions,
}: ConfigureDropdownModalProps) {
  if (!isOpen || !column) return null;

  const [options, setOptions] = useState<string[]>(column.options || []);
  const [newOption, setNewOption] = useState("");
  const [saving, setSaving] = useState(false);

  const handleAddOption = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newOption.trim();
    if (!trimmed) return;
    if (options.includes(trimmed)) return;
    setOptions([...options, trimmed]);
    setNewOption("");
  };

  const handleRemoveOption = (index: number) => {
    setOptions(options.filter((_, i) => i !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSaveOptions(column.id, options);
      onClose();
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
              <Settings2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Configure Dropdown Options</h3>
              <p className="text-xs text-slate-300">
                Column: <span className="text-amber-400 font-semibold">{column.name}</span>
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

        {/* Content */}
        <div className="p-6">
          <p className="text-xs text-slate-600 mb-4 leading-relaxed">
            Customize the available status choices for this column. Any updates are saved directly to the database and will immediately reflect in the cell dropdown menus without editing code.
          </p>

          {/* Add Option Form */}
          <form onSubmit={handleAddOption} className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="e.g. Site Visit Re-scheduled"
              value={newOption}
              onChange={(e) => setNewOption(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
            />
            <button
              type="submit"
              disabled={!newOption.trim()}
              className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-slate-950 font-semibold text-xs rounded-lg flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>Add</span>
            </button>
          </form>

          {/* Options List */}
          <div className="border border-slate-200 rounded-lg max-h-60 overflow-y-auto divide-y divide-slate-100 bg-slate-50/50">
            {options.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-400">
                No dropdown options configured. Add your first option above.
              </div>
            ) : (
              options.map((opt, idx) => (
                <div
                  key={idx}
                  className="px-3.5 py-2 flex items-center justify-between hover:bg-white transition-colors group"
                >
                  <span className="text-sm font-medium text-slate-700 flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-slate-400 group-hover:bg-amber-500 transition-colors" />
                    {opt}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleRemoveOption(idx)}
                    className="text-slate-400 hover:text-rose-600 p-1 rounded hover:bg-rose-50 transition-colors"
                    title="Remove option"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-200 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-white rounded-lg flex items-center gap-1.5 transition-colors shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <span className="inline-block h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5 text-emerald-400" />
            )}
            <span>Save Options</span>
          </button>
        </div>

      </div>
    </div>
  );
}
