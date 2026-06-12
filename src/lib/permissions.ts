import type { Plan } from "@/lib/database.types";

/**
 * Feature flags per plan.
 * solo: core field-service features
 * crew: all solo features + team management + leads
 * pro: all crew features + AI features + API access
 */
export type Feature =
  | "customers"
  | "properties"
  | "routes"
  | "visits"
  | "quotes"
  | "invoices"
  | "team_members"
  | "leads"
  | "ai_features"
  | "api_access";

const PLAN_FEATURES: Record<Plan, Feature[]> = {
  solo: [
    "customers",
    "properties",
    "routes",
    "visits",
    "quotes",
    "invoices",
  ],
  crew: [
    "customers",
    "properties",
    "routes",
    "visits",
    "quotes",
    "invoices",
    "team_members",
    "leads",
  ],
  pro: [
    "customers",
    "properties",
    "routes",
    "visits",
    "quotes",
    "invoices",
    "team_members",
    "leads",
    "ai_features",
    "api_access",
  ],
};

/**
 * Check if a given plan can use a specific feature.
 *
 * @param feature - The feature to check
 * @param plan - The org's current plan
 * @returns true if the plan includes the feature
 */
export function canUse(feature: Feature, plan: Plan): boolean {
  return PLAN_FEATURES[plan]?.includes(feature) ?? false;
}

/**
 * Get the minimum plan required for a feature.
 */
export function requiredPlan(feature: Feature): Plan | null {
  for (const plan of ["solo", "crew", "pro"] as Plan[]) {
    if (PLAN_FEATURES[plan].includes(feature)) {
      return plan;
    }
  }
  return null;
}

/**
 * Pro-only features that trigger a billing redirect in middleware.
 */
export const PRO_ONLY_FEATURES: Feature[] = ["ai_features", "api_access"];

/**
 * Crew-and-above features.
 */
export const CREW_FEATURES: Feature[] = ["team_members", "leads"];
