import { ColumnDef, RowData } from "./types";

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
    if (val !== undefined && val !== null && !isFollowupEmpty(val)) {
      return typeof val === "string" ? val.trim() : String(val).trim();
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
 * Strictly considers null, undefined, empty string, whitespace-only, hyphens,
 * and any placeholder phrases (e.g. "Select status...", "Choose...", "Unassigned") as empty.
 */
export function isFollowupEmpty(val: any): boolean {
  if (val === undefined || val === null) return true;
  const str = typeof val === "string" ? val.trim() : String(val).trim();
  if (!str) return true;

  const lower = str.toLowerCase();

  // Strip leading/trailing hyphens, dashes, bullets, whitespace
  const stripped = lower.replace(/^[-–—•\s]+|[-–—•\s]+$/g, "").trim();
  if (!stripped) return true;

  // Placeholder phrases (e.g. "Select status...", "-- Select Status --", "Choose option", etc.)
  if (
    stripped.includes("select") ||
    stripped.includes("choose") ||
    stripped === "none" ||
    stripped === "n/a" ||
    stripped === "na" ||
    stripped === "null" ||
    stripped === "undefined" ||
    stripped === "unassigned" ||
    stripped === "empty" ||
    stripped === "nil" ||
    stripped === "not attended" ||
    stripped === "unattended"
  ) {
    return true;
  }

  return false;
}

/**
 * Checks whether a lead is considered "Unattended".
 * STRICT LOGIC: A lead is considered "Unattended" ONLY if *every single*
 * follow-up status field (1st Follow Up, 2nd Follow Up, 3rd Follow Up, and 4th Follow Up)
 * is simultaneously empty, null, undefined, or set to a placeholder (e.g., "Select status...").
 *
 * If even ONE follow-up field has a valid status value, the lead is NO LONGER unattended (returns false).
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
    "1st Follow Up",
    "2nd Follow Up",
    "3rd Follow Up",
    "4th Follow Up",
    "1st follow up",
    "2nd follow up",
    "3rd follow up",
    "4th follow up",
    "col_followup_1_status",
    "col_followup_2_status",
    "col_followup_3_status",
    "col_followup_4_status",
    "followup_1",
    "followup_2",
    "followup_3",
    "followup_4",
    "Follow Up 1",
    "Follow Up 2",
    "Follow Up 3",
    "Follow Up 4",
    "Follow-up 1",
    "Follow-up 2",
    "Follow-up 3",
    "Follow-up 4",
    "follow_up_1",
    "follow_up_2",
    "follow_up_3",
    "follow_up_4",
  ]);

  if (columns && Array.isArray(columns)) {
    columns.forEach((c) => {
      const idLower = c.id.toLowerCase();
      const nameLower = c.name.toLowerCase();
      const isDate = idLower.includes("date") || nameLower.includes("date");
      if (isDate) return;

      if (
        c.type === "dropdown" &&
        (idLower.includes("followup") ||
          idLower.includes("follow_up") ||
          idLower.includes("follow-up") ||
          nameLower.includes("follow up") ||
          nameLower.includes("follow-up") ||
          nameLower.includes("followup"))
      ) {
        followupKeys.add(c.id);
        followupKeys.add(c.name);
      }
    });
  }

  // Also include any key present on rowData that looks like a follow-up status key
  for (const k of Object.keys(rowData)) {
    const kLower = k.toLowerCase();
    if (
      !kLower.includes("date") &&
      (kLower.includes("followup") ||
        kLower.includes("follow up") ||
        kLower.includes("follow-up"))
    ) {
      followupKeys.add(k);
    }
  }

  // Check all follow-up keys. If even ONE follow-up field has a valid status, it is NOT unattended.
  for (const k of Array.from(followupKeys)) {
    if (k in rowData) {
      const val = rowData[k];
      if (!isFollowupEmpty(val)) {
        // At least one follow-up field is active!
        return false;
      }
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
 * Checks whether a column key represents a lead's name field.
 */
export function isNameFieldKey(key: string): boolean {
  if (!key || typeof key !== "string") return false;
  const kLower = key.trim().toLowerCase();
  return (
    kLower === "col_name" ||
    kLower === "name" ||
    kLower === "lead_name" ||
    kLower === "client_name" ||
    kLower === "lead name" ||
    kLower === "client name"
  );
}

/**
 * Extracts lead name value from row data object.
 */
export function getLeadName(rowData: Record<string, any> | undefined | null): string {
  if (!rowData || typeof rowData !== "object") return "";
  for (const [k, v] of Object.entries(rowData)) {
    if (isNameFieldKey(k) && v !== undefined && v !== null) {
      return String(v).trim();
    }
  }
  return "";
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
 * Normalizes a date input (Date object, ISO timestamp, or date string)
 * into a strict local YYYY-MM-DD string.
 */
export function toLocalYMD(dateInput: string | Date | undefined | null): string {
  if (!dateInput) return "";

  // If already a strict YYYY-MM-DD string, return directly
  if (typeof dateInput === "string") {
    const trimmed = dateInput.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
      return trimmed;
    }
  }

  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return String(dateInput).trim();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  } catch {
    return "";
  }
}

