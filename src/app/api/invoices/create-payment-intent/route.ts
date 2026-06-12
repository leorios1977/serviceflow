import { NextRequest, NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@/lib/supabase/server";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY ?? "sk_test_placeholder", {
  apiVersion: "2026-05-27.dahlia",
});

export async function POST(request: NextRequest) {
  try {
    const { invoiceId } = await request.json();

    if (!invoiceId) {
      return NextResponse.json({ error: "Invoice ID required" }, { status: 400 });
    }

    const supabase = await createClient();

    // Fetch invoice (public access — no auth required for payment)
    const { data: invoice, error } = await supabase
      .from("invoices")
      .select("id, total, status, stripe_payment_intent, org_id, customer_id")
      .eq("id", invoiceId)
      .single();

    if (error || !invoice) {
      return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
    }

    if (invoice.status === "paid") {
      return NextResponse.json({ error: "Invoice already paid" }, { status: 400 });
    }

    // Reuse existing payment intent if available
    if (invoice.stripe_payment_intent) {
      const existing = await stripe.paymentIntents.retrieve(
        invoice.stripe_payment_intent
      );
      if (existing.status !== "canceled") {
        return NextResponse.json({ clientSecret: existing.client_secret });
      }
    }

    // Create new payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(invoice.total) * 100), // cents
      currency: "usd",
      metadata: {
        invoice_id: invoiceId,
        org_id: invoice.org_id,
      },
    });

    // Store payment intent ID on invoice
    await supabase
      .from("invoices")
      .update({ stripe_payment_intent: paymentIntent.id })
      .eq("id", invoiceId);

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
