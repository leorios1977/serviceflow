"use client";

import { useState } from "react";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { ServicePlan } from "@/lib/database.types";
import { Pencil, Trash2, Play, Pause } from "lucide-react";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

const FREQ_LABELS: Record<ServicePlan["frequency"], string> = {
  weekly: "Weekly",
  biweekly: "Bi-weekly",
  monthly: "Monthly",
  quarterly: "Quarterly",
};

interface ServicePlanCardProps {
  plan: ServicePlan;
  onEdit: () => void;
  onDeleted: () => void;
}

export function ServicePlanCard({ plan, onEdit, onDeleted }: ServicePlanCardProps) {
  const [toggling, setToggling] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function toggleStatus() {
    setToggling(true);
    const supabase = createClient();
    const newStatus = plan.status === "active" ? "paused" : "active";
    const { error } = await supabase
      .from("service_plans")
      .update({ status: newStatus })
      .eq("id", plan.id);
    if (error) {
      toast.error("Failed to update plan status");
    } else {
      toast.success(`Plan ${newStatus === "active" ? "activated" : "paused"}`);
      onDeleted(); // refresh parent
    }
    setToggling(false);
  }

  async function handleDelete() {
    if (!confirm("Delete this service plan? Future visits will not be removed.")) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("service_plans")
      .delete()
      .eq("id", plan.id);
    if (error) {
      toast.error("Failed to delete plan");
      setDeleting(false);
    } else {
      toast.success("Plan deleted");
      onDeleted();
    }
  }

  const statusVariant =
    plan.status === "active"
      ? "outline"
      : plan.status === "paused"
      ? "secondary"
      : "destructive";

  return (
    <Card>
      <CardContent className="pt-4 pb-4">
        <div className="flex items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold">
                {FREQ_LABELS[plan.frequency]}
              </span>
              <Badge
                variant={statusVariant}
                className={`text-xs capitalize ${
                  plan.status === "active"
                    ? "text-green-600 border-green-200 bg-green-50"
                    : ""
                }`}
              >
                {plan.status}
              </Badge>
            </div>
            {plan.day_of_week !== null && (
              <p className="text-xs text-muted-foreground">
                Every {DAY_NAMES[plan.day_of_week]}
              </p>
            )}
            <p className="text-sm font-medium">${Number(plan.price).toFixed(2)} / visit</p>
          </div>

          <div className="flex items-center gap-1 flex-shrink-0">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={toggleStatus}
              disabled={toggling || plan.status === "cancelled"}
              title={plan.status === "active" ? "Pause plan" : "Activate plan"}
            >
              {plan.status === "active" ? (
                <Pause className="h-3.5 w-3.5" />
              ) : (
                <Play className="h-3.5 w-3.5" />
              )}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={onEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={deleting}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
