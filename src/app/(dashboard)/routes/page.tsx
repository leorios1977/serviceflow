"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
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
import { MapPin, Plus, Users, Calendar, DollarSign, Hash } from "lucide-react";

// ─── Types ─────────────────────────────────────────────────────────────────────

interface RouteWithStats {
  id: string;
  org_id: string;
  name: string;
  assigned_user_id: string | null;
  day_of_week: number | null;
  stop_order: StopOrderItem[];
  created_at: string;
  // computed
  stop_count: number;
  estimated_revenue: number;
}

interface StopOrderItem {
  service_plan_id: string;
  position: number;
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

// ─── Create Route Dialog ───────────────────────────────────────────────────────

function CreateRouteDialog({
  open,
  orgId,
  orgMembers,
  onOpenChange,
  onCreated,
}: {
  open: boolean;
  orgId: string;
  orgMembers: OrgMember[];
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}) {
  const [name, setName] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState<string>("");
  const [assignedUserId, setAssignedUserId] = useState<string>("unassigned");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName("");
    setDayOfWeek("");
    setAssignedUserId("unassigned");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSaving(true);
    const supabase = createClient();
    const { error } = await supabase.from("routes").insert({
      org_id: orgId,
      name: name.trim(),
      day_of_week: dayOfWeek !== "" ? parseInt(dayOfWeek) : null,
      assigned_user_id:
        assignedUserId !== "unassigned" ? assignedUserId : null,
      stop_order: [],
    });
    if (error) {
      toast.error("Failed to create route");
    } else {
      toast.success("Route created");
      reset();
      onCreated();
      onOpenChange(false);
    }
    setSaving(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create Route</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="route-name">Route Name</Label>
            <Input
              id="route-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monday North"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label>Day of Week</Label>
            <Select value={dayOfWeek} onValueChange={setDayOfWeek}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select day…" />
              </SelectTrigger>
              <SelectContent>
                {DAY_NAMES.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Assign Tech</Label>
            <Select value={assignedUserId} onValueChange={setAssignedUserId}>
              <SelectTrigger className="w-full">
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
              {saving ? "Creating…" : "Create Route"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── Route Card ────────────────────────────────────────────────────────────────

function RouteCard({ route }: { route: RouteWithStats }) {
  return (
    <Link href={`/routes/${route.id}`}>
      <div className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow cursor-pointer space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div>
            <h3 className="font-semibold text-foreground">{route.name}</h3>
            {route.day_of_week !== null && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Calendar className="h-3.5 w-3.5" />
                {DAY_NAMES[route.day_of_week]}
              </p>
            )}
          </div>
          <MapPin className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
        </div>

        <div className="grid grid-cols-3 gap-2 text-sm">
          <div className="flex flex-col items-center rounded-lg bg-muted/50 p-2">
            <Hash className="h-4 w-4 text-muted-foreground mb-0.5" />
            <span className="font-semibold">{route.stop_count}</span>
            <span className="text-[10px] text-muted-foreground">Stops</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-muted/50 p-2">
            <DollarSign className="h-4 w-4 text-muted-foreground mb-0.5" />
            <span className="font-semibold">
              ${route.estimated_revenue.toFixed(0)}
            </span>
            <span className="text-[10px] text-muted-foreground">Revenue</span>
          </div>
          <div className="flex flex-col items-center rounded-lg bg-muted/50 p-2">
            <Users className="h-4 w-4 text-muted-foreground mb-0.5" />
            <span className="font-semibold text-xs truncate w-full text-center">
              {route.assigned_user_id ? "Assigned" : "—"}
            </span>
            <span className="text-[10px] text-muted-foreground">Tech</span>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function RoutesSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Skeleton key={i} className="h-40 rounded-xl" />
      ))}
    </div>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function RoutesPage() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const [routes, setRoutes] = useState<RouteWithStats[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);

  const fetchOrgMembers = useCallback(async () => {
    if (!currentOrg) return;
    const supabase = createClient();
    const { data } = await supabase
      .from("org_members")
      .select("user_id, role")
      .eq("org_id", currentOrg.id);
    setOrgMembers((data ?? []) as OrgMember[]);
  }, [currentOrg]);

  const fetchRoutes = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const supabase = createClient();

    // Fetch routes
    const { data: routesData, error } = await supabase
      .from("routes")
      .select("*")
      .eq("org_id", currentOrg.id)
      .order("day_of_week", { ascending: true });

    if (error) {
      toast.error("Failed to load routes");
      setLoading(false);
      return;
    }

    // For each route, compute stop count and estimated revenue
    const enriched: RouteWithStats[] = await Promise.all(
      (routesData ?? []).map(async (route) => {
        const stopOrder = (route.stop_order ?? []) as StopOrderItem[];
        const spIds = stopOrder.map((s) => s.service_plan_id).filter(Boolean);

        let estimatedRevenue = 0;
        if (spIds.length > 0) {
          const { data: plans } = await supabase
            .from("service_plans")
            .select("price")
            .in("id", spIds);
          estimatedRevenue = (plans ?? []).reduce(
            (sum, p) => sum + (Number(p.price) || 0),
            0
          );
        }

        return {
          ...route,
          stop_order: stopOrder,
          stop_count: stopOrder.length,
          estimated_revenue: estimatedRevenue,
        };
      })
    );

    setRoutes(enriched);
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => {
    if (!orgLoading) {
      fetchOrgMembers();
      fetchRoutes();
    }
  }, [orgLoading, fetchOrgMembers, fetchRoutes]);

  return (
    <div className="space-y-4 pb-20 lg:pb-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Routes</h1>
          <p className="text-muted-foreground text-sm mt-0.5">
            Manage your service routes and stop order.
          </p>
        </div>
        <Button
          onClick={() => setCreateOpen(true)}
          className="gap-1.5"
          size="sm"
        >
          <Plus className="h-4 w-4" />
          New Route
        </Button>
      </div>

      {/* Content */}
      {loading || orgLoading ? (
        <RoutesSkeleton />
      ) : routes.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed border-border p-12 text-center">
          <MapPin className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="font-semibold text-foreground">No routes yet</h3>
          <p className="text-sm text-muted-foreground mt-1 mb-4">
            Create your first route to start organizing stops.
          </p>
          <Button onClick={() => setCreateOpen(true)} size="sm" className="gap-1.5">
            <Plus className="h-4 w-4" />
            Create Route
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {routes.map((route) => (
            <RouteCard key={route.id} route={route} />
          ))}
        </div>
      )}

      <CreateRouteDialog
        open={createOpen}
        orgId={currentOrg?.id ?? ""}
        orgMembers={orgMembers}
        onOpenChange={setCreateOpen}
        onCreated={fetchRoutes}
      />
    </div>
  );
}
