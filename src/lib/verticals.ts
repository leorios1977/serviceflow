export type Vertical = "pool" | "cleaning" | "pest" | "painting";

export interface VerticalConfig {
  label: string;
  entityPlural: string;
  entitySingular: string;
  servicePlural: string;
  serviceSingular: string;
  icon: string;
  description: string;
}

export const VERTICALS: Record<Vertical, VerticalConfig> = {
  pool: {
    label: "Pool Service",
    entityPlural: "Pools",
    entitySingular: "Pool",
    servicePlural: "Cleanings",
    serviceSingular: "Cleaning",
    icon: "🏊",
    description: "Pool cleaning and maintenance",
  },
  cleaning: {
    label: "Home Cleaning",
    entityPlural: "Homes",
    entitySingular: "Home",
    servicePlural: "Cleans",
    serviceSingular: "Clean",
    icon: "🏠",
    description: "Residential cleaning services",
  },
  pest: {
    label: "Pest Control",
    entityPlural: "Accounts",
    entitySingular: "Account",
    servicePlural: "Treatments",
    serviceSingular: "Treatment",
    icon: "🐛",
    description: "Pest control and extermination",
  },
  painting: {
    label: "Painting",
    entityPlural: "Projects",
    entitySingular: "Project",
    servicePlural: "Jobs",
    serviceSingular: "Job",
    icon: "🎨",
    description: "Interior and exterior painting",
  },
};

export type Plan = "solo" | "crew" | "pro";

export interface PlanConfig {
  label: string;
  description: string;
  price: string;
  features: string[];
}

export const PLANS: Record<Plan, PlanConfig> = {
  solo: {
    label: "Solo",
    description: "For individual technicians",
    price: "$29/mo",
    features: [
      "1 user",
      "Up to 50 customers",
      "Route optimization",
      "Basic invoicing",
    ],
  },
  crew: {
    label: "Crew",
    description: "For small teams",
    price: "$79/mo",
    features: [
      "Up to 5 users",
      "Unlimited customers",
      "Route optimization",
      "Full invoicing & quotes",
      "Customer portal",
    ],
  },
  pro: {
    label: "Pro",
    description: "For growing businesses",
    price: "$149/mo",
    features: [
      "Unlimited users",
      "Unlimited customers",
      "Route optimization",
      "Full invoicing & quotes",
      "Customer portal",
      "Lead management",
      "SMS & email automation",
    ],
  },
};
