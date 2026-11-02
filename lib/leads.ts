/**
 * Utility functions for lead validation and counting.
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
