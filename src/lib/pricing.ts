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

export function calculateInitialProCost(): {
  cardQuantity: number;
  unitPrice: number;
  totalAmount: number;
} {
  const unitPrice = getCardUnitPrice(1);
  return {
    cardQuantity: 1,
    unitPrice,
    totalAmount: unitPrice,
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

export function calculateRenewalCost(
  primaryCards: number,
  activeTeamMembers: number
): {
  totalCards: number;
  unitPrice: number;
  totalAmount: number;
} {
  const totalCards = Math.max(1, primaryCards + activeTeamMembers);
  const unitPrice = getCardUnitPrice(totalCards);
  return {
    totalCards,
    unitPrice,
    totalAmount: totalCards * unitPrice,
  };
}
