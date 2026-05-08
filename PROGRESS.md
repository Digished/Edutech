# EduTech — Project Progress

A crowdsourced exam question bank for Nigerian students. Production-ready Next.js 16 + Supabase + Paystack stack.

**Branch:** `claude/exam-question-bank-backend-OF29J`

---

## ✅ What's done

### 1. Backend infrastructure
- **Next.js 16 App Router** with TypeScript (Turbopack)
- **Supabase** for auth, DB, storage (with full RLS)
- **Paystack** for wallet transfers + webhook verification
- **OpenAI GPT-4o** Vision for OCR question extraction
- **Vercel** deployment with extended function timeouts (`vercel.json`)

### 2. Database schema (`supabase/schema.sql`)
11 tables, fully RLS-protected:
- `users` — extends `auth.users`, role enum (`student` / `contributor` / `admin`), ban support
- `courses` — school + department + name + code (unique constraint)
- `questions` — text, options JSONB, correct answer, year, status, soft-delete
- `question_contributions` — weighted contribution tracking (upload/extraction/correction/edit)
- `question_analytics` — view counts (auto-created on question insert via trigger)
- `question_duplicates` — trigram similarity pairs for moderation
- `uploads` — file uploads with processing status
- `wallet_ledger` — immutable credit/debit entries (no balance field; computed via DB function)
- `withdrawals` — Paystack payouts with status tracking
- `revenue_pool` — admin-managed distribution rounds
- `notifications` — user-facing notifications

Plus:
- 7 enums (user_role, contribution_type, transaction_type, etc.)
- DB functions: `get_wallet_balance(uuid)`, `increment_question_views(uuid)`, `is_admin()`, `is_contributor_or_admin()`
- Auto-update triggers for `updated_at`
- Indexes on hot paths (user_id, school, status, etc.)

### 3. API routes (`src/app/api/`)

| Route | Methods | Purpose |
|---|---|---|
| `/auth/register` | POST | Create user (Supabase auth + profile) |
| `/auth/login` | POST | Sign in with email/password, checks ban status |
| `/auth/logout` | POST | Sign out |
| `/auth/me` | GET | Current user profile |
| `/auth/profile` | PATCH | Update name/school/department |
| `/courses` | GET, POST | List/create courses (any auth user can create) |
| `/courses/[id]` | GET, PATCH, DELETE | Manage course |
| `/questions` | GET, POST | List approved / submit new (with hash + dedup) |
| `/questions/[id]` | GET, PATCH, DELETE | View (increments analytics), edit, soft-delete |
| `/questions/[id]/contributors` | GET | Contribution history per question |
| `/questions/search` | GET | Full-text search via Postgres `textSearch` |
| `/uploads` | GET, POST | Upload file (PDF/image), trigger async OCR |
| `/uploads/[id]/process` | POST | Admin manual reprocess |
| `/wallet` | GET | Balance (RPC) + paginated ledger |
| `/wallet/banks` | GET | Paystack bank list |
| `/withdrawals` | GET, POST | Initiate payout (verify account → debit → Paystack transfer) |
| `/contributions` | GET | Own contribution history |
| `/analytics` | GET | Public stats |
| `/admin/analytics` | GET | Total users, contributors, revenue, top contributors |
| `/admin/questions` | GET | List by status (pending/approved/rejected) |
| `/admin/questions/[id]/moderate` | POST | Approve/reject + notify contributors |
| `/admin/questions/merge` | POST | Merge duplicate questions |
| `/admin/users` | GET | List with role/school/ban filters |
| `/admin/users/[id]` | GET, PATCH | Update role, ban/unban |
| `/admin/revenue` | GET, POST | Pool management |
| `/admin/revenue/[id]/distribute` | GET, POST | Preview + execute distribution |
| `/admin/withdrawals` | GET | All withdrawals |
| `/admin/seed` | POST | Manual admin seed (legacy — use `/admin/login` instead) |
| `/admin/auth` | POST | Auto-creates + signs in admin from env vars |
| `/webhooks/paystack` | POST | HMAC-SHA512 verified, handles `transfer.success/failed/reversed` and `charge.success` |
| `/health` | GET | Env var diagnostics |

### 4. Library code (`src/lib/`)
- `supabase/client.ts`, `server.ts`, `admin.ts` — typed Supabase clients (browser, SSR, service role)
- `paystack/client.ts`, `transfers.ts`, `webhook.ts` — Paystack integration + signature verification
- `ocr/processor.ts`, `pipeline.ts` — GPT-4o Vision extraction + async upload processing
- `dedup/similarity.ts` — Trigram Jaccard similarity for duplicate detection
- `contributions/rewards.ts` — Weighted scoring + revenue distribution formula (60% weight, 40% views)
- `utils/auth.ts`, `response.ts`, `pagination.ts`, `hash.ts` — shared helpers
- `proxy.ts` — Next.js 16 proxy (formerly middleware) for session refresh

