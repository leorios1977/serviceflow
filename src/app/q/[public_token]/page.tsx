import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { PublicQuoteClient } from "./public-quote-client";

interface PageProps {
  params: Promise<{ public_token: string }>;
}

export default async function PublicQuotePage({ params }: PageProps) {
  const { public_token } = await params;
  const supabase = await createClient();

  const { data: quote, error } = await supabase
    .from("quotes")
    .select("*, customer:customers(id, name, email, phone), org:orgs(id, name)")
    .eq("public_token", public_token)
    .single();

  if (error || !quote) {
    notFound();
  }

  return <PublicQuoteClient quote={quote} />;
}
