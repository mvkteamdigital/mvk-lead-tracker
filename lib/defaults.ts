import { ColumnDef } from "./types";

export const DEFAULT_FOLLOWUP_OPTIONS = [
  "Follow-up Needed",
  "Dropped / Not Interested",
  "RNR",
  "Site Visit Booked – Not Completed",
  "Site Visit Completed",
  "C P",
  "Purchase Done"
];

export const DEFAULT_LEAD_SOURCES = [
  "Meta Ads",
  "Google Ads",
  "Direct",
  "Referral",
  "Walk-in",
  "Website",
  "MagicBricks / 99acres",
  "Cold Call"
];

// Default visibility in top dashboard filter bar (options with true show as quick chips; false show in More Filters)
export const DEFAULT_STATUS_FILTER_VISIBILITY: Record<string, boolean> = {
  "Follow-up Needed": true,
  "RNR": true,
  "Site Visit Completed": true,
  "Dropped / Not Interested": false,
  "Site Visit Booked – Not Completed": false,
  "C P": false,
  "Purchase Done": false,
};

export const DEFAULT_SOURCE_FILTER_VISIBILITY: Record<string, boolean> = {
  "Meta Ads": true,
  "Google Ads": false,
  "Direct": false,
  "Referral": false,
  "Walk-in": false,
  "Website": false,
  "MagicBricks / 99acres": false,
  "Cold Call": false,
};

export const DEFAULT_COLUMNS: ColumnDef[] = [
  {
    id: "col_project_name",
    name: "Project Name",
    type: "text",
    width: 200,
    headerStyle: "gold",
    options: []
  },
  {
    id: "col_plot_size",
    name: "Enquired Plot Size",
    type: "text",
    width: 170,
    headerStyle: "gold",
    options: []
  },
  {
    id: "col_budget",
    name: "Client Budget",
    type: "text",
    width: 170,
    headerStyle: "gold",
    options: ["₹20-25 lakhs", "₹25-30 lakhs", "₹30-40 lakhs", "₹40-50 lakhs", "₹50-75 lakhs", "₹75L - 1 Cr", "₹1 Cr - 1.5 Cr", "₹1.5 Cr+"]
  },
  {
    id: "col_location",
    name: "Client Location",
    type: "text",
    width: 200,
    headerStyle: "gold",
    options: []
  },
  {
    id: "col_name",
    name: "Name",
    type: "text",
    width: 180,
    headerStyle: "gold",
    options: []
  },
  {
    id: "col_number",
    name: "Number",
    type: "text",
    width: 170,
    headerStyle: "gold",
    options: []
  },
  {
    id: "col_lead_source",
    name: "Lead Source",
    type: "dropdown",
    width: 160,
    headerStyle: "gold",
    options: DEFAULT_LEAD_SOURCES
  },
  {
    id: "col_followup_1",
    name: "1st Follow Up",
    type: "dropdown",
    width: 200,
    headerStyle: "navy",
    options: DEFAULT_FOLLOWUP_OPTIONS
  },
  {
    id: "col_followup_1_date",
    name: "1st Follow Up Date",
    type: "date",
    width: 155,
    headerStyle: "navy",
    options: []
  },
  {
    id: "col_followup_2",
    name: "2nd Follow Up",
    type: "dropdown",
    width: 200,
    headerStyle: "navy",
    options: DEFAULT_FOLLOWUP_OPTIONS
  },
  {
    id: "col_followup_2_date",
    name: "2nd Follow Up Date",
    type: "date",
    width: 155,
    headerStyle: "navy",
    options: []
  },
  {
    id: "col_followup_3",
    name: "3rd Follow Up",
    type: "dropdown",
    width: 200,
    headerStyle: "navy",
    options: DEFAULT_FOLLOWUP_OPTIONS
  },
  {
    id: "col_followup_3_date",
    name: "3rd Follow Up Date",
    type: "date",
    width: 155,
    headerStyle: "navy",
    options: []
  },
  {
    id: "col_followup_4",
    name: "4th Follow Up",
    type: "dropdown",
    width: 200,
    headerStyle: "navy",
    options: DEFAULT_FOLLOWUP_OPTIONS
  },
  {
    id: "col_followup_4_date",
    name: "4th Follow Up Date",
    type: "date",
    width: 155,
    headerStyle: "navy",
    options: []
  },
  {
    id: "col_remarks",
    name: "Remarks",
    type: "text",
    width: 240,
    headerStyle: "gold",
    options: []
  }
];

export const STATUS_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Follow-up Needed": { bg: "bg-amber-50", text: "text-amber-700 font-medium", border: "border-amber-200" },
  "Dropped / Not Interested": { bg: "bg-rose-50", text: "text-rose-700 font-medium", border: "border-rose-200" },
  "RNR": { bg: "bg-orange-50", text: "text-orange-700 font-medium", border: "border-orange-200" },
  "Site Visit Booked – Not Completed": { bg: "bg-blue-50", text: "text-blue-700 font-medium", border: "border-blue-200" },
  "Site Visit Completed": { bg: "bg-indigo-50", text: "text-indigo-700 font-medium", border: "border-indigo-200" },
  "C P": { bg: "bg-purple-50", text: "text-purple-700 font-medium", border: "border-purple-200" },
  "Purchase Done": { bg: "bg-emerald-100", text: "text-emerald-800 font-bold", border: "border-emerald-300" },
};

export const SOURCE_COLORS: Record<string, { bg: string; text: string; border: string }> = {
  "Meta Ads": { bg: "bg-blue-50", text: "text-blue-700 font-semibold", border: "border-blue-200" },
  "Google Ads": { bg: "bg-amber-50", text: "text-amber-700 font-semibold", border: "border-amber-200" },
  "Direct": { bg: "bg-emerald-50", text: "text-emerald-700 font-semibold", border: "border-emerald-200" },
  "Referral": { bg: "bg-purple-50", text: "text-purple-700 font-semibold", border: "border-purple-200" },
  "Walk-in": { bg: "bg-orange-50", text: "text-orange-700 font-semibold", border: "border-orange-200" },
  "Website": { bg: "bg-cyan-50", text: "text-cyan-700 font-semibold", border: "border-cyan-200" },
  "MagicBricks / 99acres": { bg: "bg-rose-50", text: "text-rose-700 font-semibold", border: "border-rose-200" },
  "Cold Call": { bg: "bg-slate-100", text: "text-slate-700 font-semibold", border: "border-slate-300" },
};