/**
 * Checks whether a row's added date strictly matches the selected filter date on an exact calendar day.
 * Prevents older or newer leads from bleeding into the filtered view by strictly checking YYYY-MM-DD === selectedDate.
 */
export function rowMatchesDateFilter(
  createdAtOrRow: string | Date | RowData | Record<string, any> | undefined | null,
  filterDate: string | null
): boolean {
  if (!filterDate) return true;
  if (!createdAtOrRow) return false;

  const targetYMD = toLocalYMD(filterDate);
  if (!targetYMD) return true;

  let rawDate: string | Date | undefined | null = null;

  if (typeof createdAtOrRow === "string" || createdAtOrRow instanceof Date) {
    rawDate = createdAtOrRow;
  } else if (typeof createdAtOrRow === "object") {
    const rowObj = createdAtOrRow as any;
    rawDate =
      rowObj.createdAt ||
      rowObj.data?.col_date ||
      rowObj.data?.date ||
      rowObj.data?.["Date Added"] ||
      rowObj.data?.["Added Date"];
  }

  if (!rawDate) return false;

  const leadYMD = toLocalYMD(rawDate);
  if (!leadYMD) return false;

  // Strict exact calendar day match (no >= or <= range, no UTC fallback bleed)
  return leadYMD === targetYMD;
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

/**
 * Sanitizes and cleans clipboard data before state updates and database writes.
 * Strips non-numeric characters/spaces for phone/number columns, formats dates,
 * removes unprintable ASCII control characters, and removes Excel quotation wrappers.
 */
export function sanitizeCellValue(rawValue: any, col?: ColumnDef): string {
  if (rawValue === undefined || rawValue === null) return "";
  let val = String(rawValue).trim();
  if (!val) return "";

  // 1. Remove non-printable control characters & null bytes (preserve standard text)
  val = val.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, "");

  // 2. Strip Excel/Sheets multi-line quote wrapping (e.g., "cell content" -> cell content)
  if (val.startsWith('"') && val.endsWith('"') && val.length >= 2) {
    val = val.substring(1, val.length - 1).replace(/""/g, '"');
  }

  // 3. Flatten internal newlines/carriage returns for single cell storage
  val = val.replace(/[\r\n\t]+/g, " ").trim();

  if (!col) return val;

  const colIdLower = (col.id || "").toLowerCase();
  const colNameLower = (col.name || "").toLowerCase();

  // 4. Phone Number sanitization
  const isPhoneColumn =
    colIdLower === "col_number" ||
    colIdLower.includes("phone") ||
    colIdLower.includes("mobile") ||
    colIdLower.includes("contact") ||
    colNameLower.includes("phone") ||
    colNameLower.includes("number") ||
    colNameLower.includes("mobile") ||
    colNameLower.includes("contact");

  if (isPhoneColumn) {
    // Strip out all non-numeric characters and spaces so Prisma/Postgres doesn't reject the payload
    // Handles formats like "+91 98765-43210", "(987) 654 3210", "98765 43210" -> "9876543210"
    const digitsOnly = val.replace(/\D/g, "");
    if (digitsOnly.length === 12 && digitsOnly.startsWith("91")) {
      return digitsOnly.slice(2);
    }
    if (digitsOnly.length === 11 && digitsOnly.startsWith("0")) {
      return digitsOnly.slice(1);
    }
    return digitsOnly;
  }

  // 5. Numeric column sanitization
  if (col.type === "number") {
    // Strip non-numeric characters, preserving decimal points and negative signs
    return val.replace(/[^\d.-]/g, "").trim();
  }

  // 6. Date column sanitization
  if (col.type === "date" || colIdLower.includes("date") || colNameLower.includes("date")) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(val)) return val;
    const parsed = new Date(val);
    if (!isNaN(parsed.getTime())) {
      try {
        return parsed.toISOString().split("T")[0];
      } catch {
        return val;
      }
    }
    return val;
  }

  // 7. Dropdown column sanitization (match casing of options)
  if (col.type === "dropdown" && Array.isArray(col.options) && col.options.length > 0) {
    const match = col.options.find(
      (opt) => opt.toLowerCase().trim() === val.toLowerCase().trim()
    );
    if (match) return match;
  }

  return val;
}
