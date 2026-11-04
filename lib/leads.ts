import { ColumnDef } from "./types";

/**
 * Utility functions for lead validation, status tracking, and counting.
 */

// Set of default dropdown placeholders and statuses to ignore when counting leads
const DEFAULT_DROPDOWN_PLACEHOLDERS = new Set([
  "select",
  "select...",
  "select status",
  "select status...",
  "select option",
  "select an option",
  "choose",
  "choose...",
  "choose option",
  "follow-up needed",
  "follow up needed",
  "follow-up required",
  "follow up required",
  "dropped / not interested",
  "dropped",
  "not interested",
  "rnr",
  "site visit booked – not completed",
  "site visit booked - not completed",
  "site visit completed",
  "c p",
  "purchase done",
  "none",
  "n/a",
  "na",
  "null",
  "undefined",
  "-",
  "--",
  "---",
  "placeholder",
]);

/**
 * Validates whether a value contains actual alphanumeric characters after trimming,
 * and is not a default dropdown placeholder or empty/invisible whitespace.
 */
function isAlphanumericText(val: any): boolean {
  if (val === undefined || val === null) return false;
  const trimmed = String(val).trim();
  if (!trimmed) return false;

  // Must contain at least one alphanumeric character
  if (!/[a-zA-Z0-9]/.test(trimmed)) return false;

  // Must not match any default dropdown placeholder (case-insensitive)
  if (DEFAULT_DROPDOWN_PLACEHOLDERS.has(trimmed.toLowerCase())) {
    return false;
  }

  return true;
}

/**
 * Determines whether a row contains a valid lead.
 * A row is ONLY counted towards the total lead count if Name, Number,
 * or Project Name contains actual alphanumeric characters after .trim() is applied.
 * It strictly ignores invisible spaces, empty strings, and default dropdown placeholders.
 */
export function isValidLead(rowData: Record<string, any> | string | undefined | null): boolean {
  if (!rowData) return false;
  let data: Record<string, any>;
  if (typeof rowData === "string") {
    try {
      data = JSON.parse(rowData);
    } catch {
      return false;
    }
  } else {
    data = rowData;
  }

  if (!data || typeof data !== "object") return false;

  // 1. Check Name
  const nameVal =
    data.col_name ??
    data["Name"] ??
    data["name"] ??
    data["client_name"] ??
    data["customer_name"];
  if (isAlphanumericText(nameVal)) return true;

  // 2. Check Number
  const numberVal =
    data.col_number ??
    data["Number"] ??
    data["number"] ??
    data["phone"] ??
    data["Phone"] ??
    data["mobile"] ??
    data["Mobile"] ??
    data["Contact"];
  if (isAlphanumericText(numberVal)) return true;

  // 3. Check Project Name
  const projectVal =
    data.col_project_name ??
    data["Project Name"] ??
    data["project"] ??
    data["project_name"];
  if (isAlphanumericText(projectVal)) return true;

  return false;
}

/**
 * Gets the latest recorded follow-up status for a lead.
 * Checks follow-up columns in reverse chronological order (4th -> 3rd -> 2nd -> 1st).
 * Returns "Unassigned" if no status is chosen yet.
 */
export function getLeadStatus(
  rowData: Record<string, any> | undefined | null,
  columns?: ColumnDef[]
): string {
  if (!rowData || typeof rowData !== "object") return "Unassigned";

  // Find specifically follow-up status dropdown columns (strictly exclude lead source, budget, date, etc.)
  const followUpKeys = (columns || [])
    .filter((c) => {
      const idLower = c.id.toLowerCase();
      const nameLower = c.name.toLowerCase();
      if (idLower.includes("source") || nameLower.includes("source")) return false;
      if (idLower.includes("budget") || nameLower.includes("budget")) return false;
      if (idLower.includes("date") || nameLower.includes("date")) return false;
      return (
        (c.type === "dropdown" && (idLower.includes("followup") || nameLower.includes("follow up"))) ||
        idLower.includes("followup")
      );
    })
    .map((c) => c.id);

  const keysToCheck =
    followUpKeys.length > 0
      ? followUpKeys.slice().reverse()
      : ["col_followup_4", "col_followup_3", "col_followup_2", "col_followup_1"];

  for (const k of keysToCheck) {
    const val = rowData[k];
    if (val && typeof val === "string") {
      const trimmed = val.trim();
      if (
        trimmed &&
        !trimmed.toLowerCase().includes("select") &&
        !trimmed.toLowerCase().includes("choose")
      ) {
        return trimmed;
      }
    }
  }

  return "Unassigned";
}

