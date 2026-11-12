"use client";

import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { SheetDetail, ColumnDef, RowData, CellStyle, ActiveCell } from "@/lib/types";
import { STATUS_COLORS, SOURCE_COLORS, getSourceColor, DEFAULT_LEAD_SOURCES, DEFAULT_FOLLOWUP_OPTIONS } from "@/lib/defaults";
import {
  rowMatchesStatusFilter,
  rowMatchesDateFilter,
  isValidLead,
  formatDateDisplay,
  sanitizeCellValue,
  filterSheetRows,
} from "@/lib/leads";
import {
  ChevronDown,
  Trash2,
  Plus,
  Copy,
  Scissors,
  Edit2,
  Check,
  Settings2,
  MoreHorizontal,
  ArrowUp,
  ArrowDown,
  Layers,
  Calendar,
  GripVertical,
  X,
} from "lucide-react";

interface SpreadsheetGridProps {
  sheet: SheetDetail;
  onUpdateCell: (rowId: string, columnId: string, value: string, order?: number) => Promise<void>;
  onBatchUpdateRows: (rows: Partial<RowData>[]) => Promise<void>;
  onAddRowAt: (index?: number) => Promise<void>;
  onDeleteRows: (
    rowIds: string[],
    meta?: {
      startRowIndex?: number;
      endRowIndex?: number;
      count?: number;
      deletedOrders?: number[];
    }
  ) => Promise<void>;
  onUpdateColumns: (columns: ColumnDef[]) => Promise<void>;
  onOpenDropdownModal: (col: ColumnDef) => void;
  activeCell: ActiveCell | null;
  setActiveCell: (cell: ActiveCell | null) => void;
  searchQuery: string;
  statusFilter?: string | null;
  dateFilter?: string | null;
  onClearFilters?: () => void;
  onUndo?: () => void;
  onRedo?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

const ROW_HEIGHT = 36;
const BUFFER = 50;

// ==========================================
// 1. MEMOIZED GRID CELL (0ms Click & Render)
// ==========================================
interface GridCellProps {
  rowId: string;
  rowIdx: number;
  colIdx: number;
  col: ColumnDef;
  value: string;
  cellStyle?: CellStyle;
  isActive: boolean;
  isSelected: boolean;
  isEditing: boolean;
  isMultiCell: boolean;
  isTopEdge: boolean;
  isBottomEdge: boolean;
  isLeftEdge: boolean;
  isRightEdge: boolean;
  isBottomRightCorner: boolean;
  editValue?: string;
  onEditValueChange?: (val: string) => void;
  onCommitEdit?: () => void;
  onCommitEditWithDirection?: (dir?: "down" | "up" | "right" | "left") => void;
  onCancelEdit?: () => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  editInputRef?: React.RefObject<HTMLInputElement>;
  onCellMouseDown: (e: React.MouseEvent, rowIdx: number, colIdx: number, col: ColumnDef) => void;
  onCellMouseEnter: (rowIdx: number, colIdx: number) => void;
  onCellDoubleClick: (rowIdx: number, col: ColumnDef) => void;
  onCellContextMenu: (e: React.MouseEvent, rowIdx: number, colIdx: number, col: ColumnDef) => void;
  onDropdownClick: (e: React.MouseEvent, rowIdx: number, colIdx: number, col: ColumnDef) => void;
  onStartEditing: (rowIdx: number, col: ColumnDef) => void;
  onClearCell?: (rowIdx: number, col: ColumnDef) => void;
}

const GridCell = ({
  rowId,
  rowIdx,
  colIdx,
  col,
  value,
  cellStyle,
  isActive,
  isSelected,
  isEditing,
  isMultiCell,
  isTopEdge,
  isBottomEdge,
  isLeftEdge,
  isRightEdge,
  isBottomRightCorner,
  editValue = "",
  onEditValueChange,
  onCommitEdit,
  onCommitEditWithDirection,
  onCancelEdit,
  onPaste,
  editInputRef,
  onCellMouseDown,
  onCellMouseEnter,
  onCellDoubleClick,
  onCellContextMenu,
  onDropdownClick,
  onStartEditing,
  onClearCell,
}: GridCellProps) => {
  const colWidth = col.width || 180;
  const inlineStyle: React.CSSProperties = {
    width: `${colWidth}px`,
    minWidth: `${colWidth}px`,
    maxWidth: `${colWidth}px`,
    fontWeight: cellStyle?.bold ? "bold" : "normal",
    fontStyle: cellStyle?.italic ? "italic" : "normal",
    color: cellStyle?.color || "#111827",
    backgroundColor: cellStyle?.bgColor || undefined,
    textAlign: cellStyle?.align || "left",
  };

  if (isMultiCell && isSelected) {
    if (!isActive) {
      inlineStyle.backgroundColor = "#dbeafe";
    } else {
      inlineStyle.backgroundColor = "#eff6ff";
    }

    const shadows: string[] = [];
    if (isTopEdge) shadows.push("inset 0 2px 0 0 #2563eb");
    if (isBottomEdge) shadows.push("inset 0 -2px 0 0 #2563eb");
    if (isLeftEdge) shadows.push("inset 2px 0 0 0 #2563eb");
    if (isRightEdge) shadows.push("inset -2px 0 0 0 #2563eb");
    if (shadows.length > 0) {
      inlineStyle.boxShadow = shadows.join(", ");
    }
  }

  const isPerimeter = isTopEdge || isBottomEdge || isLeftEdge || isRightEdge;

  return (
    <td
      onMouseDown={(e) => onCellMouseDown(e, rowIdx, colIdx, col)}
      onMouseEnter={() => onCellMouseEnter(rowIdx, colIdx)}
      onDoubleClick={() => onCellDoubleClick(rowIdx, col)}
      onContextMenu={(e) => onCellContextMenu(e, rowIdx, colIdx, col)}
      onPaste={onPaste}
      style={inlineStyle}
      className={`relative border-r border-b border-slate-300 px-3 py-1.5 transition-colors text-xs text-gray-900 font-normal overflow-hidden cursor-cell select-none ${
        !isMultiCell && isActive
          ? "outline outline-2 outline-blue-600 -outline-offset-2 z-10 bg-blue-50/40"
          : isPerimeter
          ? "z-10"
          : isSelected
          ? "z-5"
          : ""
      }`}
    >
      {/* Active Cell Drag Handle on bottom-right corner */}
      {((!isMultiCell && isActive) || (isMultiCell && isBottomRightCorner)) && (
        <div className="absolute -bottom-1 -right-1 w-1.5 h-1.5 bg-blue-600 border border-white z-20 pointer-events-none shadow-xs" />
      )}

      {/* Inner outline for active cell inside multi-cell selection */}
      {isMultiCell && isActive && (
        <div className="absolute inset-0 outline outline-1 outline-blue-400 -outline-offset-1 pointer-events-none z-10" />
      )}

      {isEditing ? (
        <input
          ref={editInputRef}
          type={col.type === "date" ? "date" : "text"}
          value={editValue}
          onChange={(e) => onEditValueChange?.(e.target.value)}
          onBlur={() => onCommitEdit?.()}
          onPaste={onPaste}
          autoFocus
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              e.stopPropagation();
              onCommitEditWithDirection?.(e.shiftKey ? "up" : "down");
            } else if (e.key === "Tab") {
              e.preventDefault();
              e.stopPropagation();
              onCommitEditWithDirection?.(e.shiftKey ? "left" : "right");
            } else if (e.key === "Escape") {
              e.preventDefault();
              e.stopPropagation();
              onCancelEdit?.();
            } else if ((e.key === "Delete" || e.key === "Backspace") && col.type === "date") {
              e.preventDefault();
              e.stopPropagation();
              if (editInputRef?.current) {
                editInputRef.current.value = "";
              }
              onEditValueChange?.("");
              onCommitEdit?.();
            }
          }}
          className="absolute inset-0 w-full h-full px-2 text-xs bg-white text-gray-900 font-medium border-2 border-blue-600 outline-none z-20 select-text"
        />
      ) : col.type === "dropdown" ? (
        <div
          onClick={(e) => onDropdownClick(e, rowIdx, colIdx, col)}
          className="flex items-center justify-between w-full cursor-pointer group/pill select-none"
        >
          {value ? (
            <span
              className={`px-2.5 py-0.5 rounded-full text-[11px] font-medium border flex items-center gap-1.5 truncate shadow-2xs select-none ${
                (col.id === "col_lead_source" ? getSourceColor(value) : STATUS_COLORS[value])?.bg || "bg-slate-100"
              } ${
                (col.id === "col_lead_source" ? getSourceColor(value) : STATUS_COLORS[value])?.text || "text-slate-900"
              } ${
                (col.id === "col_lead_source" ? getSourceColor(value) : STATUS_COLORS[value])?.border || "border-slate-300"
              }`}
            >
              <span className="h-1.5 w-1.5 rounded-full bg-current opacity-80" />
              <span className="truncate">{value}</span>
            </span>
          ) : (
            <span className="text-slate-400 italic text-[11px] select-none">
              {col.id === "col_lead_source" ? "Select source..." : "Select status..."}
            </span>
          )}
          <ChevronDown className="h-3 w-3 text-slate-500 group-hover/pill:text-slate-900 transition-colors shrink-0 ml-1" />
        </div>
      ) : col.type === "date" ? (
        <div
          onClick={() => onStartEditing(rowIdx, col)}
          className="flex items-center justify-between w-full cursor-pointer group/date select-none text-xs"
        >
          {value ? (
            <div className="flex items-center justify-between w-full">
              <span className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50/80 text-blue-900 font-medium border border-blue-200/80 text-[11px] truncate shadow-2xs">
                <Calendar className="h-3 w-3 text-blue-600 shrink-0" />
                <span className="truncate">{value}</span>
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  onClearCell?.(rowIdx, col);
                }}
                className="opacity-0 group-hover/date:opacity-100 p-0.5 hover:bg-slate-200 rounded text-slate-400 hover:text-rose-600 transition-opacity ml-1"
                title="Clear date"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ) : (
            <span className="text-slate-400 italic text-[11px] flex items-center gap-1 opacity-70 group-hover/date:opacity-100 transition-opacity">
              <Calendar className="h-3 w-3 text-slate-400 shrink-0" />
              <span>Pick date...</span>
            </span>
          )}
        </div>
      ) : (
        <span
          className="block w-full truncate select-none text-gray-900"
          title={value || undefined}
        >
          {value ? value : <span className="opacity-0 select-none">-</span>}
        </span>
      )}
    </td>
  );
};

const MemoizedGridCell = React.memo(GridCell, (prev, next) => {
  // Direct value check: re-render immediately when cell value changes
  if (prev.value !== next.value) return false;
  if (prev.isActive !== next.isActive) return false;
  if (prev.isSelected !== next.isSelected) return false;
  if (prev.isEditing !== next.isEditing) return false;
  if (next.isEditing && prev.editValue !== next.editValue) return false;
  if (prev.isMultiCell !== next.isMultiCell) return false;
  if (prev.isTopEdge !== next.isTopEdge) return false;
  if (prev.isBottomEdge !== next.isBottomEdge) return false;
  if (prev.isLeftEdge !== next.isLeftEdge) return false;
  if (prev.isRightEdge !== next.isRightEdge) return false;
  if (prev.isBottomRightCorner !== next.isBottomRightCorner) return false;
  if (prev.cellStyle !== next.cellStyle) return false;
  if (prev.col !== next.col) return false;
  if (prev.col?.width !== next.col?.width) return false;
  return true;
});

