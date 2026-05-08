// ============================================================
// Supabase Database Types — used to type the Supabase client
// Run `supabase gen types typescript --project-id <id>` to regenerate
// ============================================================

export type Json = string | number | boolean | null | { [key: string]: Json } | Json[];

type EmptyRelationships = [];

export interface Database {
  public: {
    Views: Record<string, never>;
    Tables: {
      users: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          school: string | null;
          department: string | null;
          role: 'student' | 'contributor' | 'admin';
          is_banned: boolean;
          ban_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          school?: string | null;
          department?: string | null;
          role?: 'student' | 'contributor' | 'admin';
          is_banned?: boolean;
          ban_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          email?: string;
          full_name?: string | null;
          school?: string | null;
          department?: string | null;
          role?: 'student' | 'contributor' | 'admin';
          is_banned?: boolean;
          ban_reason?: string | null;
          updated_at?: string;
        };
        Relationships: EmptyRelationships;
      };
      universities: {
        Row: {
          id: string;
          name: string;
          short_name: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          short_name?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          short_name?: string | null;
          updated_at?: string;
        };
        Relationships: EmptyRelationships;
      };
      departments: {
        Row: {
          id: string;
          university_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          university_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          university_id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: EmptyRelationships;
      };
      courses: {
        Row: {
          id: string;
          school: string;
          department: string;
          name: string;
          code: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          school: string;
          department: string;
          name: string;
          code?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          school?: string;
          department?: string;
          name?: string;
          code?: string | null;
          updated_at?: string;
        };
        Relationships: EmptyRelationships;
      };
      questions: {
        Row: {
          id: string;
          course_id: string;
          question_text: string;
          options: Json | null;
          correct_answer: string | null;
          year: number | null;
          question_type: 'mcq' | 'theory';
          source_type: 'uploaded' | 'manual' | 'extracted';
          status: 'pending' | 'approved' | 'rejected';
          is_deleted: boolean;
          content_hash: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          question_text: string;
          options?: Json | null;
          correct_answer?: string | null;
          year?: number | null;
          question_type?: 'mcq' | 'theory';
          source_type?: 'uploaded' | 'manual' | 'extracted';
          status?: 'pending' | 'approved' | 'rejected';
          is_deleted?: boolean;
          content_hash?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          course_id?: string;
          question_text?: string;
          options?: Json | null;
          correct_answer?: string | null;
          year?: number | null;
          question_type?: 'mcq' | 'theory';
          source_type?: 'uploaded' | 'manual' | 'extracted';
          status?: 'pending' | 'approved' | 'rejected';
          is_deleted?: boolean;
          content_hash?: string | null;
          updated_at?: string;
        };
        Relationships: EmptyRelationships;
      };
      question_contributions: {
        Row: {
          id: string;
          question_id: string;
          user_id: string;
          contribution_type: 'upload' | 'edit' | 'extraction' | 'correction';
          contribution_weight: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          user_id: string;
          contribution_type: 'upload' | 'edit' | 'extraction' | 'correction';
          contribution_weight?: number;
          created_at?: string;
        };
        Update: {
          question_id?: string;
          user_id?: string;
          contribution_type?: 'upload' | 'edit' | 'extraction' | 'correction';
          contribution_weight?: number;
        };
        Relationships: EmptyRelationships;
      };
      uploads: {
        Row: {
          id: string;
          user_id: string;
          course_id: string;
          file_url: string;
          file_type: 'pdf' | 'image';
          original_name: string | null;
          file_size: number | null;
          processed: boolean;
          processing_error: string | null;
          questions_extracted: number;
          progress: number;
          processing_stage: string | null;
          needs_review: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_id: string;
          file_url: string;
          file_type: 'pdf' | 'image';
          original_name?: string | null;
          file_size?: number | null;
          processed?: boolean;
          processing_error?: string | null;
          questions_extracted?: number;
          progress?: number;
          processing_stage?: string | null;
          needs_review?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          processed?: boolean;
          processing_error?: string | null;
          questions_extracted?: number;
          progress?: number;
          processing_stage?: string | null;
          needs_review?: boolean;
          updated_at?: string;
        };
        Relationships: EmptyRelationships;
      };
      upload_extractions: {
        Row: {
          id: string;
          upload_id: string;
          position: number;
          question_text: string;
          question_type: 'mcq' | 'theory';
          options: Json | null;
          correct_answer: string | null;
          year: number | null;
          content_hash: string | null;
          is_duplicate: boolean;
          duplicate_of: string | null;
          excluded: boolean;
          confirmed: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          upload_id: string;
          position?: number;
          question_text: string;
          question_type?: 'mcq' | 'theory';
          options?: Json | null;
          correct_answer?: string | null;
          year?: number | null;
          content_hash?: string | null;
          is_duplicate?: boolean;
          duplicate_of?: string | null;
          excluded?: boolean;
          confirmed?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          position?: number;
          question_text?: string;
          question_type?: 'mcq' | 'theory';
          options?: Json | null;
          correct_answer?: string | null;
          year?: number | null;
          content_hash?: string | null;
          is_duplicate?: boolean;
          duplicate_of?: string | null;
          excluded?: boolean;
          confirmed?: boolean;
          updated_at?: string;
        };
        Relationships: EmptyRelationships;
      };
      question_attempts: {
        Row: {
          id: string;
          question_id: string;
          user_id: string;
          answer: string;
          is_correct: boolean | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          user_id: string;
          answer: string;
          is_correct?: boolean | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          answer?: string;
          is_correct?: boolean | null;
          updated_at?: string;
        };
        Relationships: EmptyRelationships;
      };
      question_comments: {
        Row: {
          id: string;
          question_id: string;
          user_id: string;
          body: string;
          is_anonymous: boolean;
          is_hidden: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          question_id: string;
          user_id: string;
          body: string;
          is_anonymous?: boolean;
          is_hidden?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          is_anonymous?: boolean;
          is_hidden?: boolean;
          updated_at?: string;
        };
        Relationships: EmptyRelationships;
      };
      question_flags: {
        Row: {
          id: string;
          question_id: string;
          user_id: string;
          reason: string;
          details: string | null;
          status: string;
          created_at: string;
          reviewed_at: string | null;
        };
        Insert: {
          id?: string;
          question_id: string;
          user_id: string;
          reason: string;
          details?: string | null;
          status?: string;
          created_at?: string;
          reviewed_at?: string | null;
        };
        Update: {
          reason?: string;
          details?: string | null;
          status?: string;
          reviewed_at?: string | null;
        };
        Relationships: EmptyRelationships;
      };
      question_analytics: {
        Row: {
          id: string;
          question_id: string;
          views_count: number;
          attempts_count: number;
          last_viewed_at: string | null;
        };
        Insert: {
          id?: string;
          question_id: string;
          views_count?: number;
          attempts_count?: number;
          last_viewed_at?: string | null;
        };
        Update: {
          views_count?: number;
          attempts_count?: number;
          last_viewed_at?: string | null;
        };
        Relationships: EmptyRelationships;
      };
      wallet_ledger: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          currency: string;
          type: 'credit' | 'debit';
          status: 'pending' | 'successful' | 'failed';
          reason: 'contribution_reward' | 'withdrawal' | 'adjustment' | 'refund';
          reference_id: string | null;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          currency?: string;
          type: 'credit' | 'debit';
          status?: 'pending' | 'successful' | 'failed';
          reason: 'contribution_reward' | 'withdrawal' | 'adjustment' | 'refund';
          reference_id?: string | null;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          status?: 'pending' | 'successful' | 'failed';
          reference_id?: string | null;
          metadata?: Json | null;
        };
        Relationships: EmptyRelationships;
      };
      withdrawals: {
        Row: {
          id: string;
          user_id: string;
          amount: number;
          bank_account_number: string;
          bank_code: string;
          account_name: string | null;
          recipient_code: string | null;
          status: 'pending' | 'processing' | 'successful' | 'failed';
          paystack_transfer_code: string | null;
          failure_reason: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          amount: number;
          bank_account_number: string;
          bank_code: string;
          account_name?: string | null;
          recipient_code?: string | null;
          status?: 'pending' | 'processing' | 'successful' | 'failed';
          paystack_transfer_code?: string | null;
          failure_reason?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: 'pending' | 'processing' | 'successful' | 'failed';
          paystack_transfer_code?: string | null;
          failure_reason?: string | null;
          recipient_code?: string | null;
          account_name?: string | null;
          updated_at?: string;
        };
        Relationships: EmptyRelationships;
      };
      revenue_pool: {
        Row: {
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
        };
        Insert: {
          id?: string;
          total_revenue: number;
          contribution_pool_percentage?: number;
          period_start: string;
          period_end: string;
          distributed?: boolean;
          distributed_at?: string | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          distributed?: boolean;
          distributed_at?: string | null;
          notes?: string | null;
          total_revenue?: number;
          contribution_pool_percentage?: number;
        };
        Relationships: EmptyRelationships;
      };
      question_duplicates: {
        Row: {
          id: string;
          question_id_a: string;
          question_id_b: string;
          similarity_score: number;
          resolved: boolean;
          kept_question_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          question_id_a: string;
          question_id_b: string;
          similarity_score: number;
          resolved?: boolean;
          kept_question_id?: string | null;
          created_at?: string;
        };
        Update: {
          resolved?: boolean;
          kept_question_id?: string | null;
        };
        Relationships: EmptyRelationships;
      };
      notifications: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          body: string;
          type: string;
          read: boolean;
          metadata: Json | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          body: string;
          type?: string;
          read?: boolean;
          metadata?: Json | null;
          created_at?: string;
        };
        Update: {
          read?: boolean;
        };
        Relationships: EmptyRelationships;
      };
    };
    Functions: {
      get_wallet_balance: {
        Args: { p_user_id: string };
        Returns: number;
      };
      increment_question_views: {
        Args: { p_question_id: string };
        Returns: undefined;
      };
    };
    Enums: Record<string, never>;
  };
}
