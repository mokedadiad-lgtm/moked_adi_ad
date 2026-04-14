import { createHash, randomBytes } from "crypto";

/** טוקן גלוי להעתקה לקישור; ב-DB נשמר רק hash */
export function generatePlainToken(): string {
  return randomBytes(24).toString("base64url");
}

export function hashTeamJoinToken(plain: string): string {
  return createHash("sha256").update(plain, "utf8").digest("hex");
}
