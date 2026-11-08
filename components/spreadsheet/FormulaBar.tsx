"use client";

import React from "react";

interface FormulaBarProps {
  activeCell: { rowIdx: number; colId: string; colName: string } | null;
  cellValue: string;
  onCellValueChange: (val: string) => void;
  onCommit: () => void;
}

export function FormulaBar({
  activeCell,
  cellValue,
  onCellValueChange,
  onCommit,
}: FormulaBarProps) {
  // Convert col index to letter (A, B, C...) or use activeCell info
  const cellCoordinate = activeCell
    ? `${activeCell.colName} (Row ${activeCell.rowIdx + 1})`
    : "";

  return (
    <div className="h-8 bg-white border-b border-slate-200 px-3 flex items-center gap-2 text-xs select-none">
      {/* Cell Address Box */}
      <div className="w-44 px-2 py-0.5 text-center font-mono font-medium text-slate-700 bg-slate-100 border border-slate-200 rounded truncate">
        {cellCoordinate || "Select a cell"}
      </div>

      {/* fx Function Symbol */}
      <div className="text-slate-400 font-serif italic font-bold px-1 select-none">
        fx
      </div>

      {/* Formula Input */}
      <input
        type="text"
        disabled={!activeCell}
        value={cellValue}
        onChange={(e) => onCellValueChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            onCommit();
          }
        }}
        onPaste={(e) => {
          const pastedData = e.clipboardData.getData("text/plain");
          e.preventDefault();
          e.stopPropagation();
          if (!pastedData) return;
          const cleanVal = pastedData
            .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "")
            .replace(/[\r\n\t]+/g, " ")
            .trim();
          onCellValueChange(cleanVal);
        }}
        placeholder={activeCell ? "Enter value or lead data..." : "Select cell to edit"}
        className="flex-1 px-2 py-0.5 bg-transparent border-0 outline-none text-slate-800 focus:bg-slate-50 rounded text-xs"
      />
    </div>
  );
}
