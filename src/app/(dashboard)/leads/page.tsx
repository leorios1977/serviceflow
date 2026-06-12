"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/org-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  useDroppable,
  useDraggable,
} from "@dnd-kit/core";
import type { Lead, LeadStatus, LeadSource } from "@/lib/database.types";
import { Plus, Phone, UserPlus, Trash2, Users } from "lucide-react";

// ─── Column Config ─────────────────────────────────────────────────────────────

const COLUMNS: { id: LeadStatus; label: string; color: string }[] = [
  { id: "new", label: "New", color: "bg-blue-50 border-blue-200" },
  { id: "contacted", label: "Contacted", color: "bg-yellow-50 border-yellow-200" },
  { id: "quoted", label: "Quoted", color: "bg-purple-50 border-purple-200" },
  { id: "won", label: "Won / Lost", color: "bg-green-50 border-green-200" },
];

const SOURCE_LABELS: Record<LeadSource, string> = {
  missed_call: "Missed Call",
  web: "Website",
  referral: "Referral",
  manual: "Manual",
};

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function LeadsPage() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const router = useRouter();

  const [leads, setLeads] = useState<Lead[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickAddCol, setQuickAddCol] = useState<LeadStatus | null>(null);
  const [editLead, setEditLead] = useState<Lead | null>(null);
  const [convertLead, setConvertLead] = useState<Lead | null>(null);
  const [activeDragId, setActiveDragId] = useState<string | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchLeads = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("leads")
      .select("*")
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: false });
    if (error) {
      toast.error("Failed to load leads");
    } else {
      setLeads((data ?? []) as Lead[]);
    }
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => {
    if (!orgLoading) fetchLeads();
  }, [orgLoading, fetchLeads]);

  function handleDragStart(event: DragStartEvent) {
    setActiveDragId(event.active.id as string);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveDragId(null);
    const { active, over } = event;
    if (!over) return;

    const leadId = active.id as string;
    const newStatus = over.id as LeadStatus;
    const lead = leads.find((l) => l.id === leadId);
    if (!lead || lead.status === newStatus) return;

    // Optimistic update
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus } : l))
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("leads")
      .update({ status: newStatus })
      .eq("id", leadId);

    if (error) {
      toast.error("Failed to move lead");
      // Revert
      setLeads((prev) =>
        prev.map((l) => (l.id === leadId ? { ...l, status: lead.status } : l))
      );
    }
  }

  const activeLead = activeDragId ? leads.find((l) => l.id === activeDragId) : null;

  if (orgLoading) {
    return <LeadsPageSkeleton />;
  }

  if (!currentOrg) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Users className="h-12 w-12 text-muted-foreground mb-4" />
        <h2 className="text-lg font-medium">No organization selected</h2>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {leads.length > 0
              ? `${leads.length} lead${leads.length !== 1 ? "s" : ""} in pipeline`
              : "Track and convert your leads"}
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setQuickAddCol("new")}
        >
          <Plus className="h-4 w-4" />
          New Lead
        </Button>
      </div>

      {/* Kanban Board */}
      {loading ? (
        <LeadsBoardSkeleton />
      ) : (
        <DndContext
          sensors={sensors}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {COLUMNS.map((col) => (
              <KanbanColumn
                key={col.id}
                column={col}
                leads={leads.filter((l) => l.status === col.id)}
                onAddCard={() => setQuickAddCol(col.id)}
                onEditLead={setEditLead}
                onConvertLead={setConvertLead}
                onDeleteLead={async (lead) => {
                  if (!confirm(`Delete lead "${lead.name}"?`)) return;
                  const supabase = createClient();
                  const { error } = await supabase
                    .from("leads")
                    .delete()
                    .eq("id", lead.id);
                  if (error) {
                    toast.error("Failed to delete lead");
                  } else {
                    toast.success("Lead deleted");
                    setLeads((prev) => prev.filter((l) => l.id !== lead.id));
                  }
                }}
              />
            ))}
          </div>

          <DragOverlay>
            {activeLead && (
              <LeadCard
                lead={activeLead}
                isDragging
                onEdit={() => {}}
                onConvert={() => {}}
                onDelete={() => {}}
              />
            )}
          </DragOverlay>
        </DndContext>
      )}

      {/* Quick Add Dialog */}
      <QuickAddLeadDialog
        open={!!quickAddCol}
        initialStatus={quickAddCol ?? "new"}
        orgId={currentOrg.id}
        onOpenChange={(open) => { if (!open) setQuickAddCol(null); }}
        onCreated={(lead) => {
          setLeads((prev) => [lead, ...prev]);
          setQuickAddCol(null);
        }}
      />

      {/* Edit Lead Dialog */}
      {editLead && (
        <EditLeadDialog
          open={!!editLead}
          lead={editLead}
          onOpenChange={(open) => { if (!open) setEditLead(null); }}
          onSaved={(updated) => {
            setLeads((prev) =>
              prev.map((l) => (l.id === updated.id ? updated : l))
            );
            setEditLead(null);
          }}
        />
      )}

      {/* Convert to Customer Dialog */}
      {convertLead && (
        <ConvertLeadDialog
          open={!!convertLead}
          lead={convertLead}
          orgId={currentOrg.id}
          onOpenChange={(open) => { if (!open) setConvertLead(null); }}
          onConverted={(customerId) => {
            setLeads((prev) =>
              prev.map((l) =>
                l.id === convertLead.id ? { ...l, status: "won" as LeadStatus } : l
              )
            );
            setConvertLead(null);
            router.push(`/customers/${customerId}`);
          }}
        />
      )}
    </div>
  );
}

