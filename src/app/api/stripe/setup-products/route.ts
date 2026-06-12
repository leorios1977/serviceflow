import { NextResponse } from "next/server";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2026-05-27.dahlia",
});

const PLANS = [
  { name: "ServiceFlow Solo", plan: "solo", amount: 3900 },
  { name: "ServiceFlow Crew", plan: "crew", amount: 7900 },
  { name: "ServiceFlow Pro", plan: "pro", amount: 14900 },
];

/**
 * POST /api/stripe/setup-products
 * Creates Stripe products and prices for all three plans.
 * Run once on initial setup. Returns the price IDs to add to .env.
 */
export async function POST() {
  try {
    const results: Record<string, string> = {};

    for (const plan of PLANS) {
      // Check if product already exists
      const existingProducts = await stripe.products.search({
        query: `name:"${plan.name}"`,
        limit: 1,
      });

      let product: Stripe.Product;
      if (existingProducts.data.length > 0) {
        product = existingProducts.data[0];
      } else {
        product = await stripe.products.create({
          name: plan.name,
          metadata: { plan: plan.plan },
        });
      }

      // Check for existing active price
      const existingPrices = await stripe.prices.list({
        product: product.id,
        active: true,
        type: "recurring",
        limit: 1,
      });

      let price: Stripe.Price;
      if (existingPrices.data.length > 0) {
        price = existingPrices.data[0];
      } else {
        price = await stripe.prices.create({
          product: product.id,
          unit_amount: plan.amount,
          currency: "usd",
          recurring: { interval: "month" },
          metadata: { plan: plan.plan },
        });
      }

      results[`STRIPE_PRICE_${plan.plan.toUpperCase()}`] = price.id;
    }

    return NextResponse.json({
      success: true,
      message: "Add these to your .env.local file:",
      env_vars: results,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Setup failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
