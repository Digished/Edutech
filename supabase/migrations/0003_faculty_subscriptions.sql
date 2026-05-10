-- ============================================================
-- Migration: subscriptions are now keyed per FACULTY.
--   * Backfill any rows that were department-keyed but missing a faculty_id.
--   * Replace department-keyed RPCs with faculty-keyed equivalents.
--   * department_id / department / school columns are kept for analytics
--     and backwards reads, but no longer required for access checks.
-- ============================================================

BEGIN;

-- 1. Backfill faculty_id / faculty for any old department-only rows.
UPDATE public.subscriptions s
   SET faculty_id    = d.faculty_id,
       faculty       = COALESCE(s.faculty, f.name),
       university_id = COALESCE(s.university_id, f.university_id),
       school        = COALESCE(s.school, u.name)
  FROM public.departments  d
  JOIN public.faculties    f ON f.id = d.faculty_id
  JOIN public.universities u ON u.id = f.university_id
 WHERE s.department_id = d.id
   AND s.faculty_id   IS NULL;

-- 2. Faculty-keyed access predicate.
DROP FUNCTION IF EXISTS public.has_active_subscription_for(UUID, TEXT, TEXT);
CREATE OR REPLACE FUNCTION public.has_active_subscription_for_faculty(
  p_user_id UUID, p_faculty_id UUID
) RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = p_user_id
      AND status  = 'active'
      AND ends_at > NOW()
      AND faculty_id = p_faculty_id
  );
$$;
GRANT EXECUTE ON FUNCTION public.has_active_subscription_for_faculty(UUID, UUID)
  TO authenticated, service_role;

-- 3. Faculty-keyed list. One row per faculty (latest-ending wins on dupes).
DROP FUNCTION IF EXISTS public.list_unlocked_departments(UUID);
DROP FUNCTION IF EXISTS public.list_unlocked_faculties(UUID);
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
GRANT EXECUTE ON FUNCTION public.list_unlocked_faculties(UUID)
  TO authenticated, service_role;

-- 4. Hot-path index for the faculty access lookup.
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_faculty_active
  ON public.subscriptions(user_id, faculty_id, ends_at) WHERE status = 'active';

COMMIT;