// ==========================================
// 2. MEMOIZED GRID ROW (Skips Untouched Rows)
// ==========================================
interface GridRowProps {
  rowIdx: number;
  serialNumber: number;
  row: RowData;
  columns: ColumnDef[];
  isRowSelected: boolean;
  activeCell: ActiveCell | null;
  selectionRange: { startRow: number; endRow: number; startCol: number; endCol: number } | null;
  isMultiCell: boolean;
  editingCell: { rowId: string; colId: string; rowIdx: number } | null;
  editValue: string;
  onEditValueChange: (val: string) => void;
  onCommitEdit: () => void;
  onCommitEditWithDirection?: (dir?: "down" | "up" | "right" | "left") => void;
  onCancelEdit?: () => void;
  onPaste?: (e: React.ClipboardEvent) => void;
  editInputRef: React.RefObject<HTMLInputElement>;
  onRowHeaderClick: (e: React.MouseEvent, row: RowData, rowIdx: number) => void;
  onRowContextMenu: (e: React.MouseEvent, rowId: string, rowIdx: number) => void;
  onCellMouseDown: (e: React.MouseEvent, row: RowData, rowIdx: number, colIdx: number, col: ColumnDef) => void;
  onCellMouseEnter: (rowIdx: number, colIdx: number) => void;
  onCellDoubleClick: (row: RowData, rowIdx: number, col: ColumnDef) => void;
  onCellContextMenu: (e: React.MouseEvent, row: RowData, rowIdx: number, colIdx: number, col: ColumnDef) => void;
  onDropdownClick: (e: React.MouseEvent, row: RowData, rowIdx: number, colIdx: number, col: ColumnDef) => void;
  onStartEditing: (row: RowData, rowIdx: number, col: ColumnDef) => void;
  onClearCell?: (rowIdx: number, col: ColumnDef) => void;
}

const GridRow = ({
  rowIdx,
  serialNumber,
  row,
  columns,
  isRowSelected,
  activeCell,
  selectionRange,
  isMultiCell,
  editingCell,
  editValue,
  onEditValueChange,
  onCommitEdit,
  onCommitEditWithDirection,
  onCancelEdit,
  onPaste,
  editInputRef,
  onRowHeaderClick,
  onRowContextMenu,
  onCellMouseDown,
  onCellMouseEnter,
  onCellDoubleClick,
  onCellContextMenu,
  onDropdownClick,
  onStartEditing,
  onClearCell,
}: GridRowProps) => {
  const rowInSelectionRange =
    selectionRange !== null &&
    rowIdx >= selectionRange.startRow &&
    rowIdx <= selectionRange.endRow;

  return (
    <tr
      className={`h-9 border-b border-slate-300 transition-colors ${
        isRowSelected ? "bg-blue-50/20" : "hover:bg-slate-50/70"
      }`}
    >
      {/* Sticky Row Number (1 to 1000+) */}
      <td
        style={{ width: "56px", minWidth: "56px", maxWidth: "56px" }}
        className={`sticky left-0 z-10 text-center text-[11px] font-mono select-none cursor-pointer border-r border-b border-slate-300 transition-colors ${
          isRowSelected
            ? "bg-blue-100 font-bold text-blue-900 border-r-2 border-r-blue-600"
            : "bg-slate-100 hover:bg-slate-200 text-slate-500"
        }`}
        onClick={(e) => onRowHeaderClick(e, row, rowIdx)}
        onContextMenu={(e) => onRowContextMenu(e, row.id, rowIdx)}
      >
        {serialNumber}
      </td>

      {/* Cells */}
      {columns.map((col, colIdx) => {
        const cellVal = row.data?.[col.id] || "";
        const isActive =
          (activeCell?.rowId && !activeCell.rowId.startsWith("temp_")
            ? activeCell.rowId === row.id
            : activeCell?.rowIdx === rowIdx) && activeCell?.colId === col.id;
        const isEditing =
          (editingCell?.rowId && !editingCell.rowId.startsWith("temp_")
            ? editingCell.rowId === row.id
            : editingCell?.rowIdx === rowIdx) && editingCell?.colId === col.id;
        const cellStyle = row.styles?.[col.id];

        const isSelected =
          rowInSelectionRange &&
          colIdx >= selectionRange.startCol &&
          colIdx <= selectionRange.endCol;

        const isTopEdge = isSelected && rowIdx === selectionRange.startRow;
        const isBottomEdge = isSelected && rowIdx === selectionRange.endRow;
        const isLeftEdge = isSelected && colIdx === selectionRange.startCol;
        const isRightEdge = isSelected && colIdx === selectionRange.endCol;
        const isBottomRightCorner = isBottomEdge && isRightEdge;

        return (
          <MemoizedGridCell
            key={col.id}
            rowId={row.id}
            rowIdx={rowIdx}
            colIdx={colIdx}
            col={col}
            value={cellVal}
            cellStyle={cellStyle}
            isActive={isActive}
            isSelected={isSelected}
            isEditing={isEditing}
            isMultiCell={isMultiCell}
            isTopEdge={isTopEdge}
            isBottomEdge={isBottomEdge}
            isLeftEdge={isLeftEdge}
            isRightEdge={isRightEdge}
            isBottomRightCorner={isBottomRightCorner}
            editValue={isEditing ? editValue : undefined}
            onEditValueChange={isEditing ? onEditValueChange : undefined}
            onCommitEdit={isEditing ? onCommitEdit : undefined}
            onCommitEditWithDirection={isEditing ? onCommitEditWithDirection : undefined}
            onCancelEdit={isEditing ? onCancelEdit : undefined}
            onPaste={onPaste}
            editInputRef={isEditing ? editInputRef : undefined}
            onCellMouseDown={(e, rIdx, cIdx, c) => onCellMouseDown(e, row, rIdx, cIdx, c)}
            onCellMouseEnter={onCellMouseEnter}
            onCellDoubleClick={(rIdx, c) => onCellDoubleClick(row, rIdx, c)}
            onCellContextMenu={(e, rIdx, cIdx, c) => onCellContextMenu(e, row, rIdx, cIdx, c)}
            onDropdownClick={(e, rIdx, cIdx, c) => onDropdownClick(e, row, rIdx, cIdx, c)}
            onStartEditing={(rIdx, c) => onStartEditing(row, rIdx, c)}
            onClearCell={onClearCell}
          />
        );
      })}
    </tr>
  );
};

const MemoizedGridRow = React.memo(GridRow, (prev, next) => {
  if (prev.serialNumber !== next.serialNumber) return false;
  if (prev.row.id !== next.row.id) return false;
  if (prev.row !== next.row) return false;
  if (prev.row.data !== next.row.data) return false;
  if (JSON.stringify(prev.row.data) !== JSON.stringify(next.row.data)) return false;
  if (prev.row.styles !== next.row.styles) return false;
  if (prev.columns !== next.columns) return false;
  if (prev.isRowSelected !== next.isRowSelected) return false;

  // Active cell entered or left this row?
  const prevHasActive =
    prev.activeCell !== null &&
    (prev.activeCell.rowId && !prev.activeCell.rowId.startsWith("temp_")
      ? prev.activeCell.rowId === prev.row.id
      : prev.activeCell.rowIdx === prev.rowIdx);

  const nextHasActive =
    next.activeCell !== null &&
    (next.activeCell.rowId && !next.activeCell.rowId.startsWith("temp_")
      ? next.activeCell.rowId === next.row.id
      : next.activeCell.rowIdx === next.rowIdx);

  if (prevHasActive !== nextHasActive) return false;
  if (nextHasActive && prev.activeCell?.colId !== next.activeCell?.colId) return false;

  // Editing entered or left this row?
  const prevIsEditing =
    prev.editingCell !== null &&
    (prev.editingCell.rowId && !prev.editingCell.rowId.startsWith("temp_")
      ? prev.editingCell.rowId === prev.row.id
      : prev.editingCell.rowIdx === prev.rowIdx);

  const nextIsEditing =
    next.editingCell !== null &&
    (next.editingCell.rowId && !next.editingCell.rowId.startsWith("temp_")
      ? next.editingCell.rowId === next.row.id
      : next.editingCell.rowIdx === next.rowIdx);

  if (prevIsEditing !== nextIsEditing) return false;
  if (nextIsEditing && prev.editValue !== next.editValue) return false;

  // Selection range entered or left this row?
  const prevInSelection =
    prev.selectionRange !== null &&
    prev.rowIdx >= prev.selectionRange.startRow &&
    prev.rowIdx <= prev.selectionRange.endRow;
  const nextInSelection =
    next.selectionRange !== null &&
    next.rowIdx >= next.selectionRange.startRow &&
    next.rowIdx <= next.selectionRange.endRow;
  if (prevInSelection !== nextInSelection) return false;

  // If in selection, did selection columns or rows change?
  if (nextInSelection) {
    if (
      prev.selectionRange?.startCol !== next.selectionRange?.startCol ||
      prev.selectionRange?.endCol !== next.selectionRange?.endCol ||
      prev.selectionRange?.startRow !== next.selectionRange?.startRow ||
      prev.selectionRange?.endRow !== next.selectionRange?.endRow
    ) {
      return false;
    }
  }

  return true;
});

