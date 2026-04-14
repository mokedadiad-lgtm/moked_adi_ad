import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "crypto";

const SALT = "team_join_v1";

function getKey(): Buffer {
  const secret = process.env.TEAM_JOIN_SECRET?.trim();
  if (!secret || secret.length < 16) {
    throw new Error("TEAM_JOIN_SECRET חסר או קצר מדי (הגדרו במשתני סביבה, לפחות 16 תווים)");
  }
  return scryptSync(secret, SALT, 32);
}

/** מחרוזת base64url לשמירה ב-DB */
export function encryptTeamJoinPassword(plain: string): string {
  const key = getKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString("base64url");
}

export function decryptTeamJoinPassword(stored: string): string {
  const key = getKey();
  const buf = Buffer.from(stored, "base64url");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const data = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(data), decipher.final()]).toString("utf8");
}
