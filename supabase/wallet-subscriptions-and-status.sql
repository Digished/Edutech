-- ============================================================
-- Wallet, Subscriptions & Contributor Status Migration
-- ============================================================
-- Adds:
--   * payout_methods       — saved bank details so withdrawals auto-fill
--   * subscriptions        — paid access tiers (monthly / quarterly / yearly)
--   * users.payout_method_id (default saved method)
--   * Reduces revenue_pool default contribution_pool_percentage 70 -> 50
-- ============================================================

-- ---------------- subscription / contributor enums ----------------
DO $$ BEGIN
  CREATE TYPE subscription_plan AS ENUM ('monthly', 'quarterly', 'yearly');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_status AS ENUM ('pending', 'active', 'expired', 'cancelled');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ---------------- payout_methods ----------------
CREATE TABLE IF NOT EXISTS public.payout_methods (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  bank_code           TEXT NOT NULL,
  bank_name           TEXT,
  account_number      TEXT NOT NULL,
  account_name        TEXT NOT NULL,
  recipient_code      TEXT,
  is_default          BOOLEAN NOT NULL DEFAULT true,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, bank_code, account_number)
);

CREATE INDEX IF NOT EXISTS idx_payout_methods_user ON public.payout_methods(user_id);

DO $$ BEGIN
  CREATE TRIGGER payout_methods_updated_at BEFORE UPDATE ON public.payout_methods
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.payout_methods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payout_methods_select_own" ON public.payout_methods;
CREATE POLICY "payout_methods_select_own" ON public.payout_methods
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "payout_methods_insert_own" ON public.payout_methods;
CREATE POLICY "payout_methods_insert_own" ON public.payout_methods
  FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "payout_methods_update_own" ON public.payout_methods;
CREATE POLICY "payout_methods_update_own" ON public.payout_methods
  FOR UPDATE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "payout_methods_delete_own" ON public.payout_methods;
CREATE POLICY "payout_methods_delete_own" ON public.payout_methods
  FOR DELETE USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_all_payout_methods" ON public.payout_methods;
CREATE POLICY "admin_all_payout_methods" ON public.payout_methods
  FOR ALL USING (public.is_admin());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.payout_methods TO authenticated;
GRANT ALL ON public.payout_methods TO service_role;

-- ---------------- subscriptions ----------------
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
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON public.subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user_active
  ON public.subscriptions(user_id, ends_at) WHERE status = 'active';

DO $$ BEGIN
  CREATE TRIGGER subscriptions_updated_at BEFORE UPDATE ON public.subscriptions
    FOR EACH ROW EXECUTE FUNCTION update_updated_at();
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "subscriptions_select_own" ON public.subscriptions;
CREATE POLICY "subscriptions_select_own" ON public.subscriptions
  FOR SELECT USING (user_id = auth.uid());

DROP POLICY IF EXISTS "admin_all_subscriptions" ON public.subscriptions;
CREATE POLICY "admin_all_subscriptions" ON public.subscriptions
  FOR ALL USING (public.is_admin());

GRANT SELECT ON public.subscriptions TO authenticated;
GRANT ALL ON public.subscriptions TO service_role;

-- ---------------- helpers ----------------
CREATE OR REPLACE FUNCTION public.has_active_subscription(p_user_id UUID)
RETURNS BOOLEAN LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.subscriptions
    WHERE user_id = p_user_id
      AND status = 'active'
      AND ends_at > NOW()
  );
$$;

GRANT EXECUTE ON FUNCTION public.has_active_subscription(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.get_active_subscription(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  plan subscription_plan,
  status subscription_status,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ
) LANGUAGE sql SECURITY DEFINER STABLE SET search_path = public AS $$
  SELECT id, plan, status, starts_at, ends_at
  FROM public.subscriptions
  WHERE user_id = p_user_id
    AND status = 'active'
    AND ends_at > NOW()
  ORDER BY ends_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.get_active_subscription(UUID) TO authenticated, service_role;

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

GRANT EXECUTE ON FUNCTION public.contributor_question_count(UUID) TO authenticated, service_role;

-- ---------------- defaults ----------------
ALTER TABLE public.revenue_pool
  ALTER COLUMN contribution_pool_percentage SET DEFAULT 50.0;

-- Optional: bring existing un-distributed pools in line with the new share.
UPDATE public.revenue_pool
   SET contribution_pool_percentage = 50.0
 WHERE distributed = false
   AND contribution_pool_percentage = 70.0;
