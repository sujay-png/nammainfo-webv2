/**
 * Admin shared formatting helpers
 */

export function formatIndianCurrency(amount: number): string {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string | null | undefined): string {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateInput(dateString: string | null | undefined): string {
  if (!dateString) return "";
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return "";
    return d.toISOString().split("T")[0];
  } catch {
    return "";
  }
}

export function getDaysRemaining(
  expiryDateString: string | null | undefined,
  plan?: string
): {
  days: number;
  isExpired: boolean;
  isEndingSoon: boolean;
  isLifetime: boolean;
  label: string;
} {
  // Free tier or unassigned accounts have no active card subscription period
  if (plan === "free") {
    return { days: 0, isExpired: false, isEndingSoon: false, isLifetime: false, label: "N/A" };
  }

  // Lifetime plan
  if (plan === "lifetime") {
    return { days: 99999, isExpired: false, isEndingSoon: false, isLifetime: true, label: "Lifetime" };
  }

  if (!expiryDateString) {
    return { days: 0, isExpired: false, isEndingSoon: false, isLifetime: false, label: "N/A" };
  }

  const expiryDate = new Date(expiryDateString);
  if (isNaN(expiryDate.getTime())) {
    return { days: 0, isExpired: false, isEndingSoon: false, isLifetime: false, label: "N/A" };
  }

  // Lifetime check: year >= 2090
  if (expiryDate.getFullYear() >= 2090) {
    return { days: 99999, isExpired: false, isEndingSoon: false, isLifetime: true, label: "Lifetime" };
  }

  const expiry = expiryDate.getTime();
  const now = Date.now();
  const diffMs = expiry - now;
  const days = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  const isExpired = days <= 0;
  const isEndingSoon = !isExpired && days <= 15;

  let label = `${days} days left`;
  if (isExpired) {
    label = `Expired (${Math.abs(days)}d ago)`;
  } else if (days === 1) {
    label = "1 day left";
  }

  return { days, isExpired, isEndingSoon, isLifetime: false, label };
}

