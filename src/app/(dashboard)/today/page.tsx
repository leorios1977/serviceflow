"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/org-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { VisitStatus, Vertical } from "@/lib/database.types";
import {
  MapPin,
  Key,
  CheckCircle2,
  XCircle,
  Clock,
  Camera,
  Phone,
  ChevronDown,
  ChevronUp,
  Navigation,
} from "lucide-react";
import Link from "next/link";

// Types

interface ChecklistItem {
  id: string;
  label: string;
  done: boolean;
}

interface PhotoRecord {
  path: string;
  url: string;
  uploaded_at: string;
}

interface StopWithDetails {
  visit_id: string;
  position: number;
  status: VisitStatus;
  scheduled_date: string;
  checklist: ChecklistItem[];
  photos: PhotoRecord[];
  tech_notes: string | null;
  completed_at: string | null;
  check_in_time: string | null;
  skip_reason: string | null;
  customer_name: string;
  address: string;
  gate_code: string | null;
  frequency: string;
  price: number;
  property_id: string;
}

// Helpers

const FREQUENCY_LABELS: Record<string, string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

const SKIP_REASONS = [
  "Customer not home",
  "Access blocked",
  "Customer requested skip",
  "Weather conditions",
  "Equipment issue",
  "Other",
];

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function useElapsedTime(startIso: string | null): string {
  const [elapsed, setElapsed] = useState("");
  useEffect(() => {
    if (!startIso) { setElapsed(""); return; }
    function update() {
      const diff = Date.now() - new Date(startIso!).getTime();
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setElapsed(`${mins}m ${secs}s`);
    }
    update();
    const iv = setInterval(update, 1000);
    return () => clearInterval(iv);
  }, [startIso]);
  return elapsed;
}

function getDefaultChecklist(vertical: Vertical): ChecklistItem[] {
  const items: Record<Vertical, string[]> = {
    pool: ["Check water level","Test pH and chlorine","Skim surface debris","Brush walls and floor","Empty skimmer baskets","Check pump and filter","Add chemicals as needed","Record readings"],
    cleaning: ["Vacuum all floors","Mop hard floors","Clean bathrooms","Wipe kitchen surfaces","Clean appliances","Dust surfaces","Empty trash bins","Change linens if needed"],
    pest: ["Inspect perimeter","Check bait stations","Treat entry points","Spray interior if needed","Spray exterior perimeter","Document pest activity","Replenish bait stations"],
    painting: ["Prepare surfaces","Apply primer if needed","First coat applied","Second coat applied","Touch-up edges","Clean up area","Inspect final result"],
  };
  return (items[vertical] ?? []).map((label, i) => ({ id: `default-${i}`, label, done: false }));
}

// Progress Bar

