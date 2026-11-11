"use client";

import React, { useState, useEffect, useRef } from "react";
import { ActiveCell } from "@/lib/types";

interface FormulaBarProps {
  activeCell: ActiveCell | null;
  cellValue: string;
  onCellValueChange: (val: string) => void;
  onCommit?: () => void;
}

export function FormulaBar({
  activeCell,
  cellValue,
  onCellValueChange,
  onCommit,
}: FormulaBarProps) {
  const [localValue, setLocalValue] = useState(cellValue);
  const [isFocused, setIsFocused] = useState(false);
  const lastCommittedValueRef = useRef(cellValue);

  // Sync external cellValue changes when not focused
  useEffect(() => {
    if (!isFocused) {
      setLocalValue(cellValue);
      lastCommittedValueRef.current = cellValue;
    }
  }, [cellValue, isFocused, activeCell]);

  const commitValue = () => {
    if (localValue !== lastCommittedValueRef.current) {
      lastCommittedValueRef.current = localValue;
      onCellValueChange(localValue);
    }
    if (onCommit) onCommit();
  };

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
        value={isFocused ? localValue : cellValue}
        onFocus={() => {
          setIsFocused(true);
          setLocalValue(cellValue);
          lastCommittedValueRef.current = cellValue;
        }}
        onChange={(e) => setLocalValue(e.target.value)}
        onBlur={() => {
          setIsFocused(false);
          commitValue();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            commitValue();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            setLocalValue(cellValue);
            setIsFocused(false);
            e.currentTarget.blur();
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
          setLocalValue(cleanVal);
        }}
        placeholder={activeCell ? "Enter value or lead data..." : "Select cell to edit"}
        className="flex-1 px-2 py-0.5 bg-transparent border-0 outline-none text-slate-800 focus:bg-slate-50 rounded text-xs"
      />
    </div>
  );
}
