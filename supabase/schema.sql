-- ============================================================
-- Examspace Exam Question Bank - Full Supabase Schema
-- ============================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- fuzzy text matching
CREATE EXTENSION IF NOT EXISTS "unaccent";  -- normalize accented chars for search

-- ============================================================
-- ENUMS
-- ============================================================

CREATE TYPE user_role AS ENUM ('student', 'contributor', 'admin');
CREATE TYPE source_type AS ENUM ('uploaded', 'manual', 'extracted');
CREATE TYPE contribution_type AS ENUM ('upload', 'edit', 'extraction', 'correction');
CREATE TYPE transaction_type AS ENUM ('credit', 'debit');
CREATE TYPE transaction_status AS ENUM ('pending', 'successful', 'failed');
CREATE TYPE transaction_reason AS ENUM ('contribution_reward', 'withdrawal', 'adjustment', 'refund');
CREATE TYPE withdrawal_status AS ENUM ('pending', 'processing', 'successful', 'failed');
CREATE TYPE file_type AS ENUM ('pdf', 'image');
CREATE TYPE moderation_status AS ENUM ('pending', 'approved', 'rejected');

-- ============================================================
-- USERS (extends Supabase auth.users)
-- ============================================================

CREATE TABLE public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL UNIQUE,
  full_name     TEXT,
  school        TEXT,
  department    TEXT,
  role          user_role NOT NULL DEFAULT 'student',
  is_banned     BOOLEAN NOT NULL DEFAULT false,
  ban_reason    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- COURSES
-- ============================================================

CREATE TABLE public.courses (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school        TEXT NOT NULL,
  department    TEXT NOT NULL,
  name          TEXT NOT NULL,
  code          TEXT,
  created_by    UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (school, department, code)
);

CREATE INDEX idx_courses_school ON public.courses(school);
CREATE INDEX idx_courses_department ON public.courses(department);
CREATE INDEX idx_courses_school_dept ON public.courses(school, department);

CREATE TRIGGER courses_updated_at BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- QUESTIONS
-- ============================================================

CREATE TABLE public.questions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  question_text   TEXT NOT NULL,
  options         JSONB,             -- {"A":"...","B":"...","C":"...","D":"..."}
  correct_answer  TEXT,
  year            SMALLINT,
  source_type     source_type NOT NULL DEFAULT 'manual',
  status          moderation_status NOT NULL DEFAULT 'pending',
  is_deleted      BOOLEAN NOT NULL DEFAULT false,
  content_hash    TEXT,              -- SHA-256 of normalized question_text for dedup
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_questions_course ON public.questions(course_id);
CREATE INDEX idx_questions_status ON public.questions(status);
CREATE INDEX idx_questions_hash ON public.questions(content_hash);
CREATE INDEX idx_questions_text_trgm ON public.questions USING GIN (question_text gin_trgm_ops);

CREATE TRIGGER questions_updated_at BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- QUESTION CONTRIBUTIONS
-- ============================================================

CREATE TABLE public.question_contributions (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id          UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contribution_type    contribution_type NOT NULL,
  contribution_weight  FLOAT NOT NULL DEFAULT 1.0 CHECK (contribution_weight > 0 AND contribution_weight <= 1.0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id, user_id, contribution_type)
);

CREATE INDEX idx_contributions_question ON public.question_contributions(question_id);
CREATE INDEX idx_contributions_user ON public.question_contributions(user_id);

-- ============================================================
-- UPLOADS
-- ============================================================

CREATE TABLE public.uploads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  file_url        TEXT NOT NULL,
  file_type       file_type NOT NULL,
  original_name   TEXT,
  file_size       BIGINT,
  processed       BOOLEAN NOT NULL DEFAULT false,
  processing_error TEXT,
  questions_extracted INTEGER DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_uploads_user ON public.uploads(user_id);
CREATE INDEX idx_uploads_course ON public.uploads(course_id);
CREATE INDEX idx_uploads_processed ON public.uploads(processed);

CREATE TRIGGER uploads_updated_at BEFORE UPDATE ON public.uploads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- QUESTION ANALYTICS
-- ============================================================

CREATE TABLE public.question_analytics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id     UUID NOT NULL UNIQUE REFERENCES public.questions(id) ON DELETE CASCADE,
  views_count     BIGINT NOT NULL DEFAULT 0,
  attempts_count  BIGINT NOT NULL DEFAULT 0,
  last_viewed_at  TIMESTAMPTZ
);

CREATE INDEX idx_analytics_question ON public.question_analytics(question_id);
CREATE INDEX idx_analytics_views ON public.question_analytics(views_count DESC);

-- Auto-create analytics row when question is created
CREATE OR REPLACE FUNCTION create_question_analytics()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.question_analytics (question_id) VALUES (NEW.id);
  RETURN NEW;
