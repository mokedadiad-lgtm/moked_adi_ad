/** העדפת תקשורת בפרופילים / טיוטות – ערוץ מייל, וואטסאפ, או שניהם. */

export function wantsEmail(comm: string | null | undefined): boolean {
  return comm === "email" || comm === "both";
}

export function wantsWhatsApp(comm: string | null | undefined): boolean {
  return comm === "whatsapp" || comm === "both";
}
