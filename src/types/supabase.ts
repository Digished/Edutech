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
      faculties: {
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
      departments: {
        Row: {
          id: string;
          faculty_id: string;
          name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          faculty_id: string;
          name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          faculty_id?: string;
          name?: string;
          updated_at?: string;
        };
        Relationships: EmptyRelationships;
      };
      courses: {
        Row: {
          id: string;
          university_id: string;
          faculty_id: string;
          department_id: string;
          school: string;
          faculty: string;
          department: string;
          name: string;
          code: string | null;
          created_by: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          university_id: string;
          faculty_id: string;
          department_id: string;
          school: string;
          faculty: string;
          department: string;
          name: string;
          code?: string | null;
          created_by?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          university_id?: string;
          faculty_id?: string;
          department_id?: string;
          school?: string;
          faculty?: string;
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
          group_id: string | null;
          part_label: string | null;
          position: number | null;
          points: number | null;
          question_text: string;
          options: Json | null;
          correct_answer: string | null;
          year: number | null;
          level: number | null;
          semester: number | null;
          question_type: 'mcq' | 'theory';
          source_type: 'uploaded' | 'manual' | 'extracted';
          status: 'pending' | 'approved' | 'rejected';
          is_deleted: boolean;
          content_hash: string | null;
          image_urls: Json | null;
          explanation: string | null;
          explanation_generated_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          group_id?: string | null;
          part_label?: string | null;
          position?: number | null;
          points?: number | null;
          question_text: string;
          options?: Json | null;
          correct_answer?: string | null;
          year?: number | null;
          level?: number | null;
          semester?: number | null;
          question_type?: 'mcq' | 'theory';
          source_type?: 'uploaded' | 'manual' | 'extracted';
          status?: 'pending' | 'approved' | 'rejected';
          is_deleted?: boolean;
          content_hash?: string | null;
          image_urls?: Json | null;
          explanation?: string | null;
          explanation_generated_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          course_id?: string;
          group_id?: string | null;
          part_label?: string | null;
          position?: number | null;
          points?: number | null;
          question_text?: string;
          options?: Json | null;
          correct_answer?: string | null;
          year?: number | null;
          level?: number | null;
          semester?: number | null;
          question_type?: 'mcq' | 'theory';
          source_type?: 'uploaded' | 'manual' | 'extracted';
          status?: 'pending' | 'approved' | 'rejected';
          is_deleted?: boolean;
          content_hash?: string | null;
          image_urls?: Json | null;
          explanation?: string | null;
          explanation_generated_at?: string | null;
          updated_at?: string;
        };
        Relationships: EmptyRelationships;
      };
      question_groups: {
        Row: {
          id: string;
          course_id: string;
          stem: string;
          stem_image_urls: Json;
          year: number | null;
          level: number | null;
          semester: number | null;
          source_type: 'uploaded' | 'manual' | 'extracted';
          status: 'pending' | 'approved' | 'rejected';
          is_deleted: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          course_id: string;
          stem: string;
          stem_image_urls?: Json;
          year?: number | null;
          level?: number | null;
          semester?: number | null;
          source_type?: 'uploaded' | 'manual' | 'extracted';
          status?: 'pending' | 'approved' | 'rejected';
          is_deleted?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          stem?: string;
          stem_image_urls?: Json;
          year?: number | null;
          level?: number | null;
          semester?: number | null;
          status?: 'pending' | 'approved' | 'rejected';
          is_deleted?: boolean;
          updated_at?: string;
        };
        Relationships: EmptyRelationships;
      };
      practice_sessions: {
        Row: {
          id: string;
          user_id: string;
          course_id: string | null;
          question_type: string | null;
          reveal_mode: string | null;
          level: number | null;
          semester: number | null;
          total_questions: number;
          graded_count: number;
          correct_count: number;
          total_score: number | null;
          duration_ms: number | null;
          details: Json;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          course_id?: string | null;
          question_type?: string | null;
          reveal_mode?: string | null;
          level?: number | null;
          semester?: number | null;
          total_questions: number;
          graded_count?: number;
          correct_count?: number;
          total_score?: number | null;
          duration_ms?: number | null;
          details: Json;
          created_at?: string;
        };
        Update: {
          level?: number | null;
          semester?: number | null;
          total_questions?: number;
          graded_count?: number;
          correct_count?: number;
          total_score?: number | null;
          duration_ms?: number | null;
          details?: Json;
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
          level: number | null;
          semester: number | null;
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
          level?: number | null;
          semester?: number | null;
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
          level?: number | null;
          semester?: number | null;
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
          group_key: string | null;
          stem: string | null;
          stem_image_urls: Json | null;
          part_label: string | null;
          part_position: number | null;
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
          image_urls: Json | null;
          has_figure: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          upload_id: string;
          position?: number;
          group_key?: string | null;
          stem?: string | null;
          stem_image_urls?: Json | null;
          part_label?: string | null;
          part_position?: number | null;
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
          image_urls?: Json | null;
          has_figure?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          position?: number;
          group_key?: string | null;
          stem?: string | null;
          stem_image_urls?: Json | null;
          part_label?: string | null;
          part_position?: number | null;
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
          image_urls?: Json | null;
          has_figure?: boolean;
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
          pinned: boolean;
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
          pinned?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          is_anonymous?: boolean;
          is_hidden?: boolean;
          pinned?: boolean;
          updated_at?: string;
        };
        Relationships: EmptyRelationships;
      };
      comment_upvotes: {
        Row: {
          comment_id: string;
          user_id: string;
          created_at: string;
        };
        Insert: {
          comment_id: string;
          user_id: string;
          created_at?: string;
        };
        Update: {
          created_at?: string;
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
      admin_settings: {
        Row: {
          key: string;
          value_num: number | null;
          value_text: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          key: string;
          value_num?: number | null;
          value_text?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          value_num?: number | null;
          value_text?: string | null;
          updated_at?: string;
          updated_by?: string | null;
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
      payout_methods: {
        Row: {
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
        };
        Insert: {
          id?: string;
          user_id: string;
          bank_code: string;
          bank_name?: string | null;
          account_number: string;
          account_name: string;
          recipient_code?: string | null;
          is_default?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          bank_code?: string;
          bank_name?: string | null;
          account_number?: string;
          account_name?: string;
          recipient_code?: string | null;
          is_default?: boolean;
          updated_at?: string;
        };
        Relationships: EmptyRelationships;
      };
      subscriptions: {
        Row: {
          id: string;
          user_id: string;
          plan: 'monthly' | 'quarterly' | 'yearly';
          status: 'pending' | 'active' | 'expired' | 'cancelled';
          amount: number;
          currency: string;
          reference: string | null;
          paystack_access_code: string | null;
          starts_at: string | null;
          ends_at: string | null;
          university_id: string | null;
          faculty_id: string | null;
          department_id: string | null;
          school: string | null;
          faculty: string | null;
          department: string | null;
          contributor_discount_applied: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          plan: 'monthly' | 'quarterly' | 'yearly';
          status?: 'pending' | 'active' | 'expired' | 'cancelled';
          amount: number;
          currency?: string;
          reference?: string | null;
          paystack_access_code?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          university_id?: string | null;
          faculty_id?: string | null;
          department_id?: string | null;
          school?: string | null;
          faculty?: string | null;
          department?: string | null;
          contributor_discount_applied?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          status?: 'pending' | 'active' | 'expired' | 'cancelled';
          reference?: string | null;
          paystack_access_code?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          university_id?: string | null;
          faculty_id?: string | null;
          department_id?: string | null;
          school?: string | null;
          faculty?: string | null;
          department?: string | null;
          contributor_discount_applied?: boolean;
          updated_at?: string;
        };
        Relationships: EmptyRelationships;
      };
    };
    Functions: {
      increment_question_views: {
        Args: { p_question_id: string };
        Returns: undefined;
      };
      mint_contributor_rewards: {
        Args: { p_user_id: string };
        Returns: number;
      };
      has_active_subscription_for_faculty: {
        Args: { p_user_id: string; p_faculty_id: string };
        Returns: boolean;
      };
      list_unlocked_faculties: {
        Args: { p_user_id: string };
        Returns: {
          university_id: string | null;
          faculty_id: string;
          school: string | null;
          faculty: string | null;
          plan: 'monthly' | 'quarterly' | 'yearly';
          starts_at: string | null;
          ends_at: string | null;
        }[];
      };
      contributor_question_count: {
        Args: { p_user_id: string };
        Returns: number;
      };
    };
    Enums: Record<string, never>;
  };
}
