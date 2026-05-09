-- ============================================================
-- Subscriptions per (university, department) + multi-combo bundles
-- + contributor 60% discount.
-- Run AFTER explanations-and-sessions.sql.
-- ============================================================

-- ---- columns ----
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS school     TEXT,
  ADD COLUMN IF NOT EXISTS department TEXT,
  -- Whether the contributor discount applied at checkout time. Cosmetic — actual
  -- amount paid is on `amount` per row.
  ADD COLUMN IF NOT EXISTS contributor_discount_applied BOOLEAN NOT NULL DEFAULT false;

-- Existing rows from the old global model don't fit the new (school, department)
-- shape, so flag them expired so they don't grant access.
UPDATE public.subscriptions
   SET status = 'expired'
 WHERE (school IS NULL OR department IS NULL)
   AND status = 'active';

CREATE INDEX IF NOT EXISTS idx_subscriptions_user_dept_active
  ON public.subscriptions(user_id, school, department, ends_at)
  WHERE status = 'active';

-- ---- helpers ----

-- Drop legacy single-subscription helpers — every check is now per (school, dept).
DROP FUNCTION IF EXISTS public.has_active_subscription(UUID);
DROP FUNCTION IF EXISTS public.get_active_subscription(UUID);

CREATE OR REPLACE FUNCTION public.has_active_subscription_for(
  p_user_id UUID, p_school TEXT, p_department TEXT
)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = p_user_id
      AND status = 'active'
      AND ends_at > NOW()
      AND school = p_school
      AND department = p_department
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription_for(UUID, TEXT, TEXT)
  TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.list_unlocked_departments(p_user_id UUID)
RETURNS TABLE (
  id         UUID,
  school     TEXT,
  department TEXT,
  plan       subscription_plan,
  starts_at  TIMESTAMPTZ,
  ends_at    TIMESTAMPTZ
) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT id, school, department, plan, starts_at, ends_at
  FROM public.subscriptions
  WHERE user_id = p_user_id
    AND status = 'active'
    AND ends_at > NOW()
    AND school IS NOT NULL
    AND department IS NOT NULL
  ORDER BY ends_at DESC;
$$;

GRANT EXECUTE ON FUNCTION public.list_unlocked_departments(UUID)
  TO authenticated, service_role;
