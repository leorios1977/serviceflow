# Architecture Decisions Log

This document records every significant architectural and implementation decision made during the ServiceFlow foundation build.

---

## 1. Next.js 14+ App Router with Route Groups

**Decision:** Use Next.js App Router with three route groups: `(auth)`, `(dashboard)`, `(marketing)`.

**Rationale:** Route groups allow co-located layouts without affecting URL structure. The auth group gets a centered card layout, the dashboard group gets the full app shell (sidebar + topbar), and marketing gets a standalone layout. This keeps concerns cleanly separated.

---

## 2. Supabase for Backend (Postgres + Auth + RLS)

**Decision:** Use Supabase as the sole backend, relying on its Postgres database, built-in Auth, and Row Level Security for multi-tenancy.

**Rationale:** Supabase provides a complete backend with minimal setup. RLS eliminates the need for a custom API layer to enforce tenant isolation — the database itself enforces that users can only see data for orgs they belong to. This is more secure than application-level checks.

---

## 3. Multi-Tenant via org_members Join Table

**Decision:** Implement multi-tenancy through an `org_members` table that links `auth.users` to `orgs`, with a helper function `auth.user_belongs_to_org()` used in all RLS policies.

**Rationale:** This allows users to belong to multiple organizations (common for franchise owners or consultants). The helper function keeps RLS policies DRY and performant (marked as `SECURITY DEFINER STABLE`).

---

## 4. Vertical Terminology Config Map

**Decision:** Store vertical-specific terminology in `/lib/verticals.ts` as a static config map. Components never hardcode vertical words — they read from the config.

**Rationale:** This makes it trivial to add new verticals later and ensures consistent terminology throughout the app. The config is imported at build time with zero runtime cost.

---

## 5. Client-Side Org Context Provider

**Decision:** Use a React context (`OrgProvider`) for managing the current organization state on the client side, with localStorage persistence for the selected org.

**Rationale:** The org context needs to be available across all dashboard pages and components. Using React context with localStorage persistence means the user's org selection survives page refreshes without an extra server round-trip.

---

## 6. shadcn/ui for Component Library

**Decision:** Use shadcn/ui (copy-paste components) rather than a packaged component library.

**Rationale:** shadcn/ui gives full ownership of component code, making customization straightforward. It's built on Radix UI primitives for accessibility and uses Tailwind for styling consistency. No version lock-in or breaking changes from upstream.

---

## 7. Mobile-First with Bottom Tab Navigation

**Decision:** Implement a mobile bottom tab nav (5 key items) alongside the desktop sidebar (8 items). The mobile nav shows the most-used features; less-used items are accessible via the hamburger menu sheet.

**Rationale:** Field technicians primarily use the app on mobile. Bottom tabs provide thumb-friendly navigation for the most common actions (Dashboard, Today, Routes, Clients, Billing).

---

## 8. Server Actions for Auth Operations

**Decision:** Use Next.js Server Actions for login, signup, forgot-password, and sign-out operations.

**Rationale:** Server Actions keep auth logic on the server, preventing credential exposure. They integrate naturally with form submissions and support progressive enhancement.

---

## 9. Auth Callback with Org Check

**Decision:** The OAuth callback route checks if the user has an org membership. If not, it redirects to `/onboarding` instead of `/dashboard`.

**Rationale:** New users signing up via Google OAuth need to create an organization before they can use the app. This ensures they always go through the onboarding flow.

---

## 10. Middleware for Route Protection

**Decision:** Use Next.js middleware to protect all routes except auth pages, the marketing homepage, and the onboarding flow.

**Rationale:** Middleware runs at the edge before page rendering, providing fast redirects for unauthenticated users. It also handles Supabase session refresh on every request.

---

## 11. UUID Primary Keys

**Decision:** Use UUID v4 for all primary keys instead of auto-incrementing integers.

**Rationale:** UUIDs are globally unique, making them safe for distributed systems and client-side generation. They don't leak information about record count or creation order. Supabase's `uuid_generate_v4()` handles generation at the database level.

---

## 12. JSONB for Flexible Data

**Decision:** Use JSONB columns for `branding`, `vertical_data`, `stop_order`, `checklist`, `photos`, and `line_items`.

**Rationale:** These fields have varying schemas depending on the vertical or use case. JSONB allows flexibility without requiring schema migrations for every new field, while still supporting indexing and querying.

---

## 13. Enum Types in Postgres

**Decision:** Define custom Postgres enum types for all status/type columns rather than using text with CHECK constraints.

**Rationale:** Enums provide type safety at the database level, better storage efficiency, and clearer documentation of valid values. They're also easier to reference in TypeScript types.

---

## 14. Inter Font

**Decision:** Use Inter as the primary font instead of the default Geist fonts.

**Rationale:** Inter is widely used in SaaS products (Linear, Stripe) and provides excellent readability at all sizes. It aligns with the "clean Linear/Stripe-style aesthetic" requirement.

---

## 15. Onboarding as Separate Route (Not Route Group)

**Decision:** Place onboarding at `/onboarding` outside both the `(auth)` and `(dashboard)` route groups.

**Rationale:** Onboarding requires authentication (unlike auth pages) but doesn't need the full app shell (unlike dashboard pages). Keeping it as a standalone route with its own layout provides the cleanest UX.

---

## 16. Dashboard Stats via Real Queries

**Decision:** Dashboard stat cards execute real Supabase queries (count visits, sum invoices, etc.) rather than showing hardcoded placeholder values.

**Rationale:** Even though the database starts empty, wiring up real queries from day one means the dashboard "just works" as data is added. It also validates the schema and RLS policies early.

---

## 17. Plan Selection UI-Only (No Stripe Yet)

**Decision:** The plan selection step in onboarding saves the plan choice to the database but does not integrate with Stripe.

**Rationale:** Per the spec, Stripe integration is a later task. The plan field is stored and ready for billing logic to be wired in later.

---

## 18. Supabase SSR Package for Server/Client Split

**Decision:** Use `@supabase/ssr` with separate `client.ts` (browser) and `server.ts` (server components/actions) utilities.

**Rationale:** This is the official Supabase recommendation for Next.js App Router. It properly handles cookie-based session management across server and client boundaries.
