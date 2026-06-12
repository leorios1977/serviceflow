export type Vertical = "pool" | "cleaning" | "pest" | "painting";

export interface VerticalConfig {
  label: string;
  entityPlural: string;
  entitySingular: string;
  servicePlural: string;
  serviceSingular: string;
  icon: string;
  description: string;
  propertyFields: VerticalPropertyField[];
}

export interface VerticalPropertyField {
  key: string;
  label: string;
  type: "text" | "number" | "select" | "boolean";
  placeholder?: string;
  options?: { value: string; label: string }[];
  unit?: string;
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
    propertyFields: [
      {
        key: "gallons",
        label: "Pool Gallons",
        type: "number",
        placeholder: "e.g. 15000",
        unit: "gal",
      },
      {
        key: "equipment_type",
        label: "Equipment Type",
        type: "select",
        options: [
          { value: "sand_filter", label: "Sand Filter" },
          { value: "cartridge_filter", label: "Cartridge Filter" },
          { value: "de_filter", label: "DE Filter" },
          { value: "saltwater", label: "Saltwater System" },
          { value: "other", label: "Other" },
        ],
      },
      {
        key: "chemicals_used",
        label: "Chemicals Used",
        type: "text",
        placeholder: "e.g. Chlorine, Algaecide",
      },
    ],
  },
  cleaning: {
    label: "Home Cleaning",
    entityPlural: "Homes",
    entitySingular: "Home",
    servicePlural: "Cleans",
    serviceSingular: "Clean",
    icon: "🏠",
    description: "Residential cleaning services",
    propertyFields: [
      {
        key: "sqft",
        label: "Square Footage",
        type: "number",
        placeholder: "e.g. 1800",
        unit: "sq ft",
      },
      {
        key: "bedrooms",
        label: "Bedrooms",
        type: "number",
        placeholder: "e.g. 3",
      },
      {
        key: "bathrooms",
        label: "Bathrooms",
        type: "number",
        placeholder: "e.g. 2",
      },
      {
        key: "has_pets",
        label: "Has Pets",
        type: "boolean",
      },
    ],
  },
  pest: {
    label: "Pest Control",
    entityPlural: "Accounts",
    entitySingular: "Account",
    servicePlural: "Treatments",
    serviceSingular: "Treatment",
    icon: "🐛",
    description: "Pest control and extermination",
    propertyFields: [
      {
        key: "target_pests",
        label: "Target Pests",
        type: "text",
        placeholder: "e.g. Ants, Roaches, Termites",
      },
      {
        key: "contract_type",
        label: "Contract Type",
        type: "select",
        options: [
          { value: "monthly", label: "Monthly" },
          { value: "quarterly", label: "Quarterly" },
          { value: "annual", label: "Annual" },
          { value: "one_time", label: "One-Time" },
        ],
      },
    ],
  },
  painting: {
    label: "Painting",
    entityPlural: "Projects",
    entitySingular: "Project",
    servicePlural: "Jobs",
    serviceSingular: "Job",
    icon: "🎨",
    description: "Interior and exterior painting",
    propertyFields: [
      {
        key: "sqft",
        label: "Square Footage",
        type: "number",
        placeholder: "e.g. 2000",
        unit: "sq ft",
      },
      {
        key: "paint_type",
        label: "Paint Type",
        type: "select",
        options: [
          { value: "interior", label: "Interior" },
          { value: "exterior", label: "Exterior" },
          { value: "both", label: "Both" },
        ],
      },
    ],
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
