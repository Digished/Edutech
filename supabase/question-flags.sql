-- ============================================================
-- Question flags — users report problematic questions; admins triage.
-- ============================================================

CREATE TABLE IF NOT EXISTS public.question_flags (
  id           UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id  UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
  user_id      UUID NOT NULL REFERENCES public.users(id)     ON DELETE CASCADE,
  reason       TEXT NOT NULL CHECK (reason IN (
                 'incorrect_answer','duplicate','offensive',
                 'wrong_course','typo','other'
               )),
  details      TEXT,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open','reviewed','dismissed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  reviewed_at  TIMESTAMPTZ,
  UNIQUE (question_id, user_id, reason)
);

CREATE INDEX IF NOT EXISTS idx_flags_question ON public.question_flags(question_id);
CREATE INDEX IF NOT EXISTS idx_flags_user     ON public.question_flags(user_id);
CREATE INDEX IF NOT EXISTS idx_flags_status   ON public.question_flags(status);

ALTER TABLE public.question_flags ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "flags_insert_auth"   ON public.question_flags;
DROP POLICY IF EXISTS "flags_select_own"    ON public.question_flags;
DROP POLICY IF EXISTS "flags_admin_all"     ON public.question_flags;

CREATE POLICY "flags_insert_auth" ON public.question_flags
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "flags_select_own" ON public.question_flags
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "flags_admin_all" ON public.question_flags
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT, INSERT          ON public.question_flags TO authenticated;
GRANT ALL                     ON public.question_flags TO service_role;
