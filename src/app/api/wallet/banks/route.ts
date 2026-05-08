import { ok, serverError } from '@/lib/utils/response';
import { fetchBanks } from '@/lib/paystack/transfers';

// GET /api/wallet/banks — list Nigerian banks
export async function GET() {
  try {
    const banks = await fetchBanks();
    return ok(banks);
  } catch {
    return serverError('Could not fetch bank list');
  }
}
