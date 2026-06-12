"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/org-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { CustomerDialog } from "@/components/customers/customer-dialog";
import { CsvImportDialog } from "@/components/customers/csv-import-dialog";
import type { Customer } from "@/lib/database.types";
import {
  Plus,
  Search,
  MoreHorizontal,
  Upload,
  Users,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Trash2,
  Eye,
} from "lucide-react";

const PAGE_SIZE = 20;

export default function CustomersPage() {
  const router = useRouter();
  const { currentOrg, loading: orgLoading } = useOrg();

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(0);

  const [createOpen, setCreateOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [csvOpen, setCsvOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Debounce search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchCustomers = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const supabase = createClient();

    let query = supabase
      .from("customers")
      .select("*", { count: "exact" })
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: false })
      .range(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE - 1);

    if (debouncedSearch.trim()) {
      query = query.or(
        `name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`
      );
    }

    const { data, count, error } = await query;

    if (error) {
      toast.error("Failed to load customers");
    } else {
      setCustomers(data as Customer[]);
      setTotalCount(count ?? 0);
    }
    setLoading(false);
  }, [currentOrg, page, debouncedSearch]);

  useEffect(() => {
    if (!orgLoading) {
      fetchCustomers();
    }
  }, [orgLoading, fetchCustomers]);

  async function handleDelete(customer: Customer) {
    if (!confirm(`Delete ${customer.name}? This cannot be undone.`)) return;
    setDeletingId(customer.id);
    const supabase = createClient();
    const { error } = await supabase
      .from("customers")
      .delete()
      .eq("id", customer.id);
    if (error) {
      toast.error("Failed to delete customer");
    } else {
      toast.success("Customer deleted");
      fetchCustomers();
    }
    setDeletingId(null);
  }

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  const sourceLabel = (source: string | null) => {
    const map: Record<string, string> = {
      referral: "Referral",
      web: "Website",
      missed_call: "Missed Call",
      manual: "Manual",
      other: "Other",
    };
    return source ? (map[source] ?? source) : null;
  };

  if (orgLoading) {
    return <CustomersPageSkeleton />;
  }

  if (!currentOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Users className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-medium">No organization selected</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Please select or create an organization to manage customers.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {totalCount > 0
              ? `${totalCount} customer${totalCount !== 1 ? "s" : ""}`
              : "Manage your customer database"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setCsvOpen(true)}
            className="gap-1.5"
          >
            <Upload className="h-4 w-4" />
            <span className="hidden sm:inline">Import CSV</span>
          </Button>
          <Button size="sm" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            <span>New Customer</span>
          </Button>
        </div>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search by name, email, phone..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Table */}
      {loading ? (
        <CustomersTableSkeleton />
      ) : customers.length === 0 ? (
        <CustomersEmptyState
          hasSearch={!!debouncedSearch}
          onNew={() => setCreateOpen(true)}
        />
      ) : (
        <>
          <div className="rounded-md border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Email</TableHead>
                  <TableHead className="hidden md:table-cell">Phone</TableHead>
                  <TableHead className="hidden lg:table-cell">Source</TableHead>
                  <TableHead className="hidden lg:table-cell">Added</TableHead>
                  <TableHead className="w-12" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {customers.map((customer) => (
                  <TableRow
                    key={customer.id}
                    className="cursor-pointer"
                    onClick={() => router.push(`/customers/${customer.id}`)}
                  >
                    <TableCell className="font-medium">{customer.name}</TableCell>
                    <TableCell className="hidden sm:table-cell text-muted-foreground">
                      {customer.email ?? "—"}
                    </TableCell>
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {customer.phone ?? "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {customer.source ? (
                        <Badge variant="secondary" className="text-xs">
                          {sourceLabel(customer.source)}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-muted-foreground text-sm">
                      {new Date(customer.created_at).toLocaleDateString()}
                    </TableCell>
                    <TableCell onClick={(e) => e.stopPropagation()}>
                      <DropdownMenu>
                        <DropdownMenuTrigger className="inline-flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50">
                          <MoreHorizontal className="h-4 w-4" />
                          <span className="sr-only">Actions</span>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => router.push(`/customers/${customer.id}`)}
                          >
                            <Eye className="h-4 w-4 mr-2" />
                            View
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => setEditCustomer(customer)}
                          >
                            <Pencil className="h-4 w-4 mr-2" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive focus:text-destructive"
                            disabled={deletingId === customer.id}
                            onClick={() => handleDelete(customer)}
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

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>
                Showing {page * PAGE_SIZE + 1}–
                {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
              </span>
              <div className="flex items-center gap-1">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page === 0}
                  onClick={() => setPage((p) => p - 1)}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="px-2">
                  {page + 1} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  disabled={page >= totalPages - 1}
                  onClick={() => setPage((p) => p + 1)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <CustomerDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        orgId={currentOrg.id}
        onSaved={() => fetchCustomers()}
      />
      <CustomerDialog
        open={!!editCustomer}
        onOpenChange={(open) => { if (!open) setEditCustomer(null); }}
        orgId={currentOrg.id}
        customer={editCustomer}
        onSaved={() => { fetchCustomers(); setEditCustomer(null); }}
      />
      <CsvImportDialog
        open={csvOpen}
        onOpenChange={setCsvOpen}
        orgId={currentOrg.id}
        onImported={fetchCustomers}
      />
    </div>
  );
}

function CustomersEmptyState({
  hasSearch,
  onNew,
}: {
  hasSearch: boolean;
  onNew: () => void;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-16 text-center">
      <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
        <Users className="h-6 w-6 text-muted-foreground" />
      </div>
      {hasSearch ? (
        <>
          <h3 className="text-lg font-medium">No customers found</h3>
          <p className="text-sm text-muted-foreground mt-1">
            Try adjusting your search query.
          </p>
        </>
      ) : (
        <>
          <h3 className="text-lg font-medium">No customers yet</h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-xs">
            Add your first customer manually or import a CSV file to get started.
          </p>
          <Button onClick={onNew} className="mt-4 gap-1.5">
            <Plus className="h-4 w-4" />
            New Customer
          </Button>
        </>
      )}
    </div>
  );
}

function CustomersPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-32" />
          <Skeleton className="h-4 w-48" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-28" />
          <Skeleton className="h-9 w-32" />
        </div>
      </div>
      <Skeleton className="h-10 w-72" />
      <CustomersTableSkeleton />
    </div>
  );
}

function CustomersTableSkeleton() {
  return (
    <div className="rounded-md border overflow-hidden">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead className="hidden sm:table-cell">Email</TableHead>
            <TableHead className="hidden md:table-cell">Phone</TableHead>
            <TableHead className="hidden lg:table-cell">Source</TableHead>
            <TableHead className="hidden lg:table-cell">Added</TableHead>
            <TableHead className="w-12" />
          </TableRow>
        </TableHeader>
        <TableBody>
          {Array.from({ length: 8 }).map((_, i) => (
            <TableRow key={i}>
              <TableCell><Skeleton className="h-4 w-32" /></TableCell>
              <TableCell className="hidden sm:table-cell"><Skeleton className="h-4 w-40" /></TableCell>
              <TableCell className="hidden md:table-cell"><Skeleton className="h-4 w-28" /></TableCell>
              <TableCell className="hidden lg:table-cell"><Skeleton className="h-5 w-16 rounded-full" /></TableCell>
              <TableCell className="hidden lg:table-cell"><Skeleton className="h-4 w-20" /></TableCell>
              <TableCell><Skeleton className="h-8 w-8 rounded" /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}
