"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useOrg } from "@/lib/org-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  FileSpreadsheet,
  Users,
  MapPin,
  CalendarCheck,
  FileText,
  Receipt,
  UserPlus,
  AlertTriangle,
} from "lucide-react";

const EXPORT_TABLES = [
  {
    key: "customers",
    label: "Customers",
    description: "Names, emails, phones, notes, and source",
    icon: Users,
  },
  {
    key: "properties",
    label: "Properties",
    description: "Addresses, gate codes, and linked customers",
    icon: MapPin,
  },
  {
    key: "visits",
    label: "Visits",
    description: "Scheduled dates, statuses, tech notes, and photos",
    icon: CalendarCheck,
  },
  {
    key: "quotes",
    label: "Quotes",
    description: "Line items, totals, and status",
    icon: FileText,
  },
  {
    key: "invoices",
    label: "Invoices",
    description: "Line items, totals, due dates, and payment status",
    icon: Receipt,
  },
  {
    key: "leads",
    label: "Leads",
    description: "Lead names, sources, stages, and notes",
    icon: UserPlus,
  },
];

export default function DataExportPage() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const [exporting, setExporting] = useState(false);

  async function handleExport() {
    if (!currentOrg) return;
    setExporting(true);
    try {
      const res = await fetch(`/api/export?orgId=${currentOrg.id}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "Export failed");
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const timestamp = new Date().toISOString().split("T")[0];
      a.download = `serviceflow-export-${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Export downloaded successfully");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Export failed";
      toast.error(message);
    }
    setExporting(false);
  }

  if (orgLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!currentOrg) return null;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Data Export</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Download all your organization&apos;s data as a ZIP archive containing CSV files.
        </p>
      </div>

      {/* Export card */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6">
          <div className="flex items-start gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Download className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold">Full Data Export</h2>
              <p className="text-sm text-muted-foreground mt-0.5">
                Exports all data for <strong>{currentOrg.name}</strong> as a ZIP file
                containing individual CSV files for each data type.
              </p>
            </div>
          </div>
          <Button
            onClick={handleExport}
            disabled={exporting}
            className="gap-1.5 shrink-0"
          >
            <Download className="h-4 w-4" />
            {exporting ? "Preparing export..." : "Download ZIP"}
          </Button>
        </div>
      </div>

      {/* What's included */}
      <div>
        <h3 className="text-base font-semibold mb-4">What&apos;s included</h3>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {EXPORT_TABLES.map((table) => {
            const Icon = table.icon;
            return (
              <div
                key={table.key}
                className="flex items-start gap-3 rounded-lg border p-4"
              >
                <div className="h-8 w-8 rounded-md bg-muted flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">{table.label}</p>
                    <FileSpreadsheet className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground">.csv</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {table.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Data notice */}
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-800">Data Privacy Notice</p>
          <p className="text-sm text-amber-700 mt-0.5">
            The exported file contains sensitive customer information. Store it
            securely and handle it in accordance with your privacy policy and applicable
            data protection regulations.
          </p>
        </div>
      </div>
    </div>
  );
}
