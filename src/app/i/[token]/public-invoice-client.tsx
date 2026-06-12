"use client";

import { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  PaymentElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Receipt, CheckCircle2, Clock, AlertCircle } from "lucide-react";

// Load Stripe with the publishable key (TEST mode)
const stripePromise = loadStripe(
  process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ?? "pk_test_placeholder"
);

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface PublicInvoice {
  id: string;
  status: string;
  total: number;
  line_items: unknown[];
  due_date: string | null;
  created_at: string;
  stripe_payment_intent: string | null;
  customer: { id: string; name: string; email: string | null; phone: string | null } | null;
  org: { id: string; name: string } | null;
}

interface PublicInvoiceClientProps {
  invoice: PublicInvoice;
}

function CheckoutForm({
  invoiceId,
  onSuccess,
}: {
  invoiceId: string;
  onSuccess: () => void;
}) {
  const stripe = useStripe();
  const elements = useElements();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setLoading(true);
    setError(null);

    const { error: submitError } = await elements.submit();
    if (submitError) {
      setError(submitError.message ?? "Payment failed");
      setLoading(false);
      return;
    }

    const returnUrl = `${window.location.origin}/i/${invoiceId}?paid=true`;

    const { error: confirmError } = await stripe.confirmPayment({
      elements,
      confirmParams: { return_url: returnUrl },
    });

    if (confirmError) {
      setError(confirmError.message ?? "Payment failed");
    } else {
      onSuccess();
    }
    setLoading(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <PaymentElement />
      {error && (
        <div className="flex items-center gap-2 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}
      <Button
        type="submit"
        size="lg"
        className="w-full"
        disabled={!stripe || loading}
      >
        {loading ? "Processing..." : "Pay Now"}
      </Button>
      <p className="text-xs text-center text-muted-foreground">
        Secured by Stripe · TEST MODE
      </p>
    </form>
  );
}

export function PublicInvoiceClient({ invoice: initialInvoice }: PublicInvoiceClientProps) {
  const [invoice, setInvoice] = useState(initialInvoice);
  const [clientSecret, setClientSecret] = useState<string | null>(null);
  const [loadingPayment, setLoadingPayment] = useState(false);
  const [paymentSuccess, setPaymentSuccess] = useState(false);

  const lineItems = (invoice.line_items ?? []) as LineItem[];
  const isPaid = invoice.status === "paid" || paymentSuccess;
  const isOverdue = invoice.status === "overdue";

  // Check for ?paid=true in URL (Stripe redirect)
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("paid") === "true") {
      setPaymentSuccess(true);
    }
  }, []);

  async function initializePayment() {
    setLoadingPayment(true);
    try {
      const res = await fetch("/api/invoices/create-payment-intent", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ invoiceId: invoice.id }),
      });
      const data = await res.json();
      if (data.clientSecret) {
        setClientSecret(data.clientSecret);
      }
    } catch {
      // Payment initialization failed
    }
    setLoadingPayment(false);
  }

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary mb-4">
            <Receipt className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{invoice.org?.name ?? "ServiceFlow"}</h1>
          <p className="text-muted-foreground mt-1">Invoice for {invoice.customer?.name}</p>
        </div>

        {/* Invoice card */}
        <div className="bg-background rounded-xl border shadow-sm overflow-hidden">
          {/* Status banner */}
          {(isPaid || isOverdue) && (
            <div
              className={`px-6 py-4 flex items-center gap-3 ${
                isPaid
                  ? "bg-green-50 border-b border-green-100"
                  : "bg-red-50 border-b border-red-100"
              }`}
            >
              {isPaid ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-green-800">Payment Received</p>
                    <p className="text-sm text-green-700">Thank you for your payment!</p>
                  </div>
                </>
              ) : (
                <>
                  <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-red-800">Payment Overdue</p>
                    <p className="text-sm text-red-700">
                      This invoice is past due. Please pay as soon as possible.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          <div className="px-6 py-6 space-y-6">
            {/* Meta */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Bill to</p>
                <p className="font-semibold">{invoice.customer?.name}</p>
                {invoice.customer?.email && (
                  <p className="text-sm text-muted-foreground">{invoice.customer.email}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Invoice date</p>
                <p className="font-medium">
                  {new Date(invoice.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                {invoice.due_date && (
                  <>
                    <p className="text-sm text-muted-foreground mt-1">Due date</p>
                    <p className="font-medium">
                      {new Date(invoice.due_date).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </p>
                  </>
                )}
                <Badge variant="secondary" className="mt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  {invoice.status.charAt(0).toUpperCase() + invoice.status.slice(1)}
                </Badge>
              </div>
            </div>

            {/* Line items */}
            <div>
              <div className="grid grid-cols-[1fr_60px_90px_90px] gap-2 text-xs font-medium text-muted-foreground uppercase tracking-wide pb-2 border-b">
                <span>Description</span>
                <span className="text-right">Qty</span>
                <span className="text-right">Price</span>
                <span className="text-right">Total</span>
              </div>
              <div className="divide-y">
                {lineItems.map((item, i) => (
                  <div
                    key={i}
                    className="grid grid-cols-[1fr_60px_90px_90px] gap-2 py-3 text-sm"
                  >
                    <span>{item.description}</span>
                    <span className="text-right text-muted-foreground">
                      {item.quantity}
                    </span>
                    <span className="text-right text-muted-foreground">
                      ${Number(item.unit_price).toFixed(2)}
                    </span>
                    <span className="text-right font-medium">
                      ${(item.quantity * item.unit_price).toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Total */}
            <div className="flex items-center justify-between pt-4 border-t">
              <span className="text-base font-semibold">Total Due</span>
              <span className="text-2xl font-bold">
                ${Number(invoice.total).toFixed(2)}
              </span>
            </div>

            {/* Payment section */}
            {!isPaid && (
              <div className="pt-2">
                {!clientSecret ? (
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={initializePayment}
                    disabled={loadingPayment}
                  >
                    {loadingPayment ? "Loading payment..." : "Pay Now"}
                  </Button>
                ) : (
                  <div className="border rounded-lg p-4">
                    <h3 className="font-medium mb-4">Enter payment details</h3>
                    <Elements
                      stripe={stripePromise}
                      options={{
                        clientSecret,
                        appearance: { theme: "stripe" },
                      }}
                    >
                      <CheckoutForm
                        invoiceId={invoice.id}
                        onSuccess={() => setPaymentSuccess(true)}
                      />
                    </Elements>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          Powered by ServiceFlow
        </p>
      </div>
    </div>
  );
}
