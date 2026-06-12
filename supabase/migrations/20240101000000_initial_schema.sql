-- ServiceFlow Initial Schema Migration
-- Multi-tenant SaaS for route-based home service businesses

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- ENUMS
-- ============================================================================

CREATE TYPE vertical_type AS ENUM ('pool', 'cleaning', 'pest', 'painting');
CREATE TYPE plan_type AS ENUM ('solo', 'crew', 'pro');
CREATE TYPE org_role AS ENUM ('owner', 'admin', 'tech');
CREATE TYPE frequency_type AS ENUM ('weekly', 'biweekly', 'monthly', 'quarterly');
CREATE TYPE visit_status AS ENUM ('scheduled', 'in_progress', 'completed', 'skipped');
CREATE TYPE invoice_status AS ENUM ('draft', 'sent', 'paid', 'overdue');
CREATE TYPE message_channel AS ENUM ('sms', 'email');
CREATE TYPE message_direction AS ENUM ('inbound', 'outbound');
CREATE TYPE lead_source AS ENUM ('missed_call', 'web', 'referral', 'manual');
CREATE TYPE lead_status AS ENUM ('new', 'contacted', 'quoted', 'won', 'lost');
CREATE TYPE quote_status AS ENUM ('draft', 'sent', 'accepted', 'declined', 'expired');
CREATE TYPE service_plan_status AS ENUM ('active', 'paused', 'cancelled');

-- ============================================================================
-- TABLES
-- ============================================================================

-- Organizations
CREATE TABLE orgs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  vertical vertical_type NOT NULL,
  plan plan_type NOT NULL DEFAULT 'solo',
  branding JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Organization Members (join table between orgs and auth.users)
CREATE TABLE org_members (
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role org_role NOT NULL DEFAULT 'tech',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (org_id, user_id)
);

-- Customers
CREATE TABLE customers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  notes TEXT,
  source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Properties
