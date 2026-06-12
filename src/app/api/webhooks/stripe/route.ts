import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2026-05-27.dahlia",
});

const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET ?? "";

export async function POST(request: NextRequest) {
  const body = await request.text();
  const signature = request.headers.get("stripe-signature") ?? "";

  let event: Stripe.Event;

  try {
    if (webhookSecret) {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } else {
      // In development without a webhook secret, parse the body directly
      event = JSON.parse(body) as Stripe.Event;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook error";
    console.error("Stripe webhook error:", message);
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const supabase = await createClient();

  try {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        const invoiceId = paymentIntent.metadata?.invoice_id;

        if (invoiceId) {
          await supabase
            .from("invoices")
            .update({ status: "paid" })
            .eq("id", invoiceId);
        }
        break;
      }

      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.org_id;
        const planName = session.metadata?.plan;

        if (orgId && planName) {
          await supabase
            .from("orgs")
            .update({ plan: planName })
            .eq("id", orgId);
        }
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = (subscription.metadata as Record<string, string>)?.org_id;

        if (orgId) {
          await supabase
            .from("orgs")
            .update({ plan: "solo" })
            .eq("id", orgId);
        }
        break;
      }

      default:
        // Unhandled event type
        break;
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Webhook handler error";
    console.error("Webhook handler error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ received: true });
}
