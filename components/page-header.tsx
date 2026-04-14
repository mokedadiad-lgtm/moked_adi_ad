"use client";

import { cn } from "@/lib/utils";

/**
 * כותרת עמוד אחידה בכל המסכים: גובה אחיד, spacer להמבורגר במובייל, אותו עיצוב.
 */
export function PageHeader({
  title,
  subtitle,
  children,
  className,
  compact = false,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  /** מיזוג ל־header — לדוגמה רקע/גבול לעמוד בודד */
  className?: string;
  /** כותרת נמוכה יותר במובייל, כותרת משנה רק מ־md */
  compact?: boolean;
}) {
  return (
    <header
      className={cn(
        "sticky top-0 z-10 min-h-14 border-b border-slate-200/80 bg-background md:min-h-0",
        compact && "min-h-0",
        className
      )}
    >
      <div
        className={cn(
          "flex flex-row flex-wrap items-center justify-end gap-2 text-start md:justify-between",
          compact ? "py-2 md:py-4" : "py-3 md:py-4"
        )}
      >
        <div className="h-10 w-10 shrink-0 md:hidden" aria-hidden />
        <div className="min-w-0 flex-1">
          <h1
            className={cn(
              "font-bold text-slate-800",
              compact ? "truncate text-lg leading-tight md:mt-0 md:text-2xl" : "text-xl md:text-2xl"
            )}
          >
            {title}
          </h1>
          {subtitle != null && (
            <p
              className={cn(
                "text-sm text-slate-500",
                compact ? "hidden md:mt-1 md:block" : "mt-1"
              )}
            >
              {subtitle}
            </p>
          )}
        </div>
        {children != null && (
          <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
        )}
      </div>
    </header>
  );
}
