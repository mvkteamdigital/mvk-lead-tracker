"use client";

import React, { useState } from "react";
import { X, AlertTriangle, Copy, Check, ShieldAlert } from "lucide-react";

export interface DuplicateReportItem {
  tempId?: string;
  phone: string;
  name?: string;
  ownerName?: string;
  sheetName?: string;
  reason: string;
  order?: number;
  data?: Record<string, any>;
}

interface DuplicateBatchReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  duplicates: DuplicateReportItem[];
  totalSaved: number;
}

export function DuplicateBatchReportModal({
  isOpen,
  onClose,
  duplicates,
  totalSaved,
}: DuplicateBatchReportModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || duplicates.length === 0) return null;

  const handleCopy = () => {
    // Generate TSV formatted text representing the skipped leads
    const headers = ["Phone Number", "Lead Name", "Existing Owner / Sheet", "Reason"];
    const rows = duplicates.map((d) => [
      d.phone,
      d.name || "N/A",
      d.ownerName ? `${d.ownerName} (${d.sheetName || ""})` : "Existing Sheet",
      d.reason,
    ]);

    const tsvContent = [headers.join("\t"), ...rows.map((r) => r.join("\t"))].join("\n");
    navigator.clipboard.writeText(tsvContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-amber-500 text-slate-950 flex items-center justify-between border-b border-amber-600/20">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-black/10 rounded-lg">
              <AlertTriangle className="w-5 h-5 text-slate-950" />
            </div>
            <div>
              <h3 className="font-bold text-base text-slate-950 leading-tight">
                Duplicate Leads Detected ({duplicates.length})
              </h3>
              <p className="text-xs text-slate-800 font-medium">
                {totalSaved > 0
                  ? `Successfully saved ${totalSaved} lead(s). ${duplicates.length} duplicate lead(s) were skipped.`
                  : `${duplicates.length} lead(s) were not saved because their phone numbers already exist in the system.`}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-800 hover:text-black p-1 rounded-md hover:bg-black/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Info Banner */}
        <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-start gap-3">
          <ShieldAlert className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 leading-relaxed">
            <strong>Unique Phone Number Policy:</strong> To prevent multiple presales executives from calling the
            same client and causing customer friction, each phone number can only exist once across all team members.
            The records below already belong to an active member sheet.
          </div>
        </div>

        {/* Duplicates Table */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="border border-slate-200 rounded-lg overflow-hidden shadow-sm">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-100 border-b border-slate-200 text-slate-700 font-semibold uppercase tracking-wider">
                <tr>
                  <th className="py-2.5 px-3">#</th>
                  <th className="py-2.5 px-3">Phone</th>
                  <th className="py-2.5 px-3">Lead Name</th>
                  <th className="py-2.5 px-3">Already Assigned To</th>
                  <th className="py-2.5 px-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {duplicates.map((item, idx) => (
                  <tr key={idx} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 text-slate-500 font-mono">{idx + 1}</td>
                    <td className="py-2.5 px-3 font-semibold text-slate-900 font-mono">{item.phone}</td>
                    <td className="py-2.5 px-3 text-slate-700">{item.name || "—"}</td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 text-slate-800 border border-slate-200">
                        {item.ownerName ? `${item.ownerName} (${item.sheetName || "Sheet"})` : "Another Team Member"}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-amber-100 text-amber-800 border border-amber-200">
                        Skipped (Duplicate)
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 hover:text-slate-900 transition-colors shadow-sm"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-700">Copied to Clipboard!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-500" />
                <span>Copy Skipped Leads to Clipboard</span>
              </>
            )}
          </button>

          <button
            onClick={onClose}
            className="px-5 py-2 text-xs font-bold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors shadow-sm"
          >
            Dismiss & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
