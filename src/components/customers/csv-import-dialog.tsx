"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Upload, FileText, AlertCircle } from "lucide-react";

interface CsvImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  onImported: () => void;
}

interface CsvRow {
  name: string;
  email: string;
  phone: string;
  address: string;
}

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];

  const headers = lines[0].split(",").map((h) => h.trim().toLowerCase().replace(/['"]/g, ""));
  const nameIdx = headers.indexOf("name");
  const emailIdx = headers.indexOf("email");
  const phoneIdx = headers.indexOf("phone");
  const addressIdx = headers.indexOf("address");

  if (nameIdx === -1) throw new Error('CSV must have a "name" column');

  return lines.slice(1).map((line) => {
    // Handle quoted fields with commas
    const cols: string[] = [];
    let current = "";
    let inQuotes = false;
    for (const char of line) {
      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === "," && !inQuotes) {
        cols.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    cols.push(current.trim());

    return {
      name: nameIdx !== -1 ? cols[nameIdx] ?? "" : "",
      email: emailIdx !== -1 ? cols[emailIdx] ?? "" : "",
      phone: phoneIdx !== -1 ? cols[phoneIdx] ?? "" : "",
      address: addressIdx !== -1 ? cols[addressIdx] ?? "" : "",
    };
  }).filter((row) => row.name.trim());
}

export function CsvImportDialog({
  open,
  onOpenChange,
  orgId,
  onImported,
}: CsvImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<CsvRow[]>([]);
  const [parseError, setParseError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFile(f: File) {
    setFile(f);
    setParseError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const rows = parseCsv(e.target?.result as string);
        setPreview(rows.slice(0, 5));
        if (rows.length === 0) setParseError("No valid rows found in CSV");
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Failed to parse CSV";
        setParseError(msg);
        setPreview([]);
      }
    };
    reader.readAsText(f);
  }

  async function handleImport() {
    if (!file) return;
    setImporting(true);
    const supabase = createClient();

    try {
      const text = await file.text();
      const rows = parseCsv(text);

      let imported = 0;
      let skipped = 0;

      for (const row of rows) {
        if (!row.name.trim()) { skipped++; continue; }

        // Insert customer
        const { data: customer, error: custErr } = await supabase
          .from("customers")
          .insert({
            org_id: orgId,
            name: row.name.trim(),
            email: row.email.trim() || null,
            phone: row.phone.trim() || null,
            source: "manual",
          })
          .select()
          .single();

        if (custErr) { skipped++; continue; }

        // If address provided, create a property
        if (row.address.trim() && customer) {
          await supabase.from("properties").insert({
            org_id: orgId,
            customer_id: customer.id,
            address: row.address.trim(),
            vertical_data: {},
          });
        }

        imported++;
      }

      toast.success(`Imported ${imported} customers${skipped > 0 ? `, skipped ${skipped}` : ""}`);
      onImported();
      onOpenChange(false);
      setFile(null);
      setPreview([]);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Import failed";
      toast.error(msg);
    } finally {
      setImporting(false);
    }
  }

  function handleClose() {
    setFile(null);
    setPreview([]);
    setParseError(null);
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Import Customers from CSV</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="rounded-md bg-muted/50 p-3 text-sm text-muted-foreground">
            <p className="font-medium mb-1">Expected columns:</p>
            <code className="text-xs">name, email, phone, address</code>
            <p className="mt-1 text-xs">
              The <strong>name</strong> column is required. If <strong>address</strong> is provided,
              a property record will be created automatically.
            </p>
          </div>

          {/* Drop zone */}
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center cursor-pointer hover:border-primary/50 transition-colors"
            onClick={() => fileRef.current?.click()}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              const f = e.dataTransfer.files[0];
              if (f) handleFile(f);
            }}
          >
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {file ? (
              <div className="flex items-center justify-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="text-sm font-medium">{file.name}</span>
              </div>
            ) : (
              <div className="space-y-2">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  Click to select or drag & drop a CSV file
                </p>
              </div>
            )}
          </div>

          {parseError && (
            <div className="flex items-center gap-2 text-destructive text-sm">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              <span>{parseError}</span>
            </div>
          )}

          {preview.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">
                Preview (first {preview.length} rows):
              </p>
              <div className="overflow-x-auto rounded border">
                <table className="w-full text-xs">
                  <thead className="bg-muted">
                    <tr>
                      <th className="px-2 py-1 text-left">Name</th>
                      <th className="px-2 py-1 text-left">Email</th>
                      <th className="px-2 py-1 text-left">Phone</th>
                      <th className="px-2 py-1 text-left">Address</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((row, i) => (
                      <tr key={i} className="border-t">
                        <td className="px-2 py-1">{row.name || "—"}</td>
                        <td className="px-2 py-1">{row.email || "—"}</td>
                        <td className="px-2 py-1">{row.phone || "—"}</td>
                        <td className="px-2 py-1">{row.address || "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose} disabled={importing}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={!file || !!parseError || importing || preview.length === 0}
          >
            {importing ? "Importing..." : "Import"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
