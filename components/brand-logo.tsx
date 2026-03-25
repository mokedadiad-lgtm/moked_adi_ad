import Image from "next/image";
import { cn } from "@/lib/utils";

type BrandLogoProps = {
  priority?: boolean;
  /** מחלקות לתמונה */
  imageClassName?: string;
};

/**
 * לוגו המערכת (PNG עם שקיפות — ללא עטיפת מסגרת).
 */
export function BrandLogo({ priority, imageClassName }: BrandLogoProps) {
  return (
    <Image
      src="/brand/logo-full.png"
      alt="אסק מי פלוס"
      width={233}
      height={339}
      className={cn(
        "h-auto w-full max-w-[280px] object-contain object-center",
        imageClassName
      )}
      priority={priority}
    />
  );
}
