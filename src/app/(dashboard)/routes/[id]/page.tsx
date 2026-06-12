"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  closestCenter,
} from "@dnd-kit/core";
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
  arrayMove,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/org-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ChevronLeft,
  GripVertical,
  Plus,
  Trash2,
  MapPin,
  User,
  DollarSign,
  Key,
  Search,
} from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface StopOrderItem {
  service_plan_id: string;
  position: number;
}

interface RouteData {
  id: string;
  org_id: string;
  name: string;
  assigned_user_id: string | null;
  day_of_week: number | null;
  stop_order: StopOrderItem[];
}

interface StopDetail {
  service_plan_id: string;
  position: number;
  customer_name: string;
  address: string;
  gate_code: string | null;
  frequency: string;
  price: number;
  property_id: string;
}

interface AvailableServicePlan {
  id: string;
  price: number;
  frequency: string;
  property: {
    id: string;
    address: string;
    gate_code: string | null;
    customer: {
      name: string;
    };
  };
}

interface OrgMember {
  user_id: string;
  role: string;
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

const DAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

// ─── Sortable Stop Row ─────────────────────────────────────────────────────────

function SortableStopRow({
  stop,
  onRemove,
}: {
  stop: StopDetail;
  onRemove: (id: string) => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: stop.service_plan_id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center gap-3 rounded-xl border bg-card p-3 sm:p-4"
    >
      {/* Drag handle */}
      <button
        {...attributes}
        {...listeners}
        className="cursor-grab active:cursor-grabbing text-muted-foreground hover:text-foreground touch-none"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-5 w-5" />
      </button>

      {/* Position number */}
      <div className="flex-shrink-0 w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
        {stop.position}
      </div>

      {/* Stop info */}
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-foreground truncate">{stop.customer_name}</p>
        <p className="text-sm text-muted-foreground flex items-center gap-1 truncate">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          {stop.address}
        </p>
        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground flex-wrap">
          <span>{FREQUENCY_LABELS[stop.frequency] ?? stop.frequency}</span>
          <span className="flex items-center gap-0.5">
            <DollarSign className="h-3 w-3" />
            {stop.price.toFixed(2)}
          </span>
          {stop.gate_code && (
            <span className="flex items-center gap-0.5 text-destructive font-medium">
              <Key className="h-3 w-3" />
              {stop.gate_code}
            </span>
          )}
        </div>
      </div>

      {/* Remove */}
      <Button
        variant="ghost"
        size="icon-sm"
        className="text-muted-foreground hover:text-destructive shrink-0"
        onClick={() => onRemove(stop.service_plan_id)}
      >
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}

// ─── Add Stop Dialog ───────────────────────────────────────────────────────────

function AddStopDialog({
  open,
  availablePlans,
  onOpenChange,
  onAdd,
}: {
  open: boolean;
  availablePlans: AvailableServicePlan[];
  onOpenChange: (open: boolean) => void;
  onAdd: (planId: string) => void;
}) {
  const [search, setSearch] = useState("");

  const filtered = availablePlans.filter(
    (p) =>
      p.property.customer.name.toLowerCase().includes(search.toLowerCase()) ||
      p.property.address.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Add Stop</DialogTitle>
        </DialogHeader>

        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Search by customer or address…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="max-h-72 overflow-y-auto space-y-2 -mx-1 px-1">
          {filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">
              No available service plans
            </p>
          ) : (
            filtered.map((plan) => (
              <button
                key={plan.id}
                className="w-full text-left rounded-lg border bg-card p-3 hover:bg-muted/50 transition-colors"
                onClick={() => {
                  onAdd(plan.id);
                  onOpenChange(false);
                  setSearch("");
                }}
              >
                <p className="font-medium text-sm">{plan.property.customer.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {plan.property.address}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {FREQUENCY_LABELS[plan.frequency] ?? plan.frequency} ·{" "}
                  ${Number(plan.price).toFixed(2)}
                </p>
              </button>
            ))
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function RouteDetailPage() {
  const params = useParams();
  const router = useRouter();
  const routeId = params.id as string;
  const { currentOrg, loading: orgLoading } = useOrg();

  const [route, setRoute] = useState<RouteData | null>(null);
  const [stops, setStops] = useState<StopDetail[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [availablePlans, setAvailablePlans] = useState<AvailableServicePlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [addStopOpen, setAddStopOpen] = useState(false);
  const [activeStop, setActiveStop] = useState<StopDetail | null>(null);
  const [assignedUserId, setAssignedUserId] = useState<string>("unassigned");

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } })
  );

  const fetchOrgMembers = useCallback(async () => {
    if (!currentOrg) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("org_members")
      .select("user_id, role")
      .eq("org_id", currentOrg.id);
    setOrgMembers((data ?? []) as OrgMember[]);
  }, [currentOrg]);

  const fetchRoute = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const supabase = createClient();

    const { data: routeData, error } = await supabase
      .from("routes")
      .select("*")
      .eq("id", routeId)
      .eq("org_id", currentOrg.id)
      .single();

    if (error || !routeData) {
      toast.error("Route not found");
      router.push("/routes");
      return;
    }

    const stopOrder = (routeData.stop_order ?? []) as StopOrderItem[];
    setRoute({ ...routeData, stop_order: stopOrder });
    setAssignedUserId(routeData.assigned_user_id ?? "unassigned");

    // Fetch service plan details for each stop
    const spIds = stopOrder.map((s) => s.service_plan_id).filter(Boolean);
    if (spIds.length > 0) {
      const { data: plans } = await supabase
        .from("service_plans")
        .select(
          `id, price, frequency, properties ( id, address, gate_code, customers ( name ) )`
        )
        .in("id", spIds);

      if (plans) {
        const stopDetails: StopDetail[] = stopOrder.map((s, idx) => {
          const plan = plans.find((p) => p.id === s.service_plan_id);
          const prop = plan?.properties as {
            id: string;
            address: string;
            gate_code: string | null;
            customers: { name: string };
          } | null;
          return {
            service_plan_id: s.service_plan_id,
            position: idx + 1,
            customer_name: prop?.customers?.name ?? "Unknown",
            address: prop?.address ?? "—",
            gate_code: prop?.gate_code ?? null,
            frequency: plan?.frequency ?? "",
            price: Number(plan?.price ?? 0),
            property_id: prop?.id ?? "",
          };
        });
        setStops(stopDetails);
      }
    } else {
      setStops([]);
    }

    // Fetch available service plans (active, not already on this route for this day)
    const { data: allPlans } = await supabase
      .from("service_plans")
      .select(
        `id, price, frequency, properties ( id, address, gate_code, customers ( name ) )`
      )
      .eq("org_id", currentOrg.id)
      .eq("status", "active");

    const existingIds = new Set(spIds);
    const available = (allPlans ?? [])
      .filter((p) => !existingIds.has(p.id))
      .map((p) => {
        const prop = p.properties as {
          id: string;
          address: string;
          gate_code: string | null;
          customers: { name: string };
        } | null;
        return {
          id: p.id,
          price: Number(p.price),
          frequency: p.frequency,
          property: {
            id: prop?.id ?? "",
            address: prop?.address ?? "",
            gate_code: prop?.gate_code ?? null,
            customer: { name: prop?.customers?.name ?? "Unknown" },
          },
        };
      });
    setAvailablePlans(available);

    setLoading(false);
  }, [currentOrg, routeId, router]);

  useEffect(() => {
    if (!orgLoading) {
      fetchOrgMembers();
      fetchRoute();
    }
  }, [orgLoading, fetchOrgMembers, fetchRoute]);

  // Persist stop_order to Supabase
  async function saveStopOrder(newStops: StopDetail[]) {
    setSaving(true);
    const supabase = createClient();
    const stopOrder: StopOrderItem[] = newStops.map((s, i) => ({
      service_plan_id: s.service_plan_id,
      position: i + 1,
    }));
    const { error } = await supabase
      .from("routes")
      .update({ stop_order: stopOrder })
      .eq("id", routeId);
    if (error) {
      toast.error("Failed to save stop order");
    }
    setSaving(false);
  }

  function handleDragStart(event: DragStartEvent) {
    const stop = stops.find((s) => s.service_plan_id === event.active.id);
    setActiveStop(stop ?? null);
  }

  async function handleDragEnd(event: DragEndEvent) {
    setActiveStop(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = stops.findIndex((s) => s.service_plan_id === active.id);
    const newIndex = stops.findIndex((s) => s.service_plan_id === over.id);
    const reordered = arrayMove(stops, oldIndex, newIndex).map((s, i) => ({
      ...s,
      position: i + 1,
    }));
    setStops(reordered);
    await saveStopOrder(reordered);
    toast.success("Stop order saved");
  }

  async function handleRemoveStop(planId: string) {
    const newStops = stops
      .filter((s) => s.service_plan_id !== planId)
      .map((s, i) => ({ ...s, position: i + 1 }));
    setStops(newStops);

    // Move back to available
    const removed = stops.find((s) => s.service_plan_id === planId);
    if (removed) {
      setAvailablePlans((prev) => [
        ...prev,
        {
          id: removed.service_plan_id,
          price: removed.price,
          frequency: removed.frequency,
          property: {
            id: removed.property_id,
            address: removed.address,
            gate_code: removed.gate_code,
            customer: { name: removed.customer_name },
          },
        },
      ]);
    }

    await saveStopOrder(newStops);
    toast.success("Stop removed");
  }

  async function handleAddStop(planId: string) {
    const plan = availablePlans.find((p) => p.id === planId);
    if (!plan) return;

    const newStop: StopDetail = {
      service_plan_id: planId,
      position: stops.length + 1,
      customer_name: plan.property.customer.name,
      address: plan.property.address,
      gate_code: plan.property.gate_code,
      frequency: plan.frequency,
      price: plan.price,
      property_id: plan.property.id,
    };

    const newStops = [...stops, newStop];
    setStops(newStops);
    setAvailablePlans((prev) => prev.filter((p) => p.id !== planId));
    await saveStopOrder(newStops);
    toast.success("Stop added");
  }

  async function handleAssignTech(userId: string) {
    setAssignedUserId(userId);
    const supabase = createClient();
    const { error } = await supabase
      .from("routes")
      .update({
        assigned_user_id: userId === "unassigned" ? null : userId,
      })
      .eq("id", routeId);
    if (error) {
      toast.error("Failed to assign tech");
    } else {
      toast.success("Tech assigned");
    }
  }

  if (loading || orgLoading) {
    return (
      <div className="space-y-4 pb-20 lg:pb-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-10 w-full" />
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
    );
  }

  if (!route) return null;

  return (
    <div className="space-y-4 pb-20 lg:pb-4">
      {/* Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => router.push("/routes")}
        >
          <ChevronLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{route.name}</h1>
          {route.day_of_week !== null && (
            <p className="text-sm text-muted-foreground">
              {DAY_NAMES[route.day_of_week]}
            </p>
          )}
        </div>
      </div>

      {/* Assign tech */}
      <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
        <User className="h-5 w-5 text-muted-foreground shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium">Assigned Tech</p>
        </div>
        <Select value={assignedUserId} onValueChange={handleAssignTech}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Unassigned" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">Unassigned</SelectItem>
            {orgMembers.map((m) => (
              <SelectItem key={m.user_id} value={m.user_id}>
                {m.user_id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Stops header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-semibold">
            Stops{" "}
            <span className="text-muted-foreground font-normal text-sm">
              ({stops.length})
            </span>
          </h2>
          <p className="text-xs text-muted-foreground">
            Drag to reorder · changes save automatically
          </p>
        </div>
        <Button
          size="sm"
          className="gap-1.5"
          onClick={() => setAddStopOpen(true)}
          disabled={availablePlans.length === 0}
        >
          <Plus className="h-4 w-4" />
          Add Stop
        </Button>
      </div>

      {/* Sortable stops list */}
      {stops.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-10 text-center">
          <MapPin className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm font-medium">No stops on this route</p>
          <p className="text-xs text-muted-foreground mt-1 mb-3">
            Add service plans to build your route.
          </p>
          <Button
            size="sm"
            className="gap-1.5"
            onClick={() => setAddStopOpen(true)}
            disabled={availablePlans.length === 0}
          >
            <Plus className="h-4 w-4" />
            Add Stop
          </Button>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={stops.map((s) => s.service_plan_id)}
            strategy={verticalListSortingStrategy}
          >
            <div className="space-y-2">
              {stops.map((stop) => (
                <SortableStopRow
                  key={stop.service_plan_id}
                  stop={stop}
                  onRemove={handleRemoveStop}
                />
              ))}
            </div>
          </SortableContext>

          <DragOverlay>
            {activeStop ? (
              <div className="rounded-xl border bg-card p-3 shadow-lg opacity-90 flex items-center gap-3">
                <GripVertical className="h-5 w-5 text-muted-foreground" />
                <div className="w-7 h-7 rounded-full bg-primary/10 text-primary text-sm font-bold flex items-center justify-center">
                  {activeStop.position}
                </div>
                <div>
                  <p className="font-semibold text-sm">{activeStop.customer_name}</p>
                  <p className="text-xs text-muted-foreground">{activeStop.address}</p>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {saving && (
        <p className="text-xs text-muted-foreground text-center">Saving…</p>
      )}

      <AddStopDialog
        open={addStopOpen}
        availablePlans={availablePlans}
        onOpenChange={setAddStopOpen}
        onAdd={handleAddStop}
      />
    </div>
  );
}
