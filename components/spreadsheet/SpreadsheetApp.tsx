"use client";

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { useAuth } from "../auth/AuthContext";
import { SheetMeta, SheetDetail, ColumnDef, RowData, CellStyle } from "@/lib/types";
import {
  isValidLead,
  getLeadStatus,
  isUnattendedLead,
  rowMatchesStatusFilter,
  rowMatchesDateFilter,
  sanitizeCellValue,
  filterSheetRows,
} from "@/lib/leads";
import { HARDCODED_STATUS_FILTERS } from "@/lib/defaults";
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
import { AlertCircle, RefreshCw, FileSpreadsheet, CheckCircle2, X } from "lucide-react";

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

  // Stable refs to prevent stale closure issues during paste and rapid updates across tabs
  const activeSheetRef = useRef<SheetDetail | null>(activeSheet);
  useEffect(() => {
    activeSheetRef.current = activeSheet;
  }, [activeSheet]);

  const activeCellRef = useRef<{ rowIdx: number; colId: string; colName: string } | null>(activeCell);
  useEffect(() => {
    activeCellRef.current = activeCell;
  }, [activeCell]);

  // Modals state
  const [isDropdownModalOpen, setIsDropdownModalOpen] = useState(false);
  const [selectedColumnForDropdown, setSelectedColumnForDropdown] = useState<ColumnDef | null>(null);
  const [isAddColumnModalOpen, setIsAddColumnModalOpen] = useState(false);
  const [isNewSheetModalOpen, setIsNewSheetModalOpen] = useState(false);
  const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);
  const [isManageAccountsModalOpen, setIsManageAccountsModalOpen] = useState(false);
  const [isLeadFormModalOpen, setIsLeadFormModalOpen] = useState(false);
  const [editingLeadForModal, setEditingLeadForModal] = useState<RowData | null>(null);

  // Lightweight Toast Notification system (eliminates native alerts and page reloads)
  const [toast, setToast] = useState<{ id: number; message: string; type: "success" | "error" | "info" } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error" | "info" = "info") => {
    const id = Date.now();
    setToast({ id, message, type });
    setTimeout(() => {
      setToast((current) => (current?.id === id ? null : current));
    }, 4500);
  }, []);

  // Active users state for live tab synchronization
  const [usersList, setUsersList] = useState<Array<{ id: string; name: string; email: string; role: string }>>([]);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await fetch("/api/users");
      if (!res.ok) return;
      const data = await res.json();
      if (data.users && Array.isArray(data.users)) {
        setUsersList(data.users);
      }
    } catch (e) {
      console.error("Failed to fetch users list", e);
    }
  }, []);

  useEffect(() => {
    if (user?.role === "ADMIN") {
      fetchUsers();
    }
  }, [user?.role, fetchUsers]);

  // Fast map by user ID for instant O(1) reactive lookup
  const usersById = useMemo(() => {
    const map = new Map<string, { id: string; name: string; email: string; role: string }>();
    usersList.forEach((u) => {
      map.set(u.id, u);
    });
    return map;
  }, [usersList]);

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
    return filterSheetRows(activeSheet.rows, activeSheet.columns, {
      dateFilter,
    });
  }, [activeSheet, dateFilter]);

  // Real-time displayed lead count: when date filter is active, reflects ONLY leads added on that date!
  const displayedLeadCount = dateFilter ? activeSheetDateFilteredRows.length : activeSheetValidLeadCount;

  // Real-time summary metric counters for the 7 hardcoded status options + Unattended.
  // When dateFilter is active, status counters automatically update to count ONLY leads added on that date!
  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    if (!activeSheet || !activeSheet.rows) return counts;

    // Strict live count of Unattended Leads (all 4 follow-up statuses simultaneously empty)
    counts["Unattended"] = activeSheetDateFilteredRows.filter((r) =>
      isUnattendedLead(r.data, activeSheet.columns)
    ).length;

    // Hardcoded 7 status option counts (respecting active date filter)
    HARDCODED_STATUS_FILTERS.forEach((opt) => {
      counts[opt] = activeSheetDateFilteredRows.filter((r) =>
        rowMatchesStatusFilter(r.data, opt, activeSheet.columns)
      ).length;
    });

    return counts;
  }, [activeSheet, activeSheetDateFilteredRows]);

  // Derived state: sheet list with reactive real-time valid lead count for the active tab
  const displayedSheets = useMemo(() => {
    return sheets.map((s) => {
      return {
        ...s,
        name: s.name,
        rowCount:
          activeSheet && s.id === activeSheet.id
            ? activeSheetValidLeadCount
            : s.rowCount,
      };
    });
  }, [sheets, activeSheet, activeSheetValidLeadCount]);

  // Active sheet
  const currentActiveSheet = useMemo(() => {
    if (!activeSheet) return null;
    return activeSheet;
  }, [activeSheet]);

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

      // Keep activeSheet in sync with latest sheet name and metadata
      setActiveSheet((prev) => {
        if (!prev) return prev;
        const matching = fetchedSheets.find((s) => s.id === prev.id);
        if (matching && (matching.name !== prev.name || matching.user?.name !== prev.user?.name)) {
          return {
            ...prev,
            name: matching.name,
            user: matching.user || prev.user,
          };
        }
        return prev;
      });

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

  // Instantly reflect user updates across tabs and active sheets without needing a reload
  const handleUserUpdated = useCallback(
    (updatedUser: { id: string; name: string; email: string; role: string }) => {
      // 1. Instantly update active users state array
      setUsersList((prev) =>
        prev.map((u) => (u.id === updatedUser.id ? { ...u, ...updatedUser } : u))
      );
      // 2. Instantly update sheets list state with updated user metadata without overwriting custom sheet names
      setSheets((prev) =>
        prev.map((s) =>
          s.userId === updatedUser.id
            ? {
                ...s,
                user: s.user ? { ...s.user, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role } : s.user,
              }
            : s
        )
      );
      // 3. Instantly update activeSheet state if it belongs to this user
      setActiveSheet((prev) => {
        if (!prev) return prev;
        if (prev.userId === updatedUser.id) {
          return {
            ...prev,
            user: prev.user ? { ...prev.user, name: updatedUser.name, email: updatedUser.email, role: updatedUser.role } : prev.user,
          };
        }
        return prev;
      });
      // 4. Background re-fetch to ensure full database consistency
      fetchSheets();
      fetchUsers();
    },
    [fetchSheets, fetchUsers]
  );

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
      setStatusFilter(null);
      setDateFilter(null);
      setSearchQuery("");
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

  // Silent background refresh for seamless error recovery without unmounting or setting loading spinner
  const silentRefreshActiveSheet = useCallback(async (sheetId: string) => {
    try {
      const res = await fetch(`/api/sheets/${sheetId}`);
      if (!res.ok) return;
      const data = await res.json();
      if (data.sheet) {
        setActiveSheet((prev) => {
          if (!prev || prev.id !== sheetId) return prev;
          return {
            ...prev,
            columns: data.sheet.columns,
            rows: data.sheet.rows,
          };
        });
      }
    } catch (err) {
      console.error("Silent background refresh error:", err);
    }
  }, []);

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
    const row =
      activeSheet.rows[activeCell.rowIdx] ||
      activeSheet.rows.find(
        (r) => (r.order !== undefined ? r.order : -1) === activeCell.rowIdx
      );
    if (!row) return "";
    return row.data[activeCell.colId] || "";
  };

  // Get active cell style
  const getActiveCellStyle = (): CellStyle => {
    if (!activeSheet || !activeCell) return {};
    const row =
      activeSheet.rows[activeCell.rowIdx] ||
      activeSheet.rows.find(
        (r) => (r.order !== undefined ? r.order : -1) === activeCell.rowIdx
      );
    if (!row || !row.styles) return {};
    return row.styles[activeCell.colId] || {};
  };

  // 3. Real-time Cell Value Update (Supports any of the 1,000 blank rows)
  const handleUpdateCell = async (rowId: string, columnId: string, value: string, order?: number) => {
    const currentSheet = activeSheetRef.current || activeSheet;
    if (!currentSheet) return;

    pushUndoSnapshot();

    const colDef = currentSheet.columns.find((c) => c.id === columnId);
    const sanitizedValue = sanitizeCellValue(value, colDef);
    const rowOrder = order !== undefined ? order : activeCellRef.current?.rowIdx ?? 0;

    // Optimistically update local state immediately for zero-lag UI
    setActiveSheet((prev) => {
      if (!prev) return prev;
      let targetIndex = -1;

      // 1. Strictly match by unique database ID first
      if (rowId && !rowId.startsWith("temp_")) {
        targetIndex = prev.rows.findIndex((r) => r.id === rowId);
      }
      // 2. If rowId is temp or not found by real id, match by sequential order
      if (targetIndex === -1 && order !== undefined) {
        targetIndex = prev.rows.findIndex((r) => r.order === order);
      }
      // 3. Fallback match by temp id
      if (targetIndex === -1 && rowId && rowId.startsWith("temp_")) {
        targetIndex = prev.rows.findIndex((r) => r.id === rowId);
      }

      if (targetIndex !== -1) {
        const existing = prev.rows[targetIndex];
        const nextRows = [...prev.rows];
        nextRows[targetIndex] = {
          ...existing,
          data: { ...existing.data, [columnId]: sanitizedValue },
        };
        return {
          ...prev,
          rows: nextRows,
        };
      }

      // New row created for blank row index
      const newRow: RowData = {
        id: rowId,
        sheetId: prev.id,
        order: rowOrder,
        data: { [columnId]: sanitizedValue },
        styles: {},
        createdAt: new Date().toISOString(),
      };
      return {
        ...prev,
        rows: [...prev.rows, newRow],
      };
    });

    setSavingStatus("saving");

    try {
      const res = await fetch(`/api/sheets/${currentSheet.id}/rows`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rowId: rowId.startsWith("temp_") ? undefined : rowId,
          order: rowOrder,
          columnId,
          value: sanitizedValue,
          userId: currentSheet.userId || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 409) {
          showToast(`⚠️ ${errData.error || "Duplicate Lead detected."}`, "error");
        } else {
          showToast(errData.error || "Failed to save cell data.", "error");
        }
        silentRefreshActiveSheet(currentSheet.id);
        setSavingStatus("error");
        return;
      }
      const data = await res.json();
      if (data.row) {
        setActiveSheet((prev) => {
          if (!prev) return prev;
          const targetRowId = data.row.id;
          return {
            ...prev,
            rows: prev.rows.map((r) => {
              if (r.id === rowId || r.id === targetRowId) {
                return {
                  ...r,
                  ...data.row,
                  data: { ...r.data, ...data.row.data },
                };
              }
              return r;
            }),
          };
        });
      }
      setSavingStatus("saved");
    } catch (err: any) {
      console.error("Cell save error:", err);
      showToast("Network error: Could not save changes.", "error");
      silentRefreshActiveSheet(currentSheet.id);
      setSavingStatus("error");
    }
  };

  // 4. Batch Rows Update (Supports multi-row & multi-column bulk paste from Excel / Google Sheets)
  const handleBatchUpdateRows = async (rows: Partial<RowData>[]) => {
    const currentSheet = activeSheetRef.current || activeSheet;
    if (!currentSheet) return;

    pushUndoSnapshot();

    // Sanitize incoming rows data against column definitions
    const sanitizedRows = rows.map((r) => {
      const incomingData = typeof r.data === "string" ? JSON.parse(r.data) : r.data || {};
      const cleanData: Record<string, any> = { ...incomingData };
      currentSheet.columns.forEach((c) => {
        if (cleanData[c.id] !== undefined) {
          cleanData[c.id] = sanitizeCellValue(cleanData[c.id], c);
        }
      });
      return {
        ...r,
        data: cleanData,
      };
    });

    // Optimistically update local state immediately with ONE single batched React update
    setActiveSheet((prev) => {
      if (!prev) return prev;
      const newRows = [...prev.rows];

      sanitizedRows.forEach((r) => {
        const incomingData = r.data || {};
        let targetIndex = -1;
        if (r.id && !r.id.startsWith("temp_")) {
          targetIndex = newRows.findIndex((row) => row.id === r.id);
        }
        if (targetIndex === -1 && r.order !== undefined) {
          targetIndex = newRows.findIndex((row) => row.order === r.order);
        }
        if (targetIndex === -1 && r.id && r.id.startsWith("temp_")) {
          targetIndex = newRows.findIndex((row) => row.id === r.id);
        }

        if (targetIndex >= 0 && targetIndex < newRows.length) {
          const exist = newRows[targetIndex];
          newRows[targetIndex] = {
            ...exist,
            data: { ...exist.data, ...incomingData },
          };
        } else {
          const insertOrder = r.order !== undefined ? r.order : newRows.length;
          newRows.push({
            id: r.id || `temp_${insertOrder}`,
            sheetId: prev.id,
            order: insertOrder,
            data: incomingData,
            styles: {},
            createdAt: new Date().toISOString(),
          });
        }
      });

      return {
        ...prev,
        rows: newRows,
      };
    });

    setSavingStatus("saving");

    // Group rows: updated existing rows vs newly created rows
    const existingRowsToUpdate = sanitizedRows.filter((r) => r.id && !r.id.startsWith("temp_"));
    const newRowsToCreate = sanitizedRows.filter((r) => !r.id || r.id.startsWith("temp_"));

    try {
      const [updateRes, createRes] = await Promise.all([
        existingRowsToUpdate.length > 0
          ? fetch("/api/leads/bulk", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                leads: existingRowsToUpdate,
                sheetId: currentSheet.id,
              }),
            })
          : null,
        newRowsToCreate.length > 0
          ? fetch("/api/leads/bulk", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                leads: newRowsToCreate,
                sheetId: currentSheet.id,
                userId: currentSheet.userId || undefined,
              }),
            })
          : null,
      ]);

      const allDuplicates: any[] = [];
      let totalSaved = 0;

      // Process newly created rows and swap temporary optimistic IDs with real database IDs
      if (createRes) {
        if (!createRes.ok) {
          const errData = await createRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to create new leads");
        }
        const createData = await createRes.json();
        totalSaved += createData.count || 0;
        if (createData.duplicates && createData.duplicates.length > 0) {
          allDuplicates.push(...createData.duplicates);
        }

        if (createData.created && createData.created.length > 0) {
          setActiveSheet((prev) => {
            if (!prev) return prev;
            const tempIdMap = new Map<string, RowData>();
            const orderMap = new Map<number, RowData>();

            createData.created.forEach((r: RowData & { tempId?: string }) => {
              if (r.tempId) tempIdMap.set(r.tempId, r);
              if (r.order !== undefined) orderMap.set(r.order, r);
            });

            return {
              ...prev,
              rows: prev.rows.map((r) => {
                if (r.id && tempIdMap.has(r.id)) {
                  return { ...r, ...tempIdMap.get(r.id)! };
                }
                if (r.id && r.id.startsWith("temp_") && r.order !== undefined && orderMap.has(r.order)) {
                  return { ...r, ...orderMap.get(r.order)! };
                }
                return r;
              }),
            };
          });
        }
      }

      // Process updated existing rows
      if (updateRes) {
        if (!updateRes.ok) {
          const errData = await updateRes.json().catch(() => ({}));
          throw new Error(errData.error || "Failed to update existing leads");
        }
        const updateData = await updateRes.json();
        totalSaved += updateData.count || 0;
        if (updateData.duplicates && updateData.duplicates.length > 0) {
          allDuplicates.push(...updateData.duplicates);
        }

        if (updateData.updated && updateData.updated.length > 0) {
          setActiveSheet((prev) => {
            if (!prev) return prev;
            const updatedMap = new Map<string, RowData>();
            updateData.updated.forEach((r: RowData) => {
              updatedMap.set(r.id, r);
            });
            return {
              ...prev,
              rows: prev.rows.map((r) => (updatedMap.has(r.id) ? { ...r, ...updatedMap.get(r.id)! } : r)),
            };
          });
        }
      }

      if (allDuplicates.length > 0) {
        showToast(
          `Pasted ${totalSaved} lead(s). ${allDuplicates.length} duplicate phone number(s) skipped.`,
          "info"
        );
      } else if (totalSaved > 0) {
        showToast(`✓ Successfully pasted and saved ${totalSaved} lead(s).`, "success");
      }

      setSavingStatus("saved");
    } catch (err: any) {
      console.error("Batch update error:", err);
      showToast(err.message || "Failed to save pasted data.", "error");
      silentRefreshActiveSheet(currentSheet.id);
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

  // 8. Update Columns (widths, rename, reorder, delete, filter visibility)
  const handleUpdateColumns = async (columns: ColumnDef[]) => {
    if (!activeSheet) return;

    setActiveSheet((prev) => (prev ? { ...prev, columns } : prev));

    try {
      await fetch(`/api/sheets/${activeSheet.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ columns, syncAll: user?.role === "ADMIN" }),
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

  // 10. Save Dropdown Options & Filter Visibility for column(s)
  const handleSaveDropdownOptions = async (
    columnId: string,
    options: string[],
    filterVisibility?: Record<string, boolean>,
    allColumnsToUpdate?: { columnId: string; options: string[]; filterVisibility: Record<string, boolean> }[]
  ) => {
    if (!activeSheet) return;

    let updatedCols = [...activeSheet.columns];

    if (allColumnsToUpdate && allColumnsToUpdate.length > 0) {
      allColumnsToUpdate.forEach(({ columnId: colId, options: colOpts, filterVisibility: colVis }) => {
        const isFollowup = colId.includes("followup");
        updatedCols = updatedCols.map((c) => {
          if (isFollowup && c.type === "dropdown" && c.id.includes("followup")) {
            return { ...c, options: colOpts, filterVisibility: colVis };
          }
          if (c.id === colId) {
            return { ...c, options: colOpts, filterVisibility: colVis };
          }
          return c;
        });
      });
    } else {
      const isFollowupCol = columnId.includes("followup");
      updatedCols = updatedCols.map((c) => {
        if (isFollowupCol && c.type === "dropdown" && c.id.includes("followup")) {
          return {
            ...c,
            options,
            filterVisibility: filterVisibility !== undefined ? filterVisibility : c.filterVisibility,
          };
        }
        if (c.id === columnId) {
          return {
            ...c,
            options,
            filterVisibility: filterVisibility !== undefined ? filterVisibility : c.filterVisibility,
          };
        }
        return c;
      });
    }

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
        await fetchSheets();
        showToast(`Sheet renamed to "${newName}"`, "success");
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to rename sheet", "error");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to rename sheet", "error");
    }
  };

  // 12. Delete Sheet
  const handleDeleteSheet = async (id: string) => {
    try {
      const res = await fetch(`/api/sheets/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Sheet deleted successfully", "info");
        await fetchSheets();
        if (activeSheetId === id) {
          const remaining = sheets.filter((s) => s.id !== id);
          if (remaining.length > 0) {
            setActiveSheetId(remaining[0].id);
          }
        }
      } else {
        const err = await res.json();
        showToast(err.error || "Failed to delete sheet", "error");
      }
    } catch (err: any) {
      console.error(err);
      showToast(err.message || "Failed to delete sheet", "error");
    }
  };

  // 13. Duplicate Sheet (Structure Only vs Clone Leads)
  const handleDuplicateSheet = async (id: string, newName: string, includeLeads: boolean) => {
    try {
      const res = await fetch(`/api/sheets/${id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newName, includeLeads }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to duplicate sheet");
      await fetchSheets();
      if (data.sheet?.id) {
        setActiveSheetId(data.sheet.id);
      }
      showToast(`Sheet "${data.sheet?.name || newName}" created successfully!`, "success");
    } catch (err: any) {
      showToast(err.message || "Failed to duplicate sheet", "error");
    }
  };

  // 14. Change Sheet Tab Color
  const handleChangeSheetColor = async (id: string, color: string | null) => {
    // Optimistic local update
    setSheets((prev) => prev.map((s) => (s.id === id ? { ...s, color } : s)));
    if (activeSheet && activeSheet.id === id) {
      setActiveSheet((prev) => (prev ? { ...prev, color } : prev));
    }
    try {
      const res = await fetch(`/api/sheets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ color }),
      });
      if (!res.ok) throw new Error("Failed to update sheet color");
      await fetchSheets();
    } catch (err: any) {
      showToast("Failed to save tab color", "error");
      await fetchSheets();
    }
  };

  // 15. Copy Sheet to Member
  const handleCopySheetToUser = async (
    id: string,
    targetUserId: string,
    newName: string,
    includeLeads: boolean
  ) => {
    try {
      const res = await fetch(`/api/sheets/${id}/duplicate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUserId, newName, includeLeads }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to copy sheet to member");
      await fetchSheets();
      if (user?.role === "ADMIN") {
        fetchUsers();
      }
      showToast("Sheet copied to member successfully!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to copy sheet", "error");
    }
  };

  // 16. Move / Reassign Sheet to Member
  const handleMoveSheetToUser = async (id: string, targetUserId: string) => {
    try {
      const res = await fetch(`/api/sheets/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: targetUserId }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to reassign sheet");
      await fetchSheets();
      if (user?.role === "ADMIN") {
        fetchUsers();
      }
      showToast("Sheet reassigned successfully!", "success");
    } catch (err: any) {
      showToast(err.message || "Failed to reassign sheet", "error");
    }
  };

  // 17. Create New Sheet Tab (Admin)
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
  const handleUpdateLead = async (
    rowId: string,
    updatedData: Record<string, string>,
    order?: number
  ) => {
    const currentSheet = activeSheetRef.current || activeSheet;
    if (!currentSheet) return;

    pushUndoSnapshot();

    const rowOrder = order !== undefined ? order : activeCellRef.current?.rowIdx ?? 0;

    // Optimistically update local state immediately for zero-lag UI
    setActiveSheet((prev) => {
      if (!prev) return prev;
      let targetIndex = -1;

      // 1. Strictly match by unique database ID first
      if (rowId && !rowId.startsWith("temp_")) {
        targetIndex = prev.rows.findIndex((r) => r.id === rowId);
      }
      // 2. If rowId is temp or not found by real id, match by sequential order
      if (targetIndex === -1 && order !== undefined) {
        targetIndex = prev.rows.findIndex((r) => r.order === order);
      }
      // 3. Fallback match by temp id
      if (targetIndex === -1 && rowId && rowId.startsWith("temp_")) {
        targetIndex = prev.rows.findIndex((r) => r.id === rowId);
      }

      if (targetIndex !== -1) {
        const existing = prev.rows[targetIndex];
        const nextRows = [...prev.rows];
        nextRows[targetIndex] = {
          ...existing,
          data: { ...existing.data, ...updatedData },
        };
        return {
          ...prev,
          rows: nextRows,
        };
      }

      // New row created for blank row index
      const newRow: RowData = {
        id: rowId,
        sheetId: prev.id,
        order: rowOrder,
        data: updatedData,
        styles: {},
        createdAt: new Date().toISOString(),
      };
      return {
        ...prev,
        rows: [...prev.rows, newRow],
      };
    });

    setSavingStatus("saving");

    try {
      const res = await fetch(`/api/sheets/${currentSheet.id}/rows`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rows: [{ id: rowId.startsWith("temp_") ? undefined : rowId, order: rowOrder, data: updatedData }],
          userId: currentSheet.userId || undefined,
        }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 409) {
          showToast(`⚠️ ${errData.error || "Duplicate Lead detected."}`, "error");
        } else {
          showToast(errData.error || "Failed to save lead.", "error");
        }
        silentRefreshActiveSheet(currentSheet.id);
        setSavingStatus("error");
        throw new Error(errData.error || "Failed to save lead");
      }

      const data = await res.json();
      if (data.rows && data.rows[0]) {
        const confirmedRow = data.rows[0];
        setActiveSheet((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            rows: prev.rows.map((r) =>
              r.id === rowId || r.id === confirmedRow.id
                ? { ...r, ...confirmedRow, data: { ...r.data, ...confirmedRow.data } }
                : r
            ),
          };
        });
      }
      setSavingStatus("saved");
    } catch (err) {
      console.error(err);
      setSavingStatus("error");
      throw err;
    }
  };

  const handleSaveLeadFromModal = async (data: Record<string, string>, rowId?: string) => {
    const currentSheet = activeSheetRef.current || activeSheet;
    if (!currentSheet) return;

    if (rowId && !rowId.startsWith("temp_")) {
      // Update existing lead using unified handler
      await handleUpdateLead(rowId, data);
    } else {
      // Create new lead in database
      const existingOrders = currentSheet.rows.map((r) => r.order ?? 0);
      const nextOrder = existingOrders.length > 0 ? Math.max(...existingOrders) + 1 : 0;

      setSavingStatus("saving");
      try {
        const res = await fetch(`/api/sheets/${currentSheet.id}/rows`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ data, order: nextOrder, userId: currentSheet.userId || undefined }),
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
        sheet={currentActiveSheet || activeSheet}
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
              const row =
                activeSheet.rows[activeCell.rowIdx] ||
                activeSheet.rows.find(
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
                sheet={currentActiveSheet || activeSheet}
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
                onUpdateCell={handleUpdateCell}
                onUpdateLead={handleUpdateLead}
              />
            </div>

            {/* Desktop View: Full Google Sheets-Style Spreadsheet Grid with 1,000 Rows */}
            <div className="hidden md:flex flex-1 flex-col h-[calc(100vh-200px)] min-h-[400px] overflow-hidden w-full">
              {(() => {
                console.log("Desktop Grid Data:", activeSheet.rows);
                return (
                  <SpreadsheetGrid
                    key={activeSheet.id}
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
                );
              })()}
            </div>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center text-slate-400 gap-2">
            <FileSpreadsheet className="h-10 w-10 text-slate-300" />
            <p className="text-sm">No sheet selected or available.</p>
          </div>
        )}
      </div>

      {/* 4. Large, Thicker, High-Contrast Bottom Tab Bar (Draggable & Google Sheets Menu) */}
      <BottomTabBar
        sheets={displayedSheets}
        activeSheetId={activeSheetId}
        onSelectSheet={(id) => {
          setStatusFilter(null);
          setDateFilter(null);
          setSearchQuery("");
          setActiveSheetId(id);
        }}
        isAdmin={user?.role === "ADMIN"}
        users={usersList}
        onOpenNewSheetModal={() => setIsNewSheetModalOpen(true)}
        onRenameSheet={handleRenameSheet}
        onDeleteSheet={handleDeleteSheet}
        onReorderSheets={handleReorderSheets}
        onDuplicateSheet={handleDuplicateSheet}
        onChangeSheetColor={handleChangeSheetColor}
        onCopySheetToUser={handleCopySheetToUser}
        onMoveSheetToUser={handleMoveSheetToUser}
        onOpenManageAccounts={() => setIsManageAccountsModalOpen(true)}
      />

      {/* Modals */}
      <ConfigureDropdownModal
        isOpen={isDropdownModalOpen}
        onClose={() => {
          setIsDropdownModalOpen(false);
          setSelectedColumnForDropdown(null);
        }}
        column={selectedColumnForDropdown}
        columns={activeSheet?.columns || []}
        isAdmin={user?.role === "ADMIN"}
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
          sheetName={currentActiveSheet?.name || activeSheet.name}
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
          onRefreshSheets={() => {
            fetchSheets();
            fetchUsers();
          }}
          onUserUpdated={handleUserUpdated}
        />
      )}

      {/* Mandatory First-Time Password Setup for pre-seeded default accounts */}
      {user?.mustChangePassword && (
        <ForceChangePasswordModal
          userName={user.name}
          onSuccess={() => fetchSheets()}
        />
      )}

      {/* Lightweight Floating Toast Notification (No Page Reloads) */}
      {toast && (
        <div
          className={`fixed bottom-12 right-6 z-50 flex items-center gap-2.5 px-4 py-2.5 rounded-xl shadow-2xl text-xs font-semibold border transition-all ${
            toast.type === "error"
              ? "bg-rose-950 text-rose-100 border-rose-800 shadow-rose-950/50"
              : toast.type === "success"
              ? "bg-emerald-950 text-emerald-100 border-emerald-800 shadow-emerald-950/50"
              : "bg-slate-900 text-slate-100 border-slate-700 shadow-slate-950/50"
          }`}
        >
          {toast.type === "error" ? (
            <AlertCircle className="h-4 w-4 text-rose-400 shrink-0" />
          ) : (
            <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0" />
          )}
          <span className="max-w-xs sm:max-w-md truncate">{toast.message}</span>
          <button
            onClick={() => setToast(null)}
            className="ml-2 text-slate-400 hover:text-white p-0.5 rounded transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      )}

    </div>
  );
}
