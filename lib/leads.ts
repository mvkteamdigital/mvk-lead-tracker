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

  // Find all dropdown columns or follow-up columns
  const followUpKeys = (columns || [])
    .filter((c) => c.type === "dropdown" || c.id.includes("followup"))
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
 * Checks whether a row matches an active status filter.
 * When statusFilter is null, returns true for all rows.
 * When statusFilter is set, checks if any follow-up column on that lead has that status,
 * or if statusFilter is "Unassigned", checks if no follow-up status has been set.
 */
export function rowMatchesStatusFilter(
  rowData: Record<string, any> | undefined | null,
  statusFilter: string | null,
  columns?: ColumnDef[]
): boolean {
  if (!statusFilter) return true;
  if (!rowData || typeof rowData !== "object") return false;

  const currentStatus = getLeadStatus(rowData, columns);

  if (statusFilter === "Unassigned") {
    return currentStatus === "Unassigned";
  }

  // Check if primary status matches
  if (currentStatus.toLowerCase() === statusFilter.toLowerCase()) {
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
      val.trim().toLowerCase() === statusFilter.toLowerCase()
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
