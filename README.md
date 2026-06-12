# ServiceFlow

A production multi-tenant SaaS platform for route-based home service businesses (pool, cleaning, pest control, painting).

## Tech Stack

- **Framework:** Next.js 14+ (App Router)
- **Language:** TypeScript
- **Styling:** Tailwind CSS
- **Components:** shadcn/ui
- **Backend:** Supabase (Postgres + Auth + Row Level Security)
- **Auth:** Email/Password + Google OAuth

## Getting Started

### Prerequisites

- Node.js 18+
- pnpm 8+
- A Supabase project ([create one here](https://supabase.com/dashboard))

### 1. Clone the repository

```bash
git clone https://github.com/YOUR_USERNAME/serviceflow.git
cd serviceflow
```

### 2. Install dependencies

```bash
pnpm install
```

### 3. Set up environment variables

```bash
cp .env.example .env.local
```

Fill in your Supabase credentials:

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run database migrations

In the Supabase dashboard SQL editor, run the migration file:

```
supabase/migrations/20240101000000_initial_schema.sql
```

Or if using the Supabase CLI:

```bash
supabase db push
```

### 5. Configure Auth Providers

In your Supabase dashboard:

1. Go to **Authentication > Providers**
2. Enable **Email** (already enabled by default)
3. Enable **Google** and add your OAuth credentials

### 6. Run the development server

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

## Project Structure

```
serviceflow/
├── src/
│   ├── app/
│   │   ├── (auth)/           # Auth pages (login, signup, forgot-password)
│   │   ├── (dashboard)/      # Protected dashboard pages
│   │   ├── (marketing)/      # Public marketing pages
│   │   └── onboarding/       # Onboarding flow
│   ├── components/
│   │   ├── ui/               # shadcn/ui components
│   │   ├── app-sidebar.tsx   # Desktop sidebar navigation
│   │   ├── app-topbar.tsx    # Top bar with org switcher
│   │   ├── mobile-bottom-nav.tsx
│   │   └── mobile-sidebar-nav.tsx
│   ├── lib/
│   │   ├── supabase/         # Supabase client utilities
│   │   ├── database.types.ts # TypeScript types for DB schema
│   │   ├── org-context.tsx   # Multi-tenant org context provider
│   │   ├── verticals.ts     # Vertical config map (terminology)
│   │   └── utils.ts         # Utility functions
│   └── middleware.ts         # Auth middleware (route protection)
├── supabase/
│   └── migrations/           # SQL migration files
├── .env.example              # Environment variable template
├── DECISIONS.md              # Architecture decision log
└── README.md                 # This file
```

## Database Schema

The database includes 12 tables with full Row Level Security:

| Table | Purpose |
|-------|---------|
| `orgs` | Organizations (tenants) |
| `org_members` | User-org membership with roles |
| `customers` | Customer records per org |
| `properties` | Service locations |
| `service_plans` | Recurring service schedules |
| `routes` | Route definitions with stop ordering |
| `visits` | Individual service visits |
| `quotes` | Customer quotes |
| `invoices` | Billing and payments |
| `messages` | SMS/email communication log |
| `leads` | Lead tracking |
| `activity_log` | Audit trail |

All tables enforce RLS: users can only access data for organizations they belong to.

## Multi-Tenant Architecture

- Each user can belong to multiple organizations
- Org switcher in the top bar allows switching context
- All queries are scoped to the current org via RLS
- Vertical-specific terminology is driven by `/lib/verticals.ts`

## Verticals

The app adapts its terminology based on the organization's vertical:

| Vertical | Entities | Services |
|----------|----------|----------|
| Pool | Pools | Cleanings |
| Cleaning | Homes | Cleans |
| Pest | Accounts | Treatments |
| Painting | Projects | Jobs |

## Plans

| Plan | Target | Key Features |
|------|--------|--------------|
| Solo | Individual techs | 1 user, 50 customers |
| Crew | Small teams | 5 users, unlimited customers |
| Pro | Growing businesses | Unlimited everything + automation |

## Development

```bash
pnpm dev          # Start dev server
pnpm build        # Production build
pnpm lint         # Run ESLint
```

## License

Private - All rights reserved.
