"use client";

import React, { useState, useEffect } from "react";
import { X, Plus, FileSpreadsheet, Check } from "lucide-react";

interface NewSheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreateSheet: (name: string, userId?: string) => Promise<void>;
}

export function NewSheetModal({
  isOpen,
  onClose,
  onCreateSheet,
}: NewSheetModalProps) {
  if (!isOpen) return null;

  const [name, setName] = useState("");
  const [userId, setUserId] = useState<string>("");
  const [users, setUsers] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : { users: [] }))
      .then((data) => setUsers(data.users || []))
      .catch(() => {});
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError("Please enter a sheet name");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      await onCreateSheet(name.trim(), userId || undefined);
      setName("");
      setUserId("");
      onClose();
    } catch (err: any) {
      setError(err.message || "Failed to create sheet");
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
              <FileSpreadsheet className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm">Create New Sheet Tab</h3>
              <p className="text-xs text-slate-300">Add a dedicated sheet to the workbook</p>
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
              Sheet / Member Name
            </label>
            <input
              type="text"
              required
              placeholder="e.g. Ramesh Kumar or Q4 Campaign"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">
              Assign to User (Optional)
            </label>
            <select
              value={userId}
              onChange={(e) => {
                setUserId(e.target.value);
                const selected = users.find((u) => u.id === e.target.value);
                if (selected && !name) {
                  setName(selected.name);
                }
              }}
              className="w-full px-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 text-slate-800 bg-white"
            >
              <option value="">-- No User Assignment (Admin Only) --</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} ({u.email}) - {u.role}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-500 mt-1 block">
              If assigned to a Member, they will gain access to this sheet on their login.
            </span>
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
                <Plus className="h-3.5 w-3.5 text-amber-400" />
              )}
              <span>Create Sheet Tab</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
}
