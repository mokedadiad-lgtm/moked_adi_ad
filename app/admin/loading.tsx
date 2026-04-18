import { PageLoadingFallback } from "@/components/ui/page-loading";

export default function AdminLoading() {
  return (
    <PageLoadingFallback
      className="w-full"
      minHeight="min-h-[min(60vh,24rem)]"
    />
  );
}