/**
 * Gets the latest recorded follow-up date for a lead.
 * Corresponds to the most recent follow-up date entry.
 */
export function getLeadFollowupDate(
  rowData: Record<string, any> | undefined | null,
  columns?: ColumnDef[]
): string | null {
  if (!rowData || typeof rowData !== "object") return null;

  // Find all date columns
  const dateKeys = (columns || [])
    .filter((c) => c.type === "date" || c.id.includes("date"))
    .map((c) => c.id);

  const keysToCheck =
    dateKeys.length > 0
      ? dateKeys.slice().reverse()
      : [
          "col_followup_4_date",
          "col_followup_3_date",
          "col_followup_2_date",
          "col_followup_1_date",
        ];

  for (const k of keysToCheck) {
    const val = rowData[k];
    if (val && typeof val === "string") {
      const trimmed = val.trim();
      if (trimmed) return trimmed;
    }
  }

  return null;
}

/**
 * Helper to determine if a follow-up value is empty or just a placeholder.
 */
export function isFollowupEmpty(val: any): boolean {
  if (val === undefined || val === null) return true;
  const str = typeof val === "string" ? val.trim() : String(val).trim();
  if (!str) return true;
  const lower = str.toLowerCase();
  return (
    lower.startsWith("select") ||
    lower.startsWith("choose") ||
    lower === "-" ||
    lower === "--" ||
    lower === "---" ||
    lower === "none" ||
    lower === "n/a" ||
    lower === "na" ||
    lower === "null" ||
    lower === "undefined"
  );
}

/**
 * Checks whether a lead is considered "Unattended".
 * STRICT LOGIC: A lead is considered "Unattended" ONLY if *every single*
 * follow-up status field (1st Follow Up, 2nd Follow Up, 3rd Follow Up, and 4th Follow Up)
 * is simultaneously null, undefined, or set to the default empty state (e.g., "Select status...").
 * If even one of these follow-up fields has a value, the lead is NO LONGER considered unattended.
 */
export function isUnattendedLead(
  rowData: Record<string, any> | undefined | null,
  columns?: ColumnDef[]
): boolean {
  if (!rowData || typeof rowData !== "object") return false;
  if (!isValidLead(rowData)) return false;

  // Identify follow-up status keys to check (1st, 2nd, 3rd, and 4th Follow Up)
  const followupKeys = new Set<string>([
    "col_followup_1",
    "col_followup_2",
    "col_followup_3",
    "col_followup_4",
  ]);

  if (columns && Array.isArray(columns)) {
    columns.forEach((c) => {
      const idLower = c.id.toLowerCase();
      const nameLower = c.name.toLowerCase();
      if (
        c.type === "dropdown" &&
        (idLower.includes("followup") || nameLower.includes("follow up")) &&
        !idLower.includes("date") &&
        !nameLower.includes("date")
      ) {
        followupKeys.add(c.id);
        followupKeys.add(c.name);
      }
    });
  }

  // Also include standard named keys
  [
    "1st Follow Up",
    "2nd Follow Up",
    "3rd Follow Up",
    "4th Follow Up",
    "1st follow up",
    "2nd follow up",
    "3rd follow up",
    "4th follow up",
  ].forEach((k) => followupKeys.add(k));

  for (const k of Array.from(followupKeys)) {
    const val = rowData[k];
    if (!isFollowupEmpty(val)) {
      // If even ONE follow-up field has a value, it is NO LONGER unattended!
      return false;
    }
  }

  // All follow-up status fields are simultaneously empty / null / placeholder
  return true;
}

/**
 * Extracts lead source value from row data object.
 */
export function getLeadSource(rowData: Record<string, any> | undefined | null): string {
  if (!rowData || typeof rowData !== "object") return "";
  const val =
    rowData.col_lead_source ??
    rowData["Lead Source"] ??
    rowData["lead_source"] ??
    rowData["source"] ??
    "";
  return typeof val === "string" ? val.trim() : String(val || "").trim();
}

