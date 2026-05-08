import { NextRequest } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getAuthUser } from '@/lib/utils/auth';
import { ok, unauthorized, serverError, paginated } from '@/lib/utils/response';
import { getPagination } from '@/lib/utils/pagination';

// GET /api/wallet — balance + ledger
export async function GET(req: NextRequest) {
  try {
    const { authUser, error } = await getAuthUser();
    if (error || !authUser) return unauthorized();

    const { searchParams } = req.nextUrl;
    const page = parseInt(searchParams.get('page') ?? '1');
    const limit = parseInt(searchParams.get('limit') ?? '20');
    const { from, to } = getPagination(page, limit);

    const supabase = await createClient();

    // Compute balance using DB function
    const { data: balanceData } = await supabase.rpc('get_wallet_balance', {
      p_user_id: authUser.id,
    });

    const { data: ledger, count, error: ledgerError } = await supabase
      .from('wallet_ledger')
      .select('*', { count: 'exact' })
      .eq('user_id', authUser.id)
      .order('created_at', { ascending: false })
      .range(from, to);

    if (ledgerError) return serverError(ledgerError.message);

    return ok({
      balance: balanceData ?? 0,
      currency: 'NGN',
      ledger: {
        data: ledger ?? [],
        total: count ?? 0,
        page,
        limit,
        totalPages: Math.ceil((count ?? 0) / limit),
      },
    });
  } catch {
    return serverError();
  }
}
