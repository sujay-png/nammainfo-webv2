/**
 * Unified Dynamic Volume Pricing Engine
 * Applied across both Primary and Team Member Cards.
 */

export function getCardUnitPrice(totalCards: number): number {
  if (totalCards >= 25) {
    return 999;
  }
  if (totalCards >= 5) {
    return 1499;
  }
  return 1999;
}

export function calculateInitialProCost(cardQuantity = 1): {
  cardQuantity: number;
  unitPrice: number;
  totalAmount: number;
  extraCards: number;
  extraCost: number;
} {
  const qty = Math.max(1, Number(cardQuantity) || 1);
  const basePrice = 1999;
  const extraCards = qty - 1;
  const extraCost = extraCards * 500;
  const totalAmount = basePrice + extraCost;
  return {
    cardQuantity: qty,
    unitPrice: Math.round(totalAmount / qty),
    totalAmount,
    extraCards,
    extraCost,
  };
}

export function calculatePrimaryCardAddonCost(additionalCards = 1): {
  cardQuantity: number;
  unitPrice: number;
  totalAmount: number;
} {
  const qty = Math.max(1, Number(additionalCards) || 1);
  const unitPrice = 500;
  return {
    cardQuantity: qty,
    unitPrice,
    totalAmount: qty * unitPrice,
  };
}

export function calculateTeamAddonCost(
  currentCards: number,
  additionalCards: number
): {
  unitPrice: number;
  totalAmount: number;
  newTotalCards: number;
} {
  const validAdd = Math.max(1, additionalCards);
  const newTotalCards = currentCards + validAdd;
  const unitPrice = getCardUnitPrice(newTotalCards);
  return {
    unitPrice,
    totalAmount: validAdd * unitPrice,
    newTotalCards,
  };
}

/**
 * Calculates annual renewal cost for the organization.
 *
 * IMPORTANT: Extra physical primary cards (purchased via ₹500 primary_card_addon)
 * are a ONE-TIME hardware/print cost for the same primary business profile.
 * On annual renewal, the owner renews 1 primary subscription + all active
 * team & branch cards — never multiplying extra physical primary cards by ₹1,999.
 */
export function calculateRenewalCost(
  _primaryCards: number,
  activeTeamMembers: number
): {
  totalCards: number;
  primarySubscriptions: number;
  unitPrice: number;
  totalAmount: number;
} {
  const secondaryCount = Math.max(0, Number(activeTeamMembers) || 0);
  const primarySubscriptions = 1;
  const totalCards = primarySubscriptions + secondaryCount;
  const unitPrice = getCardUnitPrice(totalCards);
  return {
    totalCards,
    primarySubscriptions,
    unitPrice,
    totalAmount: totalCards * unitPrice,
  };
}
