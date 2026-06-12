"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { VERTICALS, PLANS, type Vertical, type Plan } from "@/lib/verticals";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type Step = "org" | "vertical" | "plan";

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("org");
  const [orgName, setOrgName] = useState("");
  const [selectedVertical, setSelectedVertical] = useState<Vertical | null>(
    null
  );
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleComplete() {
    if (!orgName || !selectedVertical || !selectedPlan) return;

    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("You must be logged in to create an organization.");
        setLoading(false);
        return;
      }

      // Create the org
      const { data: org, error: orgError } = await supabase
        .from("orgs")
        .insert({
          name: orgName,
          vertical: selectedVertical,
          plan: selectedPlan,
        })
        .select()
        .single();

      if (orgError) {
        setError(orgError.message);
        setLoading(false);
        return;
      }

      // Add user as owner
      const { error: memberError } = await supabase
        .from("org_members")
        .insert({
          org_id: org.id,
          user_id: user.id,
          role: "owner",
        });

      if (memberError) {
        setError(memberError.message);
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Something went wrong. Please try again.");
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-12">
      <div className="w-full max-w-2xl">
        {/* Progress indicator */}
        <div className="mb-8 flex items-center justify-center gap-2">
          {(["org", "vertical", "plan"] as Step[]).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium",
                  step === s
                    ? "bg-primary text-primary-foreground"
                    : i <
                        ["org", "vertical", "plan"].indexOf(step)
                      ? "bg-primary/20 text-primary"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {i + 1}
              </div>
              {i < 2 && (
                <div
                  className={cn(
                    "h-0.5 w-12",
                    i < ["org", "vertical", "plan"].indexOf(step)
                      ? "bg-primary"
                      : "bg-muted"
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {error && (
          <div className="mb-4 rounded-md bg-destructive/10 p-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* Step 1: Organization Name */}
        {step === "org" && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                Name your business
              </CardTitle>
              <CardDescription>
                This is how your customers will see you
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="orgName">Business Name</Label>
                <Input
                  id="orgName"
                  placeholder="e.g. Crystal Clear Pools"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  autoFocus
                />
              </div>
              <Button
                className="w-full"
                onClick={() => setStep("vertical")}
                disabled={!orgName.trim()}
              >
                Continue
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Step 2: Vertical Selection */}
        {step === "vertical" && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">
                What type of service?
              </CardTitle>
              <CardDescription>
                This customizes your terminology and workflows
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {(Object.entries(VERTICALS) as [Vertical, typeof VERTICALS[Vertical]][]).map(
                  ([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedVertical(key)}
                      className={cn(
                        "flex flex-col items-start rounded-lg border-2 p-4 text-left transition-colors hover:border-primary/50",
                        selectedVertical === key
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      )}
                    >
                      <span className="text-2xl mb-2">{config.icon}</span>
                      <span className="font-medium">{config.label}</span>
                      <span className="text-sm text-muted-foreground">
                        {config.description}
                      </span>
                    </button>
                  )
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("org")}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setStep("plan")}
                  disabled={!selectedVertical}
                >
                  Continue
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Step 3: Plan Selection */}
        {step === "plan" && (
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-2xl">Choose your plan</CardTitle>
              <CardDescription>
                You can change this anytime. Start with a 14-day free trial.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                {(Object.entries(PLANS) as [Plan, typeof PLANS[Plan]][]).map(
                  ([key, config]) => (
                    <button
                      key={key}
                      onClick={() => setSelectedPlan(key)}
                      className={cn(
                        "flex flex-col items-start rounded-lg border-2 p-4 text-left transition-colors hover:border-primary/50",
                        selectedPlan === key
                          ? "border-primary bg-primary/5"
                          : "border-border"
                      )}
                    >
                      <span className="font-semibold text-lg">
                        {config.label}
                      </span>
                      <span className="text-2xl font-bold mt-1">
                        {config.price}
                      </span>
                      <span className="text-sm text-muted-foreground mt-1">
                        {config.description}
                      </span>
                      <ul className="mt-3 space-y-1">
                        {config.features.map((feature) => (
                          <li
                            key={feature}
                            className="text-xs text-muted-foreground flex items-center gap-1"
                          >
                            <span className="text-primary">&#10003;</span>
                            {feature}
                          </li>
                        ))}
                      </ul>
                    </button>
                  )
                )}
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setStep("vertical")}
                >
                  Back
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleComplete}
                  disabled={!selectedPlan || loading}
                >
                  {loading ? "Setting up..." : "Get Started"}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