END;
$$;

CREATE TRIGGER question_analytics_insert AFTER INSERT ON public.questions
  FOR EACH ROW EXECUTE FUNCTION create_question_analytics();

-- ============================================================
-- WALLET LEDGER
-- ============================================================

CREATE TABLE public.wallet_ledger (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency        TEXT NOT NULL DEFAULT 'NGN',
  type            transaction_type NOT NULL,
  status          transaction_status NOT NULL DEFAULT 'pending',
  reason          transaction_reason NOT NULL,
  reference_id    TEXT,              -- Paystack reference or internal ref
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_ledger_user ON public.wallet_ledger(user_id);
CREATE INDEX idx_ledger_status ON public.wallet_ledger(status);
CREATE INDEX idx_ledger_reference ON public.wallet_ledger(reference_id);
CREATE INDEX idx_ledger_user_status ON public.wallet_ledger(user_id, status);

-- ============================================================
-- WITHDRAWALS
-- ============================================================

CREATE TABLE public.withdrawals (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount                  NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  bank_account_number     TEXT NOT NULL,
  bank_code               TEXT NOT NULL,
  account_name            TEXT,
  recipient_code          TEXT,           -- Paystack recipient code
  status                  withdrawal_status NOT NULL DEFAULT 'pending',
  paystack_transfer_code  TEXT,
  failure_reason          TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_withdrawals_user ON public.withdrawals(user_id);
CREATE INDEX idx_withdrawals_status ON public.withdrawals(status);

CREATE TRIGGER withdrawals_updated_at BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- REVENUE POOL
-- ============================================================

CREATE TABLE public.revenue_pool (
  id                           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  total_revenue                NUMERIC(15,2) NOT NULL DEFAULT 0,
  contribution_pool_percentage FLOAT NOT NULL DEFAULT 70.0 CHECK (contribution_pool_percentage BETWEEN 0 AND 100),
  payout_pool_amount           NUMERIC(15,2) GENERATED ALWAYS AS (total_revenue * contribution_pool_percentage / 100) STORED,
  period_start                 DATE NOT NULL,
  period_end                   DATE NOT NULL,
  distributed                  BOOLEAN NOT NULL DEFAULT false,
  distributed_at               TIMESTAMPTZ,
  notes                        TEXT,
  created_at                   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (period_start, period_end)
);

-- ============================================================
-- DUPLICATE DETECTION (question similarity pairs)
-- ============================================================

CREATE TABLE public.question_duplicates (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id_a   UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  question_id_b   UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  similarity_score FLOAT NOT NULL CHECK (similarity_score BETWEEN 0 AND 1),
  resolved        BOOLEAN NOT NULL DEFAULT false,
  kept_question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id_a, question_id_b)
);

-- ============================================================
-- NOTIFICATIONS
-- ============================================================

CREATE TABLE public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'info',
  read        BOOLEAN NOT NULL DEFAULT false,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_notifications_user ON public.notifications(user_id, read);

-- ============================================================
-- HELPER: compute wallet balance from ledger
-- ============================================================

CREATE OR REPLACE FUNCTION get_wallet_balance(p_user_id UUID)
RETURNS NUMERIC LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_balance NUMERIC;
BEGIN
  SELECT COALESCE(
    SUM(CASE WHEN type = 'credit' AND status = 'successful' THEN amount ELSE 0 END) -
    SUM(CASE WHEN type = 'debit'  AND status = 'successful' THEN amount ELSE 0 END),
    0
  )
  INTO v_balance
  FROM public.wallet_ledger
  WHERE user_id = p_user_id;

  RETURN v_balance;
END;
$$;

-- ============================================================
-- HELPER: increment question views atomically
-- ============================================================

CREATE OR REPLACE FUNCTION increment_question_views(p_question_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.question_analytics (question_id, views_count, last_viewed_at)
  VALUES (p_question_id, 1, NOW())
  ON CONFLICT (question_id) DO UPDATE
    SET views_count   = question_analytics.views_count + 1,
        last_viewed_at = NOW();
END;
$$;

-- ============================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_pool ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_duplicates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- ---- HELPER FUNCTIONS for role checks (SECURITY DEFINER avoids RLS recursion) ----
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_contributor_or_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('contributor','admin'));
$$;

GRANT EXECUTE ON FUNCTION public.is_admin()                TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_contributor_or_admin() TO anon, authenticated, service_role;

-- ---- users ----
CREATE POLICY "users_select_own"   ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own"   ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "admin_all_users"    ON public.users FOR ALL    USING (public.is_admin());

-- ---- courses ----
CREATE POLICY "courses_select_all"               ON public.courses FOR SELECT USING (true);
CREATE POLICY "courses_insert_authenticated"     ON public.courses FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "courses_update_admin"             ON public.courses FOR UPDATE USING (public.is_admin());
CREATE POLICY "courses_delete_admin"             ON public.courses FOR DELETE USING (public.is_admin());

-- ---- questions ----
CREATE POLICY "questions_select_approved"    ON public.questions FOR SELECT USING (status = 'approved' AND is_deleted = false);
CREATE POLICY "questions_select_own_pending" ON public.questions FOR SELECT USING (
  is_deleted = false AND EXISTS (
    SELECT 1 FROM public.question_contributions qc
    WHERE qc.question_id = id AND qc.user_id = auth.uid()
  )
);
CREATE POLICY "questions_insert_contributor" ON public.questions FOR INSERT WITH CHECK (public.is_contributor_or_admin());
CREATE POLICY "questions_update_admin"       ON public.questions FOR UPDATE USING (public.is_admin());
CREATE POLICY "admin_all_questions"          ON public.questions FOR ALL    USING (public.is_admin());

-- ---- question_contributions ----
CREATE POLICY "contributions_select_own"   ON public.question_contributions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "contributions_select_admin" ON public.question_contributions FOR SELECT USING (public.is_admin());
CREATE POLICY "contributions_insert_own"   ON public.question_contributions FOR INSERT WITH CHECK (user_id = auth.uid());

-- ---- uploads ----
CREATE POLICY "uploads_select_own" ON public.uploads FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "uploads_insert_own" ON public.uploads FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin_all_uploads"  ON public.uploads FOR ALL    USING (public.is_admin());

-- ---- question_analytics ----
CREATE POLICY "analytics_select_all" ON public.question_analytics FOR SELECT USING (true);

-- ---- wallet_ledger ----
CREATE POLICY "ledger_select_own" ON public.wallet_ledger FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "admin_all_ledger"  ON public.wallet_ledger FOR ALL    USING (public.is_admin());

-- ---- withdrawals ----
CREATE POLICY "withdrawals_select_own" ON public.withdrawals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "withdrawals_insert_own" ON public.withdrawals FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin_all_withdrawals"  ON public.withdrawals FOR ALL    USING (public.is_admin());

-- ---- revenue_pool (admin only) ----
CREATE POLICY "admin_all_revenue_pool" ON public.revenue_pool FOR ALL USING (public.is_admin());

-- ---- question_duplicates (admin only) ----
CREATE POLICY "admin_all_duplicates" ON public.question_duplicates FOR ALL USING (public.is_admin());

-- ---- notifications ----
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "admin_all_notifications"  ON public.notifications FOR ALL    USING (public.is_admin()
  );

-- ============================================================
-- ROLE GRANTS
-- Required: without these the anon/authenticated roles get
-- "permission denied" even when RLS policies would allow access.
-- ============================================================

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

-- Public read-only tables (courses, approved questions, analytics)
GRANT SELECT ON public.courses            TO anon, authenticated;
GRANT SELECT ON public.questions          TO anon, authenticated;
GRANT SELECT ON public.question_analytics TO anon, authenticated;

-- Authenticated users full access (RLS still controls rows)
GRANT SELECT, INSERT, UPDATE        ON public.users                  TO authenticated;
GRANT INSERT, UPDATE                ON public.courses                TO authenticated;
GRANT INSERT, UPDATE, DELETE        ON public.questions              TO authenticated;
GRANT SELECT, INSERT                ON public.question_contributions TO authenticated;
GRANT SELECT, INSERT                ON public.uploads                TO authenticated;
GRANT SELECT                        ON public.wallet_ledger          TO authenticated;
GRANT SELECT, INSERT                ON public.withdrawals            TO authenticated;
GRANT SELECT, INSERT                ON public.notifications          TO authenticated;
GRANT UPDATE                        ON public.notifications          TO authenticated;
GRANT SELECT                        ON public.revenue_pool           TO authenticated;
GRANT SELECT                        ON public.question_duplicates    TO authenticated;

-- Service role gets full access (used by admin client, bypasses RLS)
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- Functions need explicit EXECUTE grants
GRANT EXECUTE ON FUNCTION public.get_wallet_balance(UUID)         TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.increment_question_views(UUID)   TO authenticated, anon, service_role;

-- ============================================================
-- STORAGE BUCKETS (run via Supabase dashboard or migration)
-- ============================================================
-- INSERT INTO storage.buckets (id, name, public) VALUES ('exam-uploads', 'exam-uploads', false);
-- INSERT INTO storage.buckets (id, name, public) VALUES ('avatars', 'avatars', true);

-- Storage RLS: only owner or admin can read exam-uploads
-- CREATE POLICY "exam_uploads_owner_read" ON storage.objects
--   FOR SELECT USING (bucket_id = 'exam-uploads' AND auth.uid()::text = (storage.foldername(name))[1]);
