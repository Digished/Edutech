import { SubscriptionPlan } from '@/types/database';

// Per-department pricing for paid access. Amounts are in Naira.
export const SUBSCRIPTION_PLANS: Record<
  SubscriptionPlan,
  {
    label: string;
    amount: number;        // per (school, department) combo
    durationDays: number;
    monthlyEquivalent: number;
    perks: string[];
  }
> = {
  monthly: {
    label: 'Monthly',
    amount: 1500,
    durationDays: 30,
    monthlyEquivalent: 1500,
    perks: ['Full access to the chosen department', 'Practice exams', 'Step-by-step explanations'],
  },
  quarterly: {
    label: '3 months',
    amount: 3000,
    durationDays: 90,
    monthlyEquivalent: 1000,
    perks: ['Save ₦1,500 vs monthly', 'Full access to the chosen department', 'Step-by-step explanations'],
  },
  yearly: {
    label: '12 months',
    amount: 10000,
    durationDays: 365,
    monthlyEquivalent: Math.round(10000 / 12),
    perks: ['Best value — save ₦8,000', 'Full access to the chosen department', 'Priority support'],
  },
};

export const CONTRIBUTOR_DISCOUNT_FRACTION = 0.6; // 60% off for contributors

export function isSubscriptionPlan(value: string): value is SubscriptionPlan {
  return value in SUBSCRIPTION_PLANS;
}

export function planEndDate(plan: SubscriptionPlan, from: Date = new Date()): Date {
  const out = new Date(from);
  out.setUTCDate(out.getUTCDate() + SUBSCRIPTION_PLANS[plan].durationDays);
  return out;
}

export interface BundlePricing {
  perCombo: number;
  comboCount: number;
  gross: number;       // before discount
  discount: number;    // amount knocked off
  net: number;         // what the user actually pays
  discountPct: number; // 0..1
  contributor: boolean;
}

// Pricing for a multi-department checkout. The discount applies to the whole
// bundle so each row records the user's actual paid share.
export function priceBundle(
  plan: SubscriptionPlan,
  comboCount: number,
  contributor: boolean,
): BundlePricing {
  const perCombo = SUBSCRIPTION_PLANS[plan].amount;
  const gross = perCombo * comboCount;
  const discountPct = contributor ? CONTRIBUTOR_DISCOUNT_FRACTION : 0;
  const discount = Math.round(gross * discountPct);
  const net = gross - discount;
  return { perCombo, comboCount, gross, discount, net, discountPct, contributor };
}

// What gets stored on each row's `amount` so summing all rows ties out to net.
export function paidShareForCombo(
  plan: SubscriptionPlan,
  comboCount: number,
  contributor: boolean,
): number {
  const { net } = priceBundle(plan, comboCount, contributor);
  // Spread the net evenly across rows; round to 2dp; the last row absorbs any
  // remainder so the sum is exact.
  return parseFloat((net / comboCount).toFixed(2));
}
