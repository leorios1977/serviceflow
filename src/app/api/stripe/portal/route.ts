import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2026-05-27.dahlia",
});

export async function POST(request: NextRequest) {
  try {
    const { orgId } = await request.json();

    if (!orgId) {
      return NextResponse.json({ error: "orgId is required" }, { status: 400 });
    }

    const supabase = await createClient();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the org's Stripe customer ID
    const { data: org } = await supabase
      .from("orgs")
      .select("id, name, branding")
      .eq("id", orgId)
      .single();

    if (!org) {
      return NextResponse.json({ error: "Org not found" }, { status: 404 });
    }

    // Try to get or create Stripe customer
    const branding = (org.branding ?? {}) as Record<string, string>;
    let stripeCustomerId = branding.stripe_customer_id;

    if (!stripeCustomerId) {
      // Create a Stripe customer for this org
      const customer = await stripe.customers.create({
        name: org.name,
        metadata: { org_id: orgId },
      });
      stripeCustomerId = customer.id;

      // Store the customer ID in org branding
      await supabase
        .from("orgs")
        .update({
          branding: { ...branding, stripe_customer_id: stripeCustomerId },
        })
        .eq("id", orgId);
    }

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: stripeCustomerId,
      return_url: `${appUrl}/settings/billing`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Portal failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
