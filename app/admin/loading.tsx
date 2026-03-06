export default function AdminLoading() {
  return (
    <div className="flex min-h-[12rem] items-center justify-center" role="status" aria-live="polite">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-primary" />
    </div>
  );
}
