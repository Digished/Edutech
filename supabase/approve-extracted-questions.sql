-- ============================================================
-- Backfill: auto-approve previously-extracted questions so they
-- actually appear in the public question bank.
-- (Manually-submitted questions still go through admin review.)
-- ============================================================

UPDATE public.questions
   SET status = 'approved'
 WHERE source_type = 'extracted'
   AND status = 'pending'
   AND is_deleted = false;
