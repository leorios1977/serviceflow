"use client";

import { useEffect, useState, useCallback } from "react";
import { toast } from "sonner";
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
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/org-context";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import type { VisitStatus } from "@/lib/database.types";
import {
  ChevronLeft,
  ChevronRight,
  CalendarDays,
  MapPin,
  User,
  Clock,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface VisitWithRelations {
  id: string;
  org_id: string;
  property_id: string;
  route_id: string | null;
  scheduled_date: string;
  status: VisitStatus;
  checklist: unknown[];
  photos: unknown[];
  tech_notes: string | null;
  completed_at: string | null;
  created_at: string;
  properties: {
    address: string;
    gate_code: string | null;
    customers: {
      name: string;
    };
  } | null;
  routes: {
    assigned_user_id: string | null;
  } | null;
}

interface OrgMemberUser {
  user_id: string;
  email: string;
  full_name?: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function formatShortAddress(address: string): string {
  const parts = address.split(",");
  return parts[0]?.trim() ?? address;
}

const STATUS_STYLES: Record<VisitStatus, { badge: string; label: string }> = {
  scheduled: { badge: "bg-blue-100 text-blue-700 border-blue-200", label: "Scheduled" },
  in_progress: { badge: "bg-yellow-100 text-yellow-700 border-yellow-200", label: "In Progress" },
  completed: { badge: "bg-green-100 text-green-700 border-green-200", label: "Completed" },
  skipped: { badge: "bg-red-100 text-red-700 border-red-200", label: "Skipped" },
};

// ─── Visit Card (draggable) ────────────────────────────────────────────────────

function VisitCard({
  visit,
  onClick,
}: {
  visit: VisitWithRelations;
  onClick?: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: visit.id,
    data: { visit },
  });

  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` }
    : undefined;

  const statusStyle = STATUS_STYLES[visit.status];
  const customerName = visit.properties?.customers?.name ?? "Unknown";
  const shortAddress = visit.properties?.address
    ? formatShortAddress(visit.properties.address)
    : "—";

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      className={`rounded-lg border bg-card p-2 text-xs cursor-pointer select-none hover:shadow-sm transition-shadow ${
        isDragging ? "opacity-40" : ""
      }`}
    >
      <p className="font-medium text-foreground truncate">{customerName}</p>
      <p className="text-muted-foreground truncate flex items-center gap-1 mt-0.5">
        <MapPin className="h-3 w-3 shrink-0" />
        {shortAddress}
      </p>
      <span
        className={`mt-1 inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium ${statusStyle.badge}`}
      >
        {statusStyle.label}
      </span>
    </div>
  );
}

// ─── Day Column (droppable) ────────────────────────────────────────────────────

function DayColumn({
  date,
  visits,
  isToday,
  loading,
  onVisitClick,
}: {
  date: Date;
  visits: VisitWithRelations[];
  isToday: boolean;
  loading: boolean;
  onVisitClick: (visit: VisitWithRelations) => void;
}) {
  const isoDate = toISODate(date);
  const { setNodeRef, isOver } = useDroppable({ id: isoDate });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-h-[120px] rounded-xl border-2 transition-colors ${
        isToday ? "border-primary/40 bg-primary/5" : "border-border bg-muted/20"
      } ${isOver ? "!border-primary bg-primary/10" : ""}`}
    >
      {/* Header */}
      <div
        className={`px-2 py-1.5 text-center border-b ${
          isToday ? "border-primary/20" : "border-border"
        }`}
      >
        <p className="text-xs text-muted-foreground">{DAY_NAMES[date.getDay()]}</p>
        <p
          className={`text-sm font-semibold leading-none mt-0.5 ${
            isToday
              ? "text-white bg-primary rounded-full w-6 h-6 flex items-center justify-center mx-auto"
              : "text-foreground"
          }`}
        >
          {date.getDate()}
        </p>
      </div>

      {/* Visit cards */}
      <div className="flex-1 p-1.5 space-y-1.5 overflow-y-auto max-h-[280px]">
        {loading ? (
          <>
            <Skeleton className="h-14 rounded-lg" />
            <Skeleton className="h-14 rounded-lg" />
          </>
        ) : visits.length === 0 ? (
          <p className="text-[10px] text-muted-foreground text-center py-3">No visits</p>
        ) : (
          visits.map((v) => (
            <VisitCard key={v.id} visit={v} onClick={() => onVisitClick(v)} />
          ))
        )}
      </div>
    </div>
  );
}

