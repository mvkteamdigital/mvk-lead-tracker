import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { ColumnDef, RowData } from "@/lib/types";
import { filterSheetRows, isValidLead } from "@/lib/leads";

interface Params {
  params: { id: string };
}

export async function GET(req: Request, { params }: Params) {
  const user = await getSessionUser(req);
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "xlsx"; // "xlsx" or "csv"
  const dateFilter = searchParams.get("dateFilter") || null;
  const statusFilter = searchParams.get("statusFilter") || null;
  const searchQuery = searchParams.get("searchQuery") || "";

  try {
    const sheet = await prisma.sheet.findUnique({
      where: { id },
      include: {
        rows: {
          orderBy: [
            { order: "asc" },
            { createdAt: "asc" },
            { id: "asc" },
          ],
        },
      },
    });

    if (!sheet) {
      return NextResponse.json({ error: "Sheet not found" }, { status: 404 });
    }

    if (user.role !== "ADMIN" && sheet.userId !== user.id) {
      return NextResponse.json(
        { error: "Access denied" },
        { status: 403 }
      );
    }

    const columns: ColumnDef[] = JSON.parse(sheet.columns || "[]");
    const headers = columns.map((c) => c.name);

    // Parse database rows into RowData array
    const parsedRows: RowData[] = sheet.rows.map((r) => ({
      id: r.id,
      sheetId: r.sheetId,
      order: r.order,
      data: JSON.parse(r.data || "{}"),
      styles: JSON.parse(r.styles || "{}"),
      createdAt: r.createdAt.toISOString(),
      updatedAt: r.updatedAt.toISOString(),
    }));

    // Filter valid leads first (omit blank placeholder rows)
    const validRows = parsedRows.filter((r) => isValidLead(r.data));

    // Determine if active filters are present
    const isFiltered = Boolean(dateFilter || statusFilter || searchQuery.trim());
    const exportRows = isFiltered
      ? filterSheetRows(validRows, columns, {
          dateFilter,
          statusFilter,
          searchQuery,
        })
      : validRows;

    if (exportRows.length === 0 && isFiltered) {
      return NextResponse.json(
        { error: "No leads match the specified filter criteria to export." },
        { status: 404 }
      );
    }

    const rowsData = exportRows.map((r) => {
      return columns.map((c) => r.data[c.id] ?? "");
    });

    const aoa = [headers, ...rowsData];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Set column widths based on defined widths
    ws["!cols"] = columns.map((c) => ({
      wch: Math.max(12, Math.round((c.width || 150) / 8)),
    }));

    const filterTag = isFiltered ? "_filtered" : "";
    const sanitizedSheetName = (sheet.name || "Leads").replace(/[\\/*?:[\]]/g, "_").substring(0, 31);
    const filename = `${sanitizedSheetName}${filterTag}_leads`;

    if (format === "csv") {
      const csv = XLSX.utils.sheet_to_csv(ws);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}.csv"`,
        },
      });
    }

    // Default: xlsx
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sanitizedSheetName);

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(filename)}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Export error:", error);
    return NextResponse.json(
      { error: "Failed to export sheet" },
      { status: 500 }
    );
  }
}
