import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { ColumnDef } from "@/lib/types";

interface Params {
  params: { id: string };
}

export async function GET(req: Request, { params }: Params) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = params;
  const { searchParams } = new URL(req.url);
  const format = searchParams.get("format") || "xlsx"; // "xlsx" or "csv"

  try {
    const sheet = await prisma.sheet.findUnique({
      where: { id },
      include: {
        rows: {
          orderBy: { createdAt: "desc" },
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

    const rowsData = sheet.rows.map((r) => {
      const parsedData = JSON.parse(r.data || "{}");
      return columns.map((c) => parsedData[c.id] ?? "");
    });

    const aoa = [headers, ...rowsData];
    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Set column widths based on defined widths
    ws["!cols"] = columns.map((c) => ({
      wch: Math.max(12, Math.round((c.width || 150) / 8)),
    }));

    const sanitizedSheetName = (sheet.name || "Leads").replace(/[\\/*?:[\]]/g, "_").substring(0, 31);

    if (format === "csv") {
      const csv = XLSX.utils.sheet_to_csv(ws);
      return new Response(csv, {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="${encodeURIComponent(sanitizedSheetName)}_leads.csv"`,
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
        "Content-Disposition": `attachment; filename="${encodeURIComponent(sanitizedSheetName)}_leads.xlsx"`,
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