function ProgressBar({ completed, total }: { completed: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((completed / total) * 100);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">{completed} of {total} stops completed</span>
        <span className="text-muted-foreground">{pct}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-muted overflow-hidden">
        <div className="h-full rounded-full bg-green-500 transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

// Stop Card

function StopCard({ stop, vertical, onUpdate }: {
  stop: StopWithDetails;
  vertical: Vertical;
  onUpdate: (visitId: string, updates: Partial<StopWithDetails>) => Promise<void>;
}) {
  const [expanded, setExpanded] = useState(stop.status === "in_progress" || stop.status === "scheduled");
  const [notes, setNotes] = useState(stop.tech_notes ?? "");
  const [checklist, setChecklist] = useState<ChecklistItem[]>(() =>
    stop.checklist && stop.checklist.length > 0 ? stop.checklist : getDefaultChecklist(vertical)
  );
  const [skipReason, setSkipReason] = useState("");
  const [showSkipConfirm, setShowSkipConfirm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState<PhotoRecord[]>(stop.photos ?? []);
  const [saving, setSaving] = useState(false);
  const [checkInTime, setCheckInTime] = useState<string | null>(stop.check_in_time);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const elapsed = useElapsedTime(stop.status === "in_progress" ? checkInTime : null);

  async function handleCheckIn() {
    setSaving(true);
    const now = new Date().toISOString();
    const supabase = createClient();
    const { error } = await supabase.from("visits").update({ status: "in_progress", checklist }).eq("id", stop.visit_id);
    if (error) { toast.error("Check-in failed"); } else {
      setCheckInTime(now);
      await onUpdate(stop.visit_id, { status: "in_progress", check_in_time: now, checklist });
      toast.success("Checked in!");
    }
    setSaving(false);
  }

  async function toggleChecklistItem(id: string) {
    const updated = checklist.map((item) => item.id === id ? { ...item, done: !item.done } : item);
    setChecklist(updated);
    const supabase = createClient();
    await supabase.from("visits").update({ checklist: updated }).eq("id", stop.visit_id);
  }

  async function saveNotes() {
    const supabase = createClient();
    await supabase.from("visits").update({ tech_notes: notes }).eq("id", stop.visit_id);
  }

  async function handlePhotoUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setUploading(true);
    const supabase = createClient();
    const newPhotos: PhotoRecord[] = [...photos];
    for (const file of Array.from(files)) {
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${stop.property_id}/${stop.visit_id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("visit-photos").upload(path, file, { upsert: true });
      if (uploadError) { toast.error(`Failed to upload ${file.name}`); continue; }
      const { data: urlData } = supabase.storage.from("visit-photos").getPublicUrl(path);
      newPhotos.push({ path, url: urlData.publicUrl, uploaded_at: new Date().toISOString() });
    }
    setPhotos(newPhotos);
    await supabase.from("visits").update({ photos: newPhotos }).eq("id", stop.visit_id);
    toast.success(`${newPhotos.length - photos.length} photo(s) uploaded`);
    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleComplete() {
    setSaving(true);
    const now = new Date().toISOString();
    const supabase = createClient();
    const { error } = await supabase.from("visits").update({ status: "completed", completed_at: now, checklist, tech_notes: notes, photos }).eq("id", stop.visit_id);
    if (error) { toast.error("Failed to complete visit"); } else {
      await onUpdate(stop.visit_id, { status: "completed", completed_at: now, checklist, tech_notes: notes, photos });
      toast.success("Visit completed!");
      setExpanded(false);
    }
    setSaving(false);
  }

  async function handleSkip() {
    if (!skipReason) { toast.error("Please select a skip reason"); return; }
    setSaving(true);
    const supabase = createClient();
    const noteVal = `SKIPPED: ${skipReason}${notes ? `\n${notes}` : ""}`;
    const { error } = await supabase.from("visits").update({ status: "skipped", tech_notes: noteVal }).eq("id", stop.visit_id);
    if (error) { toast.error("Failed to skip visit"); } else {
      await onUpdate(stop.visit_id, { status: "skipped", skip_reason: skipReason, tech_notes: noteVal });
      toast.success("Visit skipped");
      setShowSkipConfirm(false);
      setExpanded(false);
    }
    setSaving(false);
  }

  const isCompleted = stop.status === "completed";
  const isSkipped = stop.status === "skipped";
  const isInProgress = stop.status === "in_progress";
  const isScheduled = stop.status === "scheduled";

  if (isCompleted) {
    return (
      <div className="rounded-2xl border-2 border-green-200 bg-green-50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-green-500 text-white font-bold text-lg flex items-center justify-center">{stop.position}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">{stop.customer_name}</p>
            <p className="text-sm text-muted-foreground truncate">{stop.address}</p>
          </div>
          <div className="text-right shrink-0">
            <CheckCircle2 className="h-6 w-6 text-green-500 mx-auto" />
            {stop.completed_at && <p className="text-xs text-muted-foreground mt-0.5">{new Date(stop.completed_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</p>}
            {photos.length > 0 && <p className="text-xs text-muted-foreground">{photos.length} photo{photos.length !== 1 ? "s" : ""}</p>}
          </div>
        </div>
      </div>
    );
  }

  if (isSkipped) {
    return (
      <div className="rounded-2xl border-2 border-red-200 bg-red-50 p-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 w-10 h-10 rounded-full bg-red-400 text-white font-bold text-lg flex items-center justify-center">{stop.position}</div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">{stop.customer_name}</p>
            <p className="text-sm text-muted-foreground truncate">{stop.address}</p>
          </div>
          <div className="text-right shrink-0">
            <XCircle className="h-6 w-6 text-red-400 mx-auto" />
            <p className="text-xs text-muted-foreground mt-0.5">{stop.skip_reason ?? "Skipped"}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border-2 ${isInProgress ? "border-yellow-300 bg-yellow-50/50" : "border-border bg-card"} overflow-hidden`}>
      <div className="p-4 cursor-pointer" onClick={() => setExpanded((v) => !v)}>
        <div className="flex items-start gap-3">
          <div className={`flex-shrink-0 w-12 h-12 rounded-full font-bold text-xl flex items-center justify-center ${isInProgress ? "bg-yellow-400 text-white" : "bg-primary/10 text-primary"}`}>
            {stop.position}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-lg font-bold leading-tight">{stop.customer_name}</p>
            <a
              href={`https://maps.google.com/?q=${encodeURIComponent(stop.address)}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-primary underline-offset-2 hover:underline mt-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <Navigation className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{stop.address}</span>
            </a>
            {stop.gate_code && (
              <span className="inline-flex items-center gap-1 mt-1.5 rounded-full bg-destructive/10 text-destructive text-xs font-bold px-2.5 py-1 border border-destructive/20">
                <Key className="h-3 w-3" />
                Gate: {stop.gate_code}
              </span>
            )}
            <p className="text-sm text-muted-foreground mt-1">
              {FREQUENCY_LABELS[stop.frequency] ?? stop.frequency} · ${stop.price.toFixed(2)}
            </p>
          </div>
          <div className="shrink-0 text-muted-foreground">
            {expanded ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
          </div>
        </div>
        {isInProgress && elapsed && (
          <div className="flex items-center gap-1.5 mt-2 text-sm text-yellow-700 font-medium">
            <Clock className="h-4 w-4" />
            In progress · {elapsed}
          </div>
        )}
      </div>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          {isScheduled && (
            <Button size="lg" className="w-full h-14 text-base font-bold gap-2" onClick={handleCheckIn} disabled={saving}>
              <CheckCircle2 className="h-5 w-5" />
              {saving ? "Checking in…" : "Check In"}
            </Button>
          )}

          {isInProgress && (
            <>
              <div className="space-y-2">
                <p className="text-sm font-semibold">Checklist</p>
                <div className="space-y-2">
                  {checklist.map((item) => (
                    <button
                      key={item.id}
                      className={`w-full flex items-center gap-3 rounded-xl border-2 p-3 text-left transition-colors ${item.done ? "border-green-300 bg-green-50" : "border-border bg-background hover:bg-muted/50"}`}
                      onClick={() => toggleChecklistItem(item.id)}
                    >
                      <div className={`flex-shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center ${item.done ? "bg-green-500 border-green-500 text-white" : "border-muted-foreground"}`}>
                        {item.done && (
                          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </div>
                      <span className={`text-sm font-medium ${item.done ? "line-through text-muted-foreground" : "text-foreground"}`}>{item.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Photos</p>
                <input ref={fileInputRef} type="file" accept="image/*" multiple capture="environment" className="hidden" onChange={handlePhotoUpload} />
                <Button variant="outline" className="w-full h-12 gap-2 border-dashed" onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Camera className="h-5 w-5" />
                  {uploading ? "Uploading…" : "Take / Upload Photo"}
                </Button>
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((photo, i) => (
                      <div key={i} className="aspect-square rounded-lg overflow-hidden border bg-muted">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photo.url} alt={`Visit photo ${i + 1}`} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <p className="text-sm font-semibold">Notes</p>
                <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} onBlur={saveNotes} rows={3} placeholder="Add notes about this visit…" className="text-base" />
              </div>

              <Button size="lg" className="w-full h-14 text-base font-bold gap-2 bg-green-600 hover:bg-green-700 text-white" onClick={handleComplete} disabled={saving}>
                <CheckCircle2 className="h-5 w-5" />
                {saving ? "Saving…" : "Complete Visit"}
              </Button>

              {!showSkipConfirm ? (
                <Button variant="ghost" size="sm" className="w-full text-muted-foreground" onClick={() => setShowSkipConfirm(true)}>
                  Skip this stop
                </Button>
              ) : (
                <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 space-y-3">
                  <p className="text-sm font-medium text-destructive">Select a reason to skip</p>
                  <Select value={skipReason} onValueChange={setSkipReason}>
                    <SelectTrigger className="w-full"><SelectValue placeholder="Choose reason…" /></SelectTrigger>
                    <SelectContent>
                      {SKIP_REASONS.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setShowSkipConfirm(false); setSkipReason(""); }}>Cancel</Button>
                    <Button variant="destructive" size="sm" className="flex-1" onClick={handleSkip} disabled={!skipReason || saving}>Confirm Skip</Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

// Main Page

export default function TodayPage() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const [stops, setStops] = useState<StopWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasRoute, setHasRoute] = useState(false);

  const fetchTodayStops = useCallback(async () => {
    if (!currentOrg) return;
    setLoading(true);
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const todayIso = toISODate(new Date());
    const todayDow = new Date().getDay();

    const { data: routes } = await supabase
      .from("routes")
      .select("id, stop_order")
      .eq("org_id", currentOrg.id)
      .eq("assigned_user_id", user.id)
      .eq("day_of_week", todayDow);

    if (!routes || routes.length === 0) { setHasRoute(false); setLoading(false); return; }

    setHasRoute(true);
    const route = routes[0];
    const stopOrder = (route.stop_order ?? []) as Array<{ service_plan_id: string; position: number }>;

    if (stopOrder.length === 0) { setStops([]); setLoading(false); return; }

    const spIds = stopOrder.map((s) => s.service_plan_id);

    const { data: plans } = await supabase
      .from("service_plans")
      .select(`id, price, frequency, properties ( id, address, gate_code, customers ( name ) )`)
      .in("id", spIds);

    const { data: visits } = await supabase
      .from("visits")
      .select("*")
      .eq("org_id", currentOrg.id)
      .eq("route_id", route.id)
      .eq("scheduled_date", todayIso);

    const visitMap = new Map((visits ?? []).map((v) => [v.property_id, v]));
    const vertical = currentOrg.vertical as Vertical;

    const enriched: StopWithDetails[] = stopOrder.map((s, idx) => {
      const plan = plans?.find((p) => p.id === s.service_plan_id);
      const prop = plan?.properties as { id: string; address: string; gate_code: string | null; customers: { name: string } } | null;
      const visit = prop ? visitMap.get(prop.id) : null;

      let skipReason: string | null = null;
      if (visit?.tech_notes?.startsWith("SKIPPED: ")) {
        skipReason = visit.tech_notes.replace("SKIPPED: ", "").split("\n")[0];
      }

      const checklist = Array.isArray(visit?.checklist) && visit.checklist.length > 0
        ? (visit.checklist as ChecklistItem[])
        : getDefaultChecklist(vertical);

      return {
        visit_id: visit?.id ?? "",
        position: idx + 1,
        status: (visit?.status ?? "scheduled") as VisitStatus,
        scheduled_date: todayIso,
        checklist,
        photos: (visit?.photos ?? []) as PhotoRecord[],
        tech_notes: visit?.tech_notes ?? null,
        completed_at: visit?.completed_at ?? null,
        check_in_time: null,
        skip_reason: skipReason,
        customer_name: prop?.customers?.name ?? "Unknown",
        address: prop?.address ?? "—",
        gate_code: prop?.gate_code ?? null,
        frequency: plan?.frequency ?? "",
        price: Number(plan?.price ?? 0),
        property_id: prop?.id ?? "",
      };
    });

    setStops(enriched);
    setLoading(false);
  }, [currentOrg]);

  useEffect(() => {
    if (!orgLoading) fetchTodayStops();
  }, [orgLoading, fetchTodayStops]);

  async function handleStopUpdate(visitId: string, updates: Partial<StopWithDetails>) {
    setStops((prev) => prev.map((s) => (s.visit_id === visitId ? { ...s, ...updates } : s)));
  }

  const completedCount = stops.filter((s) => s.status === "completed").length;
  const vertical = (currentOrg?.vertical ?? "pool") as Vertical;

  if (loading || orgLoading) {
    return (
      <div className="space-y-4 pb-32">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full" />
        {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
    );
  }

  if (!hasRoute) {
    return (
      <div className="pb-32">
        <div className="space-y-1 mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
          <p className="text-muted-foreground text-sm">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
        </div>
        <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center space-y-3">
          <MapPin className="h-12 w-12 text-muted-foreground mx-auto" />
          <h2 className="text-lg font-semibold">No route assigned for today</h2>
          <p className="text-sm text-muted-foreground max-w-xs mx-auto">
            You don&apos;t have a route assigned for today. Ask your manager to assign you to a route, or visit Routes to set one up.
          </p>
          <Link href="/routes">
            <Button className="mt-2 gap-1.5"><MapPin className="h-4 w-4" />Go to Routes</Button>
          </Link>
        </div>
        <div className="fixed bottom-20 left-0 right-0 px-4 lg:bottom-4 lg:left-64 z-40">
          <a href="tel:+10000000000">
            <Button variant="outline" className="w-full h-12 gap-2 bg-card shadow-lg border-2">
              <Phone className="h-5 w-5" />Call Office
            </Button>
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-36">
      <div className="space-y-1 mb-4">
        <h1 className="text-2xl font-semibold tracking-tight">Today</h1>
        <p className="text-muted-foreground text-sm">{new Date().toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" })}</p>
      </div>

      {stops.length > 0 && (
        <div className="mb-5">
          <ProgressBar completed={completedCount} total={stops.length} />
        </div>
      )}

      {stops.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-10 text-center">
          <CheckCircle2 className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
          <p className="font-semibold">No stops on today&apos;s route</p>
          <p className="text-sm text-muted-foreground mt-1">Your route has no stops scheduled for today.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {stops.map((stop) => (
            <StopCard
              key={stop.visit_id || `stop-${stop.position}`}
              stop={stop}
              vertical={vertical}
              onUpdate={handleStopUpdate}
            />
          ))}
        </div>
      )}

      {stops.length > 0 && completedCount === stops.length && (
        <div className="mt-6 rounded-2xl bg-green-50 border-2 border-green-200 p-6 text-center">
          <CheckCircle2 className="h-12 w-12 text-green-500 mx-auto mb-2" />
          <h2 className="text-lg font-bold text-green-800">All done for today!</h2>
          <p className="text-sm text-green-700 mt-1">Great work — all {stops.length} stops completed.</p>
        </div>
      )}

      <div className="fixed bottom-20 left-0 right-0 px-4 lg:bottom-4 lg:left-64 z-40">
        <a href="tel:+10000000000">
          <Button variant="outline" className="w-full h-12 gap-2 bg-card shadow-lg border-2">
            <Phone className="h-5 w-5" />Call Office
          </Button>
        </a>
      </div>
    </div>
  );
}
