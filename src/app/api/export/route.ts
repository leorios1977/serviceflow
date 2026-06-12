import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import JSZip from "jszip";

/**
 * GET /api/export?orgId=xxx
 * Exports all org data as a ZIP file containing CSV files.
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get("orgId");

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Verify authentication
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify user belongs to org
    const { data: membership } = await supabase
      .from("org_members")
      .select("role")
      .eq("org_id", orgId)
      .eq("user_id", user.id)
      .single();

    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch all data for the org
    const [
      customersResult,
      propertiesResult,
      visitsResult,
      quotesResult,
      invoicesResult,
      leadsResult,
    ] = await Promise.all([
      supabase
        .from("customers")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at"),
      supabase
        .from("properties")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at"),
      supabase
        .from("visits")
        .select("*")
        .eq("org_id", orgId)
        .order("scheduled_date"),
      supabase
        .from("quotes")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at"),
      supabase
        .from("invoices")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at"),
      supabase
        .from("leads")
        .select("*")
        .eq("org_id", orgId)
        .order("created_at"),
    ]);

    // Helper: convert array of objects to CSV string
    function toCSV(rows: Record<string, unknown>[]): string {
      if (!rows || rows.length === 0) return "";
      const headers = Object.keys(rows[0]);
      const csvRows = [
        headers.join(","),
        ...rows.map((row) =>
          headers
            .map((h) => {
              const val = row[h];
              if (val === null || val === undefined) return "";
              const str =
                typeof val === "object" ? JSON.stringify(val) : String(val);
              // Escape quotes and wrap in quotes if contains comma/newline/quote
              if (str.includes(",") || str.includes("\n") || str.includes('"')) {
                return `"${str.replace(/"/g, '""')}"`;
              }
              return str;
            })
            .join(",")
        ),
      ];
      return csvRows.join("\n");
    }

    // Build ZIP
    const zip = new JSZip();
    const timestamp = new Date().toISOString().split("T")[0];
    const folder = zip.folder(`serviceflow-export-${timestamp}`)!;

    const datasets: Array<{ name: string; data: Record<string, unknown>[] | null }> = [
      { name: "customers", data: customersResult.data as Record<string, unknown>[] | null },
      { name: "properties", data: propertiesResult.data as Record<string, unknown>[] | null },
      { name: "visits", data: visitsResult.data as Record<string, unknown>[] | null },
      { name: "quotes", data: quotesResult.data as Record<string, unknown>[] | null },
      { name: "invoices", data: invoicesResult.data as Record<string, unknown>[] | null },
      { name: "leads", data: leadsResult.data as Record<string, unknown>[] | null },
    ];

    // Summary stats
    const summary = {
      exported_at: new Date().toISOString(),
      org_id: orgId,
      counts: {} as Record<string, number>,
    };

    for (const { name, data } of datasets) {
      const rows = data ?? [];
      summary.counts[name] = rows.length;
      if (rows.length > 0) {
        folder.file(`${name}.csv`, toCSV(rows));
      } else {
        folder.file(`${name}.csv`, "");
      }
    }

    folder.file("summary.json", JSON.stringify(summary, null, 2));

    // Generate ZIP as ArrayBuffer for compatibility with Next.js Response
    const zipBuffer = await zip.generateAsync({ type: "arraybuffer" });

    return new NextResponse(zipBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="serviceflow-export-${timestamp}.zip"`,
        "Content-Length": zipBuffer.byteLength.toString(),
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Export failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
