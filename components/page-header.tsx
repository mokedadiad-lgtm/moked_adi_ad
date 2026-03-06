"use client";

/**
 * כותרת עמוד אחידה בכל המסכים: גובה אחיד, spacer להמבורגר במובייל, אותו עיצוב.
 */
export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="sticky top-0 z-10 min-h-14 border-b border-slate-200/80 bg-background md:min-h-0">
      <div className="flex flex-row flex-wrap items-center justify-end gap-2 py-3 text-start md:py-4 md:justify-between">
        <div className="h-10 w-10 shrink-0 md:hidden" aria-hidden />
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-slate-800 md:text-2xl">{title}</h1>
          {subtitle != null && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
        </div>
        {children != null && (
          <div className="flex flex-wrap items-center justify-end gap-2">{children}</div>
        )}
      </div>
    </header>
  );
}
