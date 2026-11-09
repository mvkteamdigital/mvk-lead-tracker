export interface ColumnDef {
  id: string;
  name: string;
  type: "text" | "dropdown" | "number" | "date";
  width: number;
  headerStyle?: "gold" | "navy" | "default" | "emerald" | "purple" | string;
  options?: string[];
  filterVisibility?: Record<string, boolean>; // optionName -> boolean (true: show in top bar, false: in More Filters)
}

export interface CellStyle {
  bold?: boolean;
  italic?: boolean;
  color?: string;
  bgColor?: string;
  align?: "left" | "center" | "right";
}

export interface RowData {
  id: string;
  sheetId: string;
  order: number;
  data: Record<string, any>;
  styles?: Record<string, CellStyle>;
  nameModifiedAt?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface SheetMeta {
  id: string;
  name: string;
  color?: string | null;
  userId: string | null;
  order: number;
  columns: ColumnDef[];
  rowCount?: number;
  user?: {
    id: string;
    name: string;
    email: string;
    role: string;
  } | null;
}

export interface SheetDetail extends SheetMeta {
  rows: RowData[];
}