// ─── Visit Detail Sheet ────────────────────────────────────────────────────────

function VisitDetailSheet({
  visit,
  open,
  onOpenChange,
  onUpdated,
}: {
  visit: VisitWithRelations | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUpdated: () => void;
}) {
  const [status, setStatus] = useState<VisitStatus>("scheduled");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (visit) {
      setStatus(visit.status);
      setNotes(visit.tech_notes ?? "");
    }
  }, [visit]);

  async function handleSave() {
    if (!visit) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("visits")
      .update({ status, tech_notes: notes })
      .eq("id", visit.id);
    if (error) {
      toast.error("Failed to save changes");
    } else {
      toast.success("Visit updated");
      onUpdated();
      onOpenChange(false);
    }
    setSaving(false);
  }

  if (!visit) return null;

  const customerName = visit.properties?.customers?.name ?? "Unknown";
  const address = visit.properties?.address ?? "—";
  const gateCode = visit.properties?.gate_code;
  const statusStyle = STATUS_STYLES[visit.status];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>{customerName}</SheetTitle>
          <SheetDescription>{address}</SheetDescription>
        </SheetHeader>

        <div className="px-4 pb-4 space-y-4">
          {/* Current status badge */}
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-medium ${statusStyle.badge}`}
          >
            {statusStyle.label}
          </span>

          {/* Details */}
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2 text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              <span>{visit.scheduled_date}</span>
            </div>
            {gateCode && (
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground text-xs">Gate Code:</span>
                <span className="font-mono font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded">
                  {gateCode}
                </span>
              </div>
            )}
            {visit.completed_at && (
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>Completed {new Date(visit.completed_at).toLocaleTimeString()}</span>
              </div>
            )}
          </div>

          {/* Edit status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <Select value={status} onValueChange={(v) => setStatus(v as VisitStatus)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
                <SelectItem value="skipped">Skipped</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Edit notes */}
          <div className="space-y-1.5">
            <Label>Tech Notes</Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="Add notes about this visit…"
            />
          </div>

          {/* Checklist (read-only view) */}
          {Array.isArray(visit.checklist) && visit.checklist.length > 0 && (
            <div className="space-y-1.5">
              <Label>Checklist</Label>
              <ul className="space-y-1">
                {(visit.checklist as Array<{ label: string; done: boolean }>).map(
                  (item, i) => (
                    <li key={i} className="flex items-center gap-2 text-sm">
                      <span
                        className={`h-4 w-4 rounded border flex items-center justify-center text-[10px] ${
                          item.done
                            ? "bg-green-500 border-green-500 text-white"
                            : "border-border"
                        }`}
                      >
                        {item.done && "✓"}
                      </span>
                      <span
                        className={item.done ? "line-through text-muted-foreground" : ""}
                      >
                        {item.label}
                      </span>
                    </li>
                  )
                )}
              </ul>
            </div>
          )}

          {/* Save */}
          <Button onClick={handleSave} disabled={saving} className="w-full">
            {saving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function SchedulePage() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const [weekStart, setWeekStart] = useState<Date>(() => getWeekStart(new Date()));
  const [visits, setVisits] = useState<VisitWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [orgMembers, setOrgMembers] = useState<OrgMemberUser[]>([]);
  const [filterUserId, setFilterUserId] = useState<string>("all");
  const [selectedVisit, setSelectedVisit] = useState<VisitWithRelations | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [activeVisit, setActiveVisit] = useState<VisitWithRelations | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const weekDates = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const weekEnd = addDays(weekStart, 6);

  const fetchOrgMembers = useCallback(async () => {
    if (!currentOrg) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("org_members")
      .select("user_id, role")
      .eq("org_id", currentOrg.id);
    if (data) {
      setOrgMembers(
        data.map((m) => ({
          user_id: m.user_id,
          email: m.user_id,
        }))
      );
    }
  }, [currentOrg]);

  const fetchVisits = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const supabase = createClient();

    const startDate = toISODate(weekStart);
    const endDate = toISODate(weekEnd);

    const { data, error } = await supabase
      .from("visits")
      .select(
        `*, properties ( address, gate_code, customers ( name ) ), routes ( assigned_user_id )`
      )
      .eq("org_id", currentOrg.id)
      .gte("scheduled_date", startDate)
      .lte("scheduled_date", endDate)
      .order("scheduled_date", { ascending: true });

    if (error) {
      toast.error("Failed to load visits");
    } else {
      let filtered = (data ?? []) as VisitWithRelations[];
      if (filterUserId !== "all") {
        filtered = filtered.filter(
          (v) => v.routes?.assigned_user_id === filterUserId
        );
      }
      setVisits(filtered);
    }
    setLoading(false);
  }, [currentOrg, weekStart, weekEnd, filterUserId]);

  useEffect(() => {
    if (!orgLoading) fetchOrgMembers();
  }, [orgLoading, fetchOrgMembers]);

  useEffect(() => {
    if (!orgLoading) fetchVisits();
  }, [orgLoading, fetchVisits]);

  const visitsByDate = weekDates.reduce<Record<string, VisitWithRelations[]>>(
    (acc, date) => {
      acc[toISODate(date)] = visits.filter(
        (v) => v.scheduled_date === toISODate(date)
      );
      return acc;
    },
    {}
  );

  function handleDragStart(event: DragStartEvent) {
    const visit = event.active.data.current?.visit as VisitWithRelations;
    setActiveVisit(visit ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveVisit(null);
    const { active, over } = event;
    if (!over) return;

    const visitId = active.id as string;
    const newDate = over.id as string;
    const visit = visits.find((v) => v.id === visitId);
    if (!visit || visit.scheduled_date === newDate) return;

    setVisits((prev) =>
      prev.map((v) => (v.id === visitId ? { ...v, scheduled_date: newDate } : v))
    );

    const supabase = createClient();
    const { error } = await supabase
      .from("visits")
      .update({ scheduled_date: newDate })
      .eq("id", visitId);

    if (error) {
      toast.error("Failed to reschedule visit");
      fetchVisits();
    } else {
      toast.success("Visit rescheduled");
    }
  }

  const todayIso = toISODate(new Date());

  const weekLabel = `${weekStart.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} – ${weekEnd.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  return (
    <div className="space-y-4 pb-20 lg:pb-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Schedule</h1>
          <p className="text-muted-foreground text-sm mt-0.5">{weekLabel}</p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {orgMembers.length > 0 && (
            <Select value={filterUserId} onValueChange={setFilterUserId}>
              <SelectTrigger className="w-40">
                <User className="h-3.5 w-3.5 mr-1 shrink-0" />
                <SelectValue placeholder="All techs" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Techs</SelectItem>
                {orgMembers.map((m) => (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name ?? m.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}

          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setWeekStart((w) => addDays(w, -7))}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setWeekStart(getWeekStart(new Date()))}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => setWeekStart((w) => addDays(w, 7))}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Calendar grid */}
      <DndContext
        sensors={sensors}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
          {weekDates.map((date) => {
            const iso = toISODate(date);
            return (
              <DayColumn
                key={iso}
                date={date}
                visits={visitsByDate[iso] ?? []}
                isToday={iso === todayIso}
                loading={loading}
                onVisitClick={(v) => {
                  setSelectedVisit(v);
                  setSheetOpen(true);
                }}
              />
            );
          })}
        </div>

        <DragOverlay>
          {activeVisit ? (
            <div className="rounded-lg border bg-card p-2 text-xs shadow-lg opacity-90 w-36">
              <p className="font-medium truncate">
                {activeVisit.properties?.customers?.name ?? "Visit"}
              </p>
              <p className="text-muted-foreground truncate">
                {activeVisit.properties?.address
                  ? formatShortAddress(activeVisit.properties.address)
                  : ""}
              </p>
            </div>
          ) : null}
        </DragOverlay>
      </DndContext>

      {/* Visit detail sheet */}
      <VisitDetailSheet
        visit={selectedVisit}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        onUpdated={fetchVisits}
      />
    </div>
  );
}
