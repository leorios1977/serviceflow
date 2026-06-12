"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, DollarSign, AlertCircle, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { useOrg } from "@/lib/org-context";

interface DashboardStats {
  todaysVisits: number;
  weeklyRevenue: number;
  overdueInvoices: number;
  routeCompletion: number;
}

export default function DashboardPage() {
  const { currentOrg, verticalConfig, loading: orgLoading } = useOrg();
  const [stats, setStats] = useState<DashboardStats>({
    todaysVisits: 0,
    weeklyRevenue: 0,
    overdueInvoices: 0,
    routeCompletion: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!currentOrg) return;

      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
        .toISOString()
        .split("T")[0];

      // Today's visits count
      const { count: todaysVisits } = await supabase
        .from("visits")
        .select("*", { count: "exact", head: true })
        .eq("org_id", currentOrg.id)
        .eq("scheduled_date", today);

      // Weekly revenue (sum of paid invoices this week)
      const { data: paidInvoices } = await supabase
        .from("invoices")
        .select("total")
        .eq("org_id", currentOrg.id)
        .eq("status", "paid")
        .gte("created_at", weekAgo);

      const weeklyRevenue =
        paidInvoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0;

      // Overdue invoices count
      const { count: overdueInvoices } = await supabase
        .from("invoices")
        .select("*", { count: "exact", head: true })
        .eq("org_id", currentOrg.id)
        .eq("status", "overdue");

      // Route completion % (completed visits / total visits today)
      const { count: completedToday } = await supabase
        .from("visits")
        .select("*", { count: "exact", head: true })
        .eq("org_id", currentOrg.id)
        .eq("scheduled_date", today)
        .eq("status", "completed");

      const totalToday = todaysVisits || 0;
      const routeCompletion =
        totalToday > 0
          ? Math.round(((completedToday || 0) / totalToday) * 100)
          : 0;

      setStats({
        todaysVisits: todaysVisits || 0,
        weeklyRevenue,
        overdueInvoices: overdueInvoices || 0,
        routeCompletion,
      });

      setLoading(false);
    }

    if (!orgLoading) {
      fetchStats();
    }
  }, [currentOrg, orgLoading]);

  if (orgLoading || loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground mt-1">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-1">
          {currentOrg
            ? `Welcome back to ${currentOrg.name}`
            : "Welcome to ServiceFlow"}
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Today&apos;s {verticalConfig?.servicePlural || "Visits"}
            </CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.todaysVisits}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Scheduled for today
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Weekly Revenue
            </CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              ${stats.weeklyRevenue.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Last 7 days
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Overdue Invoices
            </CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.overdueInvoices}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Require attention
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              Route Completion
            </CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.routeCompletion}%</div>
            <p className="text-xs text-muted-foreground mt-1">
              Today&apos;s progress
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Empty state */}
      {stats.todaysVisits === 0 && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Calendar className="h-6 w-6 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-medium">No visits scheduled</h3>
            <p className="text-sm text-muted-foreground mt-1 text-center max-w-sm">
              Start by adding customers and creating routes. Your daily{" "}
              {verticalConfig?.servicePlural.toLowerCase() || "visits"} will
              appear here.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