export function SpreadsheetGrid({
  sheet,
  onUpdateCell,
  onBatchUpdateRows,
  onAddRowAt,
  onDeleteRows,
  onUpdateColumns,
  onOpenDropdownModal,
  activeCell,
  setActiveCell,
  searchQuery,
  statusFilter = null,
  dateFilter = null,
  onClearFilters,
  onUndo,
  onRedo,
  canUndo,
  canRedo,
}: SpreadsheetGridProps) {
  // 1,000 default rows support with dynamic expansion
  const [expandedRowCount, setExpandedRowCount] = useState(1000);
  const [addMoreAmount, setAddMoreAmount] = useState(100);

  // Virtual windowing scroll tracking
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(() => {
    if (typeof window !== "undefined") {
      return Math.max(window.innerHeight - 200, 600);
    }
    return 800;
  });
  const gridContainerRef = useRef<HTMLDivElement>(null);

  // Editing state with synchronous ref mirrors to prevent stale closures and race conditions
  const [editingCell, _setEditingCell] = useState<{ rowId: string; colId: string; rowIdx: number; order?: number } | null>(null);
  const editingCellRef = useRef<{ rowId: string; colId: string; rowIdx: number; order?: number } | null>(null);
  const setEditingCell = useCallback((cell: { rowId: string; colId: string; rowIdx: number; order?: number } | null) => {
    editingCellRef.current = cell;
    _setEditingCell(cell);
  }, []);

  const [editValue, _setEditValue] = useState("");
  const editValueRef = useRef("");
  const setEditValue = useCallback((val: string) => {
    editValueRef.current = val;
    _setEditValue(val);
  }, []);

  const editInputRef = useRef<HTMLInputElement>(null);
  const isCommittingRef = useRef(false);

  // Google Sheets Selection state manager
  const [selectionAnchor, setSelectionAnchor] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const [selectionFocus, setSelectionFocus] = useState<{ rowIdx: number; colIdx: number } | null>(null);
  const [isMouseDown, setIsMouseDown] = useState(false);
  const [isDraggingCol, setIsDraggingCol] = useState(false);

  // Stable refs to prevent callback re-creation and stale closures during paste
  const sheetRef = useRef(sheet);
  useEffect(() => {
    sheetRef.current = sheet;
  }, [sheet]);

  const activeCellRef = useRef(activeCell);
  useEffect(() => {
    activeCellRef.current = activeCell;
  }, [activeCell]);

  const isMouseDownRef = useRef(isMouseDown);
  useEffect(() => {
    isMouseDownRef.current = isMouseDown;
  }, [isMouseDown]);

  const selectionAnchorRef = useRef(selectionAnchor);
  useEffect(() => {
    selectionAnchorRef.current = selectionAnchor;
  }, [selectionAnchor]);

  // Dropdown popover state
  const [openDropdown, setOpenDropdown] = useState<{
    rowId: string;
    colId: string;
    rowIdx: number;
    order?: number;
    top: number;
    left: number;
    options: string[];
  } | null>(null);

  // Column renaming / context menu
  const [columnMenu, setColumnMenu] = useState<{ colId: string; top: number; left: number } | null>(null);
  const [renamingColId, setRenamingColId] = useState<string | null>(null);
  const [colRenameValue, setColRenameValue] = useState("");

  // Context menu on cells / rows
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    rowId: string;
    colId: string;
    rowIdx: number;
  } | null>(null);

  // Column resizing state
  const [resizingCol, setResizingCol] = useState<{ id: string; startX: number; startWidth: number } | null>(null);
  const [liveColWidths, setLiveColWidths] = useState<Record<string, number>>({});
  const resizingColRef = useRef<{ id: string; startX: number; startWidth: number; currentWidth: number } | null>(null);

  // Constants for fixed geometry
  const ROW_HEADER_WIDTH = 56;
  const DEFAULT_COLUMN_WIDTH = 180;

  // Active columns with live resize override (guarantees single source of truth)
  const currentColumns = useMemo(() => {
    if (Object.keys(liveColWidths).length === 0) return sheet.columns;
    return sheet.columns.map((c) => {
      const liveW = liveColWidths[c.id];
      return liveW !== undefined ? { ...c, width: liveW } : c;
    });
  }, [sheet.columns, liveColWidths]);

  // Authoritative total table width: strictly locks table-layout: fixed
  const totalTableWidth = useMemo(() => {
    return (
      ROW_HEADER_WIDTH +
      currentColumns.reduce(
        (sum, col) => sum + (col.width || DEFAULT_COLUMN_WIDTH),
        0
      )
    );
  }, [currentColumns]);

  // Reset live column overrides on sheet switch
  useEffect(() => {
    setLiveColWidths({});
  }, [sheet.id]);

  // Synchronize live overrides when sheet.columns is updated from backend
  useEffect(() => {
    setLiveColWidths((prev) => {
      if (Object.keys(prev).length === 0) return prev;
      let hasChanges = false;
      const next = { ...prev };
      for (const col of sheet.columns) {
        if (next[col.id] !== undefined && col.width === next[col.id]) {
          delete next[col.id];
          hasChanges = true;
        }
      }
      return hasChanges ? next : prev;
    });
  }, [sheet.columns]);

  // Column drag-and-drop reordering state (draggable & adjustable side-to-side)
  const [draggedColIdx, setDraggedColIdx] = useState<number | null>(null);
  const [dragOverColIdx, setDragOverColIdx] = useState<number | null>(null);

  // Dynamic filter state: when searching, filtering by date, or filtering by status
  const isFiltered = Boolean(dateFilter || statusFilter || searchQuery.trim());

  const filteredRows = useMemo(() => {
    if (!isFiltered) return [];
    return filterSheetRows(sheet.rows, sheet.columns, {
      dateFilter,
      statusFilter,
      searchQuery,
    });
  }, [sheet.rows, sheet.columns, isFiltered, dateFilter, statusFilter, searchQuery]);

  // Stable map of sheet rows indexed by their row order
  const orderToRowMap = useMemo(() => {
    const map = new Map<number, RowData>();
    const unassigned: RowData[] = [];
    for (const row of sheet.rows) {
      if (typeof row.order === "number" && row.order >= 0) {
        if (!map.has(row.order)) {
          map.set(row.order, row);
        } else {
          unassigned.push(row);
        }
      } else {
        unassigned.push(row);
      }
    }
    // Safety fallback for unassigned or duplicate rows
    let nextIdx = 0;
    for (const row of unassigned) {
      while (map.has(nextIdx)) {
        nextIdx++;
      }
      map.set(nextIdx, row);
      nextIdx++;
    }
    return map;
  }, [sheet.rows]);

  // Total row count: in filtered mode, matches filtered rows count; in normal mode, at least 1,000 blank rows
  const totalRowCount = useMemo(() => {
    if (isFiltered) {
      return filteredRows.length;
    }
    let maxOrder = 0;
    for (const r of sheet.rows) {
      if (typeof r.order === "number" && r.order > maxOrder) {
        maxOrder = r.order;
      }
    }
    return Math.max(1000, maxOrder + 50, sheet.rows.length + 10, expandedRowCount);
  }, [isFiltered, filteredRows.length, sheet.rows, expandedRowCount]);

  // Helper to get row data at index: uses stable order mapping so row positions are fixed like Google Sheets
  const getRowAtIndex = useCallback(
    (index: number): RowData => {
      if (isFiltered) {
        if (index >= 0 && index < filteredRows.length) {
          return filteredRows[index];
        }
        return {
          id: `temp_${index}`,
          sheetId: sheet.id,
          order: index,
          data: {},
          styles: {},
        };
      }
      const existing = orderToRowMap.get(index);
      if (existing) {
        return existing;
      }
      return {
        id: `temp_${index}`,
        sheetId: sheet.id,
        order: index,
        data: {},
        styles: {},
      };
    },
    [isFiltered, filteredRows, orderToRowMap, sheet.id]
  );

  // Dynamic windowing calculations with ResizeObserver
  useEffect(() => {
    const el = gridContainerRef.current;
    if (!el) return;
    const updateHeight = () => {
      const h = el.clientHeight || (typeof window !== "undefined" ? window.innerHeight - 200 : 800);
      if (h > 0) {
        setViewportHeight(h);
      }
    };
    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(el);
    window.addEventListener("resize", updateHeight);
    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const startIndex = Math.max(0, Math.floor(scrollTop / ROW_HEIGHT) - BUFFER);
  const endIndex = Math.min(totalRowCount, Math.ceil((scrollTop + viewportHeight) / ROW_HEIGHT) + BUFFER);
  const topSpacerHeight = startIndex * ROW_HEIGHT;
  const bottomSpacerHeight = Math.max(0, (totalRowCount - endIndex) * ROW_HEIGHT);

  const visibleRowIndices = useMemo(() => {
    const indices: number[] = [];
    for (let i = startIndex; i < endIndex; i++) {
      indices.push(i);
    }
    return indices;
  }, [startIndex, endIndex]);

  // Focus editing input on entering edit mode
  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  // Synchronize selection anchor and focus when sheet changes or initial activeCell is set
  useEffect(() => {
    if (activeCell) {
      const colIdx = sheet.columns.findIndex((c) => c.id === activeCell.colId);
      if (colIdx !== -1) {
        setSelectionAnchor({ rowIdx: activeCell.rowIdx, colIdx });
        setSelectionFocus({ rowIdx: activeCell.rowIdx, colIdx });
      }
    }
  }, [sheet.id]);

  // Global mouseup to release drag selection even outside the table
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      setIsMouseDown(false);
    };
    window.addEventListener("mouseup", handleGlobalMouseUp);
    return () => {
      window.removeEventListener("mouseup", handleGlobalMouseUp);
    };
  }, []);

  // Global keydown for Undo / Redo (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if an input or textarea outside grid editing is active
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable) &&
        target !== editInputRef.current
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        if (!editingCell) {
          e.preventDefault();
          if (e.shiftKey) {
            if (onRedo) onRedo();
          } else {
            if (onUndo) onUndo();
          }
        }
      } else if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        if (!editingCell) {
          e.preventDefault();
          if (onRedo) onRedo();
        }
      }
    };

    window.addEventListener("keydown", handleGlobalKeyDown);
    return () => window.removeEventListener("keydown", handleGlobalKeyDown);
  }, [onUndo, onRedo, editingCell]);

  // Compute selection range rectangle (min/max row and column)
  const selectionRange = useMemo(() => {
    if (!selectionAnchor || !selectionFocus) {
      if (activeCell) {
        const colIdx = sheet.columns.findIndex((c) => c.id === activeCell.colId);
        if (colIdx !== -1) {
          return {
            startRow: activeCell.rowIdx,
            endRow: activeCell.rowIdx,
            startCol: colIdx,
            endCol: colIdx,
          };
        }
      }
      return null;
    }

    return {
      startRow: Math.min(selectionAnchor.rowIdx, selectionFocus.rowIdx),
      endRow: Math.max(selectionAnchor.rowIdx, selectionFocus.rowIdx),
      startCol: Math.min(selectionAnchor.colIdx, selectionFocus.colIdx),
      endCol: Math.max(selectionAnchor.colIdx, selectionFocus.colIdx),
    };
  }, [selectionAnchor, selectionFocus, activeCell, sheet.columns]);

  const isMultiCell = useMemo(() => {
    if (!selectionRange) return false;
    return (
      selectionRange.startRow !== selectionRange.endRow ||
      selectionRange.startCol !== selectionRange.endCol
    );
  }, [selectionRange]);

  // Commit in-cell edit with optional directional movement
  const commitEdit = useCallback(async (moveDirection?: "down" | "up" | "right" | "left") => {
    const currentEdit = editingCellRef.current;
    if (!currentEdit) return;

    if (isCommittingRef.current) return;
    isCommittingRef.current = true;

    // Authoritative value: inspect DOM input element directly if available, fallback to editValueRef
    const valueToSave = editInputRef.current ? editInputRef.current.value : editValueRef.current;
    const { rowId, colId, rowIdx, order } = currentEdit;
    const targetOrder = order !== undefined ? order : rowIdx;

    // Immediately clear editing state synchronously
    editingCellRef.current = null;
    _setEditingCell(null);
    isCommittingRef.current = false;

    try {
      await onUpdateCell(rowId, colId, valueToSave, targetOrder);
    } catch (err) {
      console.error("Error committing cell edit:", err);
    }

    if (moveDirection) {
      const currentActive = activeCellRef.current;
      if (currentActive) {
        const currentColIdx = sheetRef.current.columns.findIndex((c) => c.id === currentActive.colId);
        const maxRowIdx = totalRowCount - 1;
        const maxColIdx = sheetRef.current.columns.length - 1;

        if (moveDirection === "down" && currentActive.rowIdx < maxRowIdx) {
          const nextRowIdx = currentActive.rowIdx + 1;
          const targetRow = getRowAtIndex(nextRowIdx);
          setActiveCell({ rowId: targetRow?.id, rowIdx: nextRowIdx, colId: currentActive.colId, colName: currentActive.colName });
          setSelectionAnchor({ rowIdx: nextRowIdx, colIdx: currentColIdx });
          setSelectionFocus({ rowIdx: nextRowIdx, colIdx: currentColIdx });
        } else if (moveDirection === "up" && currentActive.rowIdx > 0) {
          const nextRowIdx = currentActive.rowIdx - 1;
          const targetRow = getRowAtIndex(nextRowIdx);
          setActiveCell({ rowId: targetRow?.id, rowIdx: nextRowIdx, colId: currentActive.colId, colName: currentActive.colName });
          setSelectionAnchor({ rowIdx: nextRowIdx, colIdx: currentColIdx });
          setSelectionFocus({ rowIdx: nextRowIdx, colIdx: currentColIdx });
        } else if (moveDirection === "right" && currentColIdx < maxColIdx) {
          const nextCol = sheetRef.current.columns[currentColIdx + 1];
          setActiveCell({ rowId: currentActive.rowId, rowIdx: currentActive.rowIdx, colId: nextCol.id, colName: nextCol.name });
          setSelectionAnchor({ rowIdx: currentActive.rowIdx, colIdx: currentColIdx + 1 });
          setSelectionFocus({ rowIdx: currentActive.rowIdx, colIdx: currentColIdx + 1 });
        } else if (moveDirection === "left" && currentColIdx > 0) {
          const prevCol = sheetRef.current.columns[currentColIdx - 1];
          setActiveCell({ rowId: currentActive.rowId, rowIdx: currentActive.rowIdx, colId: prevCol.id, colName: prevCol.name });
          setSelectionAnchor({ rowIdx: currentActive.rowIdx, colIdx: currentColIdx - 1 });
          setSelectionFocus({ rowIdx: currentActive.rowIdx, colIdx: currentColIdx - 1 });
        }
      }
    }
  }, [onUpdateCell, totalRowCount, getRowAtIndex, setActiveCell]);

  const commitEditRef = useRef(commitEdit);
  useEffect(() => {
    commitEditRef.current = commitEdit;
  }, [commitEdit]);

  const cancelEdit = useCallback(() => {
    editingCellRef.current = null;
    _setEditingCell(null);
  }, []);

  // Start in-cell edit
  const startEditing = useCallback((row: RowData, rowIdx: number, col: ColumnDef) => {
    if (col.type === "dropdown") return;
    const initialVal = row.data[col.id] || "";
    setEditValue(initialVal);
    setEditingCell({
      rowId: row.id,
      colId: col.id,
      rowIdx,
      order: row.order !== undefined ? row.order : rowIdx,
    });
  }, [setEditValue, setEditingCell]);

  // Handle cell double click
  const handleCellDoubleClick = useCallback((row: RowData, rowIdx: number, col: ColumnDef) => {
    startEditing(row, rowIdx, col);
  }, [startEditing]);

  // Handle cell mouse down (click, Shift-click, or start of click-and-drag)
  const handleCellMouseDown = useCallback((
    e: React.MouseEvent,
    row: RowData,
    rowIdx: number,
    colIdx: number,
    col: ColumnDef
  ) => {
    if (e.button !== 0) return; // Only primary left-click

    if (editingCellRef.current && (editingCellRef.current.rowIdx !== rowIdx || editingCellRef.current.colId !== col.id)) {
      commitEditRef.current();
    }

    if (!editingCellRef.current || editingCellRef.current.rowIdx !== rowIdx || editingCellRef.current.colId !== col.id) {
      e.preventDefault();
    }

    if (gridContainerRef.current) {
      gridContainerRef.current.focus();
    }

    if (e.shiftKey && selectionAnchorRef.current) {
      setSelectionFocus({ rowIdx, colIdx });
    } else {
      setActiveCell({ rowId: row.id, rowIdx, colId: col.id, colName: col.name });
      setSelectionAnchor({ rowIdx, colIdx });
      setSelectionFocus({ rowIdx, colIdx });
      setIsMouseDown(true);
    }
    setOpenDropdown(null);
  }, [setActiveCell]);

  // Handle cell mouse enter during drag
  const handleCellMouseEnter = useCallback((rowIdx: number, colIdx: number) => {
    if (isMouseDownRef.current && selectionAnchorRef.current) {
      setSelectionFocus({ rowIdx, colIdx });
    }
  }, []);

  // Row header click (selects the entire row across all columns, like Google Sheets)
  const handleRowHeaderClick = useCallback((e: React.MouseEvent, row: RowData, rowIdx: number) => {
    e.preventDefault();
    if (editingCellRef.current) {
      commitEditRef.current();
    }
    if (gridContainerRef.current) {
      gridContainerRef.current.focus();
    }

    const firstCol = sheet.columns[0];
    if (!firstCol) return;
    setActiveCell({
      rowId: row.id,
      rowIdx,
      colId: firstCol.id,
      colName: firstCol.name,
    });
    if (e.shiftKey && selectionAnchorRef.current) {
      setSelectionFocus({ rowIdx, colIdx: sheet.columns.length - 1 });
    } else {
      setSelectionAnchor({ rowIdx, colIdx: 0 });
      setSelectionFocus({ rowIdx, colIdx: sheet.columns.length - 1 });
    }
  }, [sheet.columns, setActiveCell]);

  // Column header click (selects the entire column across all rows, like Google Sheets)
  const handleColumnHeaderClick = useCallback(
    (e: React.MouseEvent, colIdx: number, col: ColumnDef) => {
      if (resizingCol || renamingColId !== null || isDraggingCol) return;

      if (editingCellRef.current) {
        commitEditRef.current();
      }
      if (gridContainerRef.current) {
        gridContainerRef.current.focus();
      }

      const firstRowIdx = 0;
      const lastRowIdx = totalRowCount - 1;
      const firstRow = getRowAtIndex(0);

      setActiveCell({
        rowId: firstRow?.id,
        rowIdx: firstRowIdx,
        colId: col.id,
        colName: col.name,
      });

      if (e.shiftKey && selectionAnchorRef.current) {
        setSelectionAnchor({ rowIdx: firstRowIdx, colIdx: selectionAnchorRef.current.colIdx });
        setSelectionFocus({ rowIdx: lastRowIdx, colIdx });
      } else {
        setSelectionAnchor({ rowIdx: firstRowIdx, colIdx });
        setSelectionFocus({ rowIdx: lastRowIdx, colIdx });
      }
    },
    [resizingCol, renamingColId, isDraggingCol, totalRowCount, getRowAtIndex, setActiveCell]
  );

  // Select all cells in sheet when top-left # corner is clicked
  const handleSelectAllSheet = useCallback(() => {
    if (sheet.columns.length === 0) return;
    if (editingCellRef.current) {
      commitEditRef.current();
    }
    const firstCol = sheet.columns[0];
    const lastRowIdx = totalRowCount - 1;
    const firstRow = getRowAtIndex(0);

    setActiveCell({
      rowId: firstRow?.id,
      rowIdx: 0,
      colId: firstCol.id,
      colName: firstCol.name,
    });

    setSelectionAnchor({ rowIdx: 0, colIdx: 0 });
    setSelectionFocus({ rowIdx: lastRowIdx, colIdx: sheet.columns.length - 1 });
  }, [sheet.columns, totalRowCount, getRowAtIndex, setActiveCell]);

  // Open dropdown popover
  const handleDropdownClick = useCallback((
    e: React.MouseEvent,
    row: RowData,
    rowIdx: number,
    colIdx: number,
    col: ColumnDef
  ) => {
    e.stopPropagation();
    if (editingCellRef.current) {
      commitEditRef.current();
    }
    if (gridContainerRef.current) {
      gridContainerRef.current.focus();
    }
    setActiveCell({ rowId: row.id, rowIdx, colId: col.id, colName: col.name });
    setSelectionAnchor({ rowIdx, colIdx });
    setSelectionFocus({ rowIdx, colIdx });
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const isSource = col.id === "col_lead_source" || col.name.toLowerCase().includes("source");
    const fallbackOptions = isSource ? DEFAULT_LEAD_SOURCES : DEFAULT_FOLLOWUP_OPTIONS;
    setOpenDropdown({
      rowId: row.id,
      colId: col.id,
      rowIdx,
      order: row.order !== undefined ? row.order : rowIdx,
      top: rect.bottom + 2,
      left: rect.left,
      options: col.options && col.options.length > 0 ? col.options : fallbackOptions,
    });
  }, [setActiveCell]);

  // Direct clear cell callback (for date cell X button or context actions)
  const handleClearCell = useCallback(
    async (rowIdx: number, col: ColumnDef) => {
      const targetRow =
        (isFiltered && rowIdx >= 0 && rowIdx < filteredRows.length
          ? filteredRows[rowIdx]
          : null) || getRowAtIndex(rowIdx);
      const targetRowId = targetRow?.id || `temp_${rowIdx}`;
      const targetOrder = targetRow?.order !== undefined ? targetRow.order : rowIdx;
      await onUpdateCell(targetRowId, col.id, "", targetOrder);
    },
    [isFiltered, filteredRows, getRowAtIndex, onUpdateCell]
  );

  // Row context menu
  const handleRowContextMenu = useCallback(
    (e: React.MouseEvent, rowId: string, rowIdx: number) => {
      e.preventDefault();
      if (editingCellRef.current) {
        commitEditRef.current();
      }
      setContextMenu({
        x: e.clientX,
        y: e.clientY,
        rowId,
        colId: sheet.columns[0]?.id || "",
        rowIdx,
      });
    },
    [sheet.columns]
  );

  // Global click outside grid to commit active in-cell editing
  useEffect(() => {
    const handleGlobalMouseDown = (e: MouseEvent) => {
      if (editingCellRef.current && gridContainerRef.current) {
        const target = e.target as Node;
        const isInsideGrid = gridContainerRef.current.contains(target);
        const isInsidePopover = (target as HTMLElement)?.closest?.(".fixed.z-50");
        if (!isInsideGrid && !isInsidePopover) {
          commitEditRef.current();
        }
      }
    };
    window.addEventListener("mousedown", handleGlobalMouseDown, true);
    return () => window.removeEventListener("mousedown", handleGlobalMouseDown, true);
  }, []);

  // Select dropdown option
  const handleSelectDropdownOption = async (option: string) => {
    if (!openDropdown) return;
    const { rowId, colId, rowIdx, order } = openDropdown;
    setOpenDropdown(null);
    const targetOrder = order !== undefined ? order : rowIdx;
    await onUpdateCell(rowId, colId, option, targetOrder);
    if (gridContainerRef.current) {
      gridContainerRef.current.focus();
    }
  };

  // Column resize logic (optimistic 60fps drag with single-commit persistence)
  const startColumnResize = (e: React.MouseEvent, col: ColumnDef) => {
    e.stopPropagation();
    e.preventDefault();
    const currentW = liveColWidths[col.id] || col.width || DEFAULT_COLUMN_WIDTH;
    const resizeInfo = {
      id: col.id,
      startX: e.clientX,
      startWidth: currentW,
      currentWidth: currentW,
    };
    resizingColRef.current = resizeInfo;
    setResizingCol({
      id: col.id,
      startX: e.clientX,
      startWidth: currentW,
    });
  };

  useEffect(() => {
    if (!resizingCol) return;

    const originalCursor = document.body.style.cursor;
    const originalUserSelect = document.body.style.userSelect;
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";

    const handleMouseMove = (e: MouseEvent) => {
      if (!resizingColRef.current) return;
      const delta = e.clientX - resizingColRef.current.startX;
      const newWidth = Math.max(80, resizingColRef.current.startWidth + delta);
      resizingColRef.current.currentWidth = newWidth;
      setLiveColWidths((prev) => {
        if (prev[resizingColRef.current!.id] === newWidth) return prev;
        return {
          ...prev,
          [resizingColRef.current!.id]: newWidth,
        };
      });
    };

    const handleMouseUp = () => {
      const info = resizingColRef.current;
      resizingColRef.current = null;
      setResizingCol(null);
      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;

      if (info && info.currentWidth !== info.startWidth) {
        const updatedCols = sheetRef.current.columns.map((c) =>
          c.id === info.id ? { ...c, width: info.currentWidth } : c
        );
        onUpdateColumns(updatedCols).catch((err) => {
          console.error("Failed to persist resized column:", err);
        });
      }
    };

    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
    return () => {
      document.body.style.cursor = originalCursor;
      document.body.style.userSelect = originalUserSelect;
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
    };
  }, [resizingCol, onUpdateColumns]);

  // Column drag-and-drop reordering handlers (Draggable side-to-side)
  const handleColDragStart = (e: React.DragEvent, colIdx: number) => {
    if (resizingCol || renamingColId !== null) {
      e.preventDefault();
      return;
    }
    setIsDraggingCol(true);
    setDraggedColIdx(colIdx);
    e.dataTransfer.setData("text/plain", String(colIdx));
    e.dataTransfer.effectAllowed = "move";
  };

  const handleColDragOver = (e: React.DragEvent, colIdx: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    if (dragOverColIdx !== colIdx) {
      setDragOverColIdx(colIdx);
    }
  };

  const handleColDrop = async (e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    if (draggedColIdx !== null && draggedColIdx !== targetIdx) {
      const reorderedCols = [...sheet.columns];
      const [movedCol] = reorderedCols.splice(draggedColIdx, 1);
      reorderedCols.splice(targetIdx, 0, movedCol);
      await onUpdateColumns(reorderedCols);
    }
    setDraggedColIdx(null);
    setDragOverColIdx(null);
    setTimeout(() => setIsDraggingCol(false), 100);
  };

  const handleColDragEnd = () => {
    setDraggedColIdx(null);
    setDragOverColIdx(null);
    setTimeout(() => setIsDraggingCol(false), 100);
  };

  // Keyboard Navigation with Google Sheets Range Selection & Standard Spreadsheet Controls
  const handleKeyDown = useCallback(
    async (e: React.KeyboardEvent) => {
      // 1. In Edit Mode
      if (editingCell) {
        if (e.key === "Enter") {
          e.preventDefault();
          commitEdit(e.shiftKey ? "up" : "down");
        } else if (e.key === "Tab") {
          e.preventDefault();
          commitEdit(e.shiftKey ? "left" : "right");
        } else if (e.key === "Escape") {
          e.preventDefault();
          setEditingCell(null);
        }
        return;
      }

      // 2. Global Undo / Redo Shortcuts (Ctrl+Z, Ctrl+Y, Ctrl+Shift+Z)
      if ((e.ctrlKey || e.metaKey) && (e.key === "z" || e.key === "Z")) {
        e.preventDefault();
        if (e.shiftKey) {
          if (onRedo) onRedo();
        } else {
          if (onUndo) onUndo();
        }
        return;
      }

      if ((e.ctrlKey || e.metaKey) && (e.key === "y" || e.key === "Y")) {
        e.preventDefault();
        if (onRedo) onRedo();
        return;
      }

      // 2b. Delete Row shortcut (Ctrl + - or Cmd + -) like Google Sheets
      if ((e.ctrlKey || e.metaKey) && (e.key === "-" || e.key === "_")) {
        e.preventDefault();
        if (!activeCell) return;
        const startRowIndex = selectionRange ? selectionRange.startRow : activeCell.rowIdx;
        const endRowIndex = selectionRange ? selectionRange.endRow : activeCell.rowIdx;
        const count = endRowIndex - startRowIndex + 1;

        const rowIdsToDelete: string[] = [];
        const ordersToDelete: number[] = [];

        for (let r = startRowIndex; r <= endRowIndex; r++) {
          const row = isFiltered
            ? (r >= 0 && r < filteredRows.length ? filteredRows[r] : null)
            : getRowAtIndex(r);

          const rowId = row?.id || `temp_${r}`;
          rowIdsToDelete.push(rowId);

          const ord = row?.order !== undefined ? row.order : r;
          ordersToDelete.push(ord);
        }

        await onDeleteRows(rowIdsToDelete, {
          startRowIndex,
          endRowIndex,
          count,
          deletedOrders: ordersToDelete,
        });

        // Maintain selection at startRowIndex
        const targetRowAfter = isFiltered
          ? (startRowIndex < filteredRows.length ? filteredRows[startRowIndex] : null)
          : getRowAtIndex(startRowIndex);
        setActiveCell({
          ...activeCell,
          rowIdx: startRowIndex,
          rowId: targetRowAfter?.id || `temp_${startRowIndex}`,
        });
        setSelectionAnchor({ rowIdx: startRowIndex, colIdx: 0 });
        setSelectionFocus({ rowIdx: startRowIndex, colIdx: sheet.columns.length - 1 });
        return;
      }

      if (!activeCell) return;

      const currentColIdx = sheet.columns.findIndex((c) => c.id === activeCell.colId);
      const maxRowIdx = totalRowCount - 1;
      const maxColIdx = sheet.columns.length - 1;

      // 3. Escape: Collapse multi-cell selection to active cell
      if (e.key === "Escape") {
        e.preventDefault();
        if (currentColIdx !== -1) {
          setSelectionAnchor({ rowIdx: activeCell.rowIdx, colIdx: currentColIdx });
          setSelectionFocus({ rowIdx: activeCell.rowIdx, colIdx: currentColIdx });
        }
        return;
      }

      // 4. Enter / Shift+Enter Navigation:
      // Pressing Enter moves active cell focus down one row. Shift+Enter moves it up one row.
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          if (activeCell.rowIdx > 0) {
            const newRow = activeCell.rowIdx - 1;
            const targetRow = getRowAtIndex(newRow);
            setActiveCell({
              rowId: targetRow?.id,
              rowIdx: newRow,
              colId: activeCell.colId,
              colName: activeCell.colName,
            });
            setSelectionAnchor({ rowIdx: newRow, colIdx: currentColIdx });
            setSelectionFocus({ rowIdx: newRow, colIdx: currentColIdx });
          }
        } else {
          if (activeCell.rowIdx < maxRowIdx) {
            const newRow = activeCell.rowIdx + 1;
            const targetRow = getRowAtIndex(newRow);
            setActiveCell({
              rowId: targetRow?.id,
              rowIdx: newRow,
              colId: activeCell.colId,
              colName: activeCell.colName,
            });
            setSelectionAnchor({ rowIdx: newRow, colIdx: currentColIdx });
            setSelectionFocus({ rowIdx: newRow, colIdx: currentColIdx });
          }
        }
        return;
      }

      // 5. Tab / Shift+Tab Navigation:
      // Pressing Tab moves active cell focus right one column. Shift+Tab moves it left one column.
      if (e.key === "Tab") {
        e.preventDefault();
        if (e.shiftKey) {
          if (currentColIdx > 0) {
            const prevCol = sheet.columns[currentColIdx - 1];
            setActiveCell({
              rowId: activeCell.rowId,
              rowIdx: activeCell.rowIdx,
              colId: prevCol.id,
              colName: prevCol.name,
            });
            setSelectionAnchor({ rowIdx: activeCell.rowIdx, colIdx: currentColIdx - 1 });
            setSelectionFocus({ rowIdx: activeCell.rowIdx, colIdx: currentColIdx - 1 });
          }
        } else {
          if (currentColIdx < maxColIdx) {
            const nextCol = sheet.columns[currentColIdx + 1];
            setActiveCell({
              rowId: activeCell.rowId,
              rowIdx: activeCell.rowIdx,
              colId: nextCol.id,
              colName: nextCol.name,
            });
            setSelectionAnchor({ rowIdx: activeCell.rowIdx, colIdx: currentColIdx + 1 });
            setSelectionFocus({ rowIdx: activeCell.rowIdx, colIdx: currentColIdx + 1 });
          }
        }
        return;
      }

      // 6. Arrow Keys (Up, Down, Left, Right)
      if (e.key === "ArrowUp") {
        e.preventDefault();
        if (e.shiftKey) {
          const currentFocusRow = selectionFocus?.rowIdx ?? activeCell.rowIdx;
          const currentFocusCol = selectionFocus?.colIdx ?? currentColIdx;
          const newFocusRow = Math.max(0, currentFocusRow - 1);
          setSelectionFocus({ rowIdx: newFocusRow, colIdx: currentFocusCol });
        } else {
          if (activeCell.rowIdx > 0) {
            const newRow = activeCell.rowIdx - 1;
            const targetRow = getRowAtIndex(newRow);
            setActiveCell({
              rowId: targetRow?.id,
              rowIdx: newRow,
              colId: activeCell.colId,
              colName: activeCell.colName,
            });
            setSelectionAnchor({ rowIdx: newRow, colIdx: currentColIdx });
            setSelectionFocus({ rowIdx: newRow, colIdx: currentColIdx });
          }
        }
        return;
      }

      if (e.key === "ArrowDown") {
        e.preventDefault();
        if (e.shiftKey) {
          const currentFocusRow = selectionFocus?.rowIdx ?? activeCell.rowIdx;
          const currentFocusCol = selectionFocus?.colIdx ?? currentColIdx;
          const newFocusRow = Math.min(maxRowIdx, currentFocusRow + 1);
          setSelectionFocus({ rowIdx: newFocusRow, colIdx: currentFocusCol });
        } else {
          if (activeCell.rowIdx < maxRowIdx) {
            const newRow = activeCell.rowIdx + 1;
            const targetRow = getRowAtIndex(newRow);
            setActiveCell({
              rowId: targetRow?.id,
              rowIdx: newRow,
              colId: activeCell.colId,
              colName: activeCell.colName,
            });
            setSelectionAnchor({ rowIdx: newRow, colIdx: currentColIdx });
            setSelectionFocus({ rowIdx: newRow, colIdx: currentColIdx });
          }
        }
        return;
      }

      if (e.key === "ArrowLeft") {
        e.preventDefault();
        if (e.shiftKey) {
          const currentFocusRow = selectionFocus?.rowIdx ?? activeCell.rowIdx;
          const currentFocusCol = selectionFocus?.colIdx ?? currentColIdx;
          const newFocusCol = Math.max(0, currentFocusCol - 1);
          setSelectionFocus({ rowIdx: currentFocusRow, colIdx: newFocusCol });
        } else {
          if (currentColIdx > 0) {
            const prevCol = sheet.columns[currentColIdx - 1];
            setActiveCell({
              rowId: activeCell.rowId,
              rowIdx: activeCell.rowIdx,
              colId: prevCol.id,
              colName: prevCol.name,
            });
            setSelectionAnchor({ rowIdx: activeCell.rowIdx, colIdx: currentColIdx - 1 });
            setSelectionFocus({ rowIdx: activeCell.rowIdx, colIdx: currentColIdx - 1 });
          }
        }
        return;
      }

      if (e.key === "ArrowRight") {
        e.preventDefault();
        if (e.shiftKey) {
          const currentFocusRow = selectionFocus?.rowIdx ?? activeCell.rowIdx;
          const currentFocusCol = selectionFocus?.colIdx ?? currentColIdx;
          const newFocusCol = Math.min(maxColIdx, currentFocusCol + 1);
          setSelectionFocus({ rowIdx: currentFocusRow, colIdx: newFocusCol });
        } else {
          if (currentColIdx < maxColIdx) {
            const nextCol = sheet.columns[currentColIdx + 1];
            setActiveCell({
              rowId: activeCell.rowId,
              rowIdx: activeCell.rowIdx,
              colId: nextCol.id,
              colName: nextCol.name,
            });
            setSelectionAnchor({ rowIdx: activeCell.rowIdx, colIdx: currentColIdx + 1 });
            setSelectionFocus({ rowIdx: activeCell.rowIdx, colIdx: currentColIdx + 1 });
          }
        }
        return;
      }

      // 7. F2 to start editing active cell
      if (e.key === "F2") {
        e.preventDefault();
        const activeColDef = sheet.columns[currentColIdx];
        if (activeColDef && activeColDef.type !== "dropdown") {
          const targetRow = getRowAtIndex(activeCell.rowIdx);
          startEditing(targetRow, activeCell.rowIdx, activeColDef);
        }
        return;
      }

      // 8. Delete / Backspace: Clear selected cell(s) and update database
      if (e.key === "Delete" || e.key === "Backspace") {
        e.preventDefault();
        if (isMultiCell && selectionRange) {
          const rowsToUpsert: Partial<RowData>[] = [];
          for (let r = selectionRange.startRow; r <= selectionRange.endRow; r++) {
            const existingRow =
              (isFiltered && r >= 0 && r < filteredRows.length ? filteredRows[r] : null) ||
              getRowAtIndex(r);
            const rowData = { ...existingRow.data };
            let changed = false;
            for (let c = selectionRange.startCol; c <= selectionRange.endCol; c++) {
              const col = sheet.columns[c];
              if (
                col &&
                rowData[col.id] !== undefined &&
                rowData[col.id] !== null &&
                rowData[col.id] !== ""
              ) {
                rowData[col.id] = "";
                changed = true;
              }
            }
            if (changed) {
              const targetOrder = existingRow.order !== undefined ? existingRow.order : r;
              rowsToUpsert.push({
                id: existingRow.id,
                sheetId: sheet.id,
                order: targetOrder,
                data: rowData,
              });
            }
          }
          if (rowsToUpsert.length > 0) {
            await onBatchUpdateRows(rowsToUpsert);
          }
        } else {
          const targetRow =
            (activeCell.rowId && !activeCell.rowId.startsWith("temp_")
              ? sheet.rows.find((r) => r.id === activeCell.rowId)
              : null) ||
            (isFiltered && activeCell.rowIdx >= 0 && activeCell.rowIdx < filteredRows.length
              ? filteredRows[activeCell.rowIdx]
              : null) ||
            sheet.rows.find((r) => (r.order !== undefined ? r.order : -1) === activeCell.rowIdx) ||
            getRowAtIndex(activeCell.rowIdx);

          const targetRowId = targetRow?.id || activeCell.rowId || `temp_${activeCell.rowIdx}`;
          const targetOrder = targetRow?.order !== undefined ? targetRow.order : activeCell.rowIdx;

          const currentValue = targetRow?.data ? targetRow.data[activeCell.colId] : undefined;
          const hasValue = currentValue !== undefined && currentValue !== null && currentValue !== "";

          if (hasValue || !targetRowId.startsWith("temp_")) {
            await onUpdateCell(targetRowId, activeCell.colId, "", targetOrder);
          }
        }
        return;
      }

      // 9. Quick edit on typing alphanumeric or printable characters directly
      if (
        !e.ctrlKey &&
        !e.metaKey &&
        !e.altKey &&
        e.key.length === 1 &&
        currentColIdx !== -1
      ) {
        const activeColDef = sheet.columns[currentColIdx];
        if (activeColDef && activeColDef.type !== "dropdown") {
          e.preventDefault();
          const row = getRowAtIndex(activeCell.rowIdx);
          setEditingCell({ rowId: row.id, colId: activeColDef.id, rowIdx: activeCell.rowIdx });
          setEditValue(e.key);
          return;
        }
      }
    },
    [
      editingCell,
      activeCell,
      selectionFocus,
      isMultiCell,
      selectionRange,
      sheet.columns,
      sheet.id,
      totalRowCount,
      commitEdit,
      getRowAtIndex,
      onBatchUpdateRows,
      onUpdateCell,
      onUndo,
      onRedo,
    ]
  );

  // Multi-cell Copy & Paste (Ctrl+C / Ctrl+V) - Excel & Google Sheets compatible
  const handlePaste = useCallback(
    async (e: React.ClipboardEvent) => {
      // Explicitly prevent browser default action and stop bubbling to eliminate page reloads and DOM glitches
      e.preventDefault();
      e.stopPropagation();

      const currentActive = activeCellRef.current || activeCell;
      const currentSheet = sheetRef.current || sheet;
      if (!currentActive) return;

      const rawText = e.clipboardData.getData("text/plain");
      if (!rawText) return;

      // 1. Split into rows by newline, handling CRLF (\r\n) and CR (\r)
      const rows = rawText.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
      // Remove trailing empty row caused by Google Sheets' trailing newline
      if (rows.length > 1 && rows[rows.length - 1] === "") {
        rows.pop();
      }
      if (rows.length === 0) return;

      // If user was actively editing a cell, close edit mode cleanly
      if (editingCell) {
        setEditingCell(null);
      }

      // 2. Split each row into columns by tab
      const matrix = rows.map((row) => {
        return row.split("\t").map((cell) => {
          let val = cell.trim();
          if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
            val = val.substring(1, val.length - 1).replace(/""/g, '"');
          }
          return val;
        });
      });

      // If user pastes while filters are active, clear the filters immediately
      // so the newly pasted rows are placed and visible in the true full sheet
      if (isFiltered && onClearFilters) {
        onClearFilters();
      }

      // Determine starting coordinates from currently focused cell
      const startRowIndex = currentActive.rowIdx;
      let startColIndex = currentSheet.columns.findIndex((c) => c.id === currentActive.colId);
      if (startColIndex === -1) startColIndex = 0;

      const isSingleValue = matrix.length === 1 && matrix[0].length === 1;

      // Case A: SINGLE CELL PASTE (Single value pasted into single active cell)
      if (isSingleValue && !isMultiCell) {
        const targetCol = currentSheet.columns[startColIndex];
        const rawVal = matrix[0][0];
        const sanitizedVal = sanitizeCellValue(rawVal, targetCol);
        const existingRow = getRowAtIndex(startRowIndex);

        try {
          await onUpdateCell(existingRow.id, currentActive.colId, sanitizedVal, startRowIndex);
        } catch (err) {
          console.error("Single cell paste error:", err);
        }
        return;
      }

      // Case B: SINGLE VALUE PASTE TO MULTI-CELL RANGE:
      // If a single value is copied and multiple cells are highlighted, fill the entire range
      if (isSingleValue && isMultiCell && selectionRange) {
        const rawVal = matrix[0][0];

        // Expand rows dynamically if selection extends beyond totalRowCount
        if (selectionRange.endRow >= totalRowCount) {
          setExpandedRowCount(selectionRange.endRow + 50);
        }

        const rowsToUpsert: Partial<RowData>[] = [];

        for (let r = selectionRange.startRow; r <= selectionRange.endRow; r++) {
          const existingRow = getRowAtIndex(r);
          const isExistingInDb = Boolean(existingRow && existingRow.id && !existingRow.id.startsWith("temp_"));
          const rowData = existingRow ? { ...existingRow.data } : {};

          for (let c = selectionRange.startCol; c <= selectionRange.endCol; c++) {
            const col = currentSheet.columns[c];
            if (col) {
              rowData[col.id] = sanitizeCellValue(rawVal, col);
            }
          }

          const rowId = isExistingInDb
            ? existingRow.id
            : (existingRow?.id || `temp_${Date.now()}_${r}_${Math.random().toString(36).substring(2, 7)}`);

          rowsToUpsert.push({
            id: rowId,
            sheetId: currentSheet.id,
            order: r,
            data: rowData,
            styles: existingRow?.styles || {},
          });
        }

        if (rowsToUpsert.length > 0) {
          try {
            await onBatchUpdateRows(rowsToUpsert);
          } catch (err) {
            console.error("Batch range paste error:", err);
          }
        }
        return;
      }

      // Case C: 2D MATRIX BULK PASTE (Multi-row and/or multi-column from Google Sheets / Excel)
      // Expand total row count dynamically if paste extends beyond currently rendered rows
      const requiredRows = startRowIndex + matrix.length;
      if (requiredRows > totalRowCount) {
        setExpandedRowCount(requiredRows + 50);
      }

      const rowsToUpsert: Partial<RowData>[] = [];

      matrix.forEach((rowVals, rowOffset) => {
        const targetRowIndex = startRowIndex + rowOffset;
        const existingRow = getRowAtIndex(targetRowIndex);
        const isExistingInDb = Boolean(existingRow && existingRow.id && !existingRow.id.startsWith("temp_"));

        // If targetRowIndex exists in current tab's leads: update existing lead fields
        // If targetRowIndex exceeds existing rows or lands on empty rows: create new lead pre-assigned to active sheet
        const rowData: Record<string, any> = isExistingInDb
          ? { ...existingRow.data }
          : existingRow
          ? { ...existingRow.data }
          : {};

        // Map column values across editable columns, ignoring read-only columns like #
        rowVals.forEach((val, colOffset) => {
          const targetColIndex = startColIndex + colOffset;
          if (targetColIndex < currentSheet.columns.length) {
            const col = currentSheet.columns[targetColIndex];
            if (col) {
              rowData[col.id] = sanitizeCellValue(val, col);
            }
          }
        });

        const rowId = isExistingInDb
          ? existingRow.id
          : (existingRow?.id || `temp_${Date.now()}_${targetRowIndex}_${Math.random().toString(36).substring(2, 7)}`);

        rowsToUpsert.push({
          id: rowId,
          sheetId: currentSheet.id,
          order: targetRowIndex,
          data: rowData,
          styles: existingRow?.styles || {},
        });
      });

      if (rowsToUpsert.length > 0) {
        try {
          await onBatchUpdateRows(rowsToUpsert);
        } catch (err) {
          console.error("Matrix paste batch error:", err);
        }
      }
    },
    [
      editingCell,
      activeCell,
      isMultiCell,
      selectionRange,
      sheet.columns,
      sheet.id,
      totalRowCount,
      getRowAtIndex,
      onUpdateCell,
      onBatchUpdateRows,
      isFiltered,
      onClearFilters,
    ]
  );

  // Copy active cell value or multi-cell selection range (Ctrl+C) - Google Sheets format
  const handleCopy = useCallback(
    (e: React.ClipboardEvent) => {
      if (editingCell) return;
      if (!activeCell) return;

      if (isMultiCell && selectionRange) {
        const lines: string[] = [];
        for (let r = selectionRange.startRow; r <= selectionRange.endRow; r++) {
          const row = getRowAtIndex(r);
          const rowVals: string[] = [];
          for (let c = selectionRange.startCol; c <= selectionRange.endCol; c++) {
            const col = sheet.columns[c];
            rowVals.push(col ? (row.data[col.id] || "") : "");
          }
          lines.push(rowVals.join("\t"));
        }
        e.clipboardData.setData("text/plain", lines.join("\n"));
        e.preventDefault();
        return;
      }

      const activeRow = getRowAtIndex(activeCell.rowIdx);
      const cellVal = activeRow.data[activeCell.colId] || "";
      e.clipboardData.setData("text/plain", cellVal);
      e.preventDefault();
    },
    [editingCell, activeCell, isMultiCell, selectionRange, getRowAtIndex, sheet.columns]
  );

  // Context Menu
  const handleContextMenu = (
    e: React.MouseEvent,
    row: RowData,
    rowIdx: number,
    colIdx: number,
    col: ColumnDef
  ) => {
    e.preventDefault();
    if (editingCellRef.current) {
      commitEditRef.current();
    }
    const inSel =
      selectionRange !== null &&
      rowIdx >= selectionRange.startRow &&
      rowIdx <= selectionRange.endRow &&
      colIdx >= selectionRange.startCol &&
      colIdx <= selectionRange.endCol;

    if (!inSel) {
      setActiveCell({ rowId: row.id, rowIdx, colId: col.id, colName: col.name });
      setSelectionAnchor({ rowIdx, colIdx });
      setSelectionFocus({ rowIdx, colIdx });
    }

    setContextMenu({
      x: e.clientX,
      y: e.clientY,
      rowId: row.id,
      colId: col.id,
      rowIdx,
    });
  };

  useEffect(() => {
    const handleDocumentClick = () => {
      setContextMenu(null);
      setColumnMenu(null);
      if (openDropdown) setOpenDropdown(null);
    };
    document.addEventListener("click", handleDocumentClick);
    return () => document.removeEventListener("click", handleDocumentClick);
  }, [openDropdown]);

  // Column Actions
  const handleStartRenameColumn = (col: ColumnDef) => {
    setRenamingColId(col.id);
    setColRenameValue(col.name);
    setColumnMenu(null);
  };

  const handleSaveRenameColumn = async (colId: string) => {
    const trimmed = colRenameValue.trim();
    if (trimmed) {
      const updated = sheet.columns.map((c) =>
        c.id === colId ? { ...c, name: trimmed } : c
      );
      await onUpdateColumns(updated);
      if (activeCell && activeCell.colId === colId) {
        setActiveCell({ ...activeCell, colName: trimmed });
      }
    }
    setRenamingColId(null);
  };

  const handleDeleteColumn = async (colId: string) => {
    if (sheet.columns.length <= 1) {
      alert("A sheet must have at least one column.");
      return;
    }
    if (confirm("Are you sure you want to delete this column?")) {
      const updated = sheet.columns.filter((c) => c.id !== colId);
      await onUpdateColumns(updated);
    }
    setColumnMenu(null);
  };

  // Diagnostic log for desktop table render
  console.log("Desktop Grid Data:", sheet.rows);

  return (
    <div
      ref={gridContainerRef}
      tabIndex={0}
      onScroll={handleScroll}
      onKeyDown={handleKeyDown}
      onPaste={handlePaste}
      onCopy={handleCopy}
      className="flex-1 w-full h-[calc(100vh-200px)] min-h-[400px] overflow-y-auto overflow-x-auto bg-slate-100 outline-none relative select-none"
      style={{ height: "calc(100vh - 200px)" }}
    >
      <div
        className="pb-24 select-none"
        style={{
          width: `${totalTableWidth}px`,
          minWidth: `${totalTableWidth}px`,
        }}
      >
        <table
          style={{
            width: `${totalTableWidth}px`,
            minWidth: `${totalTableWidth}px`,
            tableLayout: "fixed",
          }}
          className="border-collapse table-fixed bg-white text-slate-800 text-xs shadow-xs select-none"
        >
          {/* Column definitions & widths */}
          <colgroup>
            <col style={{ width: `${ROW_HEADER_WIDTH}px`, minWidth: `${ROW_HEADER_WIDTH}px`, maxWidth: `${ROW_HEADER_WIDTH}px` }} />
            {currentColumns.map((col) => {
              const colWidth = col.width || DEFAULT_COLUMN_WIDTH;
              return (
                <col
                  key={col.id}
                  style={{
                    width: `${colWidth}px`,
                    minWidth: `${colWidth}px`,
                    maxWidth: `${colWidth}px`,
                  }}
                />
              );
            })}
          </colgroup>

          {/* Sticky Table Header */}
          <thead className="sticky top-0 z-20 shadow-xs">
            <tr className="h-10 select-none">
              {/* Row number top-left corner (Click to select all cells in sheet) */}
              <th
                onClick={handleSelectAllSheet}
                style={{ width: `${ROW_HEADER_WIDTH}px`, minWidth: `${ROW_HEADER_WIDTH}px`, maxWidth: `${ROW_HEADER_WIDTH}px` }}
                className="sticky left-0 z-30 bg-slate-200 hover:bg-slate-300 border-b-2 border-r border-slate-300 text-slate-600 font-bold text-center text-[11px] p-0 cursor-pointer transition-colors select-none"
                title="Click to select all cells in sheet"
              >
                #
              </th>

              {/* Columns */}
              {currentColumns.map((col, colIdx) => {
                const colWidth = col.width || DEFAULT_COLUMN_WIDTH;
                const isNavy = col.headerStyle === "navy" || col.name.includes("Follow Up");
                const isGold = !isNavy;

                const headerBg = isNavy
                  ? "bg-slate-900 text-amber-300 font-bold border-slate-950"
                  : "bg-amber-300 text-slate-950 font-bold border-amber-400";

                const maxRowForCol = isFiltered && filteredRows.length > 0
                  ? Math.max(...filteredRows.map((r, i) => (r.order !== undefined ? r.order : i)))
                  : totalRowCount - 1;

                const isColSelected =
                  selectionRange !== null &&
                  colIdx >= selectionRange.startCol &&
                  colIdx <= selectionRange.endCol &&
                  selectionRange.startRow === 0 &&
                  selectionRange.endRow >= Math.min(maxRowForCol, totalRowCount - 1);

                const isBeingDragged = draggedColIdx === colIdx;
                const isDropTarget = dragOverColIdx === colIdx && draggedColIdx !== colIdx;

                return (
                  <th
                    key={col.id}
                    style={{
                      width: `${colWidth}px`,
                      minWidth: `${colWidth}px`,
                      maxWidth: `${colWidth}px`,
                    }}
                    draggable={!resizingCol && renamingColId === null}
                    onDragStart={(e) => handleColDragStart(e, colIdx)}
                    onDragOver={(e) => handleColDragOver(e, colIdx)}
                    onDrop={(e) => handleColDrop(e, colIdx)}
                    onDragEnd={handleColDragEnd}
                    onClick={(e) => handleColumnHeaderClick(e, colIdx, col)}
                    onDoubleClick={() => handleStartRenameColumn(col)}
                    className={`relative border-b-2 border-r border-slate-400/40 px-2.5 py-2 text-left font-semibold text-xs tracking-wide select-none group transition-all cursor-pointer ${headerBg} ${
                      isColSelected ? "ring-2 ring-blue-600 bg-blue-100 text-blue-950 font-black shadow-inner" : "hover:brightness-95"
                    } ${isBeingDragged ? "opacity-30 scale-95 shadow-inner" : ""} ${
                      isDropTarget ? "border-l-4 border-l-blue-600 bg-blue-100 text-blue-950 ring-2 ring-blue-400" : ""
                    }`}
                    title="Click to select entire column, drag to reorder, double-click to rename"
                  >
                    {renamingColId === col.id ? (
                      <div
                        className="flex items-center gap-1 cursor-default"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="text"
                          value={colRenameValue}
                          onChange={(e) => setColRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveRenameColumn(col.id);
                            if (e.key === "Escape") setRenamingColId(null);
                          }}
                          autoFocus
                          className="w-full px-1.5 py-0.5 text-xs text-slate-950 bg-white rounded border border-blue-500 outline-none select-text"
                        />
                        <button
                          onClick={() => handleSaveRenameColumn(col.id)}
                          className="p-1 hover:text-emerald-500"
                        >
                          <Check className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-1">
                        <div className="flex items-center gap-1 min-w-0 flex-1">
                          <GripVertical className="h-3.5 w-3.5 opacity-30 group-hover:opacity-90 shrink-0 text-current transition-opacity" />
                          <span className="truncate" title={`${col.name} (drag to reorder)`}>
                            {col.name}
                          </span>
                        </div>

                        <div className="flex items-center opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                          {col.type === "dropdown" && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onOpenDropdownModal(col);
                              }}
                              className={`p-1 rounded hover:bg-black/20 transition-colors ${
                                isNavy ? "text-amber-300" : "text-slate-800"
                              }`}
                              title="Customize dropdown options"
                            >
                              <Settings2 className="h-3 w-3" />
                            </button>
                          )}
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const rect = e.currentTarget.getBoundingClientRect();
                              setColumnMenu({
                                colId: col.id,
                                top: rect.bottom + 4,
                                left: rect.left - 50,
                              });
                            }}
                            className={`p-1 rounded hover:bg-black/20 transition-colors ${
                              isNavy ? "text-amber-300" : "text-slate-800"
                            }`}
                            title="Column options"
                          >
                            <MoreHorizontal className="h-3 w-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Draggable Column Width Resizer */}
                    <div
                      onMouseDown={(e) => startColumnResize(e, col)}
                      className="absolute right-0 top-0 bottom-0 w-2 cursor-col-resize hover:bg-blue-600 active:bg-blue-700 z-10 transition-colors"
                      title="Drag to resize column width"
                    />
                  </th>
                );
              })}
            </tr>
          </thead>

          {/* Table Body with Windowing for 1,000 Rows */}
          <tbody>
            {/* Top Spacer (only in unfiltered 1,000-row mode) */}
            {!isFiltered && topSpacerHeight > 0 && (
              <tr style={{ height: `${topSpacerHeight}px` }}>
                <td colSpan={currentColumns.length + 1} className="border-b border-slate-300 p-0" />
              </tr>
            )}

            {/* Empty state when filtered and no leads match */}
            {isFiltered && filteredRows.length === 0 && (
              <tr>
                <td colSpan={currentColumns.length + 1} className="py-16 text-center bg-white border-b border-slate-200">
                  <div className="flex flex-col items-center justify-center gap-2 max-w-sm mx-auto text-slate-500">
                    <div className="h-12 w-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
                      <Calendar className="h-6 w-6" />
                    </div>
                    <h4 className="text-sm font-bold text-slate-800">
                      {statusFilter === "Unattended" ? "All leads have been attended! 🎉" : "No leads match the active filters"}
                    </h4>
                    <p className="text-xs text-slate-500">
                      {statusFilter === "Unattended"
                        ? "Every lead in this sheet has at least one follow-up recorded."
                        : dateFilter
                        ? `No leads were added on ${formatDateDisplay(dateFilter)}.`
                        : "Try selecting a different date or status option."}
                    </p>
                  </div>
                </td>
              </tr>
            )}

            {/* Rows to render (filtered leads consecutively, or virtualized window) */}
            {isFiltered
              ? filteredRows.map((row, renderedIdx) => {
                  const rowIdx = renderedIdx;
                  const serialNumber = renderedIdx + 1;

                  const isRowSelected =
                    selectionRange !== null &&
                    rowIdx >= selectionRange.startRow &&
                    rowIdx <= selectionRange.endRow &&
                    selectionRange.startCol === 0 &&
                    selectionRange.endCol >= (currentColumns.length - 1);

                  return (
                    <MemoizedGridRow
                      key={row.id || `filtered_${renderedIdx}`}
                      rowIdx={rowIdx}
                      serialNumber={serialNumber}
                      row={row}
                      columns={currentColumns}
                      isRowSelected={isRowSelected}
                      activeCell={activeCell}
                      selectionRange={selectionRange}
                      isMultiCell={isMultiCell}
                      editingCell={editingCell}
                      editValue={editValue}
                      onEditValueChange={setEditValue}
                      onCommitEdit={commitEdit}
                      onCommitEditWithDirection={commitEdit}
                      onCancelEdit={cancelEdit}
                      onPaste={handlePaste}
                      editInputRef={editInputRef}
                      onRowHeaderClick={handleRowHeaderClick}
                      onRowContextMenu={handleRowContextMenu}
                      onCellMouseDown={handleCellMouseDown}
                      onCellMouseEnter={handleCellMouseEnter}
                      onCellDoubleClick={handleCellDoubleClick}
                      onCellContextMenu={handleContextMenu}
                      onDropdownClick={handleDropdownClick}
                      onStartEditing={startEditing}
                      onClearCell={handleClearCell}
                    />
                  );
                })
              : visibleRowIndices.map((rowIdx) => {
                  const row = getRowAtIndex(rowIdx);
                  const serialNumber = rowIdx + 1;

                  const isRowSelected =
                    selectionRange !== null &&
                    rowIdx >= selectionRange.startRow &&
                    rowIdx <= selectionRange.endRow &&
                    selectionRange.startCol === 0 &&
                    selectionRange.endCol >= (currentColumns.length - 1);

                  return (
                    <MemoizedGridRow
                      key={row.id}
                      rowIdx={rowIdx}
                      serialNumber={serialNumber}
                      row={row}
                      columns={currentColumns}
                      isRowSelected={isRowSelected}
                      activeCell={activeCell}
                      selectionRange={selectionRange}
                      isMultiCell={isMultiCell}
                      editingCell={editingCell}
                      editValue={editValue}
                      onEditValueChange={setEditValue}
                      onCommitEdit={commitEdit}
                      onCommitEditWithDirection={commitEdit}
                      onCancelEdit={cancelEdit}
                      onPaste={handlePaste}
                      editInputRef={editInputRef}
                      onRowHeaderClick={handleRowHeaderClick}
                      onRowContextMenu={handleRowContextMenu}
                      onCellMouseDown={handleCellMouseDown}
                      onCellMouseEnter={handleCellMouseEnter}
                      onCellDoubleClick={handleCellDoubleClick}
                      onCellContextMenu={handleContextMenu}
                      onDropdownClick={handleDropdownClick}
                      onStartEditing={startEditing}
                      onClearCell={handleClearCell}
                    />
                  );
                })}

            {/* Bottom Spacer (only in unfiltered 1,000-row mode) */}
            {!isFiltered && bottomSpacerHeight > 0 && (
              <tr style={{ height: `${bottomSpacerHeight}px` }}>
                <td colSpan={currentColumns.length + 1} className="border-b border-slate-300 p-0" />
              </tr>
            )}
          </tbody>
        </table>

        {/* Dynamic Row Expansion Footer (like Google Sheets) */}
        <div className="p-4 bg-white border-b border-t border-slate-300 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-600 font-medium">Add</span>
            <input
              type="number"
              min={10}
              max={5000}
              value={addMoreAmount}
              onChange={(e) => setAddMoreAmount(Math.max(1, parseInt(e.target.value) || 100))}
              className="w-20 px-2 py-1 text-xs border border-slate-300 rounded font-semibold text-center"
            />
            <span className="text-xs text-slate-600 font-medium">more rows at bottom</span>
            <button
              onClick={() => setExpandedRowCount((prev) => prev + addMoreAmount)}
              className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded text-xs font-semibold flex items-center gap-1 shadow-2xs transition-colors"
            >
              <Plus className="h-3 w-3" />
              <span>Add</span>
            </button>
          </div>

          <div className="text-xs text-slate-400 border-l border-slate-200 pl-3">
            Grid initialized with <strong className="text-slate-700">{totalRowCount.toLocaleString()}</strong> rows (Google Sheets Clean Slate Mode)
          </div>
        </div>
      </div>

      {/* Dropdown Options Popover Menu */}
      {openDropdown && (
        <div
          tabIndex={0}
          style={{ top: `${openDropdown.top}px`, left: `${openDropdown.left}px` }}
          className="fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 w-64 max-h-80 overflow-y-auto animate-in fade-in zoom-in-95 outline-none"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setOpenDropdown(null);
              gridContainerRef.current?.focus();
            } else if (e.key === "Delete" || e.key === "Backspace") {
              e.preventDefault();
              handleSelectDropdownOption("");
            }
          }}
        >
          <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100 flex items-center justify-between">
            <span>{openDropdown.colId === "col_lead_source" ? "Select Lead Source" : "Select Follow-Up Status"}</span>
            <button
              type="button"
              onClick={() => handleSelectDropdownOption("")}
              className="text-[10px] text-rose-500 hover:text-rose-700 font-semibold px-1 py-0.5 rounded hover:bg-rose-50 transition-colors"
            >
              Clear
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleSelectDropdownOption("")}
            className="w-full px-3 py-2 text-left text-xs hover:bg-rose-50 flex items-center gap-2 transition-colors font-medium text-rose-600 border-b border-slate-100"
          >
            <span className="h-2.5 w-2.5 rounded-full border border-dashed border-rose-400 flex items-center justify-center shrink-0" />
            <span>Clear Selection (None)</span>
          </button>
          {openDropdown.options.map((opt) => {
            const colors =
              openDropdown.colId === "col_lead_source"
                ? getSourceColor(opt)
                : STATUS_COLORS[opt];
            return (
              <button
                key={opt}
                type="button"
                onClick={() => handleSelectDropdownOption(opt)}
                className="w-full px-3 py-2 text-left text-xs hover:bg-slate-50 flex items-center gap-2 transition-colors font-medium text-slate-700"
              >
                <span
                  className={`h-2.5 w-2.5 rounded-full shrink-0 ${
                    colors ? colors.bg.replace("bg-", "bg-opacity-80 ") : "bg-slate-300"
                  }`}
                  style={{
                    backgroundColor: colors ? undefined : "#94a3b8",
                  }}
                />
                <span className="truncate">{opt}</span>
              </button>
            );
          })}
        </div>
      )}

      {/* Column Menu Popover */}
      {columnMenu && (
        <div
          style={{ top: `${columnMenu.top}px`, left: `${columnMenu.left}px` }}
          className="fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 w-48 text-slate-800 animate-in fade-in zoom-in-95 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          {(() => {
            const col = sheet.columns.find((c) => c.id === columnMenu.colId);
            if (!col) return null;
            return (
              <>
                <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
                  Column: {col.name}
                </div>
                <button
                  onClick={() => handleStartRenameColumn(col)}
                  className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2 font-medium"
                >
                  <Edit2 className="h-3.5 w-3.5 text-blue-600" />
                  <span>Rename Column</span>
                </button>
                {col.type === "dropdown" && (
                  <button
                    onClick={() => {
                      setColumnMenu(null);
                      onOpenDropdownModal(col);
                    }}
                    className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2 font-medium"
                  >
                    <Settings2 className="h-3.5 w-3.5 text-amber-600" />
                    <span>Configure Options</span>
                  </button>
                )}
                <div className="border-t border-slate-100 my-1" />
                <button
                  onClick={() => handleDeleteColumn(col.id)}
                  className="w-full px-3 py-1.5 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2 font-medium"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Column</span>
                </button>
              </>
            );
          })()}
        </div>
      )}

      {/* Right-Click Cell / Row Context Menu */}
      {contextMenu && (
        <div
          style={{ top: `${contextMenu.y}px`, left: `${contextMenu.x}px` }}
          className="fixed z-50 bg-white rounded-xl shadow-2xl border border-slate-200 py-1.5 w-52 text-slate-800 animate-in fade-in zoom-in-95 text-xs"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="px-3 py-1 text-[10px] font-semibold text-slate-400 uppercase tracking-wider border-b border-slate-100">
            Row #{contextMenu.rowIdx + 1} Actions
          </div>
          <button
            onClick={() => {
              onAddRowAt(contextMenu.rowIdx);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2 font-medium"
          >
            <ArrowUp className="h-3.5 w-3.5 text-blue-600" />
            <span>Insert Row Above</span>
          </button>
          <button
            onClick={() => {
              onAddRowAt(contextMenu.rowIdx + 1);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2 font-medium"
          >
            <ArrowDown className="h-3.5 w-3.5 text-blue-600" />
            <span>Insert Row Below</span>
          </button>
          <div className="border-t border-slate-100 my-1" />
          <button
            onClick={() => {
              const row = getRowAtIndex(contextMenu.rowIdx);
              const text = sheet.columns.map((c) => row.data[c.id] || "").join("\t");
              navigator.clipboard.writeText(text);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2 font-medium"
          >
            <Copy className="h-3.5 w-3.5 text-slate-600" />
            <span>Copy Row (TSV)</span>
          </button>
          <button
            onClick={async () => {
              await onUpdateCell(contextMenu.rowId, contextMenu.colId, "", contextMenu.rowIdx);
              setContextMenu(null);
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-slate-100 flex items-center gap-2 font-medium"
          >
            <Scissors className="h-3.5 w-3.5 text-slate-600" />
            <span>Clear Cell Value</span>
          </button>
          <div className="border-t border-slate-100 my-1" />
          <button
            onClick={async () => {
              const isRowInSelection =
                selectionRange !== null &&
                contextMenu.rowIdx >= selectionRange.startRow &&
                contextMenu.rowIdx <= selectionRange.endRow;

              const startRowIndex = isRowInSelection ? selectionRange.startRow : contextMenu.rowIdx;
              const endRowIndex = isRowInSelection ? selectionRange.endRow : contextMenu.rowIdx;
              const count = endRowIndex - startRowIndex + 1;

              const rowIdsToDelete: string[] = [];
              const ordersToDelete: number[] = [];

              for (let r = startRowIndex; r <= endRowIndex; r++) {
                const row = isFiltered
                  ? (r >= 0 && r < filteredRows.length ? filteredRows[r] : null)
                  : getRowAtIndex(r);

                const rowId = row?.id || `temp_${r}`;
                rowIdsToDelete.push(rowId);

                const ord = row?.order !== undefined ? row.order : r;
                ordersToDelete.push(ord);
              }

              setContextMenu(null);

              await onDeleteRows(rowIdsToDelete, {
                startRowIndex,
                endRowIndex,
                count,
                deletedOrders: ordersToDelete,
              });

              // Maintain selection at startRowIndex
              if (activeCell) {
                const targetRowAfter = isFiltered
                  ? (startRowIndex < filteredRows.length ? filteredRows[startRowIndex] : null)
                  : getRowAtIndex(startRowIndex);
                setActiveCell({
                  ...activeCell,
                  rowIdx: startRowIndex,
                  rowId: targetRowAfter?.id || `temp_${startRowIndex}`,
                });
                setSelectionAnchor({ rowIdx: startRowIndex, colIdx: 0 });
                setSelectionFocus({ rowIdx: startRowIndex, colIdx: sheet.columns.length - 1 });
              }
            }}
            className="w-full px-3 py-1.5 text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2 font-medium"
          >
            <Trash2 className="h-3.5 w-3.5" />
            <span>
              {(() => {
                const isRowInSelection =
                  selectionRange !== null &&
                  contextMenu.rowIdx >= selectionRange.startRow &&
                  contextMenu.rowIdx <= selectionRange.endRow;
                const count = isRowInSelection
                  ? selectionRange.endRow - selectionRange.startRow + 1
                  : 1;
                return count > 1 ? `Delete ${count} Rows` : "Delete Row";
              })()}
            </span>
          </button>
        </div>
      )}

    </div>
  );
}
