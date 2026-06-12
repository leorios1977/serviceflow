"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, XCircle, Clock, FileText } from "lucide-react";

interface LineItem {
  description: string;
  quantity: number;
  unit_price: number;
}

interface PublicQuote {
  id: string;
  public_token: string;
  status: string;
  total: number;
  line_items: unknown[];
  created_at: string;
  customer: { id: string; name: string; email: string | null; phone: string | null } | null;
  org: { id: string; name: string } | null;
}

interface PublicQuoteClientProps {
  quote: PublicQuote;
}

export function PublicQuoteClient({ quote: initialQuote }: PublicQuoteClientProps) {
  const [quote, setQuote] = useState(initialQuote);
  const [loading, setLoading] = useState<"accept" | "decline" | null>(null);

  const lineItems = (quote.line_items ?? []) as LineItem[];
  const isActioned = quote.status === "accepted" || quote.status === "declined";

  async function handleAction(action: "accept" | "decline") {
    setLoading(action);
    const supabase = createClient();
    const newStatus = action === "accept" ? "accepted" : "declined";

    const { data, error } = await supabase
      .from("quotes")
      .update({ status: newStatus })
      .eq("public_token", quote.public_token)
      .select()
      .single();

    if (!error && data) {
      setQuote((prev) => ({ ...prev, status: newStatus }));
    }
    setLoading(null);
  }

  return (
    <div className="min-h-screen bg-muted/30 py-12 px-4">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary mb-4">
            <FileText className="h-6 w-6 text-primary-foreground" />
          </div>
          <h1 className="text-2xl font-bold">{quote.org?.name ?? "ServiceFlow"}</h1>
          <p className="text-muted-foreground mt-1">Quote for {quote.customer?.name}</p>
        </div>

        {/* Quote card */}
        <div className="bg-background rounded-xl border shadow-sm overflow-hidden">
          {/* Status banner */}
          {isActioned && (
            <div
              className={`px-6 py-4 flex items-center gap-3 ${
                quote.status === "accepted"
                  ? "bg-green-50 border-b border-green-100"
                  : "bg-red-50 border-b border-red-100"
              }`}
            >
              {quote.status === "accepted" ? (
                <>
                  <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-green-800">Quote Accepted</p>
                    <p className="text-sm text-green-700">
                      Thank you! We&apos;ll be in touch shortly.
                    </p>
                  </div>
                </>
              ) : (
                <>
                  <XCircle className="h-5 w-5 text-red-600 shrink-0" />
                  <div>
                    <p className="font-semibold text-red-800">Quote Declined</p>
                    <p className="text-sm text-red-700">
                      This quote has been declined.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Quote details */}
          <div className="px-6 py-6 space-y-6">
            {/* Meta */}
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Prepared for</p>
                <p className="font-semibold">{quote.customer?.name}</p>
                {quote.customer?.email && (
                  <p className="text-sm text-muted-foreground">{quote.customer.email}</p>
                )}
              </div>
              <div className="text-right">
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">
                  {new Date(quote.created_at).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
                <Badge variant="secondary" className="mt-1">
                  <Clock className="h-3 w-3 mr-1" />
                  {quote.status.charAt(0).toUpperCase() + quote.status.slice(1)}
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
              <span className="text-base font-semibold">Total</span>
              <span className="text-2xl font-bold">
                ${Number(quote.total).toFixed(2)}
              </span>
            </div>

            {/* Action buttons */}
            {!isActioned && (
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <Button
                  size="lg"
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white gap-2"
                  onClick={() => handleAction("accept")}
                  disabled={loading !== null}
                >
                  <CheckCircle2 className="h-5 w-5" />
                  {loading === "accept" ? "Processing..." : "Accept Quote"}
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="flex-1 text-destructive border-destructive hover:bg-destructive/5 gap-2"
                  onClick={() => handleAction("decline")}
                  disabled={loading !== null}
                >
                  <XCircle className="h-5 w-5" />
                  {loading === "decline" ? "Processing..." : "Decline"}
                </Button>
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