// ─── Kanban Column ─────────────────────────────────────────────────────────────

function KanbanColumn({
  column,
  leads,
  onAddCard,
  onEditLead,
  onConvertLead,
  onDeleteLead,
}: {
  column: (typeof COLUMNS)[number];
  leads: Lead[];
  onAddCard: () => void;
  onEditLead: (lead: Lead) => void;
  onConvertLead: (lead: Lead) => void;
  onDeleteLead: (lead: Lead) => void;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col rounded-xl border-2 transition-colors min-h-[200px] ${column.color} ${
        isOver ? "border-primary/50 bg-primary/5" : ""
      }`}
    >
      {/* Column Header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-inherit">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold">{column.label}</span>
          <Badge variant="secondary" className="text-xs h-5 px-1.5">
            {leads.length}
          </Badge>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6"
          onClick={onAddCard}
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-2 flex-1">
        {leads.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <p className="text-xs text-muted-foreground">No leads here</p>
            <button
              className="text-xs text-primary mt-1 hover:underline"
              onClick={onAddCard}
            >
              + Add one
            </button>
          </div>
        ) : (
          leads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              onEdit={() => onEditLead(lead)}
              onConvert={() => onConvertLead(lead)}
              onDelete={() => onDeleteLead(lead)}
            />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Lead Card ─────────────────────────────────────────────────────────────────

function LeadCard({
  lead,
  isDragging = false,
  onEdit,
  onConvert,
  onDelete,
}: {
  lead: Lead;
  isDragging?: boolean;
  onEdit: () => void;
  onConvert: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging: isActiveDragging } =
    useDraggable({ id: lead.id });

  const style = transform
    ? { transform: `translate(${transform.x}px, ${transform.y}px)` }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      className={`rounded-lg bg-white border shadow-sm p-3 cursor-grab active:cursor-grabbing select-none transition-opacity ${
        isActiveDragging && !isDragging ? "opacity-40" : "opacity-100"
      } ${isDragging ? "shadow-lg rotate-1" : ""}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold truncate">{lead.name}</p>
          {lead.phone && (
            <div className="flex items-center gap-1 mt-0.5">
              <Phone className="h-3 w-3 text-muted-foreground flex-shrink-0" />
              <span className="text-xs text-muted-foreground">{lead.phone}</span>
            </div>
          )}
          {lead.source && (
            <Badge variant="secondary" className="text-xs mt-1.5">
              {SOURCE_LABELS[lead.source as LeadSource] ?? lead.source}
            </Badge>
          )}
        </div>
      </div>

      {/* Actions */}
      <div
        className="flex items-center gap-1 mt-2 pt-2 border-t"
        onPointerDown={(e) => e.stopPropagation()}
      >
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs gap-1 flex-1"
          onClick={(e) => { e.stopPropagation(); onConvert(); }}
        >
          <UserPlus className="h-3 w-3" />
          Convert
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={(e) => { e.stopPropagation(); onEdit(); }}
        >
          Edit
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 text-destructive hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
        >
          <Trash2 className="h-3 w-3" />
        </Button>
      </div>
    </div>
  );
}

// ─── Quick Add Dialog ──────────────────────────────────────────────────────────

