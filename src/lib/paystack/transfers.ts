import { getPaystackClient } from './client';
import {
  PaystackTransferRecipientPayload,
  PaystackTransferRecipientResponse,
  PaystackInitiateTransferPayload,
  PaystackInitiateTransferResponse,
  PaystackBankListItem,
} from '@/types/paystack';
import { generateReference } from '@/lib/utils/hash';

export async function createTransferRecipient(
  payload: PaystackTransferRecipientPayload,
): Promise<PaystackTransferRecipientResponse['data']> {
  const client = getPaystackClient();
  const { data } = await client.post<PaystackTransferRecipientResponse>(
    '/transferrecipient',
    payload,
  );
  if (!data.status) throw new Error(data.message);
  return data.data;
}

export async function initiateTransfer(
  payload: PaystackInitiateTransferPayload,
): Promise<PaystackInitiateTransferResponse['data']> {
  const client = getPaystackClient();
  const ref = payload.reference ?? generateReference('TRF');
  const { data } = await client.post<PaystackInitiateTransferResponse>('/transfer', {
    ...payload,
    reference: ref,
  });
  if (!data.status) throw new Error(data.message);
  return data.data;
}

export async function fetchBanks(): Promise<PaystackBankListItem[]> {
  const client = getPaystackClient();
  const { data } = await client.get<{ status: boolean; data: PaystackBankListItem[] }>(
    '/bank?currency=NGN&perPage=100',
  );
  return data.data;
}

export async function verifyAccountNumber(
  accountNumber: string,
  bankCode: string,
): Promise<{ account_name: string; account_number: string }> {
  const client = getPaystackClient();
  const { data } = await client.get(
    `/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
  );
  if (!data.status) throw new Error(data.message);
  return data.data;
}
