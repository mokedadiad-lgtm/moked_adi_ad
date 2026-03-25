import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** להריץ אחרי סגירת Radix Dialog — מונע NotFoundError ב-removeChild כשמנקים state באותו רנדר */
export function afterModalClose(fn: () => void) {
  setTimeout(fn, 0);
}
