import { getPaystackClient } from './client';
import {
  PaystackInitializePayload,
  PaystackInitializeResponse,
  PaystackVerifyResponse,
} from '@/types/paystack';

export async function initializeTransaction(
  payload: PaystackInitializePayload,
): Promise<PaystackInitializeResponse['data']> {
  const client = getPaystackClient();
  const { data } = await client.post<PaystackInitializeResponse>(
    '/transaction/initialize',
    payload,
  );
  if (!data.status) throw new Error(data.message);
  return data.data;
}

export async function verifyTransaction(
  reference: string,
): Promise<PaystackVerifyResponse['data']> {
  const client = getPaystackClient();
  const { data } = await client.get<PaystackVerifyResponse>(
    `/transaction/verify/${encodeURIComponent(reference)}`,
  );
  if (!data.status) throw new Error(data.message);
  return data.data;
}
