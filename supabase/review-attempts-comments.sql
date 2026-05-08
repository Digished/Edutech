-- ============================================================
-- Review-before-publish drafts, user attempts, anonymous comments
-- ============================================================

-- A) Review drafts produced by OCR — user edits + confirms before they
--    enter the public `questions` table.
CREATE TABLE IF NOT EXISTS public.upload_extractions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  upload_id       UUID NOT NULL REFERENCES public.uploads(id) ON DELETE CASCADE,
  position        INT  NOT NULL DEFAULT 0,
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
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_extractions_upload ON public.upload_extractions(upload_id);
CREATE INDEX IF NOT EXISTS idx_extractions_hash   ON public.upload_extractions(content_hash);

DROP TRIGGER IF EXISTS upload_extractions_updated_at ON public.upload_extractions;
CREATE TRIGGER upload_extractions_updated_at BEFORE UPDATE ON public.upload_extractions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.upload_extractions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "extractions_owner_select" ON public.upload_extractions;
DROP POLICY IF EXISTS "extractions_owner_write"  ON public.upload_extractions;
DROP POLICY IF EXISTS "extractions_admin_all"    ON public.upload_extractions;

CREATE POLICY "extractions_owner_select" ON public.upload_extractions
  FOR SELECT USING (EXISTS (
    SELECT 1 FROM public.uploads u WHERE u.id = upload_id AND u.user_id = auth.uid()
  ));

CREATE POLICY "extractions_owner_write" ON public.upload_extractions
  FOR ALL USING (EXISTS (
    SELECT 1 FROM public.uploads u WHERE u.id = upload_id AND u.user_id = auth.uid()
  )) WITH CHECK (EXISTS (
    SELECT 1 FROM public.uploads u WHERE u.id = upload_id AND u.user_id = auth.uid()
  ));

CREATE POLICY "extractions_admin_all" ON public.upload_extractions
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.upload_extractions TO authenticated;
GRANT ALL ON public.upload_extractions TO service_role;

-- After upload_extractions table is added, mark uploads that need review.
ALTER TABLE public.uploads
  ADD COLUMN IF NOT EXISTS needs_review BOOLEAN NOT NULL DEFAULT false;


-- B) Per-user attempts at a question (answer + correctness + freeform).
CREATE TABLE IF NOT EXISTS public.question_attempts (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id   UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id       UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  answer        TEXT NOT NULL,
  is_correct    BOOLEAN,            -- only set for MCQs with a known correct_answer
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (question_id, user_id)     -- one canonical attempt per user; updates overwrite
);

CREATE INDEX IF NOT EXISTS idx_attempts_question ON public.question_attempts(question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_user     ON public.question_attempts(user_id);

DROP TRIGGER IF EXISTS question_attempts_updated_at ON public.question_attempts;
CREATE TRIGGER question_attempts_updated_at BEFORE UPDATE ON public.question_attempts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.question_attempts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "attempts_owner_select" ON public.question_attempts;
DROP POLICY IF EXISTS "attempts_owner_write"  ON public.question_attempts;
DROP POLICY IF EXISTS "attempts_admin_all"    ON public.question_attempts;

CREATE POLICY "attempts_owner_select" ON public.question_attempts FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "attempts_owner_write"  ON public.question_attempts FOR ALL    USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "attempts_admin_all"    ON public.question_attempts FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.question_attempts TO authenticated;
GRANT ALL ON public.question_attempts TO service_role;

-- Bump attempt counter on the analytics row when a new attempt is logged.
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


-- C) Public, optionally-anonymous comments on questions.
CREATE TABLE IF NOT EXISTS public.question_comments (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id     UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  is_anonymous    BOOLEAN NOT NULL DEFAULT true,
  is_hidden       BOOLEAN NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_comments_question ON public.question_comments(question_id);
CREATE INDEX IF NOT EXISTS idx_comments_user     ON public.question_comments(user_id);

DROP TRIGGER IF EXISTS question_comments_updated_at ON public.question_comments;
CREATE TRIGGER question_comments_updated_at BEFORE UPDATE ON public.question_comments
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE public.question_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "comments_select_public" ON public.question_comments;
DROP POLICY IF EXISTS "comments_insert_auth"   ON public.question_comments;
DROP POLICY IF EXISTS "comments_update_owner"  ON public.question_comments;
DROP POLICY IF EXISTS "comments_delete_owner"  ON public.question_comments;
DROP POLICY IF EXISTS "comments_admin_all"     ON public.question_comments;

-- Anyone can read non-hidden comments. Note: user_id stays in the row so authors
-- can edit their own; the API anonymises the user info before returning it.
CREATE POLICY "comments_select_public" ON public.question_comments FOR SELECT USING (is_hidden = false);
CREATE POLICY "comments_insert_auth"   ON public.question_comments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_update_owner"  ON public.question_comments FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "comments_delete_owner"  ON public.question_comments FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "comments_admin_all"     ON public.question_comments FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT          ON public.question_comments TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.question_comments TO authenticated;
GRANT ALL ON public.question_comments TO service_role;
