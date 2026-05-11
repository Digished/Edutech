-- ============================================================
-- Examspace — Full canonical schema
-- ============================================================
-- Run this on a clean database (or after `wipe-data.sql`).
-- Hierarchy: University → Faculty → Department → Course → Question.
-- Adds level (100-600), semester (1/2/3), and a high-yield tag system.
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";

-- ============================================================
-- ENUMS
-- ============================================================
DO $$ BEGIN CREATE TYPE user_role AS ENUM ('student', 'contributor', 'admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE source_type AS ENUM ('uploaded', 'manual', 'extracted'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE contribution_type AS ENUM ('upload', 'edit', 'extraction', 'correction'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE transaction_type AS ENUM ('credit', 'debit'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE transaction_status AS ENUM ('pending', 'successful', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE transaction_reason AS ENUM ('contribution_reward', 'withdrawal', 'adjustment', 'refund'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE withdrawal_status AS ENUM ('pending', 'processing', 'successful', 'failed'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE file_type AS ENUM ('pdf', 'image', 'docx'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TYPE file_type ADD VALUE IF NOT EXISTS 'docx'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE moderation_status AS ENUM ('pending', 'approved', 'rejected'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE subscription_plan AS ENUM ('monthly', 'quarterly', 'yearly'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE subscription_status AS ENUM ('pending', 'active', 'expired', 'cancelled'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============================================================
-- USERS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
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

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

DROP TRIGGER IF EXISTS users_updated_at ON public.users;
CREATE TRIGGER users_updated_at BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- TAXONOMY: universities → faculties → departments
-- ============================================================
CREATE TABLE IF NOT EXISTS public.universities (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name        TEXT NOT NULL UNIQUE,
  short_name  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_universities_name ON public.universities(name);
DROP TRIGGER IF EXISTS universities_updated_at ON public.universities;
CREATE TRIGGER universities_updated_at BEFORE UPDATE ON public.universities
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS public.faculties (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id  UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (university_id, name)
);
CREATE INDEX IF NOT EXISTS idx_faculties_university ON public.faculties(university_id);
DROP TRIGGER IF EXISTS faculties_updated_at ON public.faculties;
CREATE TRIGGER faculties_updated_at BEFORE UPDATE ON public.faculties
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS public.departments (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  faculty_id   UUID NOT NULL REFERENCES public.faculties(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (faculty_id, name)
);
CREATE INDEX IF NOT EXISTS idx_departments_faculty ON public.departments(faculty_id);
DROP TRIGGER IF EXISTS departments_updated_at ON public.departments;
CREATE TRIGGER departments_updated_at BEFORE UPDATE ON public.departments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- COURSES — keeps denormalised school/department TEXT for speed
-- on hot read paths, but the FK columns are the source of truth.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.courses (
  id             UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  university_id  UUID NOT NULL REFERENCES public.universities(id) ON DELETE CASCADE,
  faculty_id     UUID NOT NULL REFERENCES public.faculties(id)    ON DELETE CASCADE,
  department_id  UUID NOT NULL REFERENCES public.departments(id)  ON DELETE CASCADE,
  school         TEXT NOT NULL,
  department     TEXT NOT NULL,
  faculty        TEXT NOT NULL,
  name           TEXT NOT NULL,
  code           TEXT,
  created_by     UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (department_id, code)
);
CREATE INDEX IF NOT EXISTS idx_courses_school        ON public.courses(school);
CREATE INDEX IF NOT EXISTS idx_courses_department    ON public.courses(department);
CREATE INDEX IF NOT EXISTS idx_courses_university_id ON public.courses(university_id);
CREATE INDEX IF NOT EXISTS idx_courses_faculty_id    ON public.courses(faculty_id);
CREATE INDEX IF NOT EXISTS idx_courses_department_id ON public.courses(department_id);
DROP TRIGGER IF EXISTS courses_updated_at ON public.courses;
CREATE TRIGGER courses_updated_at BEFORE UPDATE ON public.courses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- QUESTION GROUPS — shared stem for multi-part theory questions.
-- Standalone questions have group_id = NULL.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.question_groups (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  stem            TEXT NOT NULL,
  stem_image_urls JSONB NOT NULL DEFAULT '[]'::jsonb,
  year            SMALLINT,
  level           SMALLINT CHECK (level IN (100, 200, 300, 400, 500, 600)),
  semester        SMALLINT CHECK (semester IN (1, 2, 3)),
  source_type     source_type NOT NULL DEFAULT 'manual',
  status          moderation_status NOT NULL DEFAULT 'pending',
  is_deleted      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_question_groups_course ON public.question_groups(course_id);
DROP TRIGGER IF EXISTS question_groups_updated_at ON public.question_groups;
CREATE TRIGGER question_groups_updated_at BEFORE UPDATE ON public.question_groups
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- QUESTIONS — adds level (100-600) and semester (1/2/3)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.questions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  group_id        UUID REFERENCES public.question_groups(id) ON DELETE CASCADE,
  part_label      TEXT,
  position        INT,
  points          INT,
  question_text   TEXT NOT NULL,
  options         JSONB,
  correct_answer  TEXT,
  year            SMALLINT,
  level           SMALLINT CHECK (level IN (100, 200, 300, 400, 500, 600)),
  semester        SMALLINT CHECK (semester IN (1, 2, 3)),
  question_type   TEXT NOT NULL DEFAULT 'mcq' CHECK (question_type IN ('mcq', 'theory')),
  source_type     source_type NOT NULL DEFAULT 'manual',
  status          moderation_status NOT NULL DEFAULT 'pending',
  is_deleted      BOOLEAN NOT NULL DEFAULT false,
  content_hash    TEXT,
  image_urls      JSONB DEFAULT '[]'::jsonb,
  explanation     TEXT,
  explanation_generated_at TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_questions_course   ON public.questions(course_id);
CREATE INDEX IF NOT EXISTS idx_questions_status   ON public.questions(status);
CREATE INDEX IF NOT EXISTS idx_questions_hash     ON public.questions(content_hash);
CREATE INDEX IF NOT EXISTS idx_questions_type     ON public.questions(question_type);
CREATE INDEX IF NOT EXISTS idx_questions_level    ON public.questions(level);
CREATE INDEX IF NOT EXISTS idx_questions_semester ON public.questions(semester);
CREATE INDEX IF NOT EXISTS idx_questions_group    ON public.questions(group_id);
CREATE INDEX IF NOT EXISTS idx_questions_text_trgm ON public.questions USING GIN (question_text gin_trgm_ops);
DROP TRIGGER IF EXISTS questions_updated_at ON public.questions;
CREATE TRIGGER questions_updated_at BEFORE UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- QUESTION CONTRIBUTIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.question_contributions (
  id                   UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id          UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  contribution_type    contribution_type NOT NULL,
  contribution_weight  FLOAT NOT NULL DEFAULT 1.0 CHECK (contribution_weight > 0 AND contribution_weight <= 1.0),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id, user_id, contribution_type)
);
CREATE INDEX IF NOT EXISTS idx_contributions_question ON public.question_contributions(question_id);
CREATE INDEX IF NOT EXISTS idx_contributions_user     ON public.question_contributions(user_id);

-- ============================================================
-- ADMIN SETTINGS — single key/value table the app reads at runtime.
-- Holds the global per-100-questions reward, etc.
-- ============================================================
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key         TEXT PRIMARY KEY,
  value_num   NUMERIC,
  value_text  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES public.users(id) ON DELETE SET NULL
);
INSERT INTO public.admin_settings (key, value_num) VALUES ('reward_per_100_questions', 1000)
  ON CONFLICT (key) DO NOTHING;

-- ============================================================
-- UPLOADS — adds level + semester (propagated to extracted questions)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.uploads (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id       UUID NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  level           SMALLINT CHECK (level IN (100, 200, 300, 400, 500, 600)),
  semester        SMALLINT CHECK (semester IN (1, 2, 3)),
  file_url        TEXT NOT NULL,
  file_type       file_type NOT NULL,
  original_name   TEXT,
  file_size       BIGINT,
  processed       BOOLEAN NOT NULL DEFAULT false,
  processing_error TEXT,
  questions_extracted INTEGER DEFAULT 0,
  progress        INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
  processing_stage TEXT,
  needs_review    BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_uploads_user      ON public.uploads(user_id);
CREATE INDEX IF NOT EXISTS idx_uploads_course    ON public.uploads(course_id);
CREATE INDEX IF NOT EXISTS idx_uploads_processed ON public.uploads(processed);
DROP TRIGGER IF EXISTS uploads_updated_at ON public.uploads;
CREATE TRIGGER uploads_updated_at BEFORE UPDATE ON public.uploads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- UPLOAD EXTRACTIONS (review-before-publish drafts)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.upload_extractions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  upload_id       UUID NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  position        INT  NOT NULL DEFAULT 0,
  -- Multi-part grouping: rows that share the same (upload_id, group_key) are
  -- materialised into a single question_groups row at publish time. NULL for
  -- standalone (single-part) questions.
  group_key       TEXT,
  stem            TEXT,
  stem_image_urls JSONB DEFAULT '[]'::jsonb,
  part_label      TEXT,
  part_position   INT,
  question_text   TEXT NOT NULL,
  question_type   TEXT NOT NULL DEFAULT 'mcq' CHECK (question_type IN ('mcq','theory')),
  options         JSONB,
  correct_answer  TEXT,
  year            SMALLINT,
  content_hash    TEXT,
  is_duplicate    BOOLEAN NOT NULL DEFAULT false,
  duplicate_of    UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  excluded        BOOLEAN NOT NULL DEFAULT false,
  confirmed       BOOLEAN NOT NULL DEFAULT false,
  image_urls      JSONB DEFAULT '[]'::jsonb,
  has_figure      BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_extractions_upload    ON public.upload_extractions(upload_id);
CREATE INDEX IF NOT EXISTS idx_extractions_hash      ON public.upload_extractions(content_hash);
CREATE INDEX IF NOT EXISTS idx_extractions_group_key ON public.upload_extractions(upload_id, group_key);
DROP TRIGGER IF EXISTS upload_extractions_updated_at ON public.upload_extractions;
CREATE TRIGGER upload_extractions_updated_at BEFORE UPDATE ON public.upload_extractions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- QUESTION ANALYTICS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.question_analytics (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id     UUID NOT NULL UNIQUE REFERENCES public.questions(id) ON DELETE CASCADE,
  views_count     BIGINT NOT NULL DEFAULT 0,
  attempts_count  BIGINT NOT NULL DEFAULT 0,
  last_viewed_at  TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_analytics_question ON public.question_analytics(question_id);
CREATE INDEX IF NOT EXISTS idx_analytics_views    ON public.question_analytics(views_count DESC);

CREATE OR REPLACE FUNCTION create_question_analytics()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.question_analytics (question_id) VALUES (NEW.id)
    ON CONFLICT (question_id) DO NOTHING;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS question_analytics_insert ON public.questions;
CREATE TRIGGER question_analytics_insert AFTER INSERT ON public.questions
  FOR EACH ROW EXECUTE FUNCTION create_question_analytics();

-- ============================================================
-- ATTEMPTS, COMMENTS, FLAGS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.question_attempts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id   UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  answer        TEXT NOT NULL,
  is_correct    BOOLEAN,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_attempts_question ON public.question_attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user     ON public.question_attempts(user_id);
DROP TRIGGER IF EXISTS question_attempts_updated_at ON public.question_attempts;
CREATE TRIGGER question_attempts_updated_at BEFORE UPDATE ON public.question_attempts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE FUNCTION public.bump_attempt_counter()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.question_analytics (question_id, attempts_count)
  VALUES (NEW.question_id, 1)
  ON CONFLICT (question_id) DO UPDATE
    SET attempts_count = public.question_analytics.attempts_count + 1;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS question_attempts_count ON public.question_attempts;
CREATE TRIGGER question_attempts_count AFTER INSERT ON public.question_attempts
  FOR EACH ROW EXECUTE FUNCTION public.bump_attempt_counter();

CREATE TABLE IF NOT EXISTS public.question_comments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id     UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  is_anonymous    BOOLEAN NOT NULL DEFAULT true,
  is_hidden       BOOLEAN NOT NULL DEFAULT false,
  pinned          BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_comments_question ON public.question_comments(question_id);
CREATE INDEX IF NOT EXISTS idx_comments_user     ON public.question_comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_pinned   ON public.question_comments(question_id, pinned);
DROP TRIGGER IF EXISTS question_comments_updated_at ON public.question_comments;
CREATE TRIGGER question_comments_updated_at BEFORE UPDATE ON public.question_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS public.comment_upvotes (
  comment_id  UUID NOT NULL REFERENCES public.question_comments(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_upvotes_user    ON public.comment_upvotes(user_id);
CREATE INDEX IF NOT EXISTS idx_upvotes_comment ON public.comment_upvotes(comment_id);

CREATE TABLE IF NOT EXISTS public.question_flags (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id  UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  reason       TEXT NOT NULL CHECK (reason IN ('incorrect_answer','duplicate','offensive','wrong_course','typo','other')),
  details      TEXT,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ,
  UNIQUE (question_id, user_id, reason)
);
CREATE INDEX IF NOT EXISTS idx_flags_question ON public.question_flags(question_id);
CREATE INDEX IF NOT EXISTS idx_flags_user     ON public.question_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_flags_status   ON public.question_flags(status);

-- ============================================================
-- WALLET / WITHDRAWALS / PAYOUT METHODS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.wallet_ledger (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount          NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  currency        TEXT NOT NULL DEFAULT 'NGN',
  type            transaction_type NOT NULL,
  status          transaction_status NOT NULL DEFAULT 'pending',
  reason          transaction_reason NOT NULL,
  reference_id    TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ledger_user        ON public.wallet_ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_status      ON public.wallet_ledger(status);
CREATE INDEX IF NOT EXISTS idx_ledger_reference   ON public.wallet_ledger(reference_id);
CREATE INDEX IF NOT EXISTS idx_ledger_user_status ON public.wallet_ledger(user_id, status);

CREATE TABLE IF NOT EXISTS public.payout_methods (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bank_code       TEXT NOT NULL,
  bank_name       TEXT,
  account_number  TEXT NOT NULL,
  account_name    TEXT NOT NULL,
  recipient_code  TEXT,
  is_default      BOOLEAN NOT NULL DEFAULT true,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, bank_code, account_number)
);
CREATE INDEX IF NOT EXISTS idx_payout_methods_user ON public.payout_methods(user_id);
DROP TRIGGER IF EXISTS payout_methods_updated_at ON public.payout_methods;
CREATE TRIGGER payout_methods_updated_at BEFORE UPDATE ON public.payout_methods
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE IF NOT EXISTS public.withdrawals (
  id                      UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id                 UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  amount                  NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  bank_account_number     TEXT NOT NULL,
  bank_code               TEXT NOT NULL,
  account_name            TEXT,
  recipient_code          TEXT,
  status                  withdrawal_status NOT NULL DEFAULT 'pending',
  paystack_transfer_code  TEXT,
  failure_reason          TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_withdrawals_user   ON public.withdrawals(user_id);
CREATE INDEX IF NOT EXISTS idx_withdrawals_status ON public.withdrawals(status);
DROP TRIGGER IF EXISTS withdrawals_updated_at ON public.withdrawals;
CREATE TRIGGER withdrawals_updated_at BEFORE UPDATE ON public.withdrawals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- SUBSCRIPTIONS — keyed by department, denormalised TEXT for hot reads
-- ============================================================
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  plan            subscription_plan NOT NULL,
  status          subscription_status NOT NULL DEFAULT 'pending',
  amount          NUMERIC(12, 2) NOT NULL,
  currency        TEXT NOT NULL DEFAULT 'NGN',
  reference       TEXT UNIQUE,
  paystack_access_code TEXT,
  starts_at       TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  university_id   UUID REFERENCES public.universities(id) ON DELETE SET NULL,
  faculty_id      UUID REFERENCES public.faculties(id)    ON DELETE SET NULL,
  department_id   UUID REFERENCES public.departments(id)  ON DELETE SET NULL,
  school          TEXT,
  faculty         TEXT,
  department      TEXT,
  contributor_discount_applied BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user        ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status      ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active ON public.subscriptions(user_id, ends_at) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_faculty_active
  ON public.subscriptions(user_id, faculty_id, ends_at) WHERE status = 'active';
DROP TRIGGER IF EXISTS subscriptions_updated_at ON public.subscriptions;
CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================================
-- DUPLICATES, NOTIFICATIONS, PRACTICE SESSIONS
-- ============================================================
CREATE TABLE IF NOT EXISTS public.question_duplicates (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id_a    UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  question_id_b    UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  similarity_score FLOAT NOT NULL CHECK (similarity_score BETWEEN 0 AND 1),
  resolved         BOOLEAN NOT NULL DEFAULT false,
  kept_question_id UUID REFERENCES public.questions(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id_a, question_id_b)
);

CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  type        TEXT NOT NULL DEFAULT 'info',
  read        BOOLEAN NOT NULL DEFAULT false,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, read);

CREATE TABLE IF NOT EXISTS public.practice_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id       UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  question_type   TEXT,
  reveal_mode     TEXT,
  level           SMALLINT,
  semester        SMALLINT,
  total_questions INTEGER NOT NULL,
  graded_count    INTEGER NOT NULL DEFAULT 0,
  correct_count   INTEGER NOT NULL DEFAULT 0,
  total_score     NUMERIC(6, 3),
  duration_ms     INTEGER,
  details         JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_practice_sessions_user ON public.practice_sessions(user_id, created_at DESC);

-- ============================================================
-- HELPER FUNCTIONS
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_contributor_or_admin()
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND role IN ('contributor','admin'));
$$;

CREATE OR REPLACE FUNCTION increment_question_views(p_question_id UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  INSERT INTO public.question_analytics (question_id, views_count, last_viewed_at)
  VALUES (p_question_id, 1, NOW())
  ON CONFLICT (question_id) DO UPDATE
    SET views_count = question_analytics.views_count + 1, last_viewed_at = NOW();
END;
$$;

CREATE OR REPLACE FUNCTION public.has_active_subscription_for_faculty(
  p_user_id UUID, p_faculty_id UUID
) RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = p_user_id AND status = 'active' AND ends_at > NOW()
      AND faculty_id = p_faculty_id
  );
$$;

CREATE OR REPLACE FUNCTION public.list_unlocked_faculties(p_user_id UUID)
RETURNS TABLE (
  university_id UUID,
  faculty_id    UUID,
  school        TEXT,
  faculty       TEXT,
  plan          subscription_plan,
  starts_at     TIMESTAMPTZ,
  ends_at       TIMESTAMPTZ
) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT DISTINCT ON (faculty_id)
         university_id, faculty_id, school, faculty, plan, starts_at, ends_at
    FROM public.subscriptions
   WHERE user_id  = p_user_id
     AND status   = 'active'
     AND ends_at  > NOW()
     AND faculty_id IS NOT NULL
   ORDER BY faculty_id, ends_at DESC;
$$;

CREATE OR REPLACE FUNCTION public.contributor_question_count(p_user_id UUID)
RETURNS INTEGER LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT COUNT(DISTINCT qc.question_id)::INTEGER
  FROM public.question_contributions qc
  JOIN public.questions q ON q.id = qc.question_id
  WHERE qc.user_id = p_user_id
    AND qc.contribution_type IN ('upload', 'extraction')
    AND q.is_deleted = false
    AND q.status = 'approved';
$$;

-- Mint contribution_reward credits for any newly-crossed 100-question buckets.
-- Each bucket is locked at the rate in effect when minted (rate may change later
-- in admin_settings; past credits are never re-priced).
CREATE OR REPLACE FUNCTION public.mint_contributor_rewards(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  approved_count   INTEGER;
  target_buckets   INTEGER;
  existing_buckets INTEGER;
  rate             NUMERIC;
  i                INTEGER;
  minted           INTEGER := 0;
BEGIN
  SELECT COUNT(DISTINCT q.id) INTO approved_count
  FROM public.question_contributions qc
  JOIN public.questions q ON q.id = qc.question_id
  WHERE qc.user_id = p_user_id
    AND qc.contribution_type IN ('upload','extraction')
    AND q.status = 'approved'
    AND q.is_deleted = false;

  target_buckets := approved_count / 100;
  IF target_buckets = 0 THEN RETURN 0; END IF;

  SELECT COALESCE(MAX((metadata->>'bucket')::INTEGER), 0)
  INTO existing_buckets
  FROM public.wallet_ledger
  WHERE user_id = p_user_id
    AND reason  = 'contribution_reward'
    AND type    = 'credit';

  IF target_buckets <= existing_buckets THEN RETURN 0; END IF;

  SELECT value_num INTO rate
  FROM public.admin_settings WHERE key = 'reward_per_100_questions';
  IF rate IS NULL OR rate <= 0 THEN RETURN 0; END IF;

  FOR i IN (existing_buckets + 1)..target_buckets LOOP
    INSERT INTO public.wallet_ledger
      (user_id, amount, currency, type, status, reason, metadata)
    VALUES
      (p_user_id, rate, 'NGN', 'credit', 'successful', 'contribution_reward',
       jsonb_build_object('bucket', i, 'rate', rate));
    minted := minted + 1;
  END LOOP;

  RETURN minted;
END;
$$;

CREATE OR REPLACE FUNCTION public.questions_mint_rewards_on_approval()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE u UUID;
BEGIN
  IF NEW.status = 'approved' AND NEW.is_deleted = false
     AND (TG_OP = 'INSERT'
          OR OLD.status     IS DISTINCT FROM NEW.status
          OR OLD.is_deleted IS DISTINCT FROM NEW.is_deleted) THEN
    FOR u IN
      SELECT DISTINCT user_id
      FROM public.question_contributions
      WHERE question_id = NEW.id
        AND contribution_type IN ('upload','extraction')
    LOOP
      PERFORM public.mint_contributor_rewards(u);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS questions_mint_on_approval ON public.questions;
CREATE TRIGGER questions_mint_on_approval
  AFTER INSERT OR UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.questions_mint_rewards_on_approval();

GRANT EXECUTE ON FUNCTION public.is_admin()                                   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_contributor_or_admin()                    TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION increment_question_views(UUID)                      TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_active_subscription_for_faculty(UUID, UUID) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_unlocked_faculties(UUID)                   TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.contributor_question_count(UUID)             TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mint_contributor_rewards(UUID)               TO authenticated, service_role;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================
ALTER TABLE public.users                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.universities           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.faculties              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.departments            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.courses                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.uploads                ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.upload_extractions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_analytics     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_attempts      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_comments      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comment_upvotes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_flags         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wallet_ledger          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payout_methods         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.withdrawals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_settings         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.question_duplicates    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.practice_sessions      ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_select_own"   ON public.users;
DROP POLICY IF EXISTS "users_update_own"   ON public.users;
DROP POLICY IF EXISTS "admin_all_users"    ON public.users;
CREATE POLICY "users_select_own" ON public.users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "users_update_own" ON public.users FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "admin_all_users"  ON public.users FOR ALL    USING (public.is_admin());

DROP POLICY IF EXISTS "universities_select_all"  ON public.universities;
DROP POLICY IF EXISTS "universities_admin_write" ON public.universities;
CREATE POLICY "universities_select_all"  ON public.universities FOR SELECT USING (true);
CREATE POLICY "universities_admin_write" ON public.universities FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "faculties_select_all"  ON public.faculties;
DROP POLICY IF EXISTS "faculties_admin_write" ON public.faculties;
CREATE POLICY "faculties_select_all"  ON public.faculties FOR SELECT USING (true);
CREATE POLICY "faculties_admin_write" ON public.faculties FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "departments_select_all"  ON public.departments;
DROP POLICY IF EXISTS "departments_admin_write" ON public.departments;
CREATE POLICY "departments_select_all"  ON public.departments FOR SELECT USING (true);
CREATE POLICY "departments_admin_write" ON public.departments FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "courses_select_all"               ON public.courses;
DROP POLICY IF EXISTS "courses_insert_authenticated"     ON public.courses;
DROP POLICY IF EXISTS "courses_insert_contributor_admin" ON public.courses;
DROP POLICY IF EXISTS "courses_update_admin"             ON public.courses;
DROP POLICY IF EXISTS "courses_delete_admin"             ON public.courses;
CREATE POLICY "courses_select_all"           ON public.courses FOR SELECT USING (true);
CREATE POLICY "courses_insert_authenticated" ON public.courses FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "courses_update_admin"         ON public.courses FOR UPDATE USING (public.is_admin());
CREATE POLICY "courses_delete_admin"         ON public.courses FOR DELETE USING (public.is_admin());

DROP POLICY IF EXISTS "questions_select_approved"    ON public.questions;
DROP POLICY IF EXISTS "questions_select_own_pending" ON public.questions;
DROP POLICY IF EXISTS "questions_insert_contributor" ON public.questions;
DROP POLICY IF EXISTS "questions_update_admin"       ON public.questions;
DROP POLICY IF EXISTS "admin_all_questions"          ON public.questions;
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

DROP POLICY IF EXISTS "contributions_select_own"   ON public.question_contributions;
DROP POLICY IF EXISTS "contributions_select_admin" ON public.question_contributions;
DROP POLICY IF EXISTS "contributions_insert_own"   ON public.question_contributions;
CREATE POLICY "contributions_select_own"   ON public.question_contributions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "contributions_select_admin" ON public.question_contributions FOR SELECT USING (public.is_admin());
CREATE POLICY "contributions_insert_own"   ON public.question_contributions FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_settings_select_all"  ON public.admin_settings;
DROP POLICY IF EXISTS "admin_settings_admin_write" ON public.admin_settings;
CREATE POLICY "admin_settings_select_all"  ON public.admin_settings FOR SELECT USING (true);
CREATE POLICY "admin_settings_admin_write" ON public.admin_settings FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "uploads_select_own" ON public.uploads;
DROP POLICY IF EXISTS "uploads_insert_own" ON public.uploads;
DROP POLICY IF EXISTS "admin_all_uploads"  ON public.uploads;
CREATE POLICY "uploads_select_own" ON public.uploads FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "uploads_insert_own" ON public.uploads FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin_all_uploads"  ON public.uploads FOR ALL    USING (public.is_admin());

DROP POLICY IF EXISTS "extractions_owner_select" ON public.upload_extractions;
DROP POLICY IF EXISTS "extractions_owner_write"  ON public.upload_extractions;
DROP POLICY IF EXISTS "extractions_admin_all"    ON public.upload_extractions;
CREATE POLICY "extractions_owner_select" ON public.upload_extractions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.uploads u WHERE u.id = upload_id AND u.user_id = auth.uid())
);
CREATE POLICY "extractions_owner_write" ON public.upload_extractions FOR ALL USING (
  EXISTS (SELECT 1 FROM public.uploads u WHERE u.id = upload_id AND u.user_id = auth.uid())
) WITH CHECK (
  EXISTS (SELECT 1 FROM public.uploads u WHERE u.id = upload_id AND u.user_id = auth.uid())
);
CREATE POLICY "extractions_admin_all" ON public.upload_extractions FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "analytics_select_all" ON public.question_analytics;
CREATE POLICY "analytics_select_all" ON public.question_analytics FOR SELECT USING (true);

DROP POLICY IF EXISTS "attempts_owner_select" ON public.question_attempts;
DROP POLICY IF EXISTS "attempts_owner_write"  ON public.question_attempts;
DROP POLICY IF EXISTS "attempts_admin_all"    ON public.question_attempts;
CREATE POLICY "attempts_owner_select" ON public.question_attempts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "attempts_owner_write"  ON public.question_attempts FOR ALL    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "attempts_admin_all"    ON public.question_attempts FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "comments_select_public" ON public.question_comments;
DROP POLICY IF EXISTS "comments_insert_auth"   ON public.question_comments;
DROP POLICY IF EXISTS "comments_update_owner"  ON public.question_comments;
DROP POLICY IF EXISTS "comments_delete_owner"  ON public.question_comments;
DROP POLICY IF EXISTS "comments_admin_all"     ON public.question_comments;
CREATE POLICY "comments_select_public" ON public.question_comments FOR SELECT USING (is_hidden = false);
CREATE POLICY "comments_insert_auth"   ON public.question_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_update_owner"  ON public.question_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "comments_delete_owner"  ON public.question_comments FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "comments_admin_all"     ON public.question_comments FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "upvotes_select_all" ON public.comment_upvotes;
DROP POLICY IF EXISTS "upvotes_insert_own" ON public.comment_upvotes;
DROP POLICY IF EXISTS "upvotes_delete_own" ON public.comment_upvotes;
DROP POLICY IF EXISTS "upvotes_admin_all"  ON public.comment_upvotes;
CREATE POLICY "upvotes_select_all" ON public.comment_upvotes FOR SELECT USING (true);
CREATE POLICY "upvotes_insert_own" ON public.comment_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "upvotes_delete_own" ON public.comment_upvotes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "upvotes_admin_all"  ON public.comment_upvotes FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "flags_insert_auth" ON public.question_flags;
DROP POLICY IF EXISTS "flags_select_own"  ON public.question_flags;
DROP POLICY IF EXISTS "flags_admin_all"   ON public.question_flags;
CREATE POLICY "flags_insert_auth" ON public.question_flags FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "flags_select_own"  ON public.question_flags FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "flags_admin_all"   ON public.question_flags FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "ledger_select_own" ON public.wallet_ledger;
DROP POLICY IF EXISTS "admin_all_ledger"  ON public.wallet_ledger;
CREATE POLICY "ledger_select_own" ON public.wallet_ledger FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "admin_all_ledger"  ON public.wallet_ledger FOR ALL    USING (public.is_admin());

DROP POLICY IF EXISTS "payout_methods_select_own" ON public.payout_methods;
DROP POLICY IF EXISTS "payout_methods_insert_own" ON public.payout_methods;
DROP POLICY IF EXISTS "payout_methods_update_own" ON public.payout_methods;
DROP POLICY IF EXISTS "payout_methods_delete_own" ON public.payout_methods;
DROP POLICY IF EXISTS "admin_all_payout_methods"  ON public.payout_methods;
CREATE POLICY "payout_methods_select_own" ON public.payout_methods FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "payout_methods_insert_own" ON public.payout_methods FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "payout_methods_update_own" ON public.payout_methods FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "payout_methods_delete_own" ON public.payout_methods FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "admin_all_payout_methods"  ON public.payout_methods FOR ALL    USING (public.is_admin());

DROP POLICY IF EXISTS "withdrawals_select_own" ON public.withdrawals;
DROP POLICY IF EXISTS "withdrawals_insert_own" ON public.withdrawals;
DROP POLICY IF EXISTS "admin_all_withdrawals"  ON public.withdrawals;
CREATE POLICY "withdrawals_select_own" ON public.withdrawals FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "withdrawals_insert_own" ON public.withdrawals FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "admin_all_withdrawals"  ON public.withdrawals FOR ALL    USING (public.is_admin());

DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
DROP POLICY IF EXISTS "admin_all_subscriptions"  ON public.subscriptions;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "admin_all_subscriptions"  ON public.subscriptions FOR ALL    USING (public.is_admin());

DROP POLICY IF EXISTS "admin_all_duplicates"     ON public.question_duplicates;
DROP POLICY IF EXISTS "notifications_select_own" ON public.notifications;
DROP POLICY IF EXISTS "notifications_update_own" ON public.notifications;
DROP POLICY IF EXISTS "admin_all_notifications"  ON public.notifications;
CREATE POLICY "admin_all_duplicates"     ON public.question_duplicates FOR ALL USING (public.is_admin());
CREATE POLICY "notifications_select_own" ON public.notifications FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "notifications_update_own" ON public.notifications FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "admin_all_notifications"  ON public.notifications FOR ALL    USING (public.is_admin());

DROP POLICY IF EXISTS "practice_sessions_select_own" ON public.practice_sessions;
DROP POLICY IF EXISTS "practice_sessions_insert_own" ON public.practice_sessions;
DROP POLICY IF EXISTS "practice_sessions_delete_own" ON public.practice_sessions;
DROP POLICY IF EXISTS "admin_all_practice_sessions"  ON public.practice_sessions;
CREATE POLICY "practice_sessions_select_own" ON public.practice_sessions FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "practice_sessions_insert_own" ON public.practice_sessions FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "practice_sessions_delete_own" ON public.practice_sessions FOR DELETE USING (user_id = auth.uid());
CREATE POLICY "admin_all_practice_sessions"  ON public.practice_sessions FOR ALL    USING (public.is_admin());

-- ============================================================
-- ROLE GRANTS
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT ON public.universities         TO anon, authenticated;
GRANT SELECT ON public.faculties            TO anon, authenticated;
GRANT SELECT ON public.departments          TO anon, authenticated;
GRANT SELECT ON public.courses              TO anon, authenticated;
GRANT SELECT ON public.questions            TO anon, authenticated;
GRANT SELECT ON public.question_analytics   TO anon, authenticated;
GRANT SELECT ON public.admin_settings       TO anon, authenticated;
GRANT SELECT ON public.question_comments    TO anon, authenticated;
GRANT SELECT ON public.comment_upvotes      TO anon, authenticated;

GRANT SELECT, INSERT, UPDATE        ON public.users                  TO authenticated;
GRANT INSERT, UPDATE                ON public.courses                TO authenticated;
GRANT INSERT, UPDATE, DELETE        ON public.questions              TO authenticated;
GRANT SELECT, INSERT                ON public.question_contributions TO authenticated;
GRANT SELECT, INSERT                ON public.uploads                TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.upload_extractions    TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_attempts     TO authenticated;
GRANT INSERT, UPDATE, DELETE        ON public.question_comments      TO authenticated;
GRANT INSERT, DELETE                ON public.comment_upvotes        TO authenticated;
GRANT SELECT, INSERT                ON public.question_flags         TO authenticated;
GRANT SELECT                        ON public.wallet_ledger          TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_methods        TO authenticated;
GRANT SELECT, INSERT                ON public.withdrawals            TO authenticated;
GRANT SELECT                        ON public.subscriptions          TO authenticated;
GRANT SELECT, INSERT, UPDATE        ON public.notifications          TO authenticated;
GRANT SELECT                        ON public.question_duplicates    TO authenticated;
GRANT SELECT, INSERT, DELETE        ON public.practice_sessions      TO authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;

-- ============================================================
-- STORAGE BUCKETS (idempotent)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
  VALUES ('exam-uploads',    'exam-uploads',    false) ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
  VALUES ('avatars',         'avatars',         true)  ON CONFLICT (id) DO NOTHING;
INSERT INTO storage.buckets (id, name, public)
  VALUES ('question-images', 'question-images', true)
  ON CONFLICT (id) DO UPDATE SET public = true;

DO $$ BEGIN CREATE POLICY "question_images_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'question-images'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "question_images_owner_write" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'question-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "question_images_owner_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'question-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE POLICY "question_images_owner_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'question-images' AND auth.uid()::text = (storage.foldername(name))[1]);
  EXCEPTION WHEN duplicate_object THEN NULL; END $$;
