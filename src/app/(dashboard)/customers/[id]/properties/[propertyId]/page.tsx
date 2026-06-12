"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/org-context";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PropertyForm } from "@/components/properties/property-form";
import { ServicePlanCard } from "@/components/service-plans/service-plan-card";
import { ServicePlanDialog } from "@/components/service-plans/service-plan-dialog";
import type { Property, ServicePlan } from "@/lib/database.types";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";

export default function PropertyDetailPage() {
  const { id: customerId, propertyId } = useParams<{
    id: string;
    propertyId: string;
  }>();
  const router = useRouter();
  const { currentOrg, verticalConfig, loading: orgLoading } = useOrg();

  const isNew = propertyId === "new";

  const [property, setProperty] = useState<Property | null>(null);
  const [plans, setPlans] = useState<ServicePlan[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [deleting, setDeleting] = useState(false);
  const [planDialogOpen, setPlanDialogOpen] = useState(false);
  const [editPlan, setEditPlan] = useState<ServicePlan | null>(null);

  const fetchProperty = useCallback(async () => {
    if (!currentOrg || isNew) return;
    setLoading(true);
    const supabase = createClient();

    const { data, error } = await supabase
      .from("properties")
      .select("*")
      .eq("id", propertyId)
      .eq("org_id", currentOrg.id)
      .single();

    if (error || !data) {
      toast.error("Property not found");
      router.push(`/customers/${customerId}`);
      return;
    }
    setProperty(data as Property);

    const { data: plansData } = await supabase
      .from("service_plans")
      .select("*")
      .eq("property_id", propertyId)
      .eq("org_id", currentOrg.id)
      .order("created_at", { ascending: true });

    setPlans((plansData ?? []) as ServicePlan[]);
    setLoading(false);
  }, [currentOrg, propertyId, isNew, customerId, router]);

  useEffect(() => {
    if (!orgLoading) fetchProperty();
  }, [orgLoading, fetchProperty]);

  async function handleDelete() {
    if (!property) return;
    if (!confirm("Delete this property? All associated service plans and visits will also be deleted.")) return;
    setDeleting(true);
    const supabase = createClient();
    const { error } = await supabase
      .from("properties")
      .delete()
      .eq("id", property.id);
    if (error) {
      toast.error("Failed to delete property");
      setDeleting(false);
    } else {
      toast.success("Property deleted");
      router.push(`/customers/${customerId}`);
    }
  }

  if (orgLoading || loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Skeleton className="h-8 w-8 rounded-md" />
          <Skeleton className="h-8 w-48" />
        </div>
        <Skeleton className="h-64 rounded-lg" />
      </div>
    );
  }

  const entityLabel = verticalConfig?.entitySingular ?? "Property";

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => router.push(`/customers/${customerId}`)}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight">
            {isNew ? `New ${entityLabel}` : `Edit ${entityLabel}`}
          </h1>
        </div>
        {!isNew && property && (
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 text-destructive hover:text-destructive"
            onClick={handleDelete}
            disabled={deleting}
          >
            <Trash2 className="h-4 w-4" />
            Delete
          </Button>
        )}
      </div>

      {/* Property Form */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">{entityLabel} Information</CardTitle>
        </CardHeader>
        <CardContent>
          <PropertyForm
            orgId={currentOrg!.id}
            customerId={customerId}
            verticalConfig={verticalConfig}
            property={isNew ? null : property}
            onSaved={(saved) => {
              if (isNew) {
                router.push(`/customers/${customerId}/properties/${saved.id}`);
              } else {
                setProperty(saved);
                toast.success(`${entityLabel} saved`);
              }
            }}
            onCancel={() => router.push(`/customers/${customerId}`)}
          />
        </CardContent>
      </Card>

      {/* Service Plans (only on edit mode) */}
      {!isNew && property && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Service Plans</h2>
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5"
              onClick={() => {
                setEditPlan(null);
                setPlanDialogOpen(true);
              }}
            >
              <Plus className="h-4 w-4" />
              Add Plan
            </Button>
          </div>

          {plans.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-10 text-center">
              <p className="text-sm font-medium">No service plans yet</p>
              <p className="text-xs text-muted-foreground mt-1">
                Add a plan to start scheduling visits.
              </p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {plans.map((plan) => (
                <ServicePlanCard
                  key={plan.id}
                  plan={plan}
                  onEdit={() => {
                    setEditPlan(plan);
                    setPlanDialogOpen(true);
                  }}
                  onDeleted={() => fetchProperty()}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Service Plan Dialog */}
      {!isNew && property && (
        <ServicePlanDialog
          open={planDialogOpen}
          onOpenChange={setPlanDialogOpen}
          orgId={currentOrg!.id}
          propertyId={property.id}
          plan={editPlan}
          onSaved={() => {
            fetchProperty();
            setPlanDialogOpen(false);
          }}
        />
      )}
    </div>
  );
}
