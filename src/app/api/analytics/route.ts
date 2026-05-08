import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ok, serverError } from '@/lib/utils/response';

// GET /api/analytics?course_id= — public course/question analytics
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = req.nextUrl;
    const course_id = searchParams.get('course_id');

    const supabase = await createClient();

    if (course_id) {
      // Analytics for a specific course
      const { data } = await supabase
        .from('questions')
        .select(`
          id, question_text, year,
          question_analytics(views_count, last_viewed_at)
        `)
        .eq('course_id', course_id)
        .eq('status', 'approved')
        .eq('is_deleted', false)
        .order('question_analytics(views_count)', { ascending: false })
        .limit(50);

      return ok({ course_id, questions: data ?? [] });
    }

    // Platform-wide public stats
    const [{ count: totalQuestions }, { count: totalCourses }] = await Promise.all([
      supabase
        .from('questions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'approved')
        .eq('is_deleted', false),
      supabase.from('courses').select('*', { count: 'exact', head: true }),
    ]);

    return ok({
      total_questions: totalQuestions ?? 0,
      total_courses: totalCourses ?? 0,
    });
  } catch {
    return serverError();
  }
}
