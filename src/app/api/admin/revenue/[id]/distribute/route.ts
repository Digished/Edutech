import { NextRequest } from 'next/server';
import { requireRole } from '@/lib/utils/auth';
import { distributeRevenuePool, calculateContributorShares } from '@/lib/contributions/rewards';
import { ok, unauthorized, serverError } from '@/lib/utils/response';

// GET /api/admin/revenue/[id]/distribute — preview distribution
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized();

    const { id } = await params;
    const shares = await calculateContributorShares(id);
    return ok({ shares, total_recipients: shares.length });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Calculation failed';
    return serverError(message);
  }
}

// POST /api/admin/revenue/[id]/distribute — execute distribution
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { profile, error } = await requireRole(['admin']);
    if (error || !profile) return unauthorized();

    const { id } = await params;
    const recipientCount = await distributeRevenuePool(id);
    return ok({ recipients_paid: recipientCount }, 'Revenue pool distributed successfully');
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Distribution failed';
    return serverError(message);
  }
}
