"use client";

import { useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ServicePlan, Frequency, ServicePlanStatus } from "@/lib/database.types";

interface ServicePlanDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orgId: string;
  propertyId: string;
  plan?: ServicePlan | null;
  onSaved: () => void;
}

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "quarterly", label: "Quarterly" },
];

const DAY_OPTIONS = [
  { value: "0", label: "Sunday" },
  { value: "1", label: "Monday" },
  { value: "2", label: "Tuesday" },
  { value: "3", label: "Wednesday" },
  { value: "4", label: "Thursday" },
  { value: "5", label: "Friday" },
  { value: "6", label: "Saturday" },
];

const STATUS_OPTIONS: { value: ServicePlanStatus; label: string }[] = [
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
];

/**
 * Given a frequency, a day_of_week (0=Sun … 6=Sat), and a start date,
 * compute the next N scheduled dates.
 */
function generateScheduledDates(
  frequency: Frequency,
  dayOfWeek: number,
  count: number
): string[] {
  const dates: string[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Find the next occurrence of dayOfWeek on or after today
  let cursor = new Date(today);
  const diff = (dayOfWeek - cursor.getDay() + 7) % 7;
  cursor.setDate(cursor.getDate() + (diff === 0 ? 0 : diff));

  const intervalDays: Record<Frequency, number> = {
    weekly: 7,
    biweekly: 14,
    monthly: 30,
    quarterly: 91,
  };

  for (let i = 0; i < count; i++) {
    dates.push(cursor.toISOString().split("T")[0]);
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + intervalDays[frequency]);
  }

  return dates;
}

export function ServicePlanDialog({
  open,
  onOpenChange,
  orgId,
  propertyId,
  plan,
  onSaved,
}: ServicePlanDialogProps) {
  const isEdit = !!plan;
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<{
    frequency: Frequency;
    day_of_week: string;
    price: string;
    status: ServicePlanStatus;
  }>({
    frequency: plan?.frequency ?? "weekly",
    day_of_week: plan?.day_of_week?.toString() ?? "1",
    price: plan?.price?.toString() ?? "",
    status: plan?.status ?? "active",
  });

  const handleOpenChange = (val: boolean) => {
    if (val) {
      setForm({
        frequency: plan?.frequency ?? "weekly",
        day_of_week: plan?.day_of_week?.toString() ?? "1",
        price: plan?.price?.toString() ?? "",
        status: plan?.status ?? "active",
      });
    }
    onOpenChange(val);
  };

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.price || isNaN(parseFloat(form.price))) {
      toast.error("Price is required");
      return;
    }

    setSaving(true);
    const supabase = createClient();

    const payload = {
      frequency: form.frequency,
      day_of_week: form.day_of_week ? parseInt(form.day_of_week) : null,
      price: parseFloat(form.price),
      status: form.status,
    };

    try {
      let savedPlanId: string;
      const wasActive = plan?.status === "active";
      const isNowActive = form.status === "active";

      if (isEdit && plan) {
        const { data, error } = await supabase
          .from("service_plans")
          .update(payload)
          .eq("id", plan.id)
          .select()
          .single();
        if (error) throw error;
        savedPlanId = data.id;
        toast.success("Service plan updated");
      } else {
        const { data, error } = await supabase
          .from("service_plans")
          .insert({ ...payload, org_id: orgId, property_id: propertyId })
          .select()
          .single();
        if (error) throw error;
        savedPlanId = data.id;
        toast.success("Service plan created");
      }

      // Auto-generate next 4 visits when plan is activated (new or status change to active)
      const shouldGenerateVisits = !wasActive && isNowActive;
      if (shouldGenerateVisits && form.day_of_week) {
        const dayOfWeek = parseInt(form.day_of_week);
        const dates = generateScheduledDates(form.frequency, dayOfWeek, 4);

        const visitRows = dates.map((date) => ({
          org_id: orgId,
          property_id: propertyId,
          scheduled_date: date,
          status: "scheduled" as const,
          checklist: [],
          photos: [],
        }));

        const { error: visitsError } = await supabase
          .from("visits")
          .insert(visitRows);

        if (visitsError) {
          toast.warning("Plan saved, but failed to generate visits");
        } else {
          toast.success(`Generated ${dates.length} upcoming visits`);
        }
      }

      void savedPlanId;
      onSaved();
      onOpenChange(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Something went wrong";
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isEdit ? "Edit Service Plan" : "New Service Plan"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="frequency">Frequency *</Label>
            <Select
              value={form.frequency}
              onValueChange={(val) =>
                setForm({ ...form, frequency: (val as Frequency) ?? "weekly" })
              }
            >
              <SelectTrigger id="frequency" className="w-full">
                <SelectValue placeholder="Select frequency" />
              </SelectTrigger>
              <SelectContent>
                {FREQUENCY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="day_of_week">Day of Week</Label>
            <Select
              value={form.day_of_week}
              onValueChange={(val) =>
                setForm({ ...form, day_of_week: (val as string) ?? "1" })
              }
            >
              <SelectTrigger id="day_of_week" className="w-full">
                <SelectValue placeholder="Select day" />
              </SelectTrigger>
              <SelectContent>
                {DAY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">Price per Visit ($) *</Label>
            <Input
              id="price"
              type="number"
              step="0.01"
              min="0"
              value={form.price}
              onChange={(e) => setForm({ ...form, price: e.target.value })}
              placeholder="e.g. 150.00"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">Status</Label>
            <Select
              value={form.status}
              onValueChange={(val) =>
                setForm({ ...form, status: (val as ServicePlanStatus) ?? "active" })
              }
            >
              <SelectTrigger id="status" className="w-full">
                <SelectValue placeholder="Select status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {form.status === "active" && !isEdit && (
              <p className="text-xs text-muted-foreground">
                Activating will auto-generate the next 4 scheduled visits.
              </p>
            )}
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
              {saving
                ? "Saving..."
                : isEdit
                ? "Save Changes"
                : "Create Plan"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