### 5. Frontend pages (`src/app/`)
| Route | Purpose |
|---|---|
| `/` | Landing page — hero, features, how-it-works, footer |
| `/login` | Email/password login |
| `/register` | Full registration (name, email, password, school, dept) |
| `/questions` | Public question browser — search, course/school filter, pagination, MCQ rendering |
| `/dashboard` | Authenticated home — wallet balance, contributions, quick actions, recent transactions |
| `/dashboard/wallet` | Full ledger + withdrawal modal with Paystack bank selector |
| `/dashboard/uploads` | Upload form (with inline course creation) + upload history |
| `/dashboard/contributions` | Contribution history with type badges + weight |
| `/admin/login` | Password-only admin gate (uses env vars, auto-creates account) |
| `/admin/questions` | Moderate pending/approved/rejected questions |
| `/admin/users` | Manage users — change role, ban/unban inline |

All pages: Tailwind, dark mode, mobile responsive, matching design system.

### 6. Bugs fixed along the way
- ❌ `create-next-app` rejected "Edutech" → built in subdir, moved to root
- ❌ Supabase TypeScript "never" types → added missing `Views: Record<string, never>` and `Relationships: []` to type defs
- ❌ Vercel deprecation warning → renamed `middleware.ts` → `proxy.ts`, function name to `proxy`
- ❌ "Invalid supabaseUrl" runtime error → required Vercel redeploy after env vars added (NEXT_PUBLIC_* are inlined at build time)
- ❌ 404 on all routes except `/` → built missing frontend pages
- ❌ Dashboard blank page → fixed loading state during redirect, added error UI
- ❌ Field name mismatches:
  - `contributions.type/weight` → `contribution_type/contribution_weight`
  - `uploads.file_name` → `original_name`
  - `uploads.status` → derived from `processed` + `processing_error`
- ❌ 500 on wallet/contributions → **GRANT statements missing** (Supabase doesn't auto-grant on SQL-editor-created tables)
- ❌ "infinite recursion in policy for relation users" → admin policies queried `users` to check role; fixed with `SECURITY DEFINER` helper functions (`is_admin()`, `is_contributor_or_admin()`)
- ❌ Redundant `PAYSTACK_WEBHOOK_SECRET` → consolidated to single `PAYSTACK_SECRET_KEY`
- ❌ "course_id required" on uploads → added inline course creation form, made students able to create courses

### 7. Admin access flow
- Set `ADMIN_EMAIL` + `ADMIN_PASSWORD` in Vercel env vars
- Visit `/admin/login` — enter password (the one from env)
- API auto-creates Supabase auth user + admin profile on first login (no manual seeding)
- Subsequent logins just sign in with the same credentials

---

## 📋 Required Vercel environment variables

| Var | Purpose |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role (server-only, bypasses RLS) |
| `PAYSTACK_SECRET_KEY` | Paystack secret (used for both API + webhook signing) |
| `OPENAI_API_KEY` | For OCR question extraction |
| `ADMIN_EMAIL` | Admin account email |
| `ADMIN_PASSWORD` | Admin account password |

## 🔌 Paystack webhook URL

In Paystack dashboard → Settings → Webhooks:
```
https://<your-domain>.vercel.app/api/webhooks/paystack
```

---

## 🚧 Outstanding setup tasks

1. **Run the schema** — `supabase/schema.sql` in the Supabase SQL Editor (only if not already done)
2. **Run the RLS recursion fix** — `supabase/fix-rls-recursion.sql` (already known to be needed if existing DB)
3. **Run the GRANT statements** — included in latest schema, or paste from earlier message if existing DB
4. **Update courses insert policy** for student access:
   ```sql
   DROP POLICY IF EXISTS "courses_insert_contributor_admin" ON public.courses;
   CREATE POLICY "courses_insert_authenticated" ON public.courses
     FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
   ```
5. **Create Supabase storage buckets**:
   - `exam-uploads` (private)
   - `avatars` (public)
6. **Configure Paystack webhook URL** in Paystack dashboard
7. **Set all Vercel env vars** from the table above
8. **Visit `/admin/login`** to bootstrap admin account

---

## 🧠 Architecture notes

- **Wallet has no balance column** — balance is computed from `wallet_ledger` via the `get_wallet_balance` SECURITY DEFINER function. Prevents drift.
- **Withdrawals use a 2-phase commit pattern**: debit ledger entry created first (status=pending), then Paystack transfer initiated, then on webhook the ledger entry is marked successful. On failure the ledger entry is marked failed (effectively a refund since balance only counts `successful` entries).
- **Deduplication** runs both on submit (SHA-256 exact match) and async (trigram similarity ≥ 0.8 → admin review queue).
- **Revenue distribution formula**: per-contributor share = `(weighted_contribution_fraction × 0.6) + (views_fraction × 0.4)`.
- **OCR pipeline** is fire-and-forget on Vercel — would benefit from a real queue (Vercel Cron + Supabase Edge Function) in production.
- **Admin RLS check** uses `is_admin()` SECURITY DEFINER function to avoid recursion.
