-- ============================================================
-- Comment upvotes + pinning. Treats `question_comments` as
-- "answers/discussions" and lets users surface the best ones.
-- ============================================================

-- Pin flag on the existing comments table.
ALTER TABLE public.question_comments
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_comments_pinned ON public.question_comments(question_id, pinned);

-- One upvote per user per comment.
CREATE TABLE IF NOT EXISTS public.comment_upvotes (
  comment_id  UUID NOT NULL REFERENCES public.question_comments(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id)             ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (comment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_upvotes_user    ON public.comment_upvotes(user_id);
CREATE INDEX IF NOT EXISTS idx_upvotes_comment ON public.comment_upvotes(comment_id);

ALTER TABLE public.comment_upvotes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "upvotes_select_all"   ON public.comment_upvotes;
DROP POLICY IF EXISTS "upvotes_insert_own"   ON public.comment_upvotes;
DROP POLICY IF EXISTS "upvotes_delete_own"   ON public.comment_upvotes;
DROP POLICY IF EXISTS "upvotes_admin_all"    ON public.comment_upvotes;

CREATE POLICY "upvotes_select_all" ON public.comment_upvotes FOR SELECT USING (true);
CREATE POLICY "upvotes_insert_own" ON public.comment_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "upvotes_delete_own" ON public.comment_upvotes FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "upvotes_admin_all"  ON public.comment_upvotes FOR ALL    USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT          ON public.comment_upvotes TO anon, authenticated;
GRANT INSERT, DELETE  ON public.comment_upvotes TO authenticated;
GRANT ALL             ON public.comment_upvotes TO service_role;
