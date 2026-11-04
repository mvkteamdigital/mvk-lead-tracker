"use client";

import React, { useState, useEffect, useCallback, useMemo } from "react";
import { useAuth } from "../auth/AuthContext";
import { SheetMeta, SheetDetail, ColumnDef, RowData, CellStyle } from "@/lib/types";
import { isValidLead, getLeadStatus, rowMatchesStatusFilter, rowMatchesDateFilter } from "@/lib/leads";
import { DEFAULT_FOLLOWUP_OPTIONS } from "@/lib/defaults";
import { TopToolbar } from "./TopToolbar";
import { StatusFilterBar } from "./StatusFilterBar";
import { FormulaBar } from "./FormulaBar";
import { SpreadsheetGrid } from "./SpreadsheetGrid";
import { BottomTabBar } from "./BottomTabBar";
import { ConfigureDropdownModal } from "../modals/ConfigureDropdownModal";
import { AddColumnModal } from "../modals/AddColumnModal";
import { NewSheetModal } from "../modals/NewSheetModal";
import { ChangePasswordModal } from "../modals/ChangePasswordModal";
import { ForceChangePasswordModal } from "../modals/ForceChangePasswordModal";
import { ManageTeamAccountsModal } from "../modals/ManageTeamAccountsModal";
import { LeadFormModal } from "../modals/LeadFormModal";
import { MobileLeadListView } from "../mobile/MobileLeadListView";
import { AlertCircle, RefreshCw, FileSpreadsheet } from "lucide-react";

