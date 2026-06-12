import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PublicInvoiceClient } from "./public-invoice-client";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PublicInvoicePage({ params }: PageProps) {
  const { token } = await params;
  const supabase = await createClient();

  const { data: invoice, error } = await supabase
    .from("invoices")
    .select("*, customer:customers(id, name, email, phone), org:orgs(id, name)")
    .eq("id", token)
    .single();

  if (error || !invoice) {
    notFound();
  }

  return <PublicInvoiceClient invoice={invoice} />;
}
