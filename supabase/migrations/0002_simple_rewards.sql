-- ============================================================
-- Migration: simplify contributor rewards
--   * admin_settings table (configurable per-100 reward)
--   * mint_contributor_rewards() — locks each ₦/100 bucket at the
--     rate in effect when it was crossed
--   * trigger on questions to mint after approval
--   * drop revenue_pool, high_yield_tags, get_wallet_balance,
--     can_high_yield_tag (no longer used)
-- ============================================================

BEGIN;

-- 1. Admin settings ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.admin_settings (
  key         TEXT PRIMARY KEY,
  value_num   NUMERIC,
  value_text  TEXT,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by  UUID REFERENCES public.users(id) ON DELETE SET NULL
);

INSERT INTO public.admin_settings (key, value_num)
VALUES ('reward_per_100_questions', 1000)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.admin_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "admin_settings_select_all"  ON public.admin_settings;
DROP POLICY IF EXISTS "admin_settings_admin_write" ON public.admin_settings;
CREATE POLICY "admin_settings_select_all"  ON public.admin_settings
  FOR SELECT USING (true);
CREATE POLICY "admin_settings_admin_write" ON public.admin_settings
  FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin());

GRANT SELECT ON public.admin_settings TO anon, authenticated;

-- 2. Mint reward credits -------------------------------------------------------
-- Counts approved (status='approved', not deleted) questions a user has
-- contributed to as upload/extraction. Each crossed-100 bucket gets a single
-- credit at whatever the current rate is — past buckets are never re-priced.
CREATE OR REPLACE FUNCTION public.mint_contributor_rewards(p_user_id UUID)
RETURNS INTEGER LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public AS $$
DECLARE
  approved_count   INTEGER;
  target_buckets   INTEGER;
  existing_buckets INTEGER;
  rate             NUMERIC;
  i                INTEGER;
  minted           INTEGER := 0;
BEGIN
  SELECT COUNT(DISTINCT q.id) INTO approved_count
  FROM public.question_contributions qc
  JOIN public.questions q ON q.id = qc.question_id
  WHERE qc.user_id = p_user_id
    AND qc.contribution_type IN ('upload','extraction')
    AND q.status = 'approved'
    AND q.is_deleted = false;

  target_buckets := approved_count / 100;
  IF target_buckets = 0 THEN RETURN 0; END IF;

  SELECT COALESCE(MAX((metadata->>'bucket')::INTEGER), 0)
  INTO existing_buckets
  FROM public.wallet_ledger
  WHERE user_id = p_user_id
    AND reason  = 'contribution_reward'
    AND type    = 'credit';

  IF target_buckets <= existing_buckets THEN RETURN 0; END IF;

  SELECT value_num INTO rate
  FROM public.admin_settings WHERE key = 'reward_per_100_questions';
  IF rate IS NULL OR rate <= 0 THEN RETURN 0; END IF;

  FOR i IN (existing_buckets + 1)..target_buckets LOOP
    INSERT INTO public.wallet_ledger
      (user_id, amount, currency, type, status, reason, metadata)
    VALUES
      (p_user_id, rate, 'NGN', 'credit', 'successful', 'contribution_reward',
       jsonb_build_object('bucket', i, 'rate', rate));
    minted := minted + 1;
  END LOOP;

  RETURN minted;
END;
$$;

GRANT EXECUTE ON FUNCTION public.mint_contributor_rewards(UUID)
  TO authenticated, service_role;

-- 3. Trigger: mint on approval -------------------------------------------------
CREATE OR REPLACE FUNCTION public.questions_mint_rewards_on_approval()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE u UUID;
BEGIN
  IF NEW.status = 'approved' AND NEW.is_deleted = false
     AND (TG_OP = 'INSERT'
          OR OLD.status     IS DISTINCT FROM NEW.status
          OR OLD.is_deleted IS DISTINCT FROM NEW.is_deleted) THEN
    FOR u IN
      SELECT DISTINCT user_id
      FROM public.question_contributions
      WHERE question_id = NEW.id
        AND contribution_type IN ('upload','extraction')
    LOOP
      PERFORM public.mint_contributor_rewards(u);
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS questions_mint_on_approval ON public.questions;
CREATE TRIGGER questions_mint_on_approval
  AFTER INSERT OR UPDATE ON public.questions
  FOR EACH ROW EXECUTE FUNCTION public.questions_mint_rewards_on_approval();

-- 4. Drop legacy ---------------------------------------------------------------
DROP FUNCTION IF EXISTS public.can_high_yield_tag(UUID, UUID);
DROP FUNCTION IF EXISTS public.assert_high_yield_not_contributor() CASCADE;
DROP FUNCTION IF EXISTS public.get_wallet_balance(UUID);
DROP TABLE    IF EXISTS public.high_yield_tags CASCADE;
DROP TABLE    IF EXISTS public.revenue_pool   CASCADE;

COMMIT;