export function SpreadsheetApp() {
  const { user } = useAuth();

  // Sheets list state
  const [sheets, setSheets] = useState<SheetMeta[]>([]);
  const [activeSheetId, setActiveSheetId] = useState<string | null>(null);
  const [loadingSheets, setLoadingSheets] = useState(true);

  // Active sheet detail state
  const [activeSheet, setActiveSheet] = useState<SheetDetail | null>(null);
  const [loadingActiveSheet, setLoadingActiveSheet] = useState(false);
  const [savingStatus, setSavingStatus] = useState<"saved" | "saving" | "error">("saved");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Search & Navigation
  const [searchQuery, setSearchQuery] = useState("");
  const [activeCell, setActiveCell] = useState<{
    rowIdx: number;
    colId: string;
    colName: string;
  } | null>(null);

  // Modals state
  const [isDropdownModalOpen, setIsDropdownModalOpen] = useState(false);
  const [selectedColumnForDropdown, setSelectedColumnForDropdown] = useState<ColumnDef | null>(null);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [isNewSheetModalOpen, setIsNewSheetModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isManageAccountsModalOpen, setIsManageAccountsModalOpen] = useState(false);
  const [isLeadFormModalOpen, setIsLeadFormModalOpen] = useState(false);
  const [editingLeadForModal, setEditingLeadForModal] = useState<RowData | null>(null);

  // Dynamic Status & Date Filter state
  const [statusFilter, setStatusFilter] = useState<string | null>(null);
  const [dateFilter, setDateFilter] = useState<string | null>(null);

  // Reset filters when switching sheets
  useEffect(() => {
    setStatusFilter(null);
    setDateFilter(null);
  }, [activeSheetId]);

  // Derived state: accurately count all valid leads for the active sheet in real-time (all-time)
  const activeSheetValidLeadCount = useMemo(() => {
    if (!activeSheet || !activeSheet.rows) return 0;
    return activeSheet.rows.filter((r) => isValidLead(r.data)).length;
  }, [activeSheet]);

  // Derived state: leads matching the active dateFilter (if set, only leads added on that exact date!)
  const activeSheetDateFilteredRows = useMemo(() => {
    if (!activeSheet || !activeSheet.rows) return [];
    return activeSheet.rows.filter((r) => {
      if (!isValidLead(r.data)) return false;
      if (dateFilter && !rowMatchesDateFilter(r.createdAt, dateFilter)) {
        return false;
      }
      return true;
    });
  }, [activeSheet, dateFilter]);

  // Real-time displayed lead count: when date filter is active, reflects ONLY leads added on that date!
  const displayedLeadCount = dateFilter ? activeSheetDateFilteredRows.length : activeSheetValidLeadCount;

  // Dynamically extract all available custom dropdown options from the active sheet.
  // When a user adds an option via "Customize Dropdowns", activeSheet.columns updates,
  // and the filter bar reflects the new option automatically!
  const availableStatusOptions = useMemo(() => {
    const optionsSet = new Set<string>();
    if (activeSheet?.columns) {
      activeSheet.columns.forEach((col) => {
        if (col.type === "dropdown" && Array.isArray(col.options)) {
          col.options.forEach((opt) => {
            if (opt && opt.trim()) optionsSet.add(opt.trim());
          });
        }
      });
    }
    if (optionsSet.size === 0) {
      DEFAULT_FOLLOWUP_OPTIONS.forEach((opt) => optionsSet.add(opt));
    }
    return Array.from(optionsSet);
  }, [activeSheet?.columns]);

  // Real-time summary metric counters for each status option + Unassigned.
  // When dateFilter is active, status counters automatically update to count ONLY leads added on that date!
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!activeSheet || !activeSheet.rows) return counts;

    // Use activeSheetDateFilteredRows so status metrics automatically respect date-wise filtering!
    availableStatusOptions.forEach((opt) => {
      counts[opt] = activeSheetDateFilteredRows.filter((r) =>
        rowMatchesStatusFilter(r.data, opt, activeSheet.columns)
      ).length;
    });

    counts["Unassigned"] = activeSheetDateFilteredRows.filter(
      (r) => getLeadStatus(r.data, activeSheet.columns) === "Unassigned"
    ).length;

    return counts;
  }, [activeSheet, availableStatusOptions, activeSheetDateFilteredRows]);

  // Derived state: sheet list with reactive real-time valid lead count for the active tab
  const displayedSheets = useMemo(() => {
    return sheets.map((s) => {
      if (activeSheet && s.id === activeSheet.id) {
        return {
          ...s,
          rowCount: activeSheetValidLeadCount,
        };
      }
      return s;
    });
  }, [sheets, activeSheet, activeSheetValidLeadCount]);

  // Keep the sheets list rowCount in sync with active sheet's valid lead count
  useEffect(() => {
    if (!activeSheet) return;
    setSheets((prev) => {
      const current = prev.find((s) => s.id === activeSheet.id);
      if (current && current.rowCount !== activeSheetValidLeadCount) {
        return prev.map((s) =>
          s.id === activeSheet.id ? { ...s, rowCount: activeSheetValidLeadCount } : s
        );
      }
      return prev;
    });
  }, [activeSheet?.id, activeSheetValidLeadCount]);

  // Undo / Redo History Stack
  const [undoStack, setUndoStack] = useState<RowData[][]>([]);
  const [redoStack, setRedoStack] = useState<RowData[][]>([]);

  // Clear history when switching sheets
  useEffect(() => {
    setUndoStack([]);
    setRedoStack([]);
  }, [activeSheetId]);

  const pushUndoSnapshot = useCallback(() => {
    if (!activeSheet) return;
    const snapshot = JSON.parse(JSON.stringify(activeSheet.rows)) as RowData[];
    setUndoStack((prev) => {
      const next = [...prev, snapshot];
      if (next.length > 50) return next.slice(next.length - 50);
      return next;
    });
    setRedoStack([]);
  }, [activeSheet]);

  const handleUndo = useCallback(async () => {
    if (!activeSheet || undoStack.length === 0) return;

    const previousRows = undoStack[undoStack.length - 1];
    const newUndoStack = undoStack.slice(0, -1);
    const currentSnapshot = JSON.parse(JSON.stringify(activeSheet.rows)) as RowData[];

    setUndoStack(newUndoStack);
    setRedoStack((prev) => [...prev, currentSnapshot]);
    setActiveSheet((prev) => (prev ? { ...prev, rows: previousRows } : prev));

    setSavingStatus("saving");
    try {
      const res = await fetch(`/api/sheets/${activeSheet.id}/rows`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replaceRows: true, rows: previousRows }),
      });
      if (!res.ok) throw new Error("Failed to sync undo state");
      setSavingStatus("saved");
    } catch (err) {
      console.error("Undo error:", err);
      setSavingStatus("error");
    }
  }, [activeSheet, undoStack]);

  const handleRedo = useCallback(async () => {
    if (!activeSheet || redoStack.length === 0) return;

    const nextRows = redoStack[redoStack.length - 1];
    const newRedoStack = redoStack.slice(0, -1);
    const currentSnapshot = JSON.parse(JSON.stringify(activeSheet.rows)) as RowData[];

    setRedoStack(newRedoStack);
    setUndoStack((prev) => [...prev, currentSnapshot]);
    setActiveSheet((prev) => (prev ? { ...prev, rows: nextRows } : prev));

    setSavingStatus("saving");
    try {
      const res = await fetch(`/api/sheets/${activeSheet.id}/rows`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ replaceRows: true, rows: nextRows }),
      });
      if (!res.ok) throw new Error("Failed to sync redo state");
      setSavingStatus("saved");
    } catch (err) {
      console.error("Redo error:", err);
      setSavingStatus("error");
    }
  }, [activeSheet, redoStack]);

  // 1. Fetch accessible sheets for this user
  const fetchSheets = useCallback(async () => {
    try {
      setLoadingSheets(true);
      const res = await fetch("/api/sheets");
      if (!res.ok) throw new Error("Failed to load sheets");
      const data = await res.json();
      let fetchedSheets: SheetMeta[] = data.sheets || [];

      // Sort by order asc; respect persistent arrangement
      try {
        const savedOrder = localStorage.getItem("mvk_sheet_order");
        if (savedOrder) {
          const orderIds: string[] = JSON.parse(savedOrder);
          const orderMap = new Map<string, number>();
          orderIds.forEach((id, idx) => orderMap.set(id, idx));
          fetchedSheets.sort((a, b) => {
            const aIdx = orderMap.has(a.id) ? orderMap.get(a.id)! : a.order;
            const bIdx = orderMap.has(b.id) ? orderMap.get(b.id)! : b.order;
            return aIdx - bIdx;
          });
        }
      } catch (e) {}

      setSheets(fetchedSheets);

      if (fetchedSheets && fetchedSheets.length > 0) {
        // If no active sheet or active sheet was removed, select the first accessible sheet
        setActiveSheetId((prev) => {
          if (prev && fetchedSheets.some((s: SheetMeta) => s.id === prev)) {
            return prev;
          }
          return fetchedSheets[0].id;
        });
      } else {
        setActiveSheetId(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Failed to load sheets");
    } finally {
      setLoadingSheets(false);
    }
  }, []);

  useEffect(() => {
    fetchSheets();
  }, [fetchSheets]);

  // 2. Fetch full detail (columns & rows) for active sheet
  const fetchActiveSheetDetail = useCallback(async (sheetId: string) => {
    try {
      setLoadingActiveSheet(true);
      setErrorMsg(null);
      const res = await fetch(`/api/sheets/${sheetId}`);
      if (!res.ok) {
        if (res.status === 403) {
          throw new Error("Access Denied: You do not have permission to view this sheet.");
        }
        throw new Error("Failed to load sheet details.");
      }
      const data = await res.json();
      setActiveSheet(data.sheet);

      // Select default cell
      if (data.sheet.columns && data.sheet.columns.length > 0 && data.sheet.rows.length > 0) {
        setActiveCell({
          rowIdx: 0,
          colId: data.sheet.columns[0].id,
          colName: data.sheet.columns[0].name,
        });
      } else {
        setActiveCell(null);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error loading sheet");
      setActiveSheet(null);
    } finally {
      setLoadingActiveSheet(false);
    }
  }, []);

  useEffect(() => {
    if (activeSheetId) {
      fetchActiveSheetDetail(activeSheetId);
    }
  }, [activeSheetId, fetchActiveSheetDetail]);

  // Synchronized Multi-User Access: Manual and automated background sync from shared Neon Postgres
  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefreshFromDB = useCallback(async () => {
    if (!activeSheetId || isRefreshing) return;
    try {
      setIsRefreshing(true);
      const [sheetRes, sheetsRes] = await Promise.all([
        fetch(`/api/sheets/${activeSheetId}`),
        fetch("/api/sheets"),
      ]);
      if (sheetRes.ok) {
        const data = await sheetRes.json();
        setActiveSheet((prev) => {
          if (!prev || prev.id !== activeSheetId) return prev;
          return {
            ...prev,
            columns: data.sheet.columns,
            rows: data.sheet.rows,
          };
        });
      }
      if (sheetsRes.ok) {
        const data = await sheetsRes.json();
        setSheets(data.sheets || []);
      }
    } catch (err) {
      console.error("Multi-user sync error:", err);
    } finally {
      setIsRefreshing(false);
    }
  }, [activeSheetId, isRefreshing]);

  // Synchronized Multi-User Access: Polling every 15 seconds so CEO / Admins and members stay in sync
  useEffect(() => {
    if (!activeSheetId) return;

    const interval = setInterval(() => {
      if (savingStatus !== "saving") {
        handleRefreshFromDB();
      }
    }, 15000);

    return () => clearInterval(interval);
  }, [activeSheetId, savingStatus, handleRefreshFromDB]);

  // Get active cell value
  const getActiveCellValue = (): string => {
    if (!activeSheet || !activeCell) return "";
    const row = activeSheet.rows.find(
      (r) => (r.order !== undefined ? r.order : -1) === activeCell.rowIdx
    );
    if (!row) return "";
    return row.data[activeCell.colId] || "";
  };

  // Get active cell style
  const getActiveCellStyle = (): CellStyle => {
    if (!activeSheet || !activeCell) return {};
    const row = activeSheet.rows.find(
      (r) => (r.order !== undefined ? r.order : -1) === activeCell.rowIdx
    );
    if (!row || !row.styles) return {};
    return row.styles[activeCell.colId] || {};
  };

  // 3. Real-time Cell Value Update (Supports any of the 1,000 blank rows)
  const handleUpdateCell = async (rowId: string, columnId: string, value: string, order?: number) => {
    if (!activeSheet) return;

    pushUndoSnapshot();

    const rowOrder = order !== undefined ? order : activeCell?.rowIdx ?? 0;

    // Optimistically update local state immediately for zero-lag UI
    setActiveSheet((prev) => {
      if (!prev) return prev;
      const existing = prev.rows.find((r) => r.id === rowId || (order !== undefined && r.order === order));
      if (existing) {
        return {
          ...prev,
          rows: prev.rows.map((r) =>
            r.id === existing.id ? { ...r, data: { ...r.data, [columnId]: value } } : r
          ),
        };
      }
      const newRow: RowData = {
        id: rowId,
        sheetId: prev.id,
        order: rowOrder,
        data: { [columnId]: value },
        styles: {},
      };
      return {
        ...prev,
        rows: [...prev.rows, newRow],
      };
    });

    setSavingStatus("saving");

    try {
      const res = await fetch(`/api/sheets/${activeSheet.id}/rows`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowId: rowId.startsWith("temp_") ? undefined : rowId,
          order: rowOrder,
          columnId,
          value,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 409) {
          alert(`⚠️ ${errData.error || "Duplicate Lead detected."}`);
        }
        await fetchActiveSheetDetail(activeSheet.id);
        throw new Error(errData.error || "Failed to save cell");
      }
      const data = await res.json();
      if (data.row && rowId.startsWith("temp_")) {
        setActiveSheet((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            rows: prev.rows.map((r) => (r.id === rowId ? data.row : r)),
          };
        });
      }
      setSavingStatus("saved");
    } catch (err) {
      console.error(err);
      setSavingStatus("error");
    }
  };

  // 4. Batch Rows Update (Supports multi-row paste from Excel / Google Sheets)
  const handleBatchUpdateRows = async (rows: Partial<RowData>[]) => {
    if (!activeSheet) return;

    pushUndoSnapshot();

    // Optimistically update local state
    setActiveSheet((prev) => {
      if (!prev) return prev;
      const existingMap = new Map<number, RowData>();
      prev.rows.forEach((r, idx) => existingMap.set(r.order !== undefined ? r.order : idx, r));

      rows.forEach((r) => {
        const orderKey = r.order ?? 0;
        const exist = existingMap.get(orderKey);
        if (exist) {
          exist.data = { ...exist.data, ...(typeof r.data === "string" ? JSON.parse(r.data) : r.data || {}) };
        } else {
          existingMap.set(orderKey, {
            id: r.id || `temp_${orderKey}`,
            sheetId: prev.id,
            order: orderKey,
            data: typeof r.data === "string" ? JSON.parse(r.data) : r.data || {},
            styles: {},
          });
        }
      });

      return {
        ...prev,
        rows: Array.from(existingMap.values()).sort((a, b) => a.order - b.order),
      };
    });

    setSavingStatus("saving");

    try {
      const res = await fetch(`/api/sheets/${activeSheet.id}/rows`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        await fetchActiveSheetDetail(activeSheet.id);
        throw new Error(errData.error || "Failed to save rows");
      }
      const data = await res.json();
      if (data.rows) {
        setActiveSheet((prev) => {
          if (!prev) return prev;
          const map = new Map<number, RowData>();
          data.rows.forEach((r: RowData) => map.set(r.order, r));
          return {
            ...prev,
            rows: prev.rows.map((r) => map.get(r.order) || r),
          };
        });
      }
      setSavingStatus("saved");
    } catch (err) {
      console.error(err);
      setSavingStatus("error");
    }
  };

  // 5. Apply Formatting / Styling to active cell
  const handleApplyStyle = async (newStyle: Partial<CellStyle>) => {
    if (!activeSheet || !activeCell) return;
    pushUndoSnapshot();
    const row = activeSheet.rows[activeCell.rowIdx];
    if (!row) return;

    const currentStyle = (row.styles && row.styles[activeCell.colId]) || {};
    const mergedStyle = { ...currentStyle, ...newStyle };

    // Optimistic update
    setActiveSheet((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        rows: prev.rows.map((r) =>
          r.id === row.id
            ? {
                ...r,
                styles: {
                  ...r.styles,
                  [activeCell.colId]: mergedStyle,
                },
              }
            : r
        ),
      };
    });

    setSavingStatus("saving");

    try {
      const res = await fetch(`/api/sheets/${activeSheet.id}/rows`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowId: row.id,
          columnId: activeCell.colId,
          style: mergedStyle,
        }),
      });

      if (!res.ok) throw new Error("Failed to save style");
      setSavingStatus("saved");
    } catch (err) {
      setSavingStatus("error");
    }
  };

  // 6. Add Row (at end or inserted at index)
  const handleAddRowAt = async (index?: number) => {
    if (!activeSheet) return;

    pushUndoSnapshot();
    setSavingStatus("saving");
    try {
      const res = await fetch(`/api/sheets/${activeSheet.id}/rows`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ data: {}, styles: {} }),
      });

      if (!res.ok) throw new Error("Failed to add row");
      const data = await res.json();
      const newRow = data.rows[0];

      setActiveSheet((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rows: [...prev.rows, newRow],
        };
      });

      setSavingStatus("saved");
    } catch (err) {
      setSavingStatus("error");
    }
  };

  // 7. Delete Rows
  const handleDeleteRows = async (rowIds: string[]) => {
    if (!activeSheet) return;

    pushUndoSnapshot();
    setSavingStatus("saving");
    try {
      const res = await fetch(`/api/sheets/${activeSheet.id}/rows`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rowIds }),
      });

      if (!res.ok) throw new Error("Failed to delete rows");

      setActiveSheet((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          rows: prev.rows.filter((r) => !rowIds.includes(r.id)),
        };
      });

      setSavingStatus("saved");
    } catch (err) {
      setSavingStatus("error");
    }
  };

  // 8. Update Columns (widths, rename, reorder, delete)
  const handleUpdateColumns = async (columns: ColumnDef[]) => {
    if (!activeSheet) return;

    setActiveSheet((prev) => (prev ? { ...prev, columns } : prev));

    try {
      await fetch(`/api/sheets/${activeSheet.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns }),
      });
    } catch (err) {
      console.error(err);
    }
  };

  // 9. Add New Column
  const handleAddColumn = async (newCol: ColumnDef) => {
    if (!activeSheet) return;
    const updatedCols = [...activeSheet.columns, newCol];
    await handleUpdateColumns(updatedCols);
  };

  // 10. Save Dropdown Options for a column
  const handleSaveDropdownOptions = async (columnId: string, options: string[]) => {
    if (!activeSheet) return;
    const updatedCols = activeSheet.columns.map((c) =>
      c.id === columnId ? { ...c, options } : c
    );
    await handleUpdateColumns(updatedCols);
  };

  // 11. Rename Sheet
  const handleRenameSheet = async (id: string, newName: string) => {
    try {
      const res = await fetch(`/api/sheets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName }),
      });

      if (res.ok) {
        setSheets((prev) =>
          prev.map((s) => (s.id === id ? { ...s, name: newName } : s))
        );
        if (activeSheet && activeSheet.id === id) {
          setActiveSheet((prev) => (prev ? { ...prev, name: newName } : prev));
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 12. Delete Sheet
  const handleDeleteSheet = async (id: string) => {
    try {
      const res = await fetch(`/api/sheets/${id}`, { method: "DELETE" });
      if (res.ok) {
        fetchSheets();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // 13. Create New Sheet Tab (Admin)
  const handleCreateSheet = async (name: string, assignedUserId?: string) => {
    const res = await fetch("/api/sheets", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, userId: assignedUserId }),
    });

    if (!res.ok) {
      const data = await res.json();
      throw new Error(data.error || "Failed to create sheet");
    }

    const data = await res.json();
    await fetchSheets();
    setActiveSheetId(data.sheet.id);
  };

  // 14. Save lead from mobile form modal (Supports Add Lead & Edit Lead)
  const handleSaveLeadFromModal = async (data: Record<string, string>, rowId?: string) => {
    if (!activeSheet) return;

    if (rowId && !rowId.startsWith("temp_")) {
      // Update existing lead
      await handleBatchUpdateRows([{ id: rowId, data }]);
    } else {
      // Create new lead in database
      const existingOrders = activeSheet.rows.map((r) => r.order ?? 0);
      const nextOrder = existingOrders.length > 0 ? Math.max(...existingOrders) + 1 : 0;

      setSavingStatus("saving");
      try {
        const res = await fetch(`/api/sheets/${activeSheet.id}/rows`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, order: nextOrder }),
        });

        if (!res.ok) {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to add new lead");
        }
        const resData = await res.json();
        const createdRow = resData.rows[0];

        setActiveSheet((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            rows: [...prev.rows, createdRow],
          };
        });

        setSavingStatus("saved");
      } catch (err: any) {
        console.error(err);
        setSavingStatus("error");
        throw err;
      }
    }
  };

  // 15. Delete lead from modal
  const handleDeleteLeadFromModal = async (rowId: string) => {
    await handleDeleteRows([rowId]);
  };

  // 16. Reorder Sheets (Drag and Drop / Tab Sorting with Persistent Neon DB Sync)
  const handleReorderSheets = async (reorderedSheets: SheetMeta[]) => {
    // 1. Optimistic update in state immediately
    const updatedWithOrder = reorderedSheets.map((s, idx) => ({ ...s, order: idx }));
    setSheets(updatedWithOrder);

    // 2. Save to local storage for immediate zero-latency persistence
    try {
      localStorage.setItem(
        "mvk_sheet_order",
        JSON.stringify(reorderedSheets.map((s) => s.id))
      );
    } catch (e) {
      console.error(e);
    }

    // 3. Persist order to the Neon PostgreSQL database
    try {
      const res = await fetch("/api/sheets", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sheetOrders: reorderedSheets.map((s) => s.id) }),
      });
      if (!res.ok) {
        console.error("Failed to persist sheet order to DB");
      }
    } catch (err) {
      console.error("Reorder sheets DB error:", err);
    }
  };

  if (loadingSheets) {
    return (
      <div className="h-screen w-screen flex flex-col items-center justify-center bg-slate-900 text-white gap-3">
        <RefreshCw className="h-8 w-8 text-amber-400 animate-spin" />
        <span className="text-sm font-semibold tracking-wide">
          Loading Sheets & Verifying Permissions...
        </span>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen flex flex-col bg-slate-100 overflow-hidden font-sans">
      
      {/* 1. Top Application Toolbar */}
      <TopToolbar
        sheet={activeSheet}
        savingStatus={savingStatus}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        onAddRow={() => handleAddRowAt()}
        onOpenAddColumnModal={() => setIsAddColumnModalOpen(true)}
        onOpenDropdownModal={() => {
          // Open dropdown modal for the first dropdown column or follow-up column
          const dropdownCol =
            activeSheet?.columns.find((c) => c.type === "dropdown") || null;
          setSelectedColumnForDropdown(dropdownCol);
          setIsDropdownModalOpen(true);
        }}
        onApplyStyle={handleApplyStyle}
        selectedCellStyle={getActiveCellStyle()}
        onOpenChangePasswordModal={() => setIsChangePasswordModalOpen(true)}
        onOpenManageAccountsModal={() => setIsManageAccountsModalOpen(true)}
        onUndo={handleUndo}
        onRedo={handleRedo}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        totalLeads={displayedLeadCount}
        dateFilter={dateFilter}
        onRefresh={handleRefreshFromDB}
        isRefreshing={isRefreshing}
      />

      {/* 2. Dynamic Status & Date Filter Bar & Summary Metrics (Mobile & Desktop) */}
      <StatusFilterBar
        totalLeads={displayedLeadCount}
        allTimeTotalLeads={activeSheetValidLeadCount}
        availableStatuses={availableStatusOptions}
        statusCounts={statusCounts}
        activeFilter={statusFilter}
        onSelectFilter={setStatusFilter}
        dateFilter={dateFilter}
        onSelectDate={setDateFilter}
        onOpenDropdownModal={() => {
          const dropdownCol =
            activeSheet?.columns.find((c) => c.type === "dropdown") || null;
          setSelectedColumnForDropdown(dropdownCol);
          setIsDropdownModalOpen(true);
        }}
      />

      {/* 3. Formula Bar (Desktop Only) */}
      <div className="hidden md:block">
        <FormulaBar
          activeCell={activeCell}
          cellValue={getActiveCellValue()}
          onCellValueChange={(val) => {
            if (activeSheet && activeCell) {
              const row = activeSheet.rows.find(
                (r) => (r.order !== undefined ? r.order : -1) === activeCell.rowIdx
              );
              handleUpdateCell(
                row ? row.id : `temp_${activeCell.rowIdx}`,
                activeCell.colId,
                val,
                activeCell.rowIdx
              );
            }
          }}
          onCommit={() => {}}
        />
      </div>

      {/* 4. Main Content Area */}
      <div className="flex-1 relative overflow-hidden flex flex-col">
        {errorMsg ? (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-3">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">Restricted View</h3>
            <p className="text-sm text-slate-500 max-w-md mb-4">{errorMsg}</p>
            <button
              onClick={() => fetchSheets()}
              className="px-4 py-2 bg-slate-900 text-white text-xs font-semibold rounded-lg hover:bg-slate-800 transition-colors"
            >
              Refresh Workspace
            </button>
          </div>
        ) : loadingActiveSheet ? (
          <div className="flex-1 flex flex-col items-center justify-center gap-2 text-slate-500">
            <RefreshCw className="h-6 w-6 text-amber-500 animate-spin" />
            <span className="text-xs font-medium">Loading sheet data...</span>
          </div>
        ) : activeSheet ? (
          <>
            {/* Mobile View: Vertical Card List with Status & Date Indicators & Tap-to-Edit */}
            <div className="block md:hidden flex-1 overflow-hidden flex flex-col min-h-0">
              <MobileLeadListView
                sheet={activeSheet}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
                statusFilter={statusFilter}
                dateFilter={dateFilter}
                onSelectDate={setDateFilter}
                onEditLead={(lead) => {
                  setEditingLeadForModal(lead);
                  setIsLeadFormModalOpen(true);
                }}
                onAddNewLead={() => {
                  setEditingLeadForModal(null);
                  setIsLeadFormModalOpen(true);
                }}
              />
            </div>

            {/* Desktop View: Full Google Sheets-Style Spreadsheet Grid with 1,000 Rows */}
            <div className="hidden md:flex flex-1 overflow-hidden flex-col min-h-0">
              <SpreadsheetGrid
                sheet={activeSheet}
                onUpdateCell={handleUpdateCell}
                onBatchUpdateRows={handleBatchUpdateRows}
                onAddRowAt={handleAddRowAt}
                onDeleteRows={handleDeleteRows}
                onUpdateColumns={handleUpdateColumns}
                onOpenDropdownModal={(col) => {
                  setSelectedColumnForDropdown(col);
                  setIsDropdownModalOpen(true);
                }}
                activeCell={activeCell}
                setActiveCell={setActiveCell}
                searchQuery={searchQuery}
                statusFilter={statusFilter}
                dateFilter={dateFilter}
                onUndo={handleUndo}
                onRedo={handleRedo}
                canUndo={undoStack.length > 0}
                canRedo={redoStack.length > 0}
              />
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
            <FileSpreadsheet className="h-10 w-10 text-slate-300" />
            <p className="text-sm">No sheet selected or available.</p>
          </div>
        )}
      </div>

      {/* 4. Large, Thicker, High-Contrast Bottom Tab Bar (Draggable & Reorderable) */}
      <BottomTabBar
        sheets={displayedSheets}
        activeSheetId={activeSheetId}
        onSelectSheet={(id) => setActiveSheetId(id)}
        isAdmin={user?.role === "ADMIN"}
        onOpenNewSheetModal={() => setIsNewSheetModalOpen(true)}
        onRenameSheet={handleRenameSheet}
        onDeleteSheet={handleDeleteSheet}
        onReorderSheets={handleReorderSheets}
      />

      {/* Modals */}
      <ConfigureDropdownModal
        isOpen={isDropdownModalOpen}
        onClose={() => {
          setIsDropdownModalOpen(false);
          setSelectedColumnForDropdown(null);
        }}
        column={selectedColumnForDropdown}
        onSaveOptions={handleSaveDropdownOptions}
      />

      <AddColumnModal
        isOpen={isAddColumnModalOpen}
        onClose={() => setIsAddColumnModalOpen(false)}
        onAddColumn={handleAddColumn}
      />

      <NewSheetModal
        isOpen={isNewSheetModalOpen}
        onClose={() => setIsNewSheetModalOpen(false)}
        onCreateSheet={handleCreateSheet}
      />

      {/* Lead Form Modal for Mobile View (11 Fields) */}
      {activeSheet && (
        <LeadFormModal
          isOpen={isLeadFormModalOpen}
          onClose={() => {
            setIsLeadFormModalOpen(false);
            setEditingLeadForModal(null);
          }}
          lead={editingLeadForModal}
          columns={activeSheet.columns}
          sheetName={activeSheet.name}
          onSave={handleSaveLeadFromModal}
          onDelete={handleDeleteLeadFromModal}
        />
      )}

      <ChangePasswordModal
        isOpen={isChangePasswordModalOpen}
        onClose={() => setIsChangePasswordModalOpen(false)}
      />

      {user?.role === "ADMIN" && (
        <ManageTeamAccountsModal
          isOpen={isManageAccountsModalOpen}
          onClose={() => setIsManageAccountsModalOpen(false)}
          onRefreshSheets={fetchSheets}
        />
      )}

      {/* Mandatory First-Time Password Setup for pre-seeded default accounts */}
      {user?.mustChangePassword && (
        <ForceChangePasswordModal
          userName={user.name}
          onSuccess={() => fetchSheets()}
        />
      )}

    </div>
  );
}
