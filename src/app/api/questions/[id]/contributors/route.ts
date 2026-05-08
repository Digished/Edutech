import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { ok, notFound, serverError } from '@/lib/utils/response';

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const { data: question } = await supabase
      .from('questions')
      .select('id')
      .eq('id', id)
      .eq('is_deleted', false)
      .single();

    if (!question) return notFound('Question not found');

    const { data, error } = await supabase
      .from('question_contributions')
      .select(`
        id,
        contribution_type,
        contribution_weight,
        created_at,
        users(id, full_name, school, department)
      `)
      .eq('question_id', id)
      .order('created_at', { ascending: true });

    if (error) return serverError(error.message);
    return ok(data);
  } catch {
    return serverError();
  }
}
