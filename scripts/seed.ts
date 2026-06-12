/**
 * ServiceFlow Demo Seed Script
 *
 * Creates a complete demo organization with realistic data for a pool service company.
 * Uses the "pool" vertical from /lib/verticals.ts.
 *
 * Usage:
 *   SUPABASE_URL=xxx SUPABASE_SERVICE_ROLE_KEY=xxx npx ts-node --project tsconfig.scripts.json scripts/seed.ts
 *
 * Or with dotenv:
 *   npx ts-node --project tsconfig.scripts.json -r dotenv/config scripts/seed.ts
 *
 * WARNING: This script uses the service role key to bypass RLS.
 * NEVER expose the service role key in client-side code.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? process.env.SUPABASE_URL ?? "";
const SUPABASE_SERVICE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error(
    "❌  Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY env vars.\n" +
      "    Copy .env.local and add SUPABASE_SERVICE_ROLE_KEY."
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d.toISOString().split("T")[0];
}

function daysFromNow(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d.toISOString().split("T")[0];
}

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

async function insert<T extends Record<string, unknown>>(
  table: string,
  data: T
): Promise<T & { id: string }> {
  const { data: row, error } = await supabase
    .from(table)
    .insert(data)
    .select()
    .single();
  if (error) throw new Error(`Insert into ${table} failed: ${error.message}`);
  return row as T & { id: string };
}

// ─── Seed Data ────────────────────────────────────────────────────────────────

const DEMO_ORG_NAME = "Blue Wave Pool Service";

const CUSTOMERS = [
  { name: "Maria Garcia", email: "maria.garcia@example.com", phone: "555-0101", source: "referral", notes: "Prefers morning visits" },
  { name: "James Wilson", email: "james.wilson@example.com", phone: "555-0102", source: "google", notes: "Has 2 dogs, gate code required" },
  { name: "Sarah Chen", email: "sarah.chen@example.com", phone: "555-0103", source: "referral", notes: "" },
  { name: "Robert Johnson", email: "robert.j@example.com", phone: "555-0104", source: "google", notes: "Saltwater pool" },
  { name: "Emily Davis", email: "emily.d@example.com", phone: "555-0105", source: "manual", notes: "Calls to confirm every visit" },
  { name: "Michael Brown", email: "m.brown@example.com", phone: "555-0106", source: "referral", notes: "" },
  { name: "Lisa Martinez", email: "lisa.m@example.com", phone: "555-0107", source: "google", notes: "New construction pool" },
  { name: "David Thompson", email: "d.thompson@example.com", phone: "555-0108", source: "manual", notes: "Vacation home — call before visiting" },
];

const STREET_NAMES = [
  "Oak Lane", "Maple Drive", "Sunset Blvd", "Palm Court",
  "Harbor View", "Lakeside Ave", "Coral Way", "Bayshore Dr",
];

const TECH_NOTES = [
  "Cleaned filter, balanced chemicals. pH 7.4, chlorine 2.0 ppm.",
  "Vacuumed pool floor, brushed walls. Added algaecide.",
  "Backwashed filter. Water crystal clear.",
  "Found algae bloom on steps — treated with shock and algaecide.",
  "Replaced skimmer basket. All chemicals balanced.",
  "Checked equipment — pump running well. Added chlorine tabs.",
  "Cleaned waterline tile. pH slightly high, added acid.",
  "Emptied pump basket, cleaned filter cartridge.",
];

const QUOTE_ITEMS = [
  [
    { description: "Weekly Pool Maintenance (1 month)", quantity: 4, unit_price: 85 },
    { description: "Chemical Treatment Package", quantity: 1, unit_price: 45 },
  ],
  [
    { description: "Pool Opening Service", quantity: 1, unit_price: 250 },
    { description: "Chemical Startup Kit", quantity: 1, unit_price: 75 },
  ],
  [
    { description: "Filter Cartridge Replacement", quantity: 2, unit_price: 65 },
    { description: "Labor", quantity: 1, unit_price: 95 },
  ],
  [
    { description: "Monthly Pool Service", quantity: 1, unit_price: 175 },
    { description: "Algaecide Treatment", quantity: 1, unit_price: 55 },
  ],
];

const LEAD_NAMES = [
  "Tom Anderson", "Jennifer Lee", "Carlos Rivera", "Amanda White",
  "Kevin Park", "Nicole Adams",
];

const LEAD_SOURCES = ["google", "referral", "manual", "google", "referral"];
const LEAD_STATUSES = ["new", "contacted", "quoted", "won", "lost"];

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌊  ServiceFlow Demo Seed Script");
  console.log("────────────────────────────────");

  // 1. Create or find demo org
  console.log("\n1. Creating demo organization...");

  const { data: existingOrg } = await supabase
    .from("orgs")
    .select("id, name")
    .eq("name", DEMO_ORG_NAME)
    .single();

  let orgId: string;

  if (existingOrg) {
    console.log(`   ⚠️  Org "${DEMO_ORG_NAME}" already exists (id: ${existingOrg.id})`);
    console.log("   Skipping — delete the org first to re-seed.");
    orgId = existingOrg.id;
  } else {
    const org = await insert("orgs", {
      name: DEMO_ORG_NAME,
      vertical: "pool",
      plan: "crew",
      branding: {
        primary_color: "#0ea5e9",
        logo_url: null,
      },
    });
    orgId = org.id;
    console.log(`   ✅  Created org: ${org.name} (id: ${orgId})`);
  }

  // 2. Create customers
  console.log("\n2. Creating customers...");
  const customerIds: string[] = [];

  for (const customer of CUSTOMERS) {
    try {
      const row = await insert("customers", {
        org_id: orgId,
        name: customer.name,
        email: customer.email,
        phone: customer.phone,
        source: customer.source,
        notes: customer.notes,
      });
      customerIds.push(row.id);
      console.log(`   ✅  ${customer.name}`);
    } catch (err) {
      console.log(`   ⚠️  Skipped ${customer.name}: ${(err as Error).message}`);
    }
  }

  // 3. Create properties (one per customer)
  console.log("\n3. Creating properties...");
  const propertyIds: string[] = [];

  for (let i = 0; i < customerIds.length; i++) {
    const address = `${1000 + i * 7} ${STREET_NAMES[i % STREET_NAMES.length]}, Miami, FL 3310${i}`;
    const gateCode = i % 3 === 0 ? `#${1000 + i * 13}` : null;

    try {
      const row = await insert("properties", {
        org_id: orgId,
        customer_id: customerIds[i],
        address,
        gate_code: gateCode,
        metadata: {
          gallons: 15000 + i * 2000,
          equipment_type: randomItem(["sand_filter", "cartridge_filter", "saltwater"]),
          chemicals_used: "Chlorine, pH Minus",
        },
      });
      propertyIds.push(row.id);
      console.log(`   ✅  ${address}`);
    } catch (err) {
      console.log(`   ⚠️  Skipped property ${i}: ${(err as Error).message}`);
    }
  }

  // 4. Create a route
  console.log("\n4. Creating route...");
  let routeId: string | null = null;

  try {
    const route = await insert("routes", {
      org_id: orgId,
      name: "Monday Route",
      day_of_week: 1, // Monday
      stop_order: propertyIds.slice(0, 5).map((id, idx) => ({ property_id: id, order: idx })),
    });
    routeId = route.id;
    console.log(`   ✅  Monday Route (${propertyIds.slice(0, 5).length} stops)`);
  } catch (err) {
    console.log(`   ⚠️  Skipped route: ${(err as Error).message}`);
  }

  // 5. Create visits (past completed + upcoming scheduled)
  console.log("\n5. Creating visits...");
  const visitIds: string[] = [];

  const visitSchedule = [
    // Past completed visits
    { daysOffset: -21, status: "completed" },
    { daysOffset: -14, status: "completed" },
    { daysOffset: -7, status: "completed" },
    // Today / near future
    { daysOffset: 0, status: "scheduled" },
    { daysOffset: 7, status: "scheduled" },
    { daysOffset: 14, status: "scheduled" },
  ];

  for (let i = 0; i < Math.min(propertyIds.length, 5); i++) {
    for (const schedule of visitSchedule) {
      try {
        const visitData: Record<string, unknown> = {
          org_id: orgId,
          property_id: propertyIds[i],
          route_id: routeId,
          scheduled_date: schedule.daysOffset < 0
            ? daysAgo(Math.abs(schedule.daysOffset))
            : daysFromNow(schedule.daysOffset),
          status: schedule.status,
          checklist: [
            { task: "Check chemical levels", done: schedule.status === "completed" },
            { task: "Skim surface", done: schedule.status === "completed" },
            { task: "Brush walls", done: schedule.status === "completed" },
            { task: "Empty skimmer basket", done: schedule.status === "completed" },
          ],
          photos: [],
        };

        if (schedule.status === "completed") {
          visitData.tech_notes = randomItem(TECH_NOTES);
          visitData.completed_at = new Date(
            Date.now() + schedule.daysOffset * 24 * 60 * 60 * 1000
          ).toISOString();
        }

        const row = await insert("visits", visitData);
        visitIds.push(row.id);
      } catch (err) {
        console.log(`   ⚠️  Skipped visit: ${(err as Error).message}`);
      }
    }
  }
  console.log(`   ✅  Created ${visitIds.length} visits`);

  // 6. Create quotes
  console.log("\n6. Creating quotes...");
  const quoteStatuses = ["draft", "sent", "accepted", "declined", "sent", "accepted"];

  for (let i = 0; i < Math.min(customerIds.length, 6); i++) {
    const items = QUOTE_ITEMS[i % QUOTE_ITEMS.length];
    const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);

    try {
      await insert("quotes", {
        org_id: orgId,
        customer_id: customerIds[i],
        line_items: items,
        total,
        status: quoteStatuses[i],
      });
      console.log(`   ✅  Quote for ${CUSTOMERS[i].name} — $${total} (${quoteStatuses[i]})`);
    } catch (err) {
      console.log(`   ⚠️  Skipped quote ${i}: ${(err as Error).message}`);
    }
  }

  // 7. Create invoices
  console.log("\n7. Creating invoices...");
  const invoiceStatuses = ["paid", "sent", "paid", "overdue", "draft", "paid"];

  for (let i = 0; i < Math.min(customerIds.length, 6); i++) {
    const items = [
      { description: "Monthly Pool Service", quantity: 1, unit_price: 175 },
      { description: "Chemical Treatment", quantity: 1, unit_price: 45 },
    ];
    const total = items.reduce((sum, item) => sum + item.quantity * item.unit_price, 0);
    const status = invoiceStatuses[i];

    try {
      await insert("invoices", {
        org_id: orgId,
        customer_id: customerIds[i],
        visit_id: visitIds[i * 6] ?? null, // link to first completed visit
        line_items: items,
        total,
        status,
        due_date: status === "overdue" ? daysAgo(10) : daysFromNow(30),
      });
      console.log(`   ✅  Invoice for ${CUSTOMERS[i].name} — $${total} (${status})`);
    } catch (err) {
      console.log(`   ⚠️  Skipped invoice ${i}: ${(err as Error).message}`);
    }
  }

  // 8. Create leads
  console.log("\n8. Creating leads...");

  for (let i = 0; i < LEAD_NAMES.length; i++) {
    try {
      await insert("leads", {
        org_id: orgId,
        name: LEAD_NAMES[i],
        phone: `555-02${10 + i}`,
        source: LEAD_SOURCES[i % LEAD_SOURCES.length],
        status: LEAD_STATUSES[i % LEAD_STATUSES.length],
        notes: i % 2 === 0 ? "Interested in weekly service" : "Wants a quote first",
      });
      console.log(`   ✅  ${LEAD_NAMES[i]}`);
    } catch (err) {
      console.log(`   ⚠️  Skipped lead ${i}: ${(err as Error).message}`);
    }
  }

  // 9. Create service plans
  console.log("\n9. Creating service plans...");
  const frequencies = ["weekly", "biweekly", "monthly"];

  for (let i = 0; i < Math.min(propertyIds.length, 6); i++) {
    try {
      await insert("service_plans", {
        org_id: orgId,
        property_id: propertyIds[i],
        frequency: frequencies[i % frequencies.length],
        day_of_week: 1, // Monday
        price: i % 3 === 0 ? 85 : i % 3 === 1 ? 150 : 175,
        status: "active",
      });
      console.log(`   ✅  Service plan for property ${i + 1} (${frequencies[i % frequencies.length]})`);
    } catch (err) {
      console.log(`   ⚠️  Skipped service plan ${i}: ${(err as Error).message}`);
    }
  }

  // ─── Summary ──────────────────────────────────────────────────────────────
  console.log("\n────────────────────────────────");
  console.log("✅  Seed complete!");
  console.log(`\n   Org ID: ${orgId}`);
  console.log(`   Org Name: ${DEMO_ORG_NAME}`);
  console.log(`   Customers: ${customerIds.length}`);
  console.log(`   Properties: ${propertyIds.length}`);
  console.log(`   Visits: ${visitIds.length}`);
  console.log("\n   To log in as this org, create a user in Supabase Auth and");
  console.log("   insert a row into org_members with the org_id above.");
  console.log("\n   Example SQL:");
  console.log(`     INSERT INTO org_members (org_id, user_id, role)`);
  console.log(`     VALUES ('${orgId}', '<your-user-id>', 'owner');`);
}

main().catch((err) => {
  console.error("\n❌  Seed failed:", err);
  process.exit(1);
});
