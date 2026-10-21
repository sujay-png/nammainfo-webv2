import type { SubscriptionPlanType } from "../../company/model/types";

export interface PlanConfig {
  id: SubscriptionPlanType;
  name: string;
  basePrice: number;
  pricePerId: number;
  physicalCardPrice: number;
  description: string;
}

export const SUBSCRIPTION_PLANS: Record<SubscriptionPlanType, PlanConfig> = {
  free: {
    id: "free",
    name: "Free",
    basePrice: 0,
    pricePerId: 0,
    physicalCardPrice: 999,
    description: "Standard free profile with basic digital card.",
  },
  pro: {
    id: "pro",
    name: "Pro",
    basePrice: 2999,
    pricePerId: 499,
    physicalCardPrice: 699,
    description: "Premium plan with custom cards and team member IDs.",
  },
};

export interface ChargeBreakdown {
  planName: string;
  purchasedIdCount: number;
  basePrice: number;
  idUnitCost: number;
  idTotalCost: number;
  totalEstimatedAmount: number;
}

/**
 * Calculates estimated subscription charge based on plan & quantity of IDs bought.
 * Prepared for plug-and-play wiring to Razorpay / Stripe / in-app subscriptions.
 */
export function calculateSubscriptionCharge(
  plan: SubscriptionPlanType,
  purchasedIdCount: number
): ChargeBreakdown {
  const planInfo = SUBSCRIPTION_PLANS[plan] || SUBSCRIPTION_PLANS.free;
  const count = Math.max(1, purchasedIdCount);
  const idTotalCost = count * planInfo.pricePerId;
  const totalEstimatedAmount = planInfo.basePrice + idTotalCost;

  return {
    planName: planInfo.name,
    purchasedIdCount: count,
    basePrice: planInfo.basePrice,
    idUnitCost: planInfo.pricePerId,
    idTotalCost,
    totalEstimatedAmount,
  };
}
