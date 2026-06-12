// Database types for ServiceFlow
// These mirror the Supabase schema defined in /supabase/migrations

export type Vertical = "pool" | "cleaning" | "pest" | "painting";
export type Plan = "solo" | "crew" | "pro";
export type OrgRole = "owner" | "admin" | "tech";
export type Frequency = "weekly" | "biweekly" | "monthly" | "quarterly";
export type VisitStatus = "scheduled" | "in_progress" | "completed" | "skipped";
export type InvoiceStatus = "draft" | "sent" | "paid" | "overdue";
export type MessageChannel = "sms" | "email";
export type MessageDirection = "inbound" | "outbound";
export type LeadSource = "missed_call" | "web" | "referral" | "manual";
export type LeadStatus = "new" | "contacted" | "quoted" | "won" | "lost";
export type QuoteStatus = "draft" | "sent" | "accepted" | "declined" | "expired";
export type ServicePlanStatus = "active" | "paused" | "cancelled";

export interface Org {
  id: string;
  name: string;
  vertical: Vertical;
  plan: Plan;
  branding: Record<string, unknown>;
  created_at: string;
}

export interface OrgMember {
  org_id: string;
  user_id: string;
  role: OrgRole;
  created_at: string;
}

export interface Customer {
  id: string;
  org_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  notes: string | null;
  source: string | null;
  created_at: string;
}

export interface Property {
  id: string;
  org_id: string;
  customer_id: string;
  address: string;
  lat: number | null;
  lng: number | null;
  gate_code: string | null;
  access_notes: string | null;
  vertical_data: Record<string, unknown>;
  created_at: string;
}

export interface ServicePlan {
  id: string;
  org_id: string;
  property_id: string;
  frequency: Frequency;
  day_of_week: number | null;
  price: number;
  status: ServicePlanStatus;
  created_at: string;
}

export interface Route {
  id: string;
  org_id: string;
  name: string;
  assigned_user_id: string | null;
  day_of_week: number | null;
  stop_order: unknown[];
  created_at: string;
}

export interface Visit {
  id: string;
  org_id: string;
  property_id: string;
  route_id: string | null;
  scheduled_date: string;
  status: VisitStatus;
  checklist: unknown[];
  photos: unknown[];
  tech_notes: string | null;
  completed_at: string | null;
  created_at: string;
}

export interface Quote {
  id: string;
  org_id: string;
  customer_id: string;
  line_items: unknown[];
  total: number;
  status: QuoteStatus;
  public_token: string;
  created_at: string;
}

export interface Invoice {
  id: string;
  org_id: string;
  customer_id: string;
  visit_id: string | null;
  line_items: unknown[];
  total: number;
  status: InvoiceStatus;
  due_date: string | null;
  stripe_payment_intent: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  org_id: string;
  customer_id: string;
  channel: MessageChannel;
  direction: MessageDirection;
  body: string;
  sent_at: string;
}

export interface Lead {
  id: string;
  org_id: string;
  name: string;
  phone: string | null;
  source: LeadSource;
  status: LeadStatus;
  notes: string | null;
  created_at: string;
}

export interface ActivityLog {
  id: string;
  org_id: string;
  actor: string | null;
  action: string;
  entity: string;
  entity_id: string | null;
  created_at: string;
}
