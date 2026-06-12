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
import { QuoteDialog } from "@/components/quotes/quote-dialog";
import type { Quote, Customer } from "@/lib/database.types";
import {
  Plus,
  MoreHorizontal,
  FileText,
  Pencil,
  Trash2,
  ExternalLink,
  Copy,
} from "lucide-react";

type QuoteWithCustomer = Quote & { customer: Pick<Customer, "id" | "name"> | null };

const STATUS_COLORS: Record<string, string> = {
  draft: "secondary",
  sent: "default",
  accepted: "outline",
  declined: "destructive",
  expired: "secondary",
};

const STATUS_LABELS: Record<string, string> = {
  draft: "Draft",
  sent: "Sent",
  accepted: "Accepted",
  declined: "Declined",
  expired: "Expired",
};

export default function QuotesPage() {
  const { currentOrg, loading: orgLoading } = useOrg();

  const [quotes, setQuotes] = useState<QuoteWithCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [editQuote, setEditQuote] = useState<Quote | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchQuotes = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("quotes")
      .select("*, customer:customers(id, name)")
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: false });

    if (error) {
      toast.error("Failed to load quotes");
    } else {
      setQuotes(data as QuoteWithCustomer[]);
    }
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => {
    if (!orgLoading) fetchQuotes();
  }, [orgLoading, fetchQuotes]);

  async function handleDelete(quote: QuoteWithCustomer) {
    if (!confirm("Delete this quote? This cannot be undone.")) return;
    setDeletingId(quote.id);
    const supabase = createClient();
    const { error } = await supabase.from("quotes").delete().eq("id", quote.id);
    if (error) {
      toast.error("Failed to delete quote");
    } else {
      toast.success("Quote deleted");
      fetchQuotes();
    }
    setDeletingId(null);
  }

  function copyPublicLink(quote: QuoteWithCustomer) {
    const url = `${window.location.origin}/q/${quote.public_token}`;
    navigator.clipboard.writeText(url);
    toast.success("Public link copied to clipboard");
  }

  if (orgLoading) return <QuotesPageSkeleton />;

  if (!currentOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <FileText className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-medium">No organization selected</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Quotes</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {quotes.length > 0
              ? `${quotes.length} quote${quotes.length !== 1 ? "s" : ""}`
              : "Create and send quotes to customers"}
          </p>
        </div>
        <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
          <Plus className="h-4 w-4" />
          New Quote
        </Button>
      </div>

      {/* Table */}
      {loading ? (
        <QuotesTableSkeleton />
      ) : quotes.length === 0 ? (
        <QuotesEmptyState onNew={() => setCreateOpen(true)} />
      ) : (
        <div className="rounded-md border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Customer</TableHead>
                <TableHead className="hidden sm:table-cell">Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="hidden md:table-cell">Created</TableHead>
                <TableHead className="w-12" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {quotes.map((quote) => (
                <TableRow key={quote.id}>
                  <TableCell className="font-medium">
                    {quote.customer?.name ?? "—"}
                  </TableCell>
                  <TableCell className="hidden sm:table-cell">
                    ${Number(quote.total).toFixed(2)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        (STATUS_COLORS[quote.status] as "default" | "secondary" | "destructive" | "outline") ??
                        "secondary"
                      }
                      className={
                        quote.status === "accepted"
                          ? "border-green-500 text-green-700 bg-green-50"
                          : ""
                      }
                    >
                      {STATUS_LABELS[quote.status] ?? quote.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="hidden md:table-cell text-muted-foreground text-sm">
                    {new Date(quote.created_at).toLocaleDateString()}
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
                            window.open(`/q/${quote.public_token}`, "_blank")
                          }
                        >
                          <ExternalLink className="h-4 w-4 mr-2" />
                          View Public Page
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => copyPublicLink(quote)}>
                          <Copy className="h-4 w-4 mr-2" />
                          Copy Link
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setEditQuote(quote)}>
                          <Pencil className="h-4 w-4 mr-2" />
                          Edit
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          className="text-destructive focus:text-destructive"
                          disabled={deletingId === quote.id}
                          onClick={() => handleDelete(quote)}
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
      <QuoteDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        orgId={currentOrg.id}
        onSaved={fetchQuotes}
      />
      <QuoteDialog
        open={!!editQuote}
        onOpenChange={(open) => {
          if (!open) setEditQuote(null);
        }}
        orgId={currentOrg.id}
        quote={editQuote}
        onSaved={() => {
          fetchQuotes();
          setEditQuote(null);
        }}
      />
    </div>
  );
}

function QuotesEmptyState({ onNew }: { onNew: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <FileText className="h-6 w-6 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium">No quotes yet</h3>
      <p className="text-sm text-muted-foreground mt-1 max-w-xs">
        Create your first quote and send it to a customer for acceptance.
      </p>
      <Button onClick={onNew} className="mt-4 gap-1.5">
        <Plus className="h-4 w-4" />
        New Quote
      </Button>
    </div>
  );
}

function QuotesPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <QuotesTableSkeleton />
    </div>
  );
}

function QuotesTableSkeleton() {
  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Customer</TableHead>
            <TableHead className="hidden sm:table-cell">Total</TableHead>
            <TableHead>Status</TableHead>
            <TableHead className="hidden md:table-cell">Created</TableHead>
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
