import { cn } from "@/lib/utils";

type SpinnerSize = "sm" | "md" | "lg";

const sizeClass: Record<SpinnerSize, string> = {
  sm: "h-6 w-6 border-[2.5px]",
  md: "h-8 w-8 border-2",
  lg: "h-12 w-12 border-[3px]",
};

const spinnerVariantClass = {
  default: "border-slate-300 border-t-primary",
  /** על רקע primary (כפתור וכו׳) */
  onPrimary: "border-white/35 border-t-white",
} as const;

/**
 * עיגול מסתובב בצבע המותג (primary) — לשימוש ב־loading.tsx וב־Suspense fallback.
 */
export function PageLoadingSpinner({
  size = "md",
  variant = "default",
  className,
}: {
  size?: SpinnerSize;
  variant?: keyof typeof spinnerVariantClass;
  className?: string;
}) {
  return (
    <div
      className={cn(
        sizeClass[size],
        "shrink-0 animate-spin rounded-full",
        spinnerVariantClass[variant],
        className
      )}
      aria-hidden
    />
  );
}

/**
 * מיכל ממורכז עם טקסט נגיש לקוראי מסך.
 */
export function PageLoadingFallback({
  minHeight = "min-h-[12rem]",
  className,
  spinnerSize = "md",
}: {
  minHeight?: string;
  className?: string;
  spinnerSize?: SpinnerSize;
}) {
  return (
    <div
      className={cn("flex w-full items-center justify-center", minHeight, className)}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">טוען…</span>
      <PageLoadingSpinner size={spinnerSize} />
    </div>
  );
}

/** מסך מלא — לדפים שרוצים למלא את התצוגה בזמן Suspense */
export function PageLoadingFullScreen({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex min-h-screen w-full items-center justify-center bg-background", className)}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">טוען…</span>
      <PageLoadingSpinner size="lg" />
    </div>
  );
}
