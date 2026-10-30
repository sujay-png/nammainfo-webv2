import React from "react";
import clsx from "clsx";

export type BadgeVariant =
  | "active"
  | "renew"
  | "suspended"
  | "expired"
  | "pending"
  | "pro"
  | "trial"
  | "lifetime"
  | "enterprise"
  | "free"
  | "na"
  | "default";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  className?: string;
  dot?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  active: "text-emerald-600 dark:text-emerald-400 font-medium",
  renew: "text-amber-500 dark:text-amber-400 font-medium",
  suspended: "text-amber-600 dark:text-amber-400 font-medium",
  expired: "text-red-600 dark:text-red-400 font-medium",
  pending: "text-amber-500 dark:text-amber-400 font-medium",
  pro: "text-[#D4AF37] dark:text-[#F3C95F] font-semibold", // Elegant Gold
  trial: "text-sky-600 dark:text-sky-400 font-semibold", // Free Trial
  lifetime: "text-purple-600 dark:text-purple-400 font-semibold",
  enterprise: "text-indigo-600 dark:text-indigo-400 font-semibold",
  free: "text-[var(--muted-foreground)] font-normal",
  na: "text-[var(--muted-foreground)] font-normal",
  default: "text-[var(--foreground)]",
};

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  className,
}) => {
  return (
    <span
      className={clsx(
        "text-xs tracking-normal select-none inline-block",
        variantStyles[variant] || variantStyles.default,
        className
      )}
    >
      {children}
    </span>
  );
};
