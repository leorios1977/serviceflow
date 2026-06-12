"use client";

import { useState } from "react";
import { toast } from "sonner";
import { useOrg } from "@/lib/org-context";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { STRIPE_PLANS } from "@/lib/stripe-plans";
import { cn } from "@/lib/utils";
import { CreditCard, ExternalLink, CheckCircle2 } from "lucide-react";

export default function BillingPage() {
  const { currentOrg, loading: orgLoading } = useOrg();
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  async function handleSelectPlan(plan: string) {
    if (!currentOrg) return;
    setUpgrading(plan);
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, orgId: currentOrg.id }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast.error(data.error ?? "Failed to start checkout");
      }
    } catch {
      toast.error("Failed to start checkout");
    }
    setUpgrading(null);
  }

  async function handleManageBilling() {
    if (!currentOrg) return;
    setOpeningPortal(true);
    try {
      const res = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orgId: currentOrg.id }),
      });
      const data = await res.json();
      if (data.url) {
        window.open(data.url, "_blank");
      } else {
        toast.error(data.error ?? "Failed to open billing portal");
      }
    } catch {
      toast.error("Failed to open billing portal");
    }
    setOpeningPortal(false);
  }

  if (orgLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-24 w-full" />
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64 w-full" />)}
        </div>
      </div>
    );
  }

  if (!currentOrg) return null;

  const currentPlan = STRIPE_PLANS.find((p) => p.plan === currentOrg.plan);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Billing</h1>
        <p className="text-muted-foreground mt-1 text-sm">
          Manage your subscription and billing details.
        </p>
      </div>

      {/* Current plan card */}
      <div className="rounded-xl border bg-card p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
              <CreditCard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Current Plan</p>
              <div className="flex items-center gap-2 mt-0.5">
                <h2 className="text-xl font-semibold">
                  {currentPlan?.name ?? currentOrg.plan}
                </h2>
                <Badge variant="secondary">Active</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                ${currentPlan?.priceMonthly ?? "—"}/month · TEST MODE
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleManageBilling}
              disabled={openingPortal}
              className="gap-1.5"
            >
              <ExternalLink className="h-4 w-4" />
              {openingPortal ? "Opening..." : "Manage Billing"}
            </Button>
          </div>
        </div>
      </div>

      {/* Plan picker */}
      <div>
        <h3 className="text-base font-semibold mb-4">Change Plan</h3>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {STRIPE_PLANS.map((plan) => {
            const isCurrent = plan.plan === currentOrg.plan;
            return (
              <div
                key={plan.plan}
                className={cn(
                  "relative rounded-xl border-2 p-5 flex flex-col transition-colors",
                  isCurrent
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50"
                )}
              >
                {isCurrent && (
                  <div className="absolute top-3 right-3">
                    <Badge className="text-xs">Current</Badge>
                  </div>
                )}
                <div className="mb-4">
                  <h4 className="font-semibold text-lg">{plan.name}</h4>
                  <div className="flex items-baseline gap-1 mt-1">
                    <span className="text-2xl font-bold">${plan.priceMonthly}</span>
                    <span className="text-muted-foreground text-sm">/mo</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-1">
                    {plan.description}
                  </p>
                </div>
                <ul className="space-y-2 flex-1 mb-5">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-center gap-2 text-sm">
                      <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
                      {feature}
                    </li>
                  ))}
                </ul>
                <Button
                  variant={isCurrent ? "outline" : "default"}
                  size="sm"
                  className="w-full"
                  disabled={isCurrent || upgrading === plan.plan}
                  onClick={() => handleSelectPlan(plan.plan)}
                >
                  {upgrading === plan.plan
                    ? "Redirecting..."
                    : isCurrent
                    ? "Current Plan"
                    : "Upgrade"}
                </Button>
              </div>
            );
          })}
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          All plans are in TEST MODE. Use Stripe test card 4242 4242 4242 4242.
        </p>
      </div>
    </div>
  );
}
