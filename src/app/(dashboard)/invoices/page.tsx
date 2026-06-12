"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/org-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { InvoiceDialog } from "@/components/invoices/invoice-dialog";
import type { Invoice, Customer } from "@/lib/database.types";
import {
  Plus,
  MoreHorizontal,
  Receipt,
  Pencil,
  Trash2,
  ExternalLink,
  Copy,
} from "lucide-react";

type InvoiceWithCustomer = Invoice & {
  customer: Pick<Customer, "id" | "name"> | null;
};

const STATUS_COLORS: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  draft: "secondary",
  sent: "default",
  paid: "outline",
  overdue: "destructive",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  paid: "Paid",
  overdue: "Overdue",
};

export default function InvoicesPage() {
  const { currentOrg, loading: orgLoading } = useOrg();

  const [invoices, setInvoices] = useState<InvoiceWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editInvoice, setEditInvoice] = useState<Invoice | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchInvoices = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("invoices")
      .select("*, customer:customers(id, name)")
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load invoices");
    } else {
      setInvoices(data as InvoiceWithCustomer[]);
    }
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => {
    if (!orgLoading) fetchInvoices();
  }, [orgLoading, fetchInvoices]);

  async function handleDelete(invoice: InvoiceWithCustomer) {
    if (!confirm("Delete this invoice? This cannot be undone.")) return;
    setDeletingId(invoice.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("invoices")
      .delete()
      .eq("id", invoice.id);
    if (error) {
      toast.error("Failed to delete invoice");
    } else {
      toast.success("Invoice deleted");
      fetchInvoices();
    }
    setDeletingId(null);
  }

  function copyPublicLink(invoice: InvoiceWithCustomer) {
    const url = `${window.location.origin}/i/${invoice.id}`;
    navigator.clipboard.writeText(url);
    toast.success("Payment link copied to clipboard");
  }

  if (orgLoading) return <InvoicesPageSkeleton />;

  if (!currentOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Receipt className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-medium">No organization selected</h2>
      </div>
    );
  }

  const totalOutstanding = invoices
    .filter((i) => i.status === "sent" || i.status === "overdue")
    .reduce((sum, i) => sum + Number(i.total), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Invoices</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {totalOutstanding > 0
              ? `$${totalOutstanding.toFixed(2)} outstanding`
              : "Track payments and manage invoices"}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Invoice
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <InvoicesTableSkeleton />
      ) : invoices.length === 0 ? (
        <InvoicesEmptyState onNew={() => setCreateOpen(true)} />
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden sm:table-cell">Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Due Date</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell className="font-medium">
                    {invoice.customer?.name ?? "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    ${Number(invoice.total).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={STATUS_COLORS[invoice.status] ?? "secondary"}
                      className={
                        invoice.status === "paid"
                          ? "border-green-500 text-green-700 bg-green-50"
                          : ""
                      }
                    >
                      {STATUS_LABELS[invoice.status] ?? invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    {invoice.due_date
                      ? new Date(invoice.due_date).toLocaleDateString()
                      : "—"}
                  </TableCell>
                  <TableCell>
                    <DropdownMenu>
                      <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Actions</span>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem
                          onClick={() =>
                            window.open(`/i/${invoice.id}`, "_blank")
                          }
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Payment Page
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyPublicLink(invoice)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Payment Link
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditInvoice(invoice)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={deletingId === invoice.id}
                          onClick={() => handleDelete(invoice)}
                        >
                          <Trash2 className="h-4 w-4 mr-2" />
                          Delete
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Dialogs */}
      <InvoiceDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        orgId={currentOrg.id}
        onSaved={fetchInvoices}
      />
      <InvoiceDialog
        open={!!editInvoice}
        onOpenChange={(open) => {
          if (!open) setEditInvoice(null);
        }}
        orgId={currentOrg.id}
        invoice={editInvoice}
        onSaved={() => {
          fetchInvoices();
          setEditInvoice(null);
        }}
      />
    </div>
  );
}

function InvoicesEmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Receipt className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium">No invoices yet</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
        Create your first invoice and send a payment link to your customer.
      </p>
      <Button onClick={onNew} className="mt-4 gap-1.5">
        <Plus className="h-4 w-4" />
        New Invoice
      </Button>
    </div>
  );
}

function InvoicesPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-32" />
      </div>
      <InvoicesTableSkeleton />
    </div>
  );
}

function InvoicesTableSkeleton() {
  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead className="hidden sm:table-cell">Amount</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Due Date</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 5 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
              <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-24" /></TableCell>
              <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
