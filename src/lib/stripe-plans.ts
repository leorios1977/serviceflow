/**
 * Stripe plan configuration for ServiceFlow.
 * These are TEST mode product/price IDs.
 * On first run, call /api/stripe/setup-products to create them.
 */

export interface StripePlan {
  name: string;
  plan: "solo" | "crew" | "pro";
  priceMonthly: number; // in dollars
  description: string;
  features: string[];
  // These are populated after running the setup-products endpoint
  stripePriceId?: string;
}

export const STRIPE_PLANS: StripePlan[] = [
  {
    name: "Solo",
    plan: "solo",
    priceMonthly: 39,
    description: "For individual technicians",
    features: [
      "1 user",
      "Up to 50 customers",
      "Route optimization",
      "Quotes & invoicing",
    ],
    stripePriceId: process.env.STRIPE_PRICE_SOLO ?? "",
  },
  {
    name: "Crew",
    plan: "crew",
    priceMonthly: 79,
    description: "For small teams",
    features: [
      "Up to 5 users",
      "Unlimited customers",
      "Route optimization",
      "Quotes & invoicing",
      "Lead management",
    ],
    stripePriceId: process.env.STRIPE_PRICE_CREW ?? "",
  },
  {
    name: "Pro",
    plan: "pro",
    priceMonthly: 149,
    description: "For growing businesses",
    features: [
      "Unlimited users",
      "Unlimited customers",
      "Route optimization",
      "Quotes & invoicing",
      "Lead management",
      "AI features",
      "API access",
    ],
    stripePriceId: process.env.STRIPE_PRICE_PRO ?? "",
  },
];
