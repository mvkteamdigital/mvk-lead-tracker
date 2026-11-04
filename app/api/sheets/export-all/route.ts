import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import * as XLSX from "xlsx";
import { ColumnDef } from "@/lib/types";

export async function GET() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (user.role !== "ADMIN") {
    return NextResponse.json(
      { error: "Only administrators can export all team sheets" },
      { status: 403 }
    );
  }

  try {
    const sheets = await prisma.sheet.findMany({
      orderBy: { order: "asc" },
      include: {
        rows: {
          orderBy: { nameModifiedAt: "desc" },
        },
      },
    });

    const wb = XLSX.utils.book_new();
    const usedNames = new Set<string>();

    for (const sheet of sheets) {
      let sheetName = (sheet.name || "Sheet").replace(/[\\/*?:[\]]/g, "_").substring(0, 31);
      if (usedNames.has(sheetName)) {
        sheetName = `${sheetName}_${sheet.id.substring(0, 4)}`.substring(0, 31);
      }
      usedNames.add(sheetName);

      const columns: ColumnDef[] = JSON.parse(sheet.columns || "[]");
      const headers = columns.map((c) => c.name);

      const rowsData = sheet.rows.map((r) => {
        const parsedData = JSON.parse(r.data || "{}");
        return columns.map((c) => parsedData[c.id] ?? "");
      });

      const aoa = [headers, ...rowsData];
      const ws = XLSX.utils.aoa_to_sheet(aoa);

      ws["!cols"] = columns.map((c) => ({
        wch: Math.max(12, Math.round((c.width || 150) / 8)),
      }));

      XLSX.utils.book_append_sheet(wb, ws, sheetName);
    }

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    return new Response(buffer, {
      status: 200,
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="Team_Lead_Tracker_All_Sheets_${new Date().toISOString().slice(0, 10)}.xlsx"`,
      },
    });
  } catch (error: any) {
    console.error("Export all error:", error);
    return NextResponse.json(
      { error: "Failed to export all sheets" },
      { status: 500 }
    );
  }
}
