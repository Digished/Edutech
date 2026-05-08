import { NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/utils/auth';
import { verifyAccountNumber } from '@/lib/paystack/transfers';
import { ok, badRequest, unauthorized, serverError } from '@/lib/utils/response';

const schema = z.object({
  account_number: z.string().regex(/^\d{10}$/, 'Account number must be 10 digits'),
  bank_code: z.string().min(1),
});

// POST /api/wallet/resolve-account — proxies Paystack's bank/resolve so the
// frontend can show the verified account name as the user types.
export async function POST(req: NextRequest) {
  try {
    const { profile, error } = await requireRole(['student', 'contributor', 'admin']);
    if (error || !profile) return unauthorized(error ?? 'Unauthorized');

    const body = await req.json();
    const parsed = schema.safeParse(body);
    if (!parsed.success) return badRequest(parsed.error.issues[0].message);

    try {
      const data = await verifyAccountNumber(parsed.data.account_number, parsed.data.bank_code);
      return ok({ account_name: data.account_name, account_number: data.account_number });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not resolve account';
      return badRequest(message);
    }
  } catch {
    return serverError();
  }
}
