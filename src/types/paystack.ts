// ============================================================
// Paystack API Types
// ============================================================

export interface PaystackInitializePayload {
  email: string;
  amount: number; // in kobo (NGN * 100)
  reference?: string;
  callback_url?: string;
  metadata?: Record<string, unknown>;
}

export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    status: 'success' | 'failed' | 'abandoned';
    reference: string;
    amount: number;
    currency: string;
    paid_at: string;
    customer: {
      email: string;
      customer_code: string;
    };
    metadata: Record<string, unknown>;
  };
}

export interface PaystackTransferRecipientPayload {
  type: 'nuban';
  name: string;
  account_number: string;
  bank_code: string;
  currency: 'NGN';
}

export interface PaystackTransferRecipientResponse {
  status: boolean;
  message: string;
  data: {
    recipient_code: string;
    id: number;
    name: string;
    account_number: string;
    bank_code: string;
    currency: string;
  };
}

export interface PaystackInitiateTransferPayload {
  source: 'balance';
  amount: number;
  recipient: string;
  reason?: string;
  reference?: string;
}

export interface PaystackInitiateTransferResponse {
  status: boolean;
  message: string;
  data: {
    transfer_code: string;
    id: number;
    amount: number;
    status: string;
    reference: string;
  };
}

export interface PaystackWebhookEvent {
  event: string;
  data: Record<string, unknown>;
}

export interface PaystackBankListItem {
  id: number;
  name: string;
  code: string;
  country: string;
  currency: string;
}