/**
 * Checks whether a row matches an active status filter.
 * When statusFilter is null, returns true for all rows.
 * When statusFilter is "Unattended", returns true ONLY if all 4 follow-up statuses are empty.
 * When statusFilter is set, checks if any follow-up column on that lead has that status,
 * or if statusFilter matches the lead's Lead Source,
 * or if statusFilter is "Unassigned", checks if no follow-up status has been set.
 */
export function rowMatchesStatusFilter(
  rowData: Record<string, any> | undefined | null,
  statusFilter: string | null,
  columns?: ColumnDef[]
): boolean {
  if (!statusFilter) return true;
  if (!rowData || typeof rowData !== "object") return false;

  // Strict Unattended Lead check: every single follow-up field must be empty/null/placeholder
  if (statusFilter.toLowerCase() === "unattended") {
    return isUnattendedLead(rowData, columns);
  }

  const currentStatus = getLeadStatus(rowData, columns);

  if (statusFilter === "Unassigned") {
    return currentStatus === "Unassigned";
  }

  const normFilter = statusFilter.trim().toLowerCase().replace(/[–—]/g, "-");

  // Check if primary status matches
  if (currentStatus.trim().toLowerCase().replace(/[–—]/g, "-") === normFilter) {
    return true;
  }

  // Check if Lead Source matches (e.g., "Meta Ads", "Google Ads", etc.)
  const leadSource = getLeadSource(rowData);
  if (leadSource && leadSource.toLowerCase() === normFilter) {
    return true;
  }

  // Also check if any other follow-up column matches this status
  const followUpKeys = (columns || [])
    .filter((c) => c.type === "dropdown" || c.id.includes("followup"))
    .map((c) => c.id);

  const keysToCheck =
    followUpKeys.length > 0
      ? followUpKeys
      : ["col_followup_1", "col_followup_2", "col_followup_3", "col_followup_4"];

  return keysToCheck.some((k) => {
    const val = rowData[k];
    return (
      typeof val === "string" &&
      val.trim().toLowerCase().replace(/[–—]/g, "-") === normFilter
    );
  });
}

/**
 * Normalizes phone number into clean trimmed string and extracted digit sequence.
 */
export function extractPhoneInfo(val: any): { exact: string; digits: string } {
  if (!val || typeof val !== "string") return { exact: "", digits: "" };
  const exact = val.trim();
  const digits = exact.replace(/\D/g, "");
  const last10 = digits.length >= 10 ? digits.slice(-10) : digits;
  return { exact, digits: last10 };
}

/**
 * Extracts phone number value from row data object regardless of key variations.
 */
export function getRowPhoneNumber(data: Record<string, any> | undefined | null): string {
  if (!data || typeof data !== "object") return "";
  const num =
    data.col_number ??
    data["Number"] ??
    data["number"] ??
    data["phone"] ??
    data["Phone"] ??
    data["mobile"] ??
    data["Mobile"] ??
    data["phone_number"] ??
    "";
  return typeof num === "string" ? num.trim() : String(num || "").trim();
}

/**
 * Checks whether a row's createdAt timestamp matches the selected filter date (YYYY-MM-DD).
 * Accurately compares against both local calendar date and UTC date to avoid any timezone offset issues.
 */
export function rowMatchesDateFilter(
  createdAt: string | Date | undefined | null,
  filterDate: string | null
): boolean {
  if (!filterDate) return true;
  if (!createdAt) return false;

  try {
    const d = typeof createdAt === "string" ? new Date(createdAt) : createdAt;
    if (isNaN(d.getTime())) return false;

    // 1. Local date YYYY-MM-DD
    const localYear = d.getFullYear();
    const localMonth = String(d.getMonth() + 1).padStart(2, "0");
    const localDay = String(d.getDate()).padStart(2, "0");
    const localYMD = `${localYear}-${localMonth}-${localDay}`;
    if (localYMD === filterDate) return true;

    // 2. UTC date YYYY-MM-DD (fallback for UTC-stored timestamps)
    const utcYMD = d.toISOString().split("T")[0];
    if (utcYMD === filterDate) return true;

    return false;
  } catch {
    return false;
  }
}

/**
 * Formats a YYYY-MM-DD string into a clean display format like "Nov 4, 2026"
 */
export function formatDateDisplay(dateStr: string | null | undefined): string {
  if (!dateStr) return "";
  try {
    const [year, month, day] = dateStr.split("-").map(Number);
    if (!year || !month || !day) return dateStr;
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  } catch {
    return dateStr;
  }
}
