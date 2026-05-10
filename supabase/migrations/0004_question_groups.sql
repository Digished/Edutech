-- ============================================================
-- Migration: multi-part theory questions.
--
-- A "question group" is a shared stem (e.g. "Given the model ABC...")
-- with one or more child questions, each its own (a)/(1)/(i) sub-part.
-- Standalone questions keep group_id = NULL — no behavioural change.
-- ============================================================

BEGIN;

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

ALTER TABLE public.questions
  ADD COLUMN IF NOT EXISTS group_id   UUID REFERENCES public.question_groups(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS part_label TEXT,
  ADD COLUMN IF NOT EXISTS position   INT,
  ADD COLUMN IF NOT EXISTS points     INT;
CREATE INDEX IF NOT EXISTS idx_questions_group ON public.questions(group_id);

ALTER TABLE public.upload_extractions
  ADD COLUMN IF NOT EXISTS group_key  TEXT,
  ADD COLUMN IF NOT EXISTS stem       TEXT,
  ADD COLUMN IF NOT EXISTS stem_image_urls JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS part_label TEXT,
  ADD COLUMN IF NOT EXISTS part_position INT;
CREATE INDEX IF NOT EXISTS idx_extractions_group_key ON public.upload_extractions(upload_id, group_key);

COMMIT;