CREATE TABLE properties (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  address TEXT NOT NULL,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  gate_code TEXT,
  access_notes TEXT,
  vertical_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Service Plans
CREATE TABLE service_plans (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  frequency frequency_type NOT NULL DEFAULT 'weekly',
  day_of_week INT CHECK (day_of_week >= 0 AND day_of_week <= 6),
  price NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status service_plan_status NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Routes
CREATE TABLE routes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  assigned_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  day_of_week INT CHECK (day_of_week >= 0 AND day_of_week <= 6),
  stop_order JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Visits
CREATE TABLE visits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  route_id UUID REFERENCES routes(id) ON DELETE SET NULL,
  scheduled_date DATE NOT NULL,
  status visit_status NOT NULL DEFAULT 'scheduled',
  checklist JSONB DEFAULT '[]',
  photos JSONB DEFAULT '[]',
  tech_notes TEXT,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Quotes
CREATE TABLE quotes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  line_items JSONB DEFAULT '[]',
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status quote_status NOT NULL DEFAULT 'draft',
  public_token UUID DEFAULT uuid_generate_v4(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  visit_id UUID REFERENCES visits(id) ON DELETE SET NULL,
  line_items JSONB DEFAULT '[]',
  total NUMERIC(10, 2) NOT NULL DEFAULT 0,
  status invoice_status NOT NULL DEFAULT 'draft',
  due_date DATE,
  stripe_payment_intent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Messages
CREATE TABLE messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  customer_id UUID NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  channel message_channel NOT NULL,
  direction message_direction NOT NULL,
  body TEXT NOT NULL,
  sent_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Leads
CREATE TABLE leads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT,
  source lead_source NOT NULL DEFAULT 'manual',
  status lead_status NOT NULL DEFAULT 'new',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Activity Log
CREATE TABLE activity_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  org_id UUID NOT NULL REFERENCES orgs(id) ON DELETE CASCADE,
  actor UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- INDEXES
-- ============================================================================

CREATE INDEX idx_org_members_user_id ON org_members(user_id);
CREATE INDEX idx_customers_org_id ON customers(org_id);
CREATE INDEX idx_properties_org_id ON properties(org_id);
CREATE INDEX idx_properties_customer_id ON properties(customer_id);
CREATE INDEX idx_service_plans_org_id ON service_plans(org_id);
CREATE INDEX idx_service_plans_property_id ON service_plans(property_id);
CREATE INDEX idx_routes_org_id ON routes(org_id);
CREATE INDEX idx_visits_org_id ON visits(org_id);
CREATE INDEX idx_visits_scheduled_date ON visits(scheduled_date);
CREATE INDEX idx_visits_route_id ON visits(route_id);
CREATE INDEX idx_quotes_org_id ON quotes(org_id);
CREATE INDEX idx_quotes_public_token ON quotes(public_token);
CREATE INDEX idx_invoices_org_id ON invoices(org_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_messages_org_id ON messages(org_id);
CREATE INDEX idx_messages_customer_id ON messages(customer_id);
CREATE INDEX idx_leads_org_id ON leads(org_id);
CREATE INDEX idx_activity_log_org_id ON activity_log(org_id);
CREATE INDEX idx_activity_log_entity ON activity_log(entity, entity_id);

-- ============================================================================
-- ROW LEVEL SECURITY
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE orgs ENABLE ROW LEVEL SECURITY;
ALTER TABLE org_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE properties ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;
ALTER TABLE quotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_log ENABLE ROW LEVEL SECURITY;

-- Helper function: check if current user belongs to an org
CREATE OR REPLACE FUNCTION auth.user_belongs_to_org(check_org_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM org_members
    WHERE org_members.org_id = check_org_id
      AND org_members.user_id = auth.uid()
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ============================================================================
-- RLS POLICIES
-- ============================================================================

-- ORGS: users can only see orgs they belong to
CREATE POLICY "Users can view their orgs"
  ON orgs FOR SELECT
  USING (auth.user_belongs_to_org(id));

CREATE POLICY "Users can update their orgs"
  ON orgs FOR UPDATE
  USING (auth.user_belongs_to_org(id));

CREATE POLICY "Authenticated users can create orgs"
  ON orgs FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ORG_MEMBERS: users can see members of orgs they belong to
CREATE POLICY "Users can view org members"
  ON org_members FOR SELECT
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can insert org members"
  ON org_members FOR INSERT
  WITH CHECK (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can delete org members"
  ON org_members FOR DELETE
  USING (auth.user_belongs_to_org(org_id));

-- CUSTOMERS
CREATE POLICY "Users can view customers in their orgs"
  ON customers FOR SELECT
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can insert customers in their orgs"
  ON customers FOR INSERT
  WITH CHECK (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can update customers in their orgs"
  ON customers FOR UPDATE
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can delete customers in their orgs"
  ON customers FOR DELETE
  USING (auth.user_belongs_to_org(org_id));

-- PROPERTIES
CREATE POLICY "Users can view properties in their orgs"
  ON properties FOR SELECT
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can insert properties in their orgs"
  ON properties FOR INSERT
  WITH CHECK (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can update properties in their orgs"
  ON properties FOR UPDATE
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can delete properties in their orgs"
  ON properties FOR DELETE
  USING (auth.user_belongs_to_org(org_id));

-- SERVICE_PLANS
CREATE POLICY "Users can view service plans in their orgs"
  ON service_plans FOR SELECT
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can insert service plans in their orgs"
  ON service_plans FOR INSERT
  WITH CHECK (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can update service plans in their orgs"
  ON service_plans FOR UPDATE
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can delete service plans in their orgs"
  ON service_plans FOR DELETE
  USING (auth.user_belongs_to_org(org_id));

-- ROUTES
CREATE POLICY "Users can view routes in their orgs"
  ON routes FOR SELECT
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can insert routes in their orgs"
  ON routes FOR INSERT
  WITH CHECK (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can update routes in their orgs"
  ON routes FOR UPDATE
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can delete routes in their orgs"
  ON routes FOR DELETE
  USING (auth.user_belongs_to_org(org_id));

-- VISITS
CREATE POLICY "Users can view visits in their orgs"
  ON visits FOR SELECT
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can insert visits in their orgs"
  ON visits FOR INSERT
  WITH CHECK (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can update visits in their orgs"
  ON visits FOR UPDATE
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can delete visits in their orgs"
  ON visits FOR DELETE
  USING (auth.user_belongs_to_org(org_id));

-- QUOTES
CREATE POLICY "Users can view quotes in their orgs"
  ON quotes FOR SELECT
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can insert quotes in their orgs"
  ON quotes FOR INSERT
  WITH CHECK (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can update quotes in their orgs"
  ON quotes FOR UPDATE
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can delete quotes in their orgs"
  ON quotes FOR DELETE
  USING (auth.user_belongs_to_org(org_id));

-- INVOICES
CREATE POLICY "Users can view invoices in their orgs"
  ON invoices FOR SELECT
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can insert invoices in their orgs"
  ON invoices FOR INSERT
  WITH CHECK (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can update invoices in their orgs"
  ON invoices FOR UPDATE
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can delete invoices in their orgs"
  ON invoices FOR DELETE
  USING (auth.user_belongs_to_org(org_id));

-- MESSAGES
CREATE POLICY "Users can view messages in their orgs"
  ON messages FOR SELECT
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can insert messages in their orgs"
  ON messages FOR INSERT
  WITH CHECK (auth.user_belongs_to_org(org_id));

-- LEADS
CREATE POLICY "Users can view leads in their orgs"
  ON leads FOR SELECT
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can insert leads in their orgs"
  ON leads FOR INSERT
  WITH CHECK (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can update leads in their orgs"
  ON leads FOR UPDATE
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can delete leads in their orgs"
  ON leads FOR DELETE
  USING (auth.user_belongs_to_org(org_id));

-- ACTIVITY_LOG
CREATE POLICY "Users can view activity log in their orgs"
  ON activity_log FOR SELECT
  USING (auth.user_belongs_to_org(org_id));

CREATE POLICY "Users can insert activity log in their orgs"
  ON activity_log FOR INSERT
  WITH CHECK (auth.user_belongs_to_org(org_id));
