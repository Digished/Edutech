// ============================================================
// Database Types — mirrors Supabase schema exactly
// ============================================================

export type UserRole = 'student' | 'contributor' | 'admin';
export type SourceType = 'uploaded' | 'manual' | 'extracted';
export type ContributionType = 'upload' | 'edit' | 'extraction' | 'correction';
export type TransactionType = 'credit' | 'debit';
export type TransactionStatus = 'pending' | 'successful' | 'failed';
export type TransactionReason = 'contribution_reward' | 'withdrawal' | 'adjustment' | 'refund';
export type WithdrawalStatus = 'pending' | 'processing' | 'successful' | 'failed';
export type FileType = 'pdf' | 'image';
export type ModerationStatus = 'pending' | 'approved' | 'rejected';
export type QuestionType = 'mcq' | 'theory';

export interface User {
  id: string;
  email: string;
  full_name: string | null;
  school: string | null;
  department: string | null;
  role: UserRole;
  is_banned: boolean;
  ban_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface Course {
  id: string;
  school: string;
  department: string;
  name: string;
  code: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export type QuestionOptions = Record<string, string>; // { A: "...", B: "...", ... }

export interface Question {
  id: string;
  course_id: string;
  question_text: string;
  options: QuestionOptions | null;
  correct_answer: string | null;
  year: number | null;
  question_type: QuestionType;
  source_type: SourceType;
  status: ModerationStatus;
  is_deleted: boolean;
  content_hash: string | null;
  image_urls: string[] | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionContribution {
  id: string;
  question_id: string;
  user_id: string;
  contribution_type: ContributionType;
  contribution_weight: number;
  created_at: string;
}

export interface Upload {
  id: string;
  user_id: string;
  course_id: string;
  file_url: string;
  file_type: FileType;
  original_name: string | null;
  file_size: number | null;
  processed: boolean;
  processing_error: string | null;
  questions_extracted: number;
  progress: number;
  processing_stage: string | null;
  created_at: string;
  updated_at: string;
}

export interface QuestionAnalytics {
  id: string;
  question_id: string;
  views_count: number;
  attempts_count: number;
  last_viewed_at: string | null;
}

export interface WalletLedger {
  id: string;
  user_id: string;
  amount: number;
  currency: string;
  type: TransactionType;
  status: TransactionStatus;
  reason: TransactionReason;
  reference_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Withdrawal {
  id: string;
  user_id: string;
  amount: number;
  bank_account_number: string;
  bank_code: string;
  account_name: string | null;
  recipient_code: string | null;
  status: WithdrawalStatus;
  paystack_transfer_code: string | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
}

export interface RevenuePool {
  id: string;
  total_revenue: number;
  contribution_pool_percentage: number;
  payout_pool_amount: number;
  period_start: string;
  period_end: string;
  distributed: boolean;
  distributed_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface QuestionDuplicate {
  id: string;
  question_id_a: string;
  question_id_b: string;
  similarity_score: number;
  resolved: boolean;
  kept_question_id: string | null;
  created_at: string;
}

export interface Notification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  type: string;
  read: boolean;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export type SubscriptionPlan = 'monthly' | 'quarterly' | 'yearly';
export type SubscriptionStatusType = 'pending' | 'active' | 'expired' | 'cancelled';

export interface PayoutMethod {
  id: string;
  user_id: string;
  bank_code: string;
  bank_name: string | null;
  account_number: string;
  account_name: string;
  recipient_code: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: SubscriptionPlan;
  status: SubscriptionStatusType;
  amount: number;
  currency: string;
  reference: string | null;
  paystack_access_code: string | null;
  starts_at: string | null;
  ends_at: string | null;
  school: string | null;
  department: string | null;
  contributor_discount_applied: boolean;
  created_at: string;
  updated_at: string;
}

export interface UnlockedDepartment {
  id: string;
  school: string;
  department: string;
  plan: SubscriptionPlan;
  starts_at: string | null;
  ends_at: string | null;
}

// ============================================================
// API Request / Response shapes
// ============================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
