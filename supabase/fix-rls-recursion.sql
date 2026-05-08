-- ============================================================
-- FIX: Infinite recursion in users RLS policies
-- The admin policies query public.users to check role, but
-- querying users triggers the policy again → infinite loop.
-- Solution: use a SECURITY DEFINER function that bypasses RLS.
-- ============================================================

-- 1. Create helper function that checks admin role without RLS
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

CREATE OR REPLACE FUNCTION public.is_contributor_or_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role IN ('contributor','admin')
  );
$$;

GRANT EXECUTE ON FUNCTION public.is_admin()                 TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_contributor_or_admin()  TO anon, authenticated, service_role;

-- 2. Drop all recursive policies
DROP POLICY IF EXISTS "admin_all_users"              ON public.users;
DROP POLICY IF EXISTS "courses_insert_contributor_admin" ON public.courses;
DROP POLICY IF EXISTS "courses_update_admin"         ON public.courses;
DROP POLICY IF EXISTS "courses_delete_admin"         ON public.courses;
DROP POLICY IF EXISTS "questions_insert_contributor" ON public.questions;
DROP POLICY IF EXISTS "questions_update_admin"       ON public.questions;
DROP POLICY IF EXISTS "admin_all_questions"          ON public.questions;
DROP POLICY IF EXISTS "contributions_select_admin"   ON public.question_contributions;
DROP POLICY IF EXISTS "admin_all_uploads"            ON public.uploads;
DROP POLICY IF EXISTS "admin_all_ledger"             ON public.wallet_ledger;
DROP POLICY IF EXISTS "admin_all_withdrawals"        ON public.withdrawals;
DROP POLICY IF EXISTS "admin_all_revenue_pool"       ON public.revenue_pool;
DROP POLICY IF EXISTS "admin_all_duplicates"         ON public.question_duplicates;
DROP POLICY IF EXISTS "admin_all_notifications"      ON public.notifications;

-- 3. Recreate using the non-recursive helper functions
CREATE POLICY "admin_all_users"              ON public.users              FOR ALL    USING (public.is_admin());
CREATE POLICY "courses_insert_contributor_admin" ON public.courses        FOR INSERT WITH CHECK (public.is_contributor_or_admin());
CREATE POLICY "courses_update_admin"         ON public.courses            FOR UPDATE USING (public.is_admin());
CREATE POLICY "courses_delete_admin"         ON public.courses            FOR DELETE USING (public.is_admin());
CREATE POLICY "questions_insert_contributor" ON public.questions          FOR INSERT WITH CHECK (public.is_contributor_or_admin());
CREATE POLICY "questions_update_admin"       ON public.questions          FOR UPDATE USING (public.is_admin());
CREATE POLICY "admin_all_questions"          ON public.questions          FOR ALL    USING (public.is_admin());
CREATE POLICY "contributions_select_admin"   ON public.question_contributions FOR SELECT USING (public.is_admin());
CREATE POLICY "admin_all_uploads"            ON public.uploads            FOR ALL    USING (public.is_admin());
CREATE POLICY "admin_all_ledger"             ON public.wallet_ledger      FOR ALL    USING (public.is_admin());
CREATE POLICY "admin_all_withdrawals"        ON public.withdrawals        FOR ALL    USING (public.is_admin());
CREATE POLICY "admin_all_revenue_pool"       ON public.revenue_pool       FOR ALL    USING (public.is_admin());
CREATE POLICY "admin_all_duplicates"         ON public.question_duplicates FOR ALL   USING (public.is_admin());
CREATE POLICY "admin_all_notifications"      ON public.notifications      FOR ALL    USING (public.is_admin());
