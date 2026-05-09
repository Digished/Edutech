-- ============================================================
-- Cached question explanations + persisted practice sessions
-- Run after question-images.sql
-- ============================================================

-- ---- explanations cache on questions ----
ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS explanation TEXT;

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS explanation_generated_at TIMESTAMPTZ;

-- ---- practice sessions ----
CREATE TABLE IF NOT EXISTS public.practice_sessions (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  course_id       UUID REFERENCES public.courses(id) ON DELETE SET NULL,
  question_type   TEXT,                         -- 'mcq' | 'theory' | 'all'
  reveal_mode     TEXT,                         -- 'after_each' | 'at_end'
  total_questions INTEGER NOT NULL,
  graded_count    INTEGER NOT NULL DEFAULT 0,
  correct_count   INTEGER NOT NULL DEFAULT 0,
  total_score     NUMERIC(6, 3),
  duration_ms     INTEGER,
  details         JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_practice_sessions_user
  ON public.practice_sessions(user_id, created_at DESC);

ALTER TABLE public.practice_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "practice_sessions_select_own" ON public.practice_sessions;
CREATE POLICY "practice_sessions_select_own" ON public.practice_sessions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "practice_sessions_insert_own" ON public.practice_sessions;
CREATE POLICY "practice_sessions_insert_own" ON public.practice_sessions
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "practice_sessions_delete_own" ON public.practice_sessions;
CREATE POLICY "practice_sessions_delete_own" ON public.practice_sessions
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_all_practice_sessions" ON public.practice_sessions;
CREATE POLICY "admin_all_practice_sessions" ON public.practice_sessions
  FOR ALL USING (public.is_admin());

GRANT SELECT, INSERT, DELETE ON public.practice_sessions TO authenticated;
GRANT ALL ON public.practice_sessions TO service_role;
