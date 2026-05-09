-- ============================================================
-- DEV WIPE: clear all users + user-generated content.
-- Universities, departments and the revenue_pool seed are kept.
-- Run from the Supabase SQL editor (service-role).
-- ============================================================

BEGIN;

TRUNCATE
  public.practice_sessions,
  public.notifications,
  public.subscriptions,
  public.payout_methods,
  public.withdrawals,
  public.wallet_ledger,
  public.question_duplicates,
  public.question_attempts,
  public.question_flags,
  public.comment_upvotes,
  public.question_comments,
  public.high_yield_tags,
  public.question_contributions,
  public.question_analytics,
  public.questions,
  public.upload_extractions,
  public.uploads,
  public.courses,
  public.departments,
  public.faculties,
  public.universities
RESTART IDENTITY CASCADE;

-- Uncomment if you want to wipe revenue distribution history too:
-- TRUNCATE public.revenue_pool RESTART IDENTITY CASCADE;

-- Cascades into public.users, then into anything else still referencing it.
DELETE FROM auth.users;

COMMIT;
