import React from "react";
import clsx from "clsx";

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  isActive?: boolean;
  onClick?: () => void;
  className?: string;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  subtitle,
  icon,
  isActive = false,
  onClick,
  className,
}) => {
  const isClickable = Boolean(onClick);

  return (
    <div
      onClick={onClick}
      role={isClickable ? "button" : undefined}
      tabIndex={isClickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (isClickable && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onClick?.();
        }
      }}
      className={clsx(
        "group relative select-none rounded-[5px] border p-4 sm:p-5 transition-all duration-150 text-left outline-none",
        isClickable ? "cursor-pointer" : "cursor-default",
        isActive
          ? "border-[var(--foreground)] bg-[var(--accent)]/50 shadow-xs"
          : "border-[var(--border)] bg-[var(--card)] hover:border-[var(--muted-foreground)]/60 hover:bg-[var(--accent)]/30",
        className
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wider text-[var(--muted-foreground)] truncate">
            {title}
          </p>
          <p className="font-headline text-2xl sm:text-3xl font-bold tracking-tight text-[var(--foreground)]">
            {value}
          </p>
        </div>

        {icon && (
          <div className="text-[var(--muted-foreground)] group-hover:text-[var(--foreground)] transition-colors shrink-0 mt-0.5">
            {icon}
          </div>
        )}
      </div>

      {subtitle && (
        <div className="mt-3.5 border-t border-[var(--border)] pt-2.5 text-xs text-[var(--muted-foreground)] font-medium">
          {typeof subtitle === "string" ? (
            <p className="truncate">{subtitle}</p>
          ) : (
            subtitle
          )}
        </div>
      )}
    </div>
  );
};