function QuickAddLeadDialog({
  open,
  initialStatus,
  orgId,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  initialStatus: LeadStatus;
  orgId: string;
  onOpenChange: (open: boolean) => void;
  onCreated: (lead: Lead) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    source: "manual" as LeadSource,
    notes: "",
  });

  const handleOpenChange = (val: boolean) => {
    if (!val) {
      setForm({ name: "", phone: "", source: "manual", notes: "" });
    }
    onOpenChange(val);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error("Name is required");
      return;
    }
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("leads")
      .insert({
        org_id: orgId,
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        source: form.source,
        status: initialStatus,
        notes: form.notes.trim() || null,
      })
      .select()
      .single();
    if (error) {
      toast.error("Failed to create lead");
    } else {
      toast.success("Lead created");
      onCreated(data as Lead);
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>New Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="lead-name">Name *</Label>
            <Input
              id="lead-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="John Smith"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-phone">Phone</Label>
            <Input
              id="lead-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="(555) 000-0000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-source">Source</Label>
            <Select
              value={form.source}
              onValueChange={(val) =>
                setForm({ ...form, source: (val as LeadSource) ?? "manual" })
              }
            >
              <SelectTrigger id="lead-source" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="web">Website</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="missed_call">Missed Call</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="lead-notes">Notes</Label>
            <Textarea
              id="lead-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Any notes..."
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Creating..." : "Create Lead"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Edit Lead Dialog ──────────────────────────────────────────────────────────

function EditLeadDialog({
  open,
  lead,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  lead: Lead;
  onOpenChange: (open: boolean) => void;
  onSaved: (lead: Lead) => void;
}) {
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    name: lead.name,
    phone: lead.phone ?? "",
    source: lead.source as LeadSource,
    notes: lead.notes ?? "",
    status: lead.status as LeadStatus,
  });

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const supabase = createClient();
    const { data, error } = await supabase
      .from("leads")
      .update({
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        source: form.source,
        notes: form.notes.trim() || null,
        status: form.status,
      })
      .eq("id", lead.id)
      .select()
      .single();
    if (error) {
      toast.error("Failed to update lead");
    } else {
      toast.success("Lead updated");
      onSaved(data as Lead);
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Edit Lead</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="edit-name">Name *</Label>
            <Input
              id="edit-name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-phone">Phone</Label>
            <Input
              id="edit-phone"
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-source">Source</Label>
            <Select
              value={form.source}
              onValueChange={(val) =>
                setForm({ ...form, source: (val as LeadSource) ?? "manual" })
              }
            >
              <SelectTrigger id="edit-source" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual">Manual</SelectItem>
                <SelectItem value="web">Website</SelectItem>
                <SelectItem value="referral">Referral</SelectItem>
                <SelectItem value="missed_call">Missed Call</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(val) =>
                setForm({ ...form, status: (val as LeadStatus) ?? "new" })
              }
            >
              <SelectTrigger id="edit-status" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New</SelectItem>
                <SelectItem value="contacted">Contacted</SelectItem>
                <SelectItem value="quoted">Quoted</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="edit-notes">Notes</Label>
            <Textarea
              id="edit-notes"
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
            />
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Convert Lead Dialog ───────────────────────────────────────────────────────

function ConvertLeadDialog({
  open,
  lead,
  orgId,
  onOpenChange,
  onConverted,
}: {
  open: boolean;
  lead: Lead;
  orgId: string;
  onOpenChange: (open: boolean) => void;
  onConverted: (customerId: string) => void;
}) {
  const [converting, setConverting] = useState(false);
  const [email, setEmail] = useState("");

  async function handleConvert() {
    setConverting(true);
    const supabase = createClient();

    try {
      // Create customer from lead
      const { data: customer, error: custErr } = await supabase
        .from("customers")
        .insert({
          org_id: orgId,
          name: lead.name,
          phone: lead.phone ?? null,
          email: email.trim() || null,
          notes: lead.notes ?? null,
          source: lead.source,
        })
        .select()
        .single();

      if (custErr) throw custErr;

      // Mark lead as won
      await supabase
        .from("leads")
        .update({ status: "won" })
        .eq("id", lead.id);

      toast.success(`${lead.name} converted to customer`);
      onConverted(customer.id);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Conversion failed";
      toast.error(msg);
    } finally {
      setConverting(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Convert to Customer</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-sm text-muted-foreground">
            This will create a new customer record for{" "}
            <strong>{lead.name}</strong> and mark this lead as Won.
          </p>
          <div className="space-y-2">
            <Label htmlFor="convert-email">Email (optional)</Label>
            <Input
              id="convert-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@example.com"
            />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={converting}
          >
            Cancel
          </Button>
          <Button onClick={handleConvert} disabled={converting} className="gap-1.5">
            <UserPlus className="h-4 w-4" />
            {converting ? "Converting..." : "Convert to Customer"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Skeletons ─────────────────────────────────────────────────────────────────

function LeadsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-24" />
          <Skeleton className="h-4 w-40" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <LeadsBoardSkeleton />
    </div>
  );
}

function LeadsBoardSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-xl border-2 p-3 space-y-2">
          <Skeleton className="h-6 w-24" />
          {Array.from({ length: 2 }).map((_, j) => (
            <Skeleton key={j} className="h-20 rounded-lg" />
          ))}
        </div>
      ))}
    </div>
  );
}
