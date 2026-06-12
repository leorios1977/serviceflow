"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/org-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { CustomerDialog } from "@/components/customers/customer-dialog";
import type {
  Customer,
  Property,
  ServicePlan,
  Visit,
  Invoice,
  Message,
} from "@/lib/database.types";
import {
  ArrowLeft,
  Pencil,
  MapPin,
  Phone,
  Mail,
  FileText,
  Calendar,
  DollarSign,
  MessageSquare,
  Home,
  Plus,
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
} from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface PropertyWithPlans extends Property {
  service_plans: ServicePlan[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(amount);
}

function visitStatusBadge(status: Visit["status"]) {
  const map: Record<Visit["status"], { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
    scheduled: { label: "Scheduled", variant: "secondary" },
    in_progress: { label: "In Progress", variant: "default" },
    completed: { label: "Completed", variant: "outline" },
    skipped: { label: "Skipped", variant: "destructive" },
  };
  const { label, variant } = map[status] ?? { label: status, variant: "secondary" };
  return <Badge variant={variant} className="text-xs">{label}</Badge>;
}

function invoiceStatusBadge(status: Invoice["status"]) {
  const map: Record<Invoice["status"], { label: string; icon: React.ReactNode }> = {
    draft: { label: "Draft", icon: <FileText className="h-3 w-3" /> },
    sent: { label: "Sent", icon: <Clock className="h-3 w-3" /> },
    paid: { label: "Paid", icon: <CheckCircle2 className="h-3 w-3 text-green-500" /> },
    overdue: { label: "Overdue", icon: <AlertCircle className="h-3 w-3 text-red-500" /> },
  };
  const { label, icon } = map[status] ?? { label: status, icon: null };
  return (
    <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
      {icon}
      {label}
    </span>
  );
}

function planFrequencyLabel(freq: ServicePlan["frequency"]) {
  const map: Record<ServicePlan["frequency"], string> = {
    weekly: "Weekly",
    biweekly: "Bi-weekly",
    monthly: "Monthly",
    quarterly: "Quarterly",
  };
  return map[freq] ?? freq;
}

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { currentOrg, verticalConfig, loading: orgLoading } = useOrg();

  const [customer, setCustomer] = useState<Customer | null>(null);
  const [properties, setProperties] = useState<PropertyWithPlans[]>([]);
  const [visits, setVisits] = useState<Visit[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [notesValue, setNotesValue] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const fetchAll = useCallback(async () => {
    if (!currentOrg || !id) return;
    setLoading(true);
    const supabase = createClient();

    // Customer
    const { data: cust, error: custErr } = await supabase
      .from("customers")
      .select("*")
      .eq("id", id)
      .eq("org_id", currentOrg.id)
      .single();

    if (custErr || !cust) {
      toast.error("Customer not found");
      router.push("/customers");
      return;
    }
    setCustomer(cust as Customer);
    setNotesValue(cust.notes ?? "");

    // Properties with service plans
    const { data: props } = await supabase
      .from("properties")
      .select("*, service_plans(*)")
      .eq("customer_id", id)
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: true });

    setProperties((props ?? []) as PropertyWithPlans[]);

    // Visits (via properties)
    const propIds = (props ?? []).map((p) => p.id);
    if (propIds.length > 0) {
      const { data: vis } = await supabase
        .from("visits")
        .select("*")
        .in("property_id", propIds)
        .eq("org_id", currentOrg.id)
        .order("scheduled_date", { ascending: false })
        .limit(50);
      setVisits((vis ?? []) as Visit[]);
    } else {
      setVisits([]);
    }

    // Invoices
    const { data: invs } = await supabase
      .from("invoices")
      .select("*")
      .eq("customer_id", id)
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: false })
      .limit(50);
    setInvoices((invs ?? []) as Invoice[]);

    // Messages
    const { data: msgs } = await supabase
      .from("messages")
      .select("*")
      .eq("customer_id", id)
      .eq("org_id", currentOrg.id)
      .order("sent_at", { ascending: true });
    setMessages((msgs ?? []) as Message[]);

    setLoading(false);
  }, [currentOrg, id, router]);

  useEffect(() => {
    if (!orgLoading) fetchAll();
  }, [orgLoading, fetchAll]);

  async function saveNotes() {
    if (!customer) return;
    setSavingNotes(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("customers")
      .update({ notes: notesValue })
      .eq("id", customer.id);
    if (error) {
      toast.error("Failed to save notes");
    } else {
      toast.success("Notes saved");
      setCustomer({ ...customer, notes: notesValue });
    }
    setSavingNotes(false);
  }

  if (orgLoading || loading) {
    return <CustomerDetailSkeleton />;
  }

  if (!customer) return null;

  const entityLabel = verticalConfig?.entitySingular ?? "Property";
  const entityPluralLabel = verticalConfig?.entityPlural ?? "Properties";

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 mt-0.5 flex-shrink-0"
            onClick={() => router.push("/customers")}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight">{customer.name}</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Customer since {formatDate(customer.created_at)}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setEditOpen(true)}
          className="gap-1.5 self-start sm:self-auto"
        >
          <Pencil className="h-4 w-4" />
          Edit
        </Button>
      </div>

      {/* Contact Info Card */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Contact Information</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="flex items-center gap-2 text-sm">
            <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span className="truncate">{customer.email ?? <span className="text-muted-foreground">No email</span>}</span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <span>{customer.phone ?? <span className="text-muted-foreground">No phone</span>}</span>
          </div>
          {customer.source && (
            <div className="flex items-center gap-2 text-sm">
              <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-muted-foreground">Source:</span>
              <Badge variant="secondary" className="text-xs capitalize">{customer.source}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs defaultValue="properties" className="w-full">
        <TabsList className="w-full sm:w-auto">
          <TabsTrigger value="properties" className="flex-1 sm:flex-none">
            {entityPluralLabel} ({properties.length})
          </TabsTrigger>
          <TabsTrigger value="visits" className="flex-1 sm:flex-none">
            Visits ({visits.length})
          </TabsTrigger>
          <TabsTrigger value="invoices" className="flex-1 sm:flex-none">
            Invoices ({invoices.length})
          </TabsTrigger>
          <TabsTrigger value="messages" className="flex-1 sm:flex-none">
            Messages ({messages.length})
          </TabsTrigger>
        </TabsList>

        {/* Properties Tab */}
        <TabsContent value="properties" className="mt-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-muted-foreground">
              {entityPluralLabel}
            </h2>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() =>
                router.push(`/customers/${customer.id}/properties/new`)
              }
            >
              <Plus className="h-4 w-4" />
              Add {entityLabel}
            </Button>
          </div>

          {properties.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <Home className="h-8 w-8 text-muted-foreground mb-3" />
              <h3 className="text-sm font-medium">No {entityPluralLabel.toLowerCase()} yet</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Add a {entityLabel.toLowerCase()} to start scheduling visits.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {properties.map((property) => (
                <PropertyCard
                  key={property.id}
                  property={property}
                  customerId={customer.id}
                  entityLabel={entityLabel}
                  onNavigate={() =>
                    router.push(`/customers/${customer.id}/properties/${property.id}`)
                  }
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* Visits Tab */}
        <TabsContent value="visits" className="mt-4">
          {visits.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <Calendar className="h-8 w-8 text-muted-foreground mb-3" />
              <h3 className="text-sm font-medium">No visits yet</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Visits will appear here once service plans are active.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {visits.map((visit) => (
                <div
                  key={visit.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div className="flex items-center gap-3">
                    <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <div>
                      <p className="text-sm font-medium">{formatDate(visit.scheduled_date)}</p>
                      {visit.tech_notes && (
                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                          {visit.tech_notes}
                        </p>
                      )}
                    </div>
                  </div>
                  {visitStatusBadge(visit.status)}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Invoices Tab */}
        <TabsContent value="invoices" className="mt-4">
          {invoices.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <DollarSign className="h-8 w-8 text-muted-foreground mb-3" />
              <h3 className="text-sm font-medium">No invoices yet</h3>
              <p className="text-xs text-muted-foreground mt-1">
                Invoices will appear here after completed visits.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {invoices.map((invoice) => (
                <div
                  key={invoice.id}
                  className="flex items-center justify-between rounded-lg border px-4 py-3"
                >
                  <div>
                    <p className="text-sm font-medium">{formatCurrency(invoice.total)}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(invoice.created_at)}
                      {invoice.due_date && ` · Due ${formatDate(invoice.due_date)}`}
                    </p>
                  </div>
                  {invoiceStatusBadge(invoice.status)}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* Messages Tab */}
        <TabsContent value="messages" className="mt-4">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12 text-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground mb-3" />
              <h3 className="text-sm font-medium">No messages yet</h3>
              <p className="text-xs text-muted-foreground mt-1">
                SMS and email communications will appear here.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {messages.map((msg) => (
                <MessageBubble key={msg.id} message={msg} />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      <Separator />

      {/* Notes Section */}
      <div className="space-y-3">
        <h2 className="text-sm font-medium">Notes</h2>
        <Textarea
          value={notesValue}
          onChange={(e) => setNotesValue(e.target.value)}
          placeholder="Add notes about this customer..."
          rows={4}
          className="resize-none"
        />
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={saveNotes}
            disabled={savingNotes || notesValue === (customer.notes ?? "")}
          >
            {savingNotes ? "Saving..." : "Save Notes"}
          </Button>
        </div>
      </div>

      {/* Edit Dialog */}
      <CustomerDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        orgId={currentOrg!.id}
        customer={customer}
        onSaved={(updated) => {
          setCustomer(updated);
          setEditOpen(false);
        }}
      />
    </div>
  );
}

// ─── Property Card ─────────────────────────────────────────────────────────────

function PropertyCard({
  property,
  entityLabel,
  onNavigate,
}: {
  property: PropertyWithPlans;
  customerId: string;
  entityLabel: string;
  onNavigate: () => void;
}) {
  const activePlans = property.service_plans.filter((p) => p.status === "active");
  const pausedPlans = property.service_plans.filter((p) => p.status === "paused");

  return (
    <Card
      className="cursor-pointer hover:border-primary/50 transition-colors"
      onClick={onNavigate}
    >
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start gap-2 mb-3">
          <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
          <div className="min-w-0">
            <p className="text-sm font-medium leading-tight">{property.address}</p>
            {property.gate_code && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Gate: {property.gate_code}
              </p>
            )}
          </div>
        </div>

        {property.service_plans.length === 0 ? (
          <p className="text-xs text-muted-foreground">No service plans</p>
        ) : (
          <div className="space-y-1.5">
            {activePlans.map((plan) => (
              <div key={plan.id} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {planFrequencyLabel(plan.frequency)}
                  {plan.day_of_week !== null && ` · ${DAY_NAMES[plan.day_of_week]}`}
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium">${plan.price}/visit</span>
                  <Badge variant="outline" className="text-xs text-green-600 border-green-200 bg-green-50">
                    Active
                  </Badge>
                </div>
              </div>
            ))}
            {pausedPlans.map((plan) => (
              <div key={plan.id} className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">
                  {planFrequencyLabel(plan.frequency)}
                </span>
                <Badge variant="secondary" className="text-xs">Paused</Badge>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 pt-3 border-t">
          <p className="text-xs text-primary font-medium">
            View {entityLabel} details →
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Message Bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isOutbound = message.direction === "outbound";
  return (
    <div className={`flex ${isOutbound ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
          isOutbound
            ? "bg-primary text-primary-foreground rounded-br-sm"
            : "bg-muted rounded-bl-sm"
        }`}
      >
        <p>{message.body}</p>
        <div
          className={`flex items-center gap-1.5 mt-1 text-xs ${
            isOutbound ? "text-primary-foreground/70" : "text-muted-foreground"
          }`}
        >
          {message.channel === "sms" ? (
            <Phone className="h-3 w-3" />
          ) : (
            <Mail className="h-3 w-3" />
          )}
          <span>
            {new Date(message.sent_at).toLocaleString("en-US", {
              month: "short",
              day: "numeric",
              hour: "numeric",
              minute: "2-digit",
            })}
          </span>
        </div>
      </div>
    </div>
  );
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CustomerDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-start gap-3">
        <Skeleton className="h-8 w-8 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-4 w-36" />
        </div>
      </div>
      <Card>
        <CardContent className="pt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-5 w-40" />
          ))}
        </CardContent>
      </Card>
      <div className="space-y-4">
        <Skeleton className="h-10 w-full sm:w-96" />
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 2 }).map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}
