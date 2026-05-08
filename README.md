# EduTech — Crowdsourced Exam Question Bank

A production-ready backend platform for Nigerian students to upload, contribute, and earn rewards from structured exam question banks.

**Stack:** Next.js 15 (App Router) · TypeScript · Supabase · Paystack · OpenAI GPT-4o · Vercel

---

## Features

| Area | Capability |
|---|---|
| **Auth** | Email/password via Supabase Auth, role-based access (student / contributor / admin) |
| **Questions** | Manual contribution, full-text search, trigram fuzzy search, moderation workflow |
| **Uploads** | PDF/image upload → GPT-4o OCR extraction → structured question creation |
| **Deduplication** | SHA-256 hashing + trigram similarity scoring, admin merge tool |
| **Wallet** | Ledger-based wallet (credit/debit), balance via DB function |
| **Withdrawals** | Paystack bank transfer flow with webhook status updates |
| **Revenue Pool** | Monthly revenue tracking, weighted payout distribution to contributors |
| **Admin** | User management, content moderation, financial control, analytics |
| **Analytics** | Per-question views, top contributors, most viewed courses |

---

## Project Structure

```
src/
├── app/
│   └── api/
│       ├── auth/          # register, login, logout, me, profile
│       ├── courses/       # CRUD + list by school/department
│       ├── questions/     # CRUD + search + contributors
│       ├── uploads/       # file upload + processing trigger
│       ├── contributions/ # own contribution history
│       ├── wallet/        # balance + ledger + bank list
│       ├── withdrawals/   # withdrawal requests
│       ├── analytics/     # public stats
│       ├── webhooks/
│       │   └── paystack/  # transfer & charge webhooks
│       └── admin/
│           ├── users/     # list, view, ban, role change
│           ├── questions/ # moderation, merge duplicates
│           ├── withdrawals/ # override withdrawal status
│           ├── revenue/   # pool management + distribution
│           └── analytics/ # platform metrics
├── lib/
│   ├── supabase/          # client, server, admin clients
│   ├── paystack/          # HTTP client, transfer helpers, webhook verify
│   ├── ocr/               # OpenAI extraction, upload pipeline
│   ├── dedup/             # trigram similarity, merge logic
│   ├── contributions/     # reward calculation engine
│   └── utils/             # response helpers, pagination, hash, auth
├── types/
│   ├── database.ts        # all DB + API types
│   └── paystack.ts        # Paystack API types
└── middleware.ts           # Supabase session refresh
supabase/
└── schema.sql              # complete schema + RLS policies
```

---

## API Routes Reference

### Authentication
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/auth/register` | Public | Create account |
| POST | `/api/auth/login` | Public | Email/password login |
| POST | `/api/auth/logout` | Auth | Sign out |
| GET | `/api/auth/me` | Auth | Current user profile |
| PATCH | `/api/auth/profile` | Auth | Update profile |

### Courses
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/courses` | Public | List courses (`?school=&department=&page=&limit=`) |
| POST | `/api/courses` | Contributor+ | Create course |
| GET | `/api/courses/:id` | Public | Get course |
| PATCH | `/api/courses/:id` | Admin | Update course |
| DELETE | `/api/courses/:id` | Admin | Delete course |

### Questions
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/questions` | Public | List questions (`?course_id=&year=&page=`) |
| POST | `/api/questions` | Contributor+ | Submit question |
| GET | `/api/questions/:id` | Public | Get question + increment view |
| PATCH | `/api/questions/:id` | Auth | Edit question |
| DELETE | `/api/questions/:id` | Admin | Soft delete |
| GET | `/api/questions/:id/contributors` | Public | Contributor history |
| GET | `/api/questions/search` | Public | Full-text search (`?q=&course_id=`) |

### Uploads
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/uploads` | Auth | Own uploads |
| POST | `/api/uploads` | Auth | Upload file (multipart) |
| POST | `/api/uploads/:id/process` | Admin | Manually trigger processing |

### Wallet & Withdrawals
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/wallet` | Auth | Balance + ledger |
| GET | `/api/wallet/banks` | Public | Nigerian bank list |
| GET | `/api/withdrawals` | Auth | Own withdrawals |
| POST | `/api/withdrawals` | Auth | Request withdrawal |

### Analytics
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/analytics` | Public | Platform stats |

### Admin
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| GET | `/api/admin/users` | Admin | List all users |
| GET/PATCH | `/api/admin/users/:id` | Admin | View/update user |
| GET | `/api/admin/questions` | Admin | Questions by status |
| POST | `/api/admin/questions/:id/moderate` | Admin | Approve/reject |
| POST | `/api/admin/questions/merge` | Admin | Merge duplicates |
| GET | `/api/admin/withdrawals` | Admin | All withdrawals |
| PATCH | `/api/admin/withdrawals/:id` | Admin | Manual override |
| GET/POST | `/api/admin/revenue` | Admin | Revenue pools |
| GET/POST | `/api/admin/revenue/:id/distribute` | Admin | Preview/execute payout |
| GET | `/api/admin/analytics` | Admin | Platform metrics |

### Webhooks
| Method | Route | Auth | Description |
|--------|-------|------|-------------|
| POST | `/api/webhooks/paystack` | HMAC | Paystack events |

---

## Setup

### 1. Clone & Install
```bash
npm install
cp .env.example .env.local
# Fill in all variables in .env.local
```

### 2. Supabase Setup
1. Create a Supabase project
2. Run `supabase/schema.sql` in the SQL editor
3. Create storage buckets: `exam-uploads` (private), `avatars` (public)
4. Add storage RLS policies (see comments at bottom of schema.sql)

### 3. Paystack Setup
1. Get your secret key from the Paystack dashboard
2. Register webhook URL: `https://your-domain.vercel.app/api/webhooks/paystack`
3. Enable: `transfer.success`, `transfer.failed`, `transfer.reversed`, `charge.success`
4. Copy the webhook secret to `PAYSTACK_WEBHOOK_SECRET`

### 4. Run Locally
```bash
npm run dev
```

### 5. Deploy to Vercel
```bash
vercel deploy
```
Set all environment variables in the Vercel dashboard under Settings → Environment Variables.

---

## Data Model

```
users ─────────────────────────────────────────────────┐
  │                                                     │
  ├── uploads ──────────────────────────────────────────┤
  │       └── triggers processUpload()                  │
  │                                                     │
  ├── question_contributions ─── questions ─────────────┤
  │       (upload/edit/extraction/correction)           │
  │                                                     │
  ├── wallet_ledger (credit/debit ledger)               │
  │       └── get_wallet_balance() RPC                  │
  │                                                     │
  ├── withdrawals ── Paystack Transfer API              │
  │                                                     │
  └── notifications                                     │
                                                        │
revenue_pool ── distributeRevenuePool() ─── wallet_ledger
```

---

## Contribution Weight System

| Contribution Type | Weight |
|---|---|
| upload | 1.0 |
| extraction | 1.0 |
| correction | 0.7 |
| edit | 0.5 |

**Payout formula (per contributor):**
```
score = (weighted_fraction × 0.6) + (views_fraction × 0.4)
payout = score × pool_amount
```

---

## Security

- All tables protected by Supabase Row Level Security (RLS)
- Admin client (service_role) only used server-side, never exposed to client
- Paystack webhooks verified via HMAC-SHA512 signature
- File uploads validated by MIME type and size (20MB max)
- Rate limiting recommended via Vercel Edge middleware or Upstash Redis
