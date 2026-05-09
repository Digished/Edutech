import { SubscriptionPlan } from '@/types/database';

// Pricing for paid access. Amounts are in Naira.
export const SUBSCRIPTION_PLANS: Record<
  SubscriptionPlan,
  {
    label: string;
    amount: number;
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
    perks: ['All approved questions unlocked', 'Practice exams', 'AI-graded theory'],
  },
  quarterly: {
    label: '3 months',
    amount: 3000,
    durationDays: 90,
    monthlyEquivalent: 1000,
    perks: ['Save ₦1,500 vs monthly', 'All approved questions unlocked', 'AI-graded theory'],
  },
  yearly: {
    label: '12 months',
    amount: 10000,
    durationDays: 365,
    monthlyEquivalent: Math.round(10000 / 12),
    perks: ['Best value — save ₦8,000', 'All approved questions unlocked', 'Priority support'],
  },
};

export function isSubscriptionPlan(value: string): value is SubscriptionPlan {
  return value in SUBSCRIPTION_PLANS;
}

export function planEndDate(plan: SubscriptionPlan, from: Date = new Date()): Date {
  const out = new Date(from);
  out.setUTCDate(out.getUTCDate() + SUBSCRIPTION_PLANS[plan].durationDays);
  return out;
}
